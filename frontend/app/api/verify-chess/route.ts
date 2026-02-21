import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { createAdminClient } from '@/utils/supabase/admin'

interface LichessUser {
  id: string;
  name: string;
  title?: string;
  rating?: number;
}

interface LichessPlayer {
  user: LichessUser;
  rating: number;
  ratingDiff?: number;
}

interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  players: {
    white: LichessPlayer;
    black: LichessPlayer;
  };
  winner?: 'white' | 'black';
}

export async function POST(req: NextRequest) {
  try {
    const { challengeId, gameId } = await req.json()

    if (!challengeId || !gameId) {
      return NextResponse.json({ error: 'Missing challengeId or gameId' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Fetch Challenge Data
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('challenges')
      .select('creatorId, challengerId, status, betAmount')
      .eq('id', challengeId)
      .single()

    if (challengeError || !challenge) {
      console.error('Error fetching challenge:', challengeError)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const { creatorId, challengerId, betAmount } = challenge

    // 2. Fetch Lichess Game Data
    let gameData: LichessGame
    try {
      const response = await axios.get(`https://lichess.org/game/export/${gameId}`, {
        params: {
          accept: 'application/json',
          clocks: false,
          opening: false,
          literate: false
        },
        headers: {
          'Accept': 'application/json'
        }
      })
      gameData = response.data
    } catch (error) {
      console.error('Lichess API Error:', error)
      return NextResponse.json({ error: 'Failed to fetch game from Lichess' }, { status: 502 })
    }

    if (!gameData || !gameData.players) {
      return NextResponse.json({ error: 'Invalid game data received from Lichess' }, { status: 500 })
    }

    // 3. Map Lichess Users to Supabase Users
    const whiteLichessId = gameData.players.white.user.id.toLowerCase()
    const blackLichessId = gameData.players.black.user.id.toLowerCase()

    // Fetch game accounts for both players to verify identity
    // We check both LICHESS and generic matches in case platformId isn't strictly enforced yet
    const { data: gameAccounts, error: accountsError } = await supabaseAdmin
      .from('game_accounts')
      .select('userId, gamerTag')
      .in('userId', [creatorId, challengerId])

    if (accountsError || !gameAccounts) {
      console.error('Error fetching game accounts:', accountsError)
      return NextResponse.json({ error: 'Database error fetching game accounts' }, { status: 500 })
    }

    // Find which Supabase user played which color
    let whiteUserId: string | null = null
    let blackUserId: string | null = null

    // Helper to find user by gamer tag (case-insensitive)
    const findUserByTag = (tag: string) => {
      return gameAccounts.find(acc => acc.gamerTag.toLowerCase() === tag.toLowerCase())?.userId
    }

    whiteUserId = findUserByTag(whiteLichessId) || null
    blackUserId = findUserByTag(blackLichessId) || null

    if (!whiteUserId || !blackUserId) {
        // Fallback: If strict mapping fails, check if the challenge creator/challenger
        // tags match the Lichess IDs directly (if stored elsewhere).
        // For now, fail if accounts aren't linked properly.
        return NextResponse.json({
            error: 'Could not map Lichess players to Challenge users. Ensure Lichess accounts are linked.',
            details: { white: whiteLichessId, black: blackLichessId }
        }, { status: 400 })
    }

    // Verify mapping is correct (one is creator, one is challenger)
    const isValidMatch = (whiteUserId === creatorId && blackUserId === challengerId) ||
                         (whiteUserId === challengerId && blackUserId === creatorId)

    if (!isValidMatch) {
       return NextResponse.json({ error: 'Lichess players do not match the challenge participants' }, { status: 400 })
    }

    // 4. Determine Result and Handle Payouts
    const isGameFinished = ['mate', 'resign', 'outoftime', 'timeout', 'draw', 'stalemate', 'cheat', 'noStart', 'unknownFinish', 'variantEnd'].includes(gameData.status) || !!gameData.winner

    if (!isGameFinished) {
      return NextResponse.json({ status: 'PENDING', message: 'Game is not finished yet' })
    }

    // Check if result already processed
    const { data: existingResult } = await supabaseAdmin
        .from('match_results')
        .select('id')
        .eq('challengeId', challengeId)
        .single()

    if (existingResult) {
        return NextResponse.json({ status: 'COMPLETED', message: 'Match result already recorded' })
    }

    let winnerId: string | null = null
    let isDraw = false

    if (gameData.status === 'draw' || gameData.status === 'stalemate' || (!gameData.winner && gameData.status !== 'created' && gameData.status !== 'started')) {
        isDraw = true
    } else if (gameData.winner) {
        winnerId = gameData.winner === 'white' ? whiteUserId : blackUserId
    }

    // 5. Record Match Result (First Step: Prevent Double Spend)
    const { error: resultError } = await supabaseAdmin
        .from('match_results')
        .insert({
            challengeId: challengeId,
            winnerId: winnerId, // Null for draw
            verifiedAt: new Date().toISOString()
        })

    if (resultError) {
        console.error('Error inserting match result:', resultError)
        // If unique constraint violation, it means already processed
        if (resultError.code === '23505') {
             return NextResponse.json({ status: 'COMPLETED', winner: winnerId, message: 'Match already verified' })
        }
        // Other error: stop processing
        return NextResponse.json({ error: 'Failed to record match result' }, { status: 500 })
    }

    // 6. Execute Transactions
    // Helper for safe wallet updates with retry
    const updateWalletSafe = async (userId: string, amount: number) => {
        const MAX_RETRIES = 3
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const { data: wallet, error: fetchError } = await supabaseAdmin
                    .from('wallets')
                    .select('balance')
                    .eq('userId', userId)
                    .single()

                if (fetchError || !wallet) throw new Error('Wallet not found')

                const currentBalance = Number(wallet.balance)
                const newBalance = currentBalance + amount

                const { data: updated, error: updateError } = await supabaseAdmin
                    .from('wallets')
                    .update({ balance: newBalance })
                    .eq('userId', userId)
                    .eq('balance', currentBalance) // Optimistic locking
                    .select()
                    .single()

                if (!updateError && updated) {
                    return true
                }
            } catch (e) {
                console.error(`Wallet update retry ${i+1} failed for user ${userId}`, e)
            }
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        return false
    }

    if (isDraw) {
        // Refund Logic
        console.log(`Game ended in draw. Refunding bet amount ${betAmount} to both players.`)

        const refundCreator = await updateWalletSafe(creatorId, Number(betAmount))
        const refundChallenger = await updateWalletSafe(challengerId, Number(betAmount))

        if (!refundCreator || !refundChallenger) {
             console.error('CRITICAL: Failed to refund one or both players')
             // We continue to update status but log the error. Admin intervention required.
        }

    } else if (winnerId) {
        // Win Logic
        const totalPot = Number(betAmount) * 2
        const commission = totalPot * 0.10
        const payout = totalPot - commission

        console.log(`Game won by ${winnerId}. Pot: ${totalPot}, Commission: ${commission}, Payout: ${payout}`)

        const paid = await updateWalletSafe(winnerId, payout)

        if (!paid) {
            console.error(`CRITICAL: Failed to pay winner ${winnerId} amount ${payout}`)
            // We return error but the match is recorded as verified.
            return NextResponse.json({ error: 'Match verified but payment failed. Contact support.' }, { status: 500 })
        }
    }

    // 7. Update Challenge Status
    await supabaseAdmin
        .from('challenges')
        .update({ status: 'COMPLETED', winnerId: winnerId }) // If draw, winnerId is null, which is correct
        .eq('id', challengeId)

    return NextResponse.json({
        status: 'COMPLETED',
        winner: winnerId,
        isDraw,
        payout: winnerId ? (Number(betAmount) * 2 * 0.9) : 0
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('Verify Chess Error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
