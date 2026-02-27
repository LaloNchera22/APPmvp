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
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Loader2 className="w-12 h-12 text-foreground animate-spin" />
      </div>
    )
  }

  if (error || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-red-600 bg-red-100 border-4 border-red-600 p-8 max-w-md mx-auto my-12 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="font-bold uppercase text-lg text-center">{error || "Partida no encontrada"}</p>
        <Button onClick={() => router.push("/dashboard")} className="mt-8 yeezy-button w-full">
            Volver al Dashboard
        </Button>
      </div>
    )
  }

  const isCreator = currentUserId === challenge.creatorId

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-4 border-4 border-foreground p-8 bg-yeezy-light shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
        <h1 className="text-4xl font-black text-foreground flex items-center justify-center gap-4 uppercase tracking-tighter">
          <Swords className="text-foreground w-10 h-10" />
          Sala de Batalla
        </h1>
        <p className="text-foreground/80 font-bold uppercase text-xl">
            Apuesta: <span className="font-pixel text-foreground">${challenge.betAmount}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
          {/* Main Content Area */}
          <Card className="yeezy-card rounded-none border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
              <CardHeader className="bg-foreground text-background border-b-4 border-foreground">
                  <CardTitle className="text-background flex items-center gap-2 font-black uppercase text-2xl tracking-tighter">
                      <ExternalLink className="w-6 h-6 text-background" />
                      {challenge.status === 'IN_PROGRESS' ? 'Partida en Curso' : 'Estado del Reto'}
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                  {challenge.status === 'OPEN' ? (
                      isCreator ? (
                          <div className="space-y-8 text-center py-6">
                              <div className="flex flex-col items-center justify-center space-y-6">
                                  <div className="relative">
                                      <Loader2 className="w-20 h-20 text-foreground animate-spin relative z-10" />
                                  </div>
                                  <div className="space-y-2">
                                      <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter">Encontrando oponente...</h3>
                                      <p className="text-foreground/80 max-w-md mx-auto text-lg font-bold">
                                          Comparte este enlace con tu oponente para comenzar.
                                      </p>
                                  </div>
                              </div>

                              <div className="max-w-xl mx-auto space-y-3">
                                  <label className="text-sm font-bold uppercase text-foreground/60">Compartir link del reto</label>
                                  <div className="relative flex items-center">
                                      <Input
                                        readOnly
                                        value={inviteLink}
                                        className="pr-16 border-2 border-foreground font-pixel text-xs bg-yeezy-light h-14"
                                      />
                                      <Button
                                          size="sm"
                                          className="absolute right-1 top-1 bottom-1 h-auto w-12 bg-foreground text-background hover:bg-foreground/90 rounded-none border-2 border-transparent"
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
                                  <div className="w-24 h-24 bg-foreground text-background flex items-center justify-center mx-auto border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
                                      <Swords className="w-12 h-12" />
                                  </div>
                                  <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter">¡Has sido retado!</h3>
                                  <p className="text-foreground/80 text-xl max-w-md mx-auto font-bold uppercase mt-4">
                                      El creador ha puesto <span className="font-pixel text-foreground">${challenge.betAmount}</span> en juego.
                                      <br /><br />
                                      ¿Aceptas el desafío?
                                  </p>
                              </div>

                              <Button
                                onClick={handleAcceptChallenge}
                                disabled={accepting}
                                className="yeezy-button h-16 px-10 text-xl w-full max-w-sm"
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
                          <div className="flex justify-center mb-6">
                              <a
                                href={challenge.gameLink || `https://lichess.org/${challenge.lichess_game_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="yeezy-button w-full max-w-sm flex items-center justify-center gap-3 py-4 text-lg font-bold uppercase"
                              >
                                <Play className="w-5 h-5 fill-current" />
                                Ir a Lichess
                                <ExternalLink className="w-5 h-5" />
                              </a>
                          </div>

                          <div className="aspect-[4/3] w-full bg-foreground border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] overflow-hidden">
                            <iframe
                              src={`https://lichess.org/${challenge.lichess_game_id}`}
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
                                  {verifyStatus === 'COMPLETED' ? (
                                      <motion.div
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="bg-green-100 border-4 border-green-600 p-6 text-center space-y-4"
                                      >
                                          <div className="flex flex-col items-center justify-center gap-2 text-green-700">
                                            <CheckCircle className="w-12 h-12" />
                                            <h3 className="text-2xl font-black uppercase">¡Partida Verificada!</h3>
                                          </div>
                                          <p className="text-green-800 font-bold uppercase">Los fondos han sido transferidos al ganador.</p>
                                          <Button
                                            onClick={() => router.push('/dashboard')}
                                            className="mt-4 border-4 border-green-700 bg-green-200 text-green-900 hover:bg-green-300 w-full rounded-none font-bold uppercase"
                                          >
                                            Volver al Inicio
                                          </Button>
                                      </motion.div>
                                  ) : verifyStatus !== 'IDLE' && (
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
                              <CheckCircle className="w-20 h-20 text-foreground" />
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

                          <Button onClick={() => router.push("/dashboard")} className="yeezy-button px-8 py-6 text-lg h-auto mt-8">
                              Volver al Dashboard
                          </Button>
                      </div>
                  ) : (
                    <div className="text-center py-10 font-bold uppercase text-foreground/60">
                      <p>Cargando estado de la partida...</p>
                    </div>
                  )}
              </CardContent>
          </Card>
      </div>
    </div>
  )
}
