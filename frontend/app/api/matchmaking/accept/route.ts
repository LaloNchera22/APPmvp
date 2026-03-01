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
        let refundSuccess = false
        let attempts = 0
        while (!refundSuccess && attempts < 3) {
            attempts++
            try {
                const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('userId', userId).single()
                if (wallet) {
                    const { data: updateData, error: refundError } = await supabaseAdmin
                        .from('wallets')
                        .update({ balance: Number(wallet.balance) + amount })
                        .eq('userId', userId)
                        .eq('balance', wallet.balance) // Optimistic locking
                        .select()

                    if (!refundError && updateData && updateData.length > 0) {
                        refundSuccess = true
                    }
                }
            } catch (e) {
                console.error(`Attempt ${attempts} to refund failed for user ${userId}:`, e)
            }
        }
        if (!refundSuccess) {
            console.error(`CRITICAL: Failed to refund ${amount} to user ${userId} after 3 attempts.`)
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
        const bodyStr = new URLSearchParams({
            'clock.limit': '600',
            'clock.increment': '0',
            'name': `Reto ${betAmount} USD`
        }).toString()

        const lichessResponse = await fetch('https://lichess.org/api/challenge/open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyStr
        })

        if (!lichessResponse.ok) {
            const errText = await lichessResponse.text()
            console.error('Lichess API error text:', errText)
            throw new Error(`Lichess API error: ${lichessResponse.statusText} - ${errText}`)
        }

        lichessData = await lichessResponse.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        console.error("Error creating Lichess game:", JSON.stringify(e, null, 2))
        // Refund challenger
        await refundUser(user.id, betAmount)
        return NextResponse.json({ error: e.message || 'Error al crear la partida en Lichess.', details: e }, { status: 502 })
    }

    // Extract ID and URLs
    const lichessGameId = lichessData.challenge?.id || lichessData.id
    const urlWhite = lichessData.urlWhite || lichessData.challenge?.url || lichessData.url
    const urlBlack = lichessData.urlBlack || lichessData.challenge?.url || lichessData.url

    if (!lichessGameId || !urlWhite || !urlBlack) {
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
        url_white: urlWhite,
        url_black: urlBlack
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
      url_black: updatedChallenge.url_black
    })

  } catch (err: unknown) {
    console.error('Unexpected error in accept challenge:', err)
    return NextResponse.json({
      error: 'Ocurrió un error inesperado.',
    }, { status: 500 })
  }
}
