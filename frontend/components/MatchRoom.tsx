'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, ExternalLink, Trophy, Swords } from 'lucide-react'

interface MatchRoomProps {
  playerUrl: string
  matchId: string
}

export default function MatchRoom({ playerUrl, matchId }: MatchRoomProps) {
  const [isValidating, setIsValidating] = useState(true)
  const [lichessId, setLichessId] = useState<string | null>(null)
  const supabase = createClient()
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const { data } = await supabase
          .from('challenges')
          .select('lichess_game_id')
          .eq('id', matchId)
          .single()

        if (data?.lichess_game_id) {
          setLichessId(data.lichess_game_id)
        }
      } catch (error) {
        console.error('Error fetching challenge:', error)
      }
    }

    fetchChallenge()
  }, [matchId, supabase])

  useEffect(() => {
    const checkResult = async () => {
      try {
        const { data } = await supabase
          .from('match_results')
          .select('*')
          .eq('challengeId', matchId)
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

  if (lichessId) {
    return (
      <div className="yeezy-card w-full h-[600px] md:h-[700px] max-w-5xl mx-auto relative overflow-hidden p-0 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
        <iframe
          src={`https://lichess.org/${lichessId}`}
          className="w-full h-full border-none"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="yeezy-card p-8 max-w-2xl mx-auto text-center relative overflow-hidden shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
      {/* Header */}
      <div className="relative z-10 mb-8">
        <div className="inline-flex items-center justify-center p-4 bg-foreground border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] mb-6">
           <Swords className="w-8 h-8 text-background" />
        </div>
        <h2 className="text-4xl font-black text-foreground uppercase tracking-tighter">
          ¡Duelo Encontrado!
        </h2>
      </div>

      {/* Action Button */}
      <div className="relative z-10 mb-10">
        <a
          href={playerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex items-center gap-3 px-8 py-5 yeezy-button text-xl w-full max-w-sm justify-center"
        >
          <span>IR A LA PARTIDA</span>
          <ExternalLink className="w-6 h-6 group-hover:rotate-45 transition-transform duration-300" />
        </a>
      </div>

      {/* Instructions */}
      <div className="relative z-10 text-left bg-yeezy-light p-6 border-4 border-foreground mb-8 shadow-[4px_4px_0px_0px_rgba(17,17,17,1)]">
        <h3 className="text-lg font-black text-foreground uppercase tracking-tighter mb-4 border-b-4 border-foreground pb-2">
          Instrucciones
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-foreground font-bold">
            <li className="pl-2">Juega tu partida en Chess.com.</li>
            <li className="pl-2">Al terminar, el sistema validará el resultado automáticamente.</li>
        </ol>
      </div>

      {/* Validation State */}
      <div className="relative z-10 border-t-4 border-foreground pt-8">
        {isValidating ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-foreground animate-spin" />
            <p className="text-foreground text-sm font-bold uppercase animate-pulse">
              Esperando resultado final...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="p-4 bg-green-200 border-4 border-green-700 shadow-[4px_4px_0px_0px_rgba(21,128,61,1)]">
                <Trophy className="w-8 h-8 text-green-800" />
            </div>
            <div>
                <p className="text-green-800 font-black uppercase text-xl">¡Resultado Validado!</p>
                <p className="text-green-700/80 text-sm font-bold uppercase mt-2">La partida ha finalizado correctamente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
