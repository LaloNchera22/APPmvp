import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { Chess } from 'chess.js'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { challengeId, result, winnerId } = await request.json()

    if (!challengeId || !result) {
      return NextResponse.json({ error: 'Missing challengeId or result' }, { status: 400 })
    }

    if (result === 'win' && !winnerId) {
        return NextResponse.json({ error: 'Missing winnerId for win result' }, { status: 400 })
    }

    let supabaseAdmin
    try {
      supabaseAdmin = createAdminClient()
    } catch (e) {
      console.error('Failed to create admin client:', e)
      return NextResponse.json(
        { error: 'Error de configuración del servidor.' },
        { status: 500 }
      )
    }

    // 1. Fetch Challenge Data
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (challengeError || !challenge) {
      console.error('Error fetching challenge:', challengeError)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Validate participants
    if (user.id !== challenge.creatorId && user.id !== challenge.challengerId) {
        return NextResponse.json({ error: 'Not a participant in this challenge' }, { status: 403 })
    }

    // If already completed, return success
    if (challenge.status === 'COMPLETED') {
         return NextResponse.json({ status: 'COMPLETED', message: 'Match already completed' })
    }

    if (challenge.status !== 'IN_PROGRESS') {
         return NextResponse.json({ error: 'Challenge is not in progress' }, { status: 400 })
    }

    // 2. Server-Side FEN Validation
    if (!challenge.fen) {
         return NextResponse.json({ error: 'Partida no iniciada o estado inválido.' }, { status: 400 })
    }

    const game = new Chess()
    try {
        game.load(challenge.fen)
    } catch (e) {
        console.error("Invalid FEN state in DB:", e)
        return NextResponse.json({ error: 'Estado de partida corrupto.' }, { status: 500 })
    }

    if (!game.isGameOver()) {
        return NextResponse.json({ error: 'La partida sigue en curso. Payout denegado.' }, { status: 403 })
    }

    let serverResult = null
    let serverWinnerId = null

    if (game.isCheckmate()) {
        serverResult = 'win'
        const turn = game.turn()
        // If it's black's turn to move and they are checkmated, white (creator) won.
        serverWinnerId = turn === 'b' ? challenge.creatorId : challenge.challengerId
    } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
        serverResult = 'draw'
    }

    if (!serverResult || serverResult !== result) {
        return NextResponse.json({ error: 'El resultado solicitado no coincide con el estado del servidor.' }, { status: 403 })
    }

    if (serverResult === 'win' && serverWinnerId !== winnerId) {
        return NextResponse.json({ error: 'El ganador solicitado no coincide con el estado del servidor.' }, { status: 403 })
    }

    const { creatorId, challengerId, betAmount } = challenge
    const isDraw = serverResult === 'draw'

    // 3. Update Challenge Status (Optimistic Lock)
    // We update status first to prevent double spending via race conditions
    const finalWinnerId = isDraw ? null : winnerId;
    const { error: updateChallengeError } = await supabaseAdmin
        .from('challenges')
        .update({
            status: 'COMPLETED',
            winnerId: finalWinnerId
        })
        .eq('id', challengeId)
        .neq('status', 'COMPLETED') // Ensure we only complete once
        .select()
        .single() // Forces an error if no rows are updated

    if (updateChallengeError) {
        // If error or no rows updated, likely already completed (or race condition handled)
        return NextResponse.json({ status: 'COMPLETED', message: 'Partida ya verificada o no se pudo actualizar.' })
    }

    // 3. Execute Transactions (Direct Update - No RPC)
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
        await updateWalletSafe(challengerId!, bet)
    } else if (finalWinnerId) {
        // Payout Winner
        // Total pool is 2X. The winner receives 190% of their bet. The remaining 10% stays in platform.
        const baseBet = Number(betAmount)
        const payout = baseBet * 1.90 // Original 100% + 90% of opponent's bet

        await updateWalletSafe(finalWinnerId, payout)
    }

    return NextResponse.json({
        status: 'COMPLETED',
        winner: finalWinnerId,
        isDraw
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('Finish Matchmaking Error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}