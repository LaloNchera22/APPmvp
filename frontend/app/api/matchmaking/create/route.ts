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
    const { betAmount, type } = await request.json()
    const challengeType = type === 'public' ? 'public' : 'private'

    // Validate input
    if (typeof betAmount !== 'number' || betAmount <= 0) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 })
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

    // 1. Check wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("userId", user.id)
        .single()

    if (walletError || !wallet) {
         return NextResponse.json({ error: 'Error al verificar saldo.' }, { status: 500 })
    }

    const currentBalance = Number(wallet.balance)
    if (currentBalance < betAmount) {
        return NextResponse.json({ error: 'Saldo insuficiente.' }, { status: 400 })
    }

    // 2. Lock Funds (Direct Update)
    const newBalance = currentBalance - betAmount
    const { error: updateError } = await supabaseAdmin
        .from("wallets")
        .update({ balance: newBalance })
        .eq("userId", user.id)
        .eq("balance", currentBalance) // Optimistic locking check

    if (updateError) {
        return NextResponse.json({ error: 'Error al actualizar saldo. Intenta de nuevo.' }, { status: 409 })
    }

    // Helper function for refunds
    const refundUser = async (userId: string, amount: number) => {
        let refundSuccess = false
        let attempts = 0
        while (!refundSuccess && attempts < 3) {
            attempts++
            try {
                const { data: refundWallet } = await supabaseAdmin
                    .from('wallets')
                    .select('balance')
                    .eq('userId', userId)
                    .single()

                if (refundWallet) {
                    const { data: updateData, error: refundError } = await supabaseAdmin
                        .from('wallets')
                        .update({ balance: Number(refundWallet.balance) + amount })
                        .eq('userId', userId)
                        .eq('balance', refundWallet.balance) // Optimistic locking for refund
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
        // Refund creator
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

    // 4. Create Challenge
    let newChallenge;
    let insertError;

    try {
      const result = await supabaseAdmin
        .from('challenges')
        .insert({
          game: 'LICHESS',
          metric: 'MATCH_WINNER',
          betAmount: betAmount,
          status: 'OPEN',
          creatorId: user.id,
          match_type: challengeType,
          lichess_game_id: lichessGameId,
          url_white: urlWhite,
          url_black: urlBlack
        })
        .select()
        .single();

      newChallenge = result.data;
      insertError = result.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      insertError = error;
    }

    if (insertError) {
      console.error('Challenge creation failed:', JSON.stringify(insertError, null, 2));

      // Rollback: Refund safely with retry loop for optimistic locking
      await refundUser(user.id, betAmount)

      return NextResponse.json({
        error: insertError.message || 'Error al crear el reto.',
        details: insertError
      }, { status: 500 })
    }

    return NextResponse.json(newChallenge)

  } catch (err: unknown) {
    console.error('Unexpected error in create challenge:', err)
    return NextResponse.json({
      error: 'Ocurrió un error inesperado.',
    }, { status: 500 })
  }
}
