import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
export async function POST(request: Request) {
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

try {
const { challengeId } = await request.json()
if (!challengeId) return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 })

const supabaseAdmin = createAdminClient()
// 1. Obtener el reto
const { data: challenge, error: fetchError } = await supabaseAdmin
  .from('challenges')
  .select('betAmount, status, creatorId')
  .eq('id', challengeId)
  .single()
if (fetchError || !challenge) return NextResponse.json({ error: 'Reto no encontrado.' }, { status: 404 })
if (challenge.creatorId !== user.id) return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
// 2. Devolver fondos
const betAmount = Number(challenge.betAmount)
if (betAmount > 0) {
    const { error: unlockError } = await supabaseAdmin.rpc('unlock_bet', { p_user_id: user.id, p_amount: betAmount })
    if (unlockError) throw unlockError
}
// 3. Borrar definitivamente
const { error: deleteError } = await supabaseAdmin.from('challenges').delete().eq('id', challengeId)
if (deleteError) throw deleteError
return NextResponse.json({ success: true })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (err: any) {
return NextResponse.json({ error: err.message || 'Error inesperado al cancelar.' }, { status: 500 })
}
}
