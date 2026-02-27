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
        game: 'CHESS_COM',
        metric: 'MATCH_WINNER',
        betAmount: betAmount,
        status: 'OPEN',
        creatorId: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Challenge creation failed:', insertError)

      // Rollback: Refund safely with retry loop for optimistic locking
      let refundSuccess = false
      let attempts = 0
      while (!refundSuccess && attempts < 3) {
          attempts++
          const { data: refundWallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('userId', user.id)
            .single()

          if (refundWallet) {
              const { data: updateData, error: refundError } = await supabaseAdmin
                .from('wallets')
                .update({ balance: Number(refundWallet.balance) + betAmount })
                .eq('userId', user.id)
                .eq('balance', refundWallet.balance) // Optimistic locking for refund
                .select()

              if (!refundError && updateData && updateData.length > 0) {
                  refundSuccess = true
              }
          }
      }

      if (!refundSuccess) {
          console.error(`CRITICAL: Failed to refund ${betAmount} to user ${user.id} after challenge creation failed.`)
      }

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
