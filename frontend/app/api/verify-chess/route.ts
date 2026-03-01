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

    // If already completed, return success
    if (challenge.status === 'COMPLETED') {
         return NextResponse.json({ status: 'COMPLETED', message: 'Match already completed' })
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
    // We need to know who is who.
    // Strategy: We check if the Lichess usernames match any `game_accounts` linked to our users.

    const whiteLichessId = gameData.players.white?.user?.id?.toLowerCase()
    const blackLichessId = gameData.players.black?.user?.id?.toLowerCase()

    if (!whiteLichessId || !blackLichessId) {
        return NextResponse.json({ error: 'Game not started or players missing' }, { status: 400 })
    }

    // Fetch game accounts for both players to verify identity
    const { data: gameAccounts, error: accountsError } = await supabaseAdmin
      .from('game_accounts')
      .select('userId, gamerTag')
      .in('userId', [creatorId, challengerId])

    if (accountsError || !gameAccounts) {
      console.error('Error fetching game accounts:', accountsError)
      return NextResponse.json({ error: 'Database error fetching game accounts' }, { status: 500 })
    }

    // Find which Supabase user played which color
    const findUserByTag = (tag: string) => {
      // Simple exact match (case insensitive)
      return gameAccounts.find(acc => acc.gamerTag.toLowerCase() === tag)?.userId
    }

    const whiteUserId = findUserByTag(whiteLichessId)
    const blackUserId = findUserByTag(blackLichessId)

    // Verification: We need to ensure that the Lichess players CORRESPOND to the Challenge participants.
    // If we can't map them, we can't payout.
    if (!whiteUserId || !blackUserId) {
        // Fallback: Check if we can assume identity based on who verified? No, risky.
        // We must return an error asking users to link their Lichess accounts.
        return NextResponse.json({
            error: 'No se pudieron identificar los usuarios de Lichess. Asegúrense de tener sus cuentas vinculadas en Perfil.',
            details: { white: whiteLichessId, black: blackLichessId }
        }, { status: 400 })
    }

    const participants = [creatorId, challengerId]
    if (!participants.includes(whiteUserId) || !participants.includes(blackUserId)) {
         return NextResponse.json({ error: 'Los jugadores de Lichess no coinciden con el reto.' }, { status: 400 })
    }

    // 4. Determine Result
    const isGameFinished = ['mate', 'resign', 'outoftime', 'timeout', 'draw', 'stalemate', 'cheat', 'noStart', 'unknownFinish', 'variantEnd'].includes(gameData.status) || !!gameData.winner

    if (!isGameFinished) {
      return NextResponse.json({ status: 'PENDING', message: 'La partida sigue en curso.' })
    }

    let winnerId: string | null = null
    let isDraw = false

    if (gameData.status === 'draw' || gameData.status === 'stalemate' || (!gameData.winner && gameData.status !== 'created' && gameData.status !== 'started')) {
        isDraw = true
    } else if (gameData.winner) {
        winnerId = gameData.winner === 'white' ? whiteUserId : blackUserId
    }

    // 5. Update Challenge Status (Optimistic Lock)
    // We update status first to prevent double spending via race conditions
    const { error: updateChallengeError } = await supabaseAdmin
        .from('challenges')
        .update({
            status: 'COMPLETED',
            winnerId: winnerId
        })
        .eq('id', challengeId)
        .neq('status', 'COMPLETED') // Ensure we only complete once

    if (updateChallengeError) {
        // If error or no rows updated, likely already completed
        return NextResponse.json({ status: 'COMPLETED', message: 'Partida ya verificada.' })
    }

    // 6. Execute Transactions (Direct Update - No RPC)
    const updateWalletSafe = async (userId: string, amount: number) => {
        try {
            const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('userId', userId).single()
            if (wallet) {
                const currentBalance = Number(wallet.balance)
                await supabaseAdmin
                    .from('wallets')
                    .update({ balance: currentBalance + amount })
                    .eq('userId', userId)
                    .eq('balance', currentBalance)
                return true
            }
        } catch (e) {
            console.error(`Payout failed for user ${userId}`, e)
        }
        return false
    }

    if (isDraw) {
        // Refund
        const bet = Number(betAmount)
        await updateWalletSafe(creatorId, bet)
        await updateWalletSafe(challengerId, bet)
    } else if (winnerId) {
        // Payout Winner
        // Total pool is 2X. The winner receives 190% of their bet. The remaining 10% stays in platform.
        const baseBet = Number(betAmount)
        const payout = baseBet * 1.90 // Original 100% + 90% of opponent's bet

        await updateWalletSafe(winnerId, payout)
    }

    return NextResponse.json({
        status: 'COMPLETED',
        winner: winnerId,
        isDraw
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('Verify Chess Error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
