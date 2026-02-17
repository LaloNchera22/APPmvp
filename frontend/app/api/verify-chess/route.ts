import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { createAdminClient } from '@/utils/supabase/admin'

interface ChessPlayer {
  rating: number;
  result: string;
  username: string;
  uuid: string;
  '@id': string;
}

interface ChessGame {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  tcn: string;
  uuid: string;
  initial_setup: string;
  fen: string;
  time_class: string;
  rules: string;
  white: ChessPlayer;
  black: ChessPlayer;
}

export async function POST(req: NextRequest) {
  try {
    const { challengeId } = await req.json()

    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 })
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

    const { creatorId, challengerId } = challenge

    // 2. Fetch Gamer Tags
    // Assumption: game_accounts table has userId, platformId, gamerTag columns
    // We assume 'CHESS_COM' is the platform identifier for Chess.com.
    const { data: gameAccounts, error: accountsError } = await supabaseAdmin
      .from('game_accounts')
      .select('userId, gamerTag')
      .in('userId', [creatorId, challengerId])
      .eq('platformId', 'CHESS_COM')

    if (accountsError) {
      console.error('Error fetching game accounts:', accountsError)
      return NextResponse.json({ error: 'Database error fetching game accounts' }, { status: 500 })
    }

    if (!gameAccounts || gameAccounts.length < 2) {
      return NextResponse.json({ error: 'Game accounts not found for both players (need platformId="CHESS_COM")' }, { status: 400 })
    }

    const creatorAccount = gameAccounts.find(acc => acc.userId === creatorId)
    const challengerAccount = gameAccounts.find(acc => acc.userId === challengerId)

    if (!creatorAccount?.gamerTag || !challengerAccount?.gamerTag) {
       return NextResponse.json({ error: 'Missing gamer tags for one or both players' }, { status: 400 })
    }

    const creatorUsername = creatorAccount.gamerTag
    const challengerUsername = challengerAccount.gamerTag

    // 3. Fetch Chess.com Archives for Creator
    // Using creator's username to find games.
    const archivesUrl = `https://api.chess.com/pub/player/${creatorUsername}/games/archives`

    let archivesResponse;
    try {
        archivesResponse = await axios.get(archivesUrl)
    } catch (e) {
        console.error('Chess.com API Error:', e)
        return NextResponse.json({ error: 'Failed to fetch Chess.com archives' }, { status: 502 })
    }

    const archives = archivesResponse.data.archives

    if (!archives || archives.length === 0) {
      return NextResponse.json({ status: 'PENDING', message: 'No game archives found on Chess.com' })
    }

    // Get the latest archive (current month usually)
    const latestArchiveUrl = archives[archives.length - 1]

    // 4. Fetch Games from Latest Archive
    const gamesResponse = await axios.get(latestArchiveUrl)
    const games = gamesResponse.data.games as ChessGame[]

    if (!games || games.length === 0) {
      return NextResponse.json({ status: 'PENDING', message: 'No games in latest archive' })
    }

    // 5. Find Match vs Challenger
    // Filter by opponent and sort by end_time descending to get the very last game
    const relevantGames = games
      .filter((game: ChessGame) => {
        const white = game.white.username.toLowerCase()
        const black = game.black.username.toLowerCase()
        const targetCreator = creatorUsername.toLowerCase()
        const targetChallenger = challengerUsername.toLowerCase()

        // Check if this game involves both players
        const hasCreator = white === targetCreator || black === targetCreator
        const hasChallenger = white === targetChallenger || black === targetChallenger

        return hasCreator && hasChallenger
      })
      .sort((a: ChessGame, b: ChessGame) => b.end_time - a.end_time)

    if (relevantGames.length === 0) {
      return NextResponse.json({ status: 'PENDING', message: 'No match found between players in latest archive' })
    }

    const latestGame = relevantGames[0]

    // 6. Determine Winner
    // If the game is still going, result won't be definitive usually, but 'win' indicates completion.

    let winnerUserId: string | null = null;

    const whiteUsername = latestGame.white.username.toLowerCase()
    const blackUsername = latestGame.black.username.toLowerCase()

    // Check result
    // Chess.com results: 'win', 'checkmated', 'abandoned', 'timeout', 'resigned', 'stalemate', 'lose', 'insufficient', '50move', 'repetition', 'agreed'

    // We only care if someone WON.
    if (latestGame.white.result === 'win') {
        if (whiteUsername === creatorUsername.toLowerCase()) winnerUserId = creatorId
        else if (whiteUsername === challengerUsername.toLowerCase()) winnerUserId = challengerId
    } else if (latestGame.black.result === 'win') {
        if (blackUsername === creatorUsername.toLowerCase()) winnerUserId = creatorId
        else if (blackUsername === challengerUsername.toLowerCase()) winnerUserId = challengerId
    }

    if (winnerUserId) {
        // 7. Implement 100% Payment Logic

        // First, check if match is already verified to prevent double payment
        const { data: existingResult } = await supabaseAdmin
            .from('match_results')
            .select('id')
            .eq('challengeId', challengeId)
            .single()

        if (existingResult) {
            return NextResponse.json({ status: 'COMPLETED', winner: winnerUserId, message: 'Match already verified' })
        }

        // Insert into match_results
        const { error: resultError } = await supabaseAdmin
            .from('match_results')
            .insert({
                challengeId: challengeId,
                winnerId: winnerUserId,
                verifiedAt: new Date().toISOString()
            })

        if (resultError) {
            console.error('Error inserting match result:', resultError)
            // If error is duplicate key, it means it was just verified.
            if (resultError.code === '23505') { // Unique violation
                 return NextResponse.json({ status: 'COMPLETED', winner: winnerUserId, message: 'Match already verified' })
            }
            return NextResponse.json({ error: 'Failed to record match result' }, { status: 500 })
        }

        // Transfer funds: Winner gets 2 * betAmount (Return bet + Winnings)
        // Funds were locked (deducted) at start, so we just ADD to winner.
        // If betAmount is 0 (free game), we skip wallet update or add 0.

        const payout = challenge.betAmount * 2

        if (payout > 0) {
            // Update Winner's Wallet with optimistic locking retry logic
            const updateWallet = async (userId: string, amount: number) => {
                const MAX_RETRIES = 3
                for (let i = 0; i < MAX_RETRIES; i++) {
                    try {
                        const { data: wallet, error: fetchError } = await supabaseAdmin
                            .from('wallets')
                            .select('balance')
                            .eq('userId', userId)
                            .single()

                        if (fetchError || !wallet) continue

                        const currentBalance = Number(wallet.balance)
                        const newBalance = currentBalance + amount

                        const { data: updated, error: updateError } = await supabaseAdmin
                            .from('wallets')
                            .update({ balance: newBalance })
                            .eq('userId', userId)
                            .eq('balance', currentBalance)
                            .select()
                            .single()

                        if (!updateError && updated) return true
                    } catch (e) {
                        console.error("Wallet update error:", e)
                    }
                }
                return false
            }

            const paid = await updateWallet(winnerUserId, payout)
            if (!paid) {
                console.error(`CRITICAL: Failed to pay winner ${winnerUserId} amount ${payout} for challenge ${challengeId}`)
                // Manual intervention might be needed here.
                // We return error but match_results is already inserted, effectively "locking" the state.
                return NextResponse.json({ error: 'Match verified but payment failed. Contact support.' }, { status: 500 })
            }
        }

        // Update Challenge Status to COMPLETED
        await supabaseAdmin
            .from('challenges')
            .update({ status: 'COMPLETED' })
            .eq('id', challengeId)

        return NextResponse.json({ status: 'COMPLETED', winner: winnerUserId, gameUrl: latestGame.url })
    } else {
        // Draw or no clear winner (e.g. both 'agreed')
        return NextResponse.json({ status: 'PENDING', message: 'Match ended in draw or no clear winner yet', result: { white: latestGame.white.result, black: latestGame.black.result } })
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Verify Chess Error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
