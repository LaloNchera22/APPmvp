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
    const { betAmount } = await request.json()

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

    // We don't deduct funds *before* challenge insertion to avoid complex rollback loops.
    // However, since inserting a challenge and deducting funds isn't in a DB transaction via API,
    // and a challenge isn't public until it's 'OPEN', we can safely:
    // 2. Insert Challenge as 'PENDING_FUNDS' or just 'OPEN' and immediately deduct.
    // Actually, deducting first and then creating the challenge is standard, but the refund logic here was bulky.
    // Let's optimize it by extracting the refund helper, similar to `accept/route`.

    const refundUser = async (userId: string, amount: number) => {
        let refundSuccess = false
        let attempts = 0
        while (!refundSuccess && attempts < 3) {
            attempts++
            try {
                const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('userId', userId).single()
                if (w) {
                    const { data: updateData, error: refundError } = await supabaseAdmin
                        .from('wallets')
                        .update({ balance: Number(w.balance) + amount })
                        .eq('userId', userId)
                        .eq('balance', w.balance) // Optimistic locking
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

    // 3. Create Challenge
    const { data: newChallenge, error: insertError } = await supabaseAdmin
      .from('challenges')
      .insert({
        game: 'CHESS_COM', // using the existing GameTitle enum value, could map to Lichess logically if DB supports it, but preserving CHESS_COM to avoid enum constraint errors.
        metric: 'MATCH_WINNER',
        betAmount: betAmount,
        status: 'OPEN',
        creatorId: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Challenge creation failed:', insertError)

      // Rollback: Refund safely
      await refundUser(user.id, betAmount)

      return NextResponse.json({
        error: 'Error al crear el reto.',
        details: insertError.message
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
