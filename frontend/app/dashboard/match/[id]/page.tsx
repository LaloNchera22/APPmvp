"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, CheckCircle, ExternalLink, Copy, Play, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  // Redirect automatically when match goes into progress
  useEffect(() => {
    if (challenge && challenge.status === 'IN_PROGRESS' && challenge.lichess_game_id) {
        router.push(`/dashboard/play/${challenge.id}`)
    }
  }, [challenge, router])

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
                      <div className="text-center py-12 space-y-8 animate-in zoom-in-95 duration-500">
                           <Loader2 className="w-20 h-20 text-foreground animate-spin mx-auto" />
                           <p className="text-xl font-bold uppercase text-foreground animate-pulse">Redirigiendo a la sala de juego...</p>
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
