"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Loader2, Play, ExternalLink, AlertCircle, Swords, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface Challenge {
  id: string
  status: string
  betAmount: number
  creatorId: string
  challengerId: string
  lichess_game_id?: string
  url_white?: string
  url_black?: string
  winnerId?: string
}

export default function PlayMatchRoom() {
  const params = useParams()
  const router = useRouter()
  const challengeId = params.id as string
  const supabase = createClient()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Verification State
  const [verifying, setVerifying] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<'IDLE' | 'COMPLETED' | 'PENDING' | 'ERROR'>('IDLE')

  const fetchChallenge = async () => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single()

      if (error) throw error
      setChallenge(data as unknown as Challenge)
      if (data.status === 'COMPLETED') {
        setVerifyStatus('COMPLETED')
      }
    } catch (e) {
      console.error("Error fetching challenge:", e)
      setError("No se pudo cargar la partida.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
    fetchChallenge()

    // Realtime subscription
    const channel = supabase
      .channel(`play_room_${challengeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `id=eq.${challengeId}` },
        (payload) => {
          setChallenge(payload.new as unknown as Challenge)
          if (payload.new.status === 'COMPLETED') {
            setVerifyStatus('COMPLETED')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId])

  const handleVerify = async () => {
      if (!challenge?.lichess_game_id) return
      setVerifying(true)
      setVerifyMessage("")
      setVerifyStatus('PENDING')

      try {
          const response = await fetch('/api/verify-chess', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  challengeId: challenge.id,
                  gameId: challenge.lichess_game_id
              })
          })

          const data = await response.json()

          if (!response.ok) {
              setVerifyStatus('ERROR')
              setVerifyMessage(data.error || 'Error al verificar. Asegúrate de tener tu cuenta de Lichess vinculada.')
              return
          }

          if (data.status === 'COMPLETED') {
               setVerifyStatus('COMPLETED')
               // Give time for UI update
               setTimeout(() => fetchChallenge(), 1000)
          } else {
               setVerifyStatus('PENDING')
               setVerifyMessage(data.message || 'La partida sigue en curso.')
          }

      } catch (err) {
          console.error(err)
          setVerifyStatus('ERROR')
          setVerifyMessage('Error de conexión al verificar.')
      } finally {
          setVerifying(false)
      }
  }

  if (loading) {
      return (
          <div className="flex items-center justify-center min-h-[50vh] flex-col gap-4 font-pixel uppercase">
             <Loader2 className="w-12 h-12 animate-spin text-foreground" />
             <p className="text-foreground animate-pulse">Cargando partida...</p>
          </div>
      )
  }

  if (error || !challenge) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
              <div className="bg-red-100 border-4 border-red-600 p-8 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]">
                 <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                 <h2 className="text-2xl font-black text-red-700 uppercase mb-2">Error</h2>
                 <p className="text-red-600 font-bold uppercase">{error || "Reto no encontrado"}</p>
                 <Button onClick={() => router.push("/dashboard")} className="mt-6 yeezy-button w-full">Volver al Dashboard</Button>
              </div>
          </div>
      )
  }

  if (challenge.status === 'OPEN') {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
              <div className="bg-yellow-100 border-4 border-yellow-600 p-8 shadow-[8px_8px_0px_0px_rgba(202,138,4,1)]">
                 <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                 <h2 className="text-2xl font-black text-yellow-700 uppercase mb-2">Reto no iniciado</h2>
                 <p className="text-yellow-600 font-bold uppercase">Este reto aún no ha sido aceptado por tu oponente.</p>
                 <Button onClick={() => router.push(`/dashboard/match/${challenge.id}`)} className="mt-6 yeezy-button w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 border-yellow-600">Ver Detalles</Button>
              </div>
          </div>
      )
  }

  let playerUrl = ""
  if (currentUserId === challenge.creatorId) {
      playerUrl = challenge.url_white || ""
  } else {
      playerUrl = challenge.url_black || ""
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 font-mono pb-20">
      <div className="flex items-center gap-4 bg-background border-4 border-foreground p-4 shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
          <div className="bg-foreground text-background p-3 flex-shrink-0">
             <Swords className="w-8 h-8" />
          </div>
          <div>
              <h1 className="text-2xl md:text-3xl font-pixel uppercase text-foreground leading-tight">Partida en Curso</h1>
              <p className="text-foreground/80 font-bold uppercase text-sm md:text-base mt-1">Lichess • ${challenge.betAmount} USD</p>
          </div>
      </div>

      <div className="bg-background border-4 border-foreground p-6 shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
          {challenge.status === 'IN_PROGRESS' && challenge.lichess_game_id ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="flex justify-center mb-6">
                      <a
                        href={playerUrl || `https://lichess.org/${challenge.lichess_game_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="yeezy-button w-full max-w-sm flex items-center justify-center gap-3 py-4 text-lg font-bold uppercase"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Abrir en Lichess (App)
                        <ExternalLink className="w-5 h-5" />
                      </a>
                  </div>

                  <div className="aspect-[4/3] w-full bg-foreground border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] overflow-hidden">
                    <iframe
                      src={playerUrl || `https://lichess.org/${challenge.lichess_game_id}`}
                      className="w-full h-full"
                      frameBorder="0"
                      allowTransparency={true}
                    />
                  </div>

                  <div className="space-y-4 pt-8">
                       <Button
                          onClick={handleVerify}
                          disabled={verifying}
                          className={`w-full font-bold h-16 text-xl transition-all duration-300 ${
                              verifying
                              ? 'bg-foreground/20 text-foreground/50 border-4 border-foreground/20 cursor-not-allowed rounded-none'
                              : 'yeezy-button'
                          }`}
                          >
                          {verifying ? (
                              <>
                              <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                              Verificando...
                              </>
                          ) : (
                              "VERIFICAR RESULTADO"
                          )}
                        </Button>

                        <AnimatePresence mode="wait">
                          {verifyStatus !== 'IDLE' && verifyStatus !== 'COMPLETED' && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 border-4 text-sm font-bold uppercase flex items-start gap-3 ${
                                  verifyStatus === 'ERROR'
                                  ? 'bg-red-100 border-red-600 text-red-700'
                                  : 'bg-yellow-100 border-yellow-500 text-yellow-800'
                              }`}>
                                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                  <span className="text-base">{verifyMessage}</span>
                              </motion.div>
                          )}
                        </AnimatePresence>
                  </div>
              </div>
          ) : challenge.status === 'COMPLETED' ? (
              <div className="text-center py-12 space-y-8">
                  <div className="inline-block border-4 border-foreground p-6 bg-yeezy-light shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
                      <Trophy className="w-20 h-20 text-foreground" />
                  </div>
                  <div className="space-y-4">
                      <h3 className="text-4xl font-black uppercase">Partida Finalizada</h3>
                      <p className="text-foreground/80 text-lg font-bold uppercase">Esta partida ya ha concluido y los premios han sido entregados.</p>
                  </div>

                  {challenge.winnerId ? (
                     <div className="p-6 bg-foreground text-background border-4 border-foreground max-w-sm mx-auto shadow-[8px_8px_0px_0px_rgba(244,244,240,1)]">
                        <p className="text-background/80 font-bold uppercase mb-2">Ganador</p>
                        <p className="text-background font-black text-3xl uppercase">
                            {challenge.winnerId === currentUserId ? "¡TÚ!" : "Oponente"}
                        </p>
                     </div>
                  ) : (
                     <div className="p-6 bg-yeezy-light text-foreground border-4 border-foreground max-w-sm mx-auto shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
                        <p className="text-foreground/80 font-bold uppercase mb-2">Resultado</p>
                        <p className="text-foreground font-black text-3xl uppercase">Empate</p>
                     </div>
                  )}

                  <Button onClick={() => router.push("/dashboard")} className="yeezy-button px-8 py-6 text-lg h-auto mt-8 w-full max-w-sm">
                      Volver al Dashboard
                  </Button>
              </div>
          ) : (
            <div className="text-center py-10 font-bold uppercase text-foreground/60">
              <p>Cargando estado de la partida...</p>
            </div>
          )}
      </div>
    </div>
  )
}
