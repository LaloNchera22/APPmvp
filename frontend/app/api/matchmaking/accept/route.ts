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

    const betAmount = challenge.betAmount
    const isDirectInvite = !!challenge.challengerId

    // If it's a direct invite, the challengerId MUST match the user accepting (if set)
    if (isDirectInvite && challenge.challengerId !== user.id) {
       return NextResponse.json({ error: 'Este reto no es para ti.' }, { status: 403 })
    }

    // Helper function for refunds
    const refundUser = async (userId: string, amount: number) => {
      const MAX_RETRIES = 3
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const { data: wallet, error: fetchError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('userId', userId)
            .single()

          if (fetchError || !wallet) continue

          const currentBalance = Number(wallet.balance)
          const newBalance = currentBalance + Number(amount)

          const { data: updatedWallet, error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('userId', userId)
            .eq('balance', currentBalance)
            .select()
            .single()

          if (updateError) {
              console.error(`Refund failed for user ${userId} (Attempt ${i + 1}): Update error`, updateError)
              continue
          }

          if (updatedWallet) return true
        } catch (e) {
          console.error(`Refund exception for user ${userId}:`, e)
        }
      }
      return false
    }

    // 2. Lock Funds

    // 2a. Lock Challenger Funds (Always)
    const { error: challengerLockError } = await supabaseAdmin.rpc('lock_bet', {
      p_user_id: user.id,
      p_amount: betAmount
    })

    if (challengerLockError) {
      console.error('Challenger lock failed:', challengerLockError)
      return NextResponse.json({
        error: challengerLockError.message || 'Error al procesar el pago.',
        details: challengerLockError.details,
        hint: challengerLockError.hint,
        code: challengerLockError.code
      }, { status: 400 })
    }

    // 3. Create Lichess Game (NEW)
    let lichessData
    try {
        const lichessResponse = await fetch('https://lichess.org/api/challenge/open', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.LICHESS_API_TOKEN}`
            },
            // Body can be empty for default open challenge
        })

        if (!lichessResponse.ok) {
            throw new Error(`Lichess API error: ${lichessResponse.statusText}`)
        }

        lichessData = await lichessResponse.json()
    } catch (e) {
        console.error("Error creating Lichess game:", e)
        // If Lichess fails, refund challenger and abort
        await refundUser(user.id, betAmount)
        return NextResponse.json({ error: 'Error al crear la partida en Lichess.' }, { status: 502 })
    }

    // Extract ID and URL
    // Handle both wrapped { challenge: { ... } } and flat { id: ... } responses
    const lichessGameId = lichessData.challenge?.id || lichessData.id
    const lichessGameUrl = lichessData.challenge?.url || lichessData.url || `https://lichess.org/${lichessGameId}`

    if (!lichessGameId) {
        console.error("Invalid Lichess response:", lichessData)
        await refundUser(user.id, betAmount)
        return NextResponse.json({ error: 'Respuesta inválida de Lichess.' }, { status: 502 })
    }

    // 4. Update Challenge (IN_PROGRESS)
    // Critical: Check status is STILL 'OPEN' to prevent race conditions
    const { data: updatedChallenge, error: updateError } = await supabaseAdmin
      .from('challenges')
      .update({
        status: 'IN_PROGRESS',
        challengerId: user.id,
        lichess_game_id: lichessGameId, // New column for Lichess ID
        gameLink: lichessGameUrl // Update gameLink for frontend compatibility
      })
      .eq('id', challengeId)
      .eq('status', 'OPEN')
      .select()
      .single()

    if (updateError || !updatedChallenge) {
      console.error('Challenge update error or race condition:', updateError)

      // Rollback: Refund Challenger
      await refundUser(user.id, betAmount)

      return NextResponse.json({
        error: 'No se pudo actualizar el reto. Es posible que alguien más lo haya aceptado.',
        details: updateError?.message
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
