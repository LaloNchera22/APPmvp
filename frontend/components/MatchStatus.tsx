"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import { Loader2, CheckCircle, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface MatchStatusProps {
  challengeId: string
}

export default function MatchStatus({ challengeId }: MatchStatusProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'IDLE' | 'COMPLETED' | 'PENDING' | 'ERROR'>('IDLE')
  const [message, setMessage] = useState('')
  const [newBalance, setNewBalance] = useState<string | null>(null)
  const [winnerId, setWinnerId] = useState<string | null>(null)
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
        setWinnerId(data.winner)

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

    } catch (error: any) {
      console.error(error)
      setStatus('ERROR')
      setMessage(error.message || 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-[#050505]/80 border-white/10 backdrop-blur-md shadow-xl overflow-hidden relative">
       {/* Ambient Glow */}
       <div className="absolute -top-20 -right-20 w-60 h-60 bg-neon-magenta/10 blur-[80px] rounded-full pointer-events-none" />
       <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-neon-cyan/10 blur-[80px] rounded-full pointer-events-none" />

       <CardHeader className="text-center pb-2 relative z-10">
         <CardTitle className="text-xl font-bold text-white flex items-center justify-center gap-2">
           Estado de la Partida
         </CardTitle>
       </CardHeader>

       <CardContent className="space-y-6 relative z-10">
         <div className="flex flex-col items-center gap-4">
           <a
             href="https://www.chess.com"
             target="_blank"
             rel="noopener noreferrer"
             className="group w-full"
           >
             <Button
                variant="outline"
                className="w-full border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan hover:border-neon-cyan/60 transition-all duration-300"
             >
               <ExternalLink className="w-4 h-4 mr-2" />
               Ir a Chess.com
             </Button>
           </a>

           <AnimatePresence mode="wait">
             {status === 'COMPLETED' ? (
               <motion.div
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="flex flex-col items-center text-center space-y-2 p-4 bg-green-500/10 border border-green-500/20 rounded-xl w-full"
               >
                 <motion.div
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   transition={{ type: "spring", stiffness: 200, damping: 10 }}
                 >
                   <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
                 </motion.div>
                 <h3 className="text-lg font-bold text-green-400">¡Partida Finalizada!</h3>
                 <p className="text-sm text-gray-300">El resultado ha sido verificado.</p>
                 {newBalance && (
                   <motion.div
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.3 }}
                     className="mt-2 px-4 py-2 bg-black/40 rounded-lg border border-white/5"
                   >
                     <p className="text-xs text-gray-400 uppercase tracking-wider">Nuevo Balance</p>
                     <p className="text-xl font-mono font-bold text-white">${newBalance}</p>
                   </motion.div>
                 )}
               </motion.div>
             ) : (
               <div className="w-full space-y-4">
                 <Button
                   onClick={handleVerify}
                   disabled={loading}
                   className={`w-full font-bold transition-all duration-300 ${
                     loading
                       ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                       : 'bg-neon-magenta hover:bg-neon-magenta/80 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)]'
                   }`}
                 >
                   {loading ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       Verificando...
                     </>
                   ) : (
                     <>
                       <CheckCircle className="w-4 h-4 mr-2" />
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
                       className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${
                         status === 'ERROR'
                           ? 'bg-red-500/10 border-red-500/20 text-red-400'
                           : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                       }`}
                     >
                       <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
