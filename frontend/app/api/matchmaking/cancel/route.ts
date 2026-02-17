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

    // 1. Get challenge to check amount (and existence)
    const { data: challenge, error: fetchError } = await supabaseAdmin
      .from('challenges')
      .select('betAmount, status, creatorId')
      .eq('id', challengeId)
      .single()

    if (fetchError || !challenge) {
      return NextResponse.json({ error: 'Reto no encontrado.' }, { status: 404 })
    }

    if (challenge.creatorId !== user.id) {
        return NextResponse.json({ error: 'No tienes permiso para cancelar este reto.' }, { status: 403 })
    }

    // 2. Mark as CANCELLED atomically to prevent race conditions (e.g. acceptance)
    const { data: updated, error: updateError } = await supabaseAdmin
        .from('challenges')
        .update({ status: 'CANCELLED' })
        .eq('id', challengeId)
        .eq('status', 'OPEN') // Critical: Only cancel if still OPEN
        .select()
        .single()

    if (updateError || !updated) {
        return NextResponse.json({
            error: 'No se pudo cancelar el reto. Es posible que ya haya iniciado o sido cancelado.'
        }, { status: 400 })
    }

    // 3. Unlock funds
    const betAmount = Number(challenge.betAmount)
    if (betAmount > 0) {
        const { error: unlockError } = await supabaseAdmin.rpc('unlock_bet', {
            p_user_id: user.id,
            p_amount: betAmount
        })

        if (unlockError) {
            console.error('Unlock bet failed:', unlockError)
            // Critical failure: Funds are stuck. Challenge is CANCELLED.
            // User needs support.
            return NextResponse.json({
                error: 'Error al reembolsar fondos. Contacta a soporte.',
                details: unlockError.message
            }, { status: 500 })
        }
    }

    // 4. Delete challenge (Cleanup)
    const { error: deleteError } = await supabaseAdmin
        .from('challenges')
        .delete()
        .eq('id', challengeId)

    if (deleteError) {
        console.error('Final deletion failed:', deleteError)
        // Non-critical: Challenge remains as CANCELLED.
    }

    return NextResponse.json({ success: true })

  } catch (err: unknown) {
    console.error('Unexpected error in cancel challenge:', err)
    return NextResponse.json({
      error: 'Ocurrió un error inesperado.',
    }, { status: 500 })
  }
}
