import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { challengeId } = await request.json()

    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 })
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

    // 1. Get challenge from challenges table (Must be OPEN)
    const { data: challenge, error: fetchError } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('status', 'OPEN')
      .single()

    if (fetchError || !challenge) {
      return NextResponse.json({ error: 'Reto no disponible o ya aceptado.' }, { status: 404 })
    }

    if (challenge.creatorId === user.id) {
      return NextResponse.json({ error: 'No puedes aceptar tu propio reto.' }, { status: 400 })
    }

    const betAmount = Number(challenge.betAmount)
    const isDirectInvite = !!challenge.challengerId

    // If it's a direct invite, the challengerId MUST match the user accepting (if set)
    if (isDirectInvite && challenge.challengerId !== user.id) {
       return NextResponse.json({ error: 'Este reto no es para ti.' }, { status: 403 })
    }

    // Helper function for refunds
    const refundUser = async (userId: string, amount: number) => {
        try {
            const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('userId', userId).single()
            if (wallet) {
                await supabaseAdmin
                    .from('wallets')
                    .update({ balance: Number(wallet.balance) + amount })
                    .eq('userId', userId)
            }
        } catch (e) {
            console.error(`Refund failed for user ${userId}:`, e)
        }
    }

    // 2. Lock Funds (Direct Update - No RPC)
    const { data: wallet, error: walletError } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('userId', user.id)
        .single()

    if (walletError || !wallet) {
        return NextResponse.json({ error: 'Error al verificar saldo.' }, { status: 500 })
    }

    const currentBalance = Number(wallet.balance)
    if (currentBalance < betAmount) {
        return NextResponse.json({ error: 'Saldo insuficiente.' }, { status: 400 })
    }

    const newBalance = currentBalance - betAmount
    const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({ balance: newBalance })
        .eq('userId', user.id)
        .eq('balance', currentBalance) // Optimistic locking

    if (updateError) {
         return NextResponse.json({ error: 'Error al procesar el pago. Intenta de nuevo.' }, { status: 409 })
    }

    // 3. Create Lichess Game
    let lichessData
    try {
        const lichessResponse = await fetch('https://lichess.org/api/challenge/open', {
            method: 'POST',
            headers: {
                // If we want the bot to be the creator? No, open challenges are anonymous usually unless authenticated.
                // If we use a token, the account owning the token creates it.
                'Authorization': `Bearer ${process.env.LICHESS_API_TOKEN}`
            },
            body: JSON.stringify({
                clock: { limit: 600, increment: 0 }, // Example: 10 mins
                name: `Reto ${betAmount} USD`
            })
        })

        if (!lichessResponse.ok) {
            throw new Error(`Lichess API error: ${lichessResponse.statusText}`)
        }

        lichessData = await lichessResponse.json()
    } catch (e) {
        console.error("Error creating Lichess game:", e)
        // Refund challenger
        await refundUser(user.id, betAmount)
        return NextResponse.json({ error: 'Error al crear la partida en Lichess.' }, { status: 502 })
    }

    // Extract ID and URL
    // Lichess response format for /api/challenge/open: { challenge: { id: "...", url: "..." } } OR { id: "...", url: "..." } depending on endpoint version/docs.
    // Usually /api/challenge/open returns { challenge: { id, url, ... }, urlWhite: "...", urlBlack: "..." } if strictly open?
    // Let's assume standard response based on previous code or docs. Previous code handled both.
    const lichessGameId = lichessData.challenge?.id || lichessData.id
    const lichessGameUrl = lichessData.challenge?.url || lichessData.url || `https://lichess.org/${lichessGameId}`

    if (!lichessGameId) {
        console.error("Invalid Lichess response:", lichessData)
        await refundUser(user.id, betAmount)
        return NextResponse.json({ error: 'Respuesta inválida de Lichess.' }, { status: 502 })
    }

    // 4. Update Challenge (IN_PROGRESS)
    // Critical: Check status is STILL 'OPEN' to prevent race conditions
    const { data: updatedChallenge, error: challengeUpdateError } = await supabaseAdmin
      .from('challenges')
      .update({
        status: 'IN_PROGRESS',
        challengerId: user.id,
        lichess_game_id: lichessGameId,
        gameLink: lichessGameUrl
      })
      .eq('id', challengeId)
      .eq('status', 'OPEN')
      .select()
      .single()

    if (challengeUpdateError || !updatedChallenge) {
      console.error('Challenge update error or race condition:', challengeUpdateError)

      // Rollback: Refund Challenger
      await refundUser(user.id, betAmount)

      return NextResponse.json({
        error: 'No se pudo actualizar el reto. Es posible que alguien más lo haya aceptado.',
        details: challengeUpdateError?.message
      }, { status: 500 })
    }

    return NextResponse.json({
      challengeId: updatedChallenge.id,
      gameLink: updatedChallenge.gameLink
    })

  } catch (err: unknown) {
    console.error('Unexpected error in accept challenge:', err)
    return NextResponse.json({
      error: 'Ocurrió un error inesperado.',
    }, { status: 500 })
  }
}
