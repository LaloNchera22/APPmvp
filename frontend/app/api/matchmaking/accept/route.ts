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

    // 2. Check Funds (Don't deduct yet)
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

    // 3. Create Lichess Game (Open-Ended Challenge)
    // We create the game BEFORE deducting funds. Lichess games are free,
    // so if this succeeds but later steps fail, we just abandon the link.
    let lichessData
    try {
        const params = new URLSearchParams()
        params.append('clock.limit', '600')
        params.append('clock.increment', '0')
        params.append('name', `Reto ${betAmount} USD`)

        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        }

        // Add Auth Token if available to link the game to an account, but it's optional for open challenges
        if (process.env.LICHESS_API_TOKEN) {
             (fetchOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${process.env.LICHESS_API_TOKEN}`
        }

        const lichessResponse = await fetch('https://lichess.org/api/challenge/open', fetchOptions)

        if (!lichessResponse.ok) {
            const errorText = await lichessResponse.text()
            console.error('Lichess API error response body:', errorText)
            throw new Error(`Lichess API error: ${lichessResponse.status} ${lichessResponse.statusText} - ${errorText}`)
        }

        lichessData = await lichessResponse.json()
    } catch (e) {
        console.error("Error creating Lichess game:", e)
        // No refund needed here because we haven't deducted funds yet!
        return NextResponse.json({ error: 'Error al crear la partida en Lichess.' }, { status: 502 })
    }

    // Extract URLs from response
    const lichessGameId = lichessData.challenge?.id || lichessData.id
    const urlWhite = lichessData.urlWhite
    const urlBlack = lichessData.urlBlack

    if (!lichessGameId || !urlWhite || !urlBlack) {
        console.error("Invalid Lichess response. Missing ID or Links:", lichessData)
        return NextResponse.json({ error: 'Respuesta inválida de Lichess.' }, { status: 502 })
    }

    // 4. Deduct Funds (Now that Lichess is ready)
    const newBalance = currentBalance - betAmount
    const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({ balance: newBalance })
        .eq('userId', user.id)
        .eq('balance', currentBalance) // Optimistic locking

    if (updateError) {
         // Lichess game is created but ignored since we fail here. No funds are deducted.
         return NextResponse.json({ error: 'Error al procesar el pago. Intenta de nuevo.' }, { status: 409 })
    }

    // We store urlWhite in gameLink for the creator, and urlBlack in a JSON string alongside it or just map it
    // Since we don't know if the challenger_link column exists, we can encode both inside gameLink
    // Actually, we can use the original logic where both players just join via lichessGameId (Lichess assigns colors randomly if they just join).
    // BUT the prompt explicitly says: "Asigna urlWhite al creador del reto y guarda urlBlack en la base de datos para el oponente."
    // Let's create a combined JSON string for gameLink to avoid schema issues, or assume we can add a column.
    // To be safe without altering schema, we save both in `gameLink` as JSON and parse them on the client.
    // Wait! The user prompt explicitly states "guarda urlBlack en la base de datos para el oponente".
    // I will stringify it into gameLink: JSON.stringify({ white: urlWhite, black: urlBlack })
    const combinedGameLink = JSON.stringify({ white: urlWhite, black: urlBlack })

    // 5. Update Challenge (IN_PROGRESS)
    // Critical: Check status is STILL 'OPEN' to prevent race conditions
    const { data: updatedChallenge, error: challengeUpdateError } = await supabaseAdmin
      .from('challenges')
      .update({
        status: 'IN_PROGRESS',
        challengerId: user.id,
        lichess_game_id: lichessGameId,
        gameLink: combinedGameLink
      })
      .eq('id', challengeId)
      .eq('status', 'OPEN')
      .select()
      .single()

    if (challengeUpdateError || !updatedChallenge) {
      console.error('Challenge update error or race condition:', challengeUpdateError)

      // Rollback: Refund Challenger because they WERE deducted in step 4
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
