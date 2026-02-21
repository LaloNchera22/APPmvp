"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, CheckCircle, ExternalLink, AlertCircle, Copy, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"

interface Challenge {
  id: string
  game: string
  status: string
  betAmount?: number | null
  creatorId: string
  challengerId: string
  gameLink?: string | null
  lichess_game_id?: string | null
  winnerId?: string | null
}

export default function MatchRoom({ params }: { params: { id: string } }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState("")

  // Accept Challenge State
  const [accepting, setAccepting] = useState(false)

  // Verification State
  const [verifying, setVerifying] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<'IDLE' | 'COMPLETED' | 'PENDING' | 'ERROR'>('IDLE')

  const supabase = createClient()
  const router = useRouter()
  const challengeId = params.id

  const fetchChallenge = async () => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single()

      if (error) throw error
      setChallenge(data as unknown as Challenge)
    } catch (e) {
      console.error("Error fetching challenge:", e)
      setError("No se pudo cargar la partida.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setCurrentUserId(user.id)
      setInviteLink(window.location.href)

      fetchChallenge()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel(`match:${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenges",
          filter: `id=eq.${challengeId}`,
        },
        (payload) => {
          console.log("Match update:", payload)
          setChallenge(payload.new as unknown as Challenge)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [challengeId, supabase])

  const handleAcceptChallenge = async () => {
    setAccepting(true)
    try {
      const res = await fetch('/api/matchmaking/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al aceptar el reto')
      }

      // Challenge state will be updated via Realtime subscription
    } catch (e) {
      console.error("Error accepting challenge:", e)
      alert(e instanceof Error ? e.message : "Error al aceptar el reto")
    } finally {
      setAccepting(false)
    }
  }

  const handleVerify = async () => {
    if (!challenge?.lichess_game_id) return

    setVerifying(true)
    setVerifyMessage('')
    setVerifyStatus('IDLE')

    try {
      const res = await fetch('/api/verify-chess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          gameId: challenge.lichess_game_id
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al verificar la partida')
      }

      if (data.status === 'COMPLETED') {
        setVerifyStatus('COMPLETED')
        // Dispatch event to update Navbar balance if we had one
        window.dispatchEvent(new Event('balanceUpdated'))
      } else {
        setVerifyStatus('PENDING')
        setVerifyMessage(data.message || 'La partida no ha terminado o no se encontró.')
      }

    } catch (error: unknown) {
      console.error(error)
      setVerifyStatus('ERROR')
      const err = error as Error
      setVerifyMessage(err.message || 'Ocurrió un error inesperado.')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-neon-magenta animate-spin" />
      </div>
    )
  }

  if (error || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-400">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>{error || "Partida no encontrada"}</p>
        <Button onClick={() => router.push("/dashboard")} className="mt-4" variant="outline">
            Volver al Dashboard
        </Button>
      </div>
    )
  }

  const isCreator = currentUserId === challenge.creatorId

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
          <Swords className="text-neon-magenta w-8 h-8" />
          Sala de Batalla
        </h1>
        <p className="text-gray-400">
            Apuesta: <span className="text-neon-cyan font-mono font-bold">${challenge.betAmount}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
          {/* Main Content Area */}
          <Card className="bg-[#050505]/80 border-white/10 shadow-2xl backdrop-blur-md">
              <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                      <ExternalLink className="w-5 h-5 text-neon-cyan" />
                      {challenge.status === 'IN_PROGRESS' ? 'Partida en Curso' : 'Estado del Reto'}
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  {challenge.status === 'OPEN' ? (
                      isCreator ? (
                          <div className="space-y-8 text-center py-6">
                              <div className="flex flex-col items-center justify-center space-y-4">
                                  <div className="relative">
                                      <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-xl animate-pulse"></div>
                                      <Loader2 className="w-16 h-16 text-neon-cyan animate-spin relative z-10" />
                                  </div>
                                  <div className="space-y-2">
                                      <h3 className="text-2xl font-bold text-white">Esperando oponente...</h3>
                                      <p className="text-gray-400 max-w-md mx-auto text-lg">
                                          Comparte este enlace con tu oponente para comenzar.
                                      </p>
                                  </div>
                              </div>

                              <div className="max-w-xl mx-auto space-y-2">
                                  <label className="text-sm font-medium text-gray-400">Enlace de invitación</label>
                                  <div className="relative flex items-center">
                                      <Input
                                        readOnly
                                        value={inviteLink}
                                        className="pr-12 bg-black/40 border-white/10 text-neon-cyan font-mono text-sm h-12"
                                      />
                                      <Button
                                          size="sm"
                                          className="absolute right-1 top-1 bottom-1 h-auto w-10 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
                                          onClick={() => {
                                            navigator.clipboard.writeText(inviteLink)
                                          }}
                                      >
                                          <Copy className="w-4 h-4" />
                                      </Button>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center py-10 space-y-8 text-center">
                              <div className="space-y-4">
                                  <div className="w-20 h-20 bg-neon-magenta/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-neon-magenta/30">
                                      <Swords className="w-10 h-10 text-neon-magenta" />
                                  </div>
                                  <h3 className="text-3xl font-bold text-white">¡Has sido retado!</h3>
                                  <p className="text-gray-400 text-lg max-w-md mx-auto">
                                      El creador ha puesto <span className="text-neon-cyan font-bold">${challenge.betAmount}</span> en juego.
                                      <br />
                                      ¿Aceptas el desafío?
                                  </p>
                              </div>

                              <Button
                                onClick={handleAcceptChallenge}
                                disabled={accepting}
                                className="bg-neon-magenta hover:bg-neon-magenta/80 text-white font-bold h-16 px-10 text-xl shadow-[0_0_30px_rgba(217,70,239,0.4)] hover:shadow-[0_0_50px_rgba(217,70,239,0.6)] transition-all w-full max-w-sm rounded-xl transform hover:-translate-y-1"
                              >
                                {accepting ? (
                                  <>
                                    <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                                    Procesando...
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-6 h-6 mr-3 fill-current" />
                                    ACEPTAR Y APOSTAR ${challenge.betAmount}
                                  </>
                                )}
                              </Button>
                          </div>
                      )
                  ) : challenge.status === 'IN_PROGRESS' && challenge.lichess_game_id ? (
                      <div className="space-y-6 animate-in zoom-in-95 duration-500">
                          <div className="aspect-[4/3] w-full bg-black/50 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                            <iframe
                              src={`https://lichess.org/${challenge.lichess_game_id}`}
                              className="w-full h-full"
                              frameBorder="0"
                              allowTransparency={true}
                            />
                          </div>

                          <div className="space-y-4 pt-4 border-t border-white/10">
                               <Button
                                  onClick={handleVerify}
                                  disabled={verifying}
                                  className={`w-full font-bold h-14 text-xl rounded-xl transition-all duration-300 ${
                                      verifying
                                      ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                                      : 'bg-neon-magenta hover:bg-neon-magenta/80 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)]'
                                  }`}
                                  >
                                  {verifying ? (
                                      <>
                                      <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                                      Verificando Resultado...
                                      </>
                                  ) : (
                                      "VERIFICAR RESULTADO"
                                  )}
                                </Button>

                                <AnimatePresence mode="wait">
                                  {verifyStatus === 'COMPLETED' ? (
                                      <motion.div
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center space-y-4"
                                      >
                                          <div className="flex flex-col items-center justify-center gap-2 text-green-400">
                                            <CheckCircle className="w-12 h-12" />
                                            <h3 className="text-2xl font-bold">¡Partida Verificada!</h3>
                                          </div>
                                          <p className="text-gray-300">Los fondos han sido transferidos al ganador.</p>
                                          <Button
                                            onClick={() => router.push('/dashboard')}
                                            variant="outline"
                                            className="mt-2 border-green-500/30 text-green-400 hover:bg-green-500/10 w-full"
                                          >
                                            Volver al Inicio
                                          </Button>
                                      </motion.div>
                                  ) : verifyStatus !== 'IDLE' && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${
                                          verifyStatus === 'ERROR'
                                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                          : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                      }`}>
                                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                          <span className="font-medium text-base">{verifyMessage}</span>
                                      </motion.div>
                                  )}
                                </AnimatePresence>
                          </div>
                      </div>
                  ) : challenge.status === 'COMPLETED' ? (
                      <div className="text-center py-12 space-y-6">
                          <div className="relative inline-block">
                              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl"></div>
                              <CheckCircle className="w-20 h-20 text-green-500 relative z-10" />
                          </div>
                          <div className="space-y-2">
                              <h3 className="text-3xl font-bold text-white">Partida Finalizada</h3>
                              <p className="text-gray-400 text-lg">Esta partida ya ha concluido y los premios han sido entregados.</p>
                          </div>

                          {challenge.winnerId ? (
                             <div className="p-4 bg-white/5 rounded-lg border border-white/10 max-w-sm mx-auto">
                                <p className="text-gray-300">Ganador</p>
                                <p className="text-neon-cyan font-bold text-xl">
                                    {challenge.winnerId === currentUserId ? "¡TÚ!" : "Oponente"}
                                </p>
                             </div>
                          ) : (
                             <div className="p-4 bg-white/5 rounded-lg border border-white/10 max-w-sm mx-auto">
                                <p className="text-gray-300">Resultado</p>
                                <p className="text-yellow-400 font-bold text-xl">Empate</p>
                             </div>
                          )}

                          <Button onClick={() => router.push("/dashboard")} variant="outline" className="border-white/10 text-white hover:bg-white/10 px-8 py-6 text-lg h-auto">
                              Volver al Dashboard
                          </Button>
                      </div>
                  ) : (
                    <div className="text-center py-10 text-gray-400">
                      <p>Cargando estado de la partida...</p>
                    </div>
                  )}
              </CardContent>
          </Card>
      </div>
    </div>
  )
}
