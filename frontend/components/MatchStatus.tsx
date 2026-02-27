"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import { Loader2, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MatchStatusProps {
  challengeId: string
}

export default function MatchStatus({ challengeId }: MatchStatusProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'IDLE' | 'COMPLETED' | 'PENDING' | 'ERROR'>('IDLE')
  const [message, setMessage] = useState('')
  const [newBalance, setNewBalance] = useState<string | null>(null)
  const supabase = createClient()

  const handleVerify = async () => {
    setLoading(true)
    setMessage('')
    setStatus('IDLE')

    try {
      const res = await fetch('/api/verify-chess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al verificar la partida')
      }

      if (data.status === 'COMPLETED') {
        setStatus('COMPLETED')

        // Fetch new balance
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: wallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("userId", user.id)
            .single()

            if (wallet) {
                setNewBalance(Number(wallet.balance).toFixed(2))
            }
             // Dispatch event to update Navbar
             window.dispatchEvent(new Event('balanceUpdated'))
        }
      } else {
        setStatus('PENDING')
        setMessage(data.message || 'La partida no ha terminado o no se encontró.')
      }

    } catch (error: unknown) {
      console.error(error)
      setStatus('ERROR')
      const err = error as Error
      setMessage(err.message || 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto yeezy-card relative">
       <CardHeader className="text-center pb-2 relative z-10 border-b-4 border-foreground">
         <CardTitle className="text-xl font-black text-foreground uppercase flex items-center justify-center gap-2">
           Estado de la Partida
         </CardTitle>
       </CardHeader>

       <CardContent className="space-y-6 relative z-10 pt-6">
         <div className="flex flex-col items-center gap-4">
           <a
             href="https://www.chess.com"
             target="_blank"
             rel="noopener noreferrer"
             className="group w-full"
           >
             <Button
                variant="outline"
                className="w-full py-6 text-base"
             >
               <ExternalLink className="w-5 h-5 mr-2" />
               Ir a Chess.com
             </Button>
           </a>

           <AnimatePresence mode="wait">
             {status === 'COMPLETED' ? (
               <motion.div
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="flex flex-col items-center text-center space-y-4 p-6 bg-green-200 border-4 border-green-700 w-full shadow-[4px_4px_0px_0px_rgba(21,128,61,1)]"
               >
                 <motion.div
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   transition={{ type: "spring", stiffness: 200, damping: 10 }}
                 >
                   <CheckCircle className="w-12 h-12 text-green-800" />
                 </motion.div>
                 <h3 className="text-xl font-black text-green-800 uppercase">¡Partida Finalizada!</h3>
                 <p className="text-sm font-bold text-green-700/80 uppercase">El resultado ha sido verificado.</p>
                 {newBalance && (
                   <motion.div
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.3 }}
                     className="mt-4 px-6 py-4 bg-background border-4 border-green-800 text-foreground w-full"
                   >
                     <p className="text-xs text-foreground/60 font-bold uppercase tracking-wider mb-1">Nuevo Balance</p>
                     <p className="text-2xl font-pixel font-bold">${newBalance}</p>
                   </motion.div>
                 )}
               </motion.div>
             ) : (
               <div className="w-full space-y-4">
                 <Button
                   onClick={handleVerify}
                   disabled={loading}
                   className={`w-full py-6 text-base ${
                     loading
                       ? 'bg-foreground/20 text-foreground/50 border-4 border-foreground/20 cursor-not-allowed'
                       : 'yeezy-button'
                   }`}
                 >
                   {loading ? (
                     <>
                       <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                       Verificando...
                     </>
                   ) : (
                     <>
                       <CheckCircle className="w-5 h-5 mr-2" />
                       ¡Ya terminé mi partida!
                     </>
                   )}
                 </Button>

                 {/* Status Messages */}
                 <AnimatePresence>
                   {(status === 'PENDING' || status === 'ERROR') && (
                     <motion.div
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       className={`p-4 border-4 text-sm font-bold uppercase flex items-start gap-3 ${
                         status === 'ERROR'
                           ? 'bg-red-100 border-red-600 text-red-700'
                           : 'bg-yellow-100 border-yellow-500 text-yellow-800'
                       }`}
                     >
                       <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                       <span>{message}</span>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
             )}
           </AnimatePresence>
         </div>
       </CardContent>
    </Card>
  )
}
