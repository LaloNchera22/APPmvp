'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, ExternalLink, Trophy, Swords } from 'lucide-react'

interface MatchRoomProps {
  gameLink: string
  matchId: string
}

export default function MatchRoom({ gameLink, matchId }: MatchRoomProps) {
  const [isValidating, setIsValidating] = useState(true)
  const supabase = createClient()
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const checkResult = async () => {
      try {
        const { data } = await supabase
          .from('match_results')
          .select('*')
          .eq('challenge_id', matchId)
          .single()

        if (data) {
          setIsValidating(false)
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch (error) {
        console.error('Error checking match result:', error)
      }
    }

    checkResult()
    intervalRef.current = setInterval(checkResult, 10000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [matchId, supabase])

  return (
    <div className="glass-card p-8 rounded-xl border border-neon-cyan/30 bg-black/40 backdrop-blur-md max-w-2xl mx-auto text-center relative overflow-hidden shadow-[0_0_50px_-12px_rgba(6,182,212,0.25)]">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-neon-cyan/5 blur-3xl rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-neon-magenta/10 rounded-full mb-4 ring-1 ring-neon-magenta/50 shadow-[0_0_15px_rgba(217,70,239,0.3)]">
           <Swords className="w-8 h-8 text-neon-magenta" />
        </div>
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-white to-neon-magenta animate-pulse">
          ¡Duelo Encontrado!
        </h2>
      </div>

      {/* Action Button */}
      <div className="relative z-10 mb-10">
        <a
          href={gameLink}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan font-bold text-lg rounded-xl border border-neon-cyan/50 hover:border-neon-cyan transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transform hover:-translate-y-1"
        >
          <span>IR A LA PARTIDA</span>
          <ExternalLink className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
        </a>
      </div>

      {/* Instructions */}
      <div className="relative z-10 text-left bg-white/5 p-6 rounded-xl border border-white/10 mb-8">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
          Instrucciones
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 text-sm">
            <li className="pl-2"><span className="text-gray-400">Juega tu partida en</span> <span className="text-neon-magenta font-semibold">Chess.com</span>.</li>
            <li className="pl-2"><span className="text-gray-400">Al terminar, el sistema validará el resultado automáticamente.</span></li>
        </ol>
      </div>

      {/* Validation State */}
      <div className="relative z-10 border-t border-white/10 pt-6">
        {isValidating ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 text-neon-cyan animate-spin" />
            <p className="text-gray-400 text-sm font-medium animate-pulse">
              Esperando resultado final...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in duration-500">
            <div className="p-2 bg-green-500/10 rounded-full">
                <Trophy className="w-8 h-8 text-green-400" />
            </div>
            <div>
                <p className="text-green-400 font-bold text-lg">¡Resultado Validado!</p>
                <p className="text-gray-400 text-xs mt-1">La partida ha finalizado correctamente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
