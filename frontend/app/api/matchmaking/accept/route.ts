import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Add environment variable check at the start
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Server configuration error: Missing Supabase URL or Service Role Key')
    return NextResponse.json(
      { error: 'Error de configuración del servidor.' },
      { status: 500 }
    )
  }

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

    // 2b. Lock Creator Funds (ONLY if not already locked - i.e., NOT a direct invite)
    if (!isDirectInvite) {
        const { error: creatorLockError } = await supabaseAdmin.rpc('lock_bet', {
            p_user_id: challenge.creatorId,
            p_amount: betAmount
        })

        if (creatorLockError) {
            // Rollback: Refund Challenger
            await refundUser(user.id, betAmount)

            return NextResponse.json({
                error: 'El creador del reto ya no tiene fondos suficientes. Se ha cancelado el reto.',
                details: 'Creator funds lock failed'
            }, { status: 400 })
        }
    }

    // 3. Generate Game Link
    let gameLink = "https://www.chess.com/play/online"
    try {
        const { data: gameAccounts } = await supabaseAdmin
            .from('game_accounts')
            .select('userId, gamerTag')
            .in('userId', [challenge.creatorId, user.id])
            .eq('platformId', 'CHESS_COM')

        const creatorAccount = gameAccounts?.find(acc => acc.userId === challenge.creatorId)
        const challengerAccount = gameAccounts?.find(acc => acc.userId === user.id)

        if (creatorAccount?.gamerTag && challengerAccount?.gamerTag) {
             gameLink = `https://www.chess.com/play/online/new?opponent=${encodeURIComponent(creatorAccount.gamerTag)}`
        }
    } catch (e) {
        console.error("Error generating link:", e)
    }

    // 4. Update Challenge (IN_PROGRESS)
    // Critical: Check status is STILL 'OPEN' to prevent race conditions
    const { data: updatedChallenge, error: updateError } = await supabaseAdmin
      .from('challenges')
      .update({
        status: 'IN_PROGRESS',
        challengerId: user.id,
        gameLink: gameLink
      })
      .eq('id', challengeId)
      .eq('status', 'OPEN')
      .select()
      .single()

    if (updateError || !updatedChallenge) {
      console.error('Challenge update error or race condition:', updateError)

      // Rollback: Refund Challenger
      await refundUser(user.id, betAmount)

      // Rollback: Refund Creator (ONLY if we locked them here)
      if (!isDirectInvite) {
          await refundUser(challenge.creatorId, betAmount)
      }

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
      // Ensure no sensitive details are leaked
    }, { status: 500 })
  }
}
