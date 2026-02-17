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
    const { betAmount, game } = await request.json()

    if (typeof betAmount !== 'number' || betAmount <= 0) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 })
    }

    if (!game) {
        return NextResponse.json({ error: 'Juego requerido.' }, { status: 400 })
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

    // 2. Lock Funds
    const { error: lockError } = await supabaseAdmin.rpc('lock_bet', {
      p_user_id: user.id,
      p_amount: betAmount
    })

    if (lockError) {
      console.error('Lock bet failed:', lockError)
      return NextResponse.json({
        error: lockError.message || 'Error al procesar la apuesta.',
        details: lockError.details,
        hint: lockError.hint,
        code: lockError.code
      }, { status: 400 })
    }

    // 3. Create Challenge
    const { data: newChallenge, error: insertError } = await supabaseAdmin
      .from('challenges')
      .insert({
        game: game, // e.g. "CHESS_COM"
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
      await supabaseAdmin.rpc('unlock_bet', {
          p_user_id: user.id,
          p_amount: betAmount
      })

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
