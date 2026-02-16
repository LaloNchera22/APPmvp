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
      .select('creatorId, challengerId, status')
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
        // 7. Call RPC resolve_match_payment
        // Using Service Role to execute payment
        const { error: rpcError } = await supabaseAdmin.rpc('resolve_match_payment', {
            p_challenge_id: challengeId,
            p_winner_id: winnerUserId
        })

        if (rpcError) {
            console.error('RPC resolve_match_payment Error:', rpcError)
            return NextResponse.json({ error: 'Payment resolution failed: ' + rpcError.message }, { status: 500 })
        }

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
