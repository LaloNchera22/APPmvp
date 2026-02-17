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
    const { proposalId } = await request.json()

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Get proposal to verify amount and creator
    const { data: proposal, error: fetchError } = await supabaseAdmin
      .from('active_proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada o ya fue aceptada.' }, { status: 404 })
    }

    if (proposal.userId === user.id) {
      return NextResponse.json({ error: 'No puedes aceptar tu propia propuesta.' }, { status: 400 })
    }

    // Helper function for refunds with optimistic locking and retries
    const refundUser = async (userId: string, amount: number) => {
      const MAX_RETRIES = 3
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          // 1. Get current balance
          const { data: wallet, error: fetchError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('userId', userId)
            .single()

          if (fetchError || !wallet) {
            console.error(`Refund failed for user ${userId} (Attempt ${i + 1}): Could not fetch wallet`, fetchError)
            continue
          }

          const currentBalance = Number(wallet.balance)
          const newBalance = currentBalance + Number(amount)

          // 2. Optimistic Update: Update only if balance matches what we just read
          const { data: updatedWallet, error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('userId', userId)
            .eq('balance', currentBalance) // Optimistic lock
            .select()
            .single()

          if (updateError) {
             console.error(`Refund failed for user ${userId} (Attempt ${i + 1}): Update error`, updateError)
             continue
          }

          if (updatedWallet) {
             console.log(`Refund successful for user ${userId}: ${amount} returned. New balance: ${updatedWallet.balance}`)
             return true
          } else {
             // If no data returned, it means the row was not updated (likely balance changed by another transaction)
             console.warn(`Refund retry for user ${userId} (Attempt ${i + 1}): Balance mismatch (Optimistic Lock)`)
             // Loop continues to retry
          }
        } catch (e) {
          console.error(`Refund exception for user ${userId}:`, e)
        }
      }
      return false
    }

    // 2. Lock Challenger Funds first (to avoid touching creator if challenger is broke)
    const { error: challengerLockError } = await supabaseAdmin.rpc('lock_bet', {
      p_user_id: user.id,
      p_amount: proposal.betAmount
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

    // 3. Lock Creator Funds
    const { error: creatorLockError } = await supabaseAdmin.rpc('lock_bet', {
      p_user_id: proposal.userId,
      p_amount: proposal.betAmount
    })

    if (creatorLockError) {
      console.error('Creator lock failed:', creatorLockError)

      // Rollback: Refund Challenger
      const refundSuccess = await refundUser(user.id, proposal.betAmount)

      const refundMsg = refundSuccess
        ? 'Se ha reembolsado tu apuesta.'
        : 'ERROR CRÍTICO: No se pudo reembolsar tu apuesta. Contacta a soporte inmediatamente.'

      return NextResponse.json({
        error: `El creador de la propuesta ya no tiene fondos suficientes. Se ha cancelado el reto. ${refundMsg}`,
        details: 'Creator funds lock failed',
        serverError: creatorLockError // Return raw error for debugging if needed
      }, { status: 400 })
    }

    // 4. Insert Challenge
    const { data: challenge, error: insertError } = await supabaseAdmin
      .from('challenges')
      .insert({
        game: 'CHESS', // specific to this matchmaking page context
        metric: 'MATCH_WINNER',
        betAmount: proposal.betAmount,
        status: 'ACCEPTED',
        creatorId: proposal.userId,
        challengerId: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Challenge insert error:', insertError)

      // Rollback: Refund Challenger AND Creator
      const refundChallenger = await refundUser(user.id, proposal.betAmount)
      const refundCreator = await refundUser(proposal.userId, proposal.betAmount)

      const refundMsg = (refundChallenger && refundCreator)
        ? 'Se ha reembolsado el dinero a ambas partes.'
        : 'ERROR CRÍTICO: Falló el reembolso automático. Contacta a soporte.'

      return NextResponse.json({
        error: `Error al crear el reto: ${insertError.message}. ${refundMsg}`,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      }, { status: 500 })
    }

    // 5. Delete Proposal
    const { error: deleteError } = await supabaseAdmin
      .from('active_proposals')
      .delete()
      .eq('id', proposalId)

    if (deleteError) {
      console.error('Failed to delete proposal:', deleteError)
      // Not critical, but we should probably log it.
    }

    // 6. Cleanup Challenger's own proposals (if any)
    await supabaseAdmin
      .from('active_proposals')
      .delete()
      .eq('userId', user.id)

    return NextResponse.json({ challengeId: challenge.id })

  } catch (err) {
    console.error('Unexpected error in accept challenge:', err)
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 })
  }
}
