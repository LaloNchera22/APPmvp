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

      // Rollback: Refund
      await supabaseAdmin
        .from("wallets")
        .update({ balance: currentBalance }) // Restore original balance (approximate if race condition, but simple refund is +betAmount)
        // Safer refund:
        // .rpc('increment_balance', { ... }) if we had it, but here we do read-modify-write again or just set it back if we assume single thread per user mostly.
        // Better:
        // const { data: currentWallet } = await supabaseAdmin.from('wallets').select('balance').eq('userId', user.id).single()
        // await supabaseAdmin.from('wallets').update({ balance: currentWallet.balance + betAmount })...

      // Since we just deducted, let's add it back safely.
      const { data: refundWallet } = await supabaseAdmin.from('wallets').select('balance').eq('userId', user.id).single()
      if (refundWallet) {
          await supabaseAdmin.from('wallets').update({ balance: Number(refundWallet.balance) + betAmount }).eq('userId', user.id)
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
