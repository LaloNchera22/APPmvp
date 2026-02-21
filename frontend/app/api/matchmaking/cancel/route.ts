import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { challengeId } = await request.json()

    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Consultar el reto
    const { data: challenge, error: fetchError } = await supabaseAdmin
      .from('challenges')
      .select('id, status, creatorId, betAmount')
      .eq('id', challengeId)
      .single()

    if (fetchError || !challenge) {
      return NextResponse.json({ error: 'Reto no encontrado.' }, { status: 404 })
    }

    if (challenge.status !== 'OPEN') {
      return NextResponse.json({ error: 'El reto no está abierto.' }, { status: 400 })
    }

    if (challenge.creatorId !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso para cancelar este reto.' }, { status: 403 })
    }

    // 2. Ejecutar RPC unlock_bet
    const { error: unlockError } = await supabaseAdmin.rpc('unlock_bet', {
      p_user_id: user.id,
      p_amount: challenge.betAmount
    })

    if (unlockError) {
      console.error('Error unlocking bet:', unlockError)
      return NextResponse.json({ error: 'Error al reembolsar la apuesta.' }, { status: 500 })
    }

    // 3. Borrar definitivamente el reto
    const { error: deleteError } = await supabaseAdmin
      .from('challenges')
      .delete()
      .eq('id', challengeId)

    if (deleteError) {
      console.error('Error deleting challenge:', deleteError)
      // Aunque falle el borrado, el dinero ya se devolvió.
      // Se podría considerar un estado inconsistente, pero el flujo principal se completó.
      // El usuario pidió borrarlo. Si falla, retornamos error o éxito?
      // "Retornar una respuesta exitosa 200. Maneja los errores devolviendo un JSON con un mensaje claro si el RPC falla."
      // No especifica qué hacer si falla el delete, pero asumiré que es crítico.
      return NextResponse.json({ error: 'Error al eliminar el reto.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in cancel challenge:', error)
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 })
  }
}
