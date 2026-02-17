"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, CheckCircle, ExternalLink, AlertCircle, Copy, Send } from "lucide-react"
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
}

export default function MatchRoom({ params }: { params: { id: string } }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkInput, setLinkInput] = useState("")
  const [submittingLink, setSubmittingLink] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Verification State
  const [verifying, setVerifying] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<'IDLE' | 'COMPLETED' | 'PENDING' | 'ERROR'>('IDLE')
  // Removed unused newBalance state

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

  const handleSubmitLink = async () => {
    if (!linkInput.includes("chess.com")) {
      alert("Por favor ingresa un link válido de Chess.com")
      return
    }

    setSubmittingLink(true)
    try {
      const { error } = await supabase
        .from("challenges")
        .update({ gameLink: linkInput })
        .eq("id", challengeId)

      if (error) throw error

    } catch (e) {
      console.error("Error updating link:", e)
      alert("Error al enviar el link.")
    } finally {
      setSubmittingLink(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyMessage('')
    setVerifyStatus('IDLE')

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
        setVerifyStatus('COMPLETED')
        // Dispatch event to update Navbar
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
  // Treat generic link as null to trigger manual flow fallback
  const gameLink = (challenge.gameLink === "https://www.chess.com/play/online") ? null : challenge.gameLink

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Side: Game Status & Link */}
          <Card className="bg-[#050505]/80 border-white/10">
              <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                      <ExternalLink className="w-5 h-5 text-neon-cyan" />
                      Enlace de la Partida
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  {!gameLink ? (
                      isCreator ? (
                          <div className="space-y-4">
                              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg text-yellow-200 text-sm">
                                  <p className="font-bold mb-1">¡Tú eres el anfitrión!</p>
                                  <ol className="list-decimal list-inside space-y-1">
                                      <li>Ve a <a href="https://chess.com/play/online" target="_blank" className="underline hover:text-white">Chess.com</a>.</li>
                                      <li>Crea una partida &quot;Amistosa&quot; (Play a Friend).</li>
                                      <li>Copia el enlace de invitación.</li>
                                      <li>Pégalo abajo para compartirlo con tu rival.</li>
                                  </ol>
                              </div>
                              <div className="flex gap-2">
                                  <Input
                                      placeholder="Pegar enlace de Chess.com aquí..."
                                      value={linkInput}
                                      onChange={(e) => setLinkInput(e.target.value)}
                                      className="bg-black/20 border-white/10 text-white"
                                  />
                                  <Button
                                    onClick={handleSubmitLink}
                                    disabled={submittingLink || !linkInput}
                                    className="bg-neon-magenta hover:bg-neon-magenta/80"
                                  >
                                      {submittingLink ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                                  </Button>
                              </div>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                              <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
                              <div className="space-y-1">
                                  <p className="text-white font-medium">Esperando al anfitrión...</p>
                                  <p className="text-sm text-gray-400">El creador del reto está generando el link de la partida.</p>
                              </div>
                          </div>
                      )
                  ) : (
                      <div className="space-y-6">
                          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <div className="p-2 bg-green-500/20 rounded-full">
                                      <CheckCircle className="w-5 h-5 text-green-500" />
                                  </div>
                                  <div>
                                      <p className="text-green-400 font-bold">¡Partida Lista!</p>
                                      <p className="text-xs text-green-500/70">Enlace recibido correctamente.</p>
                                  </div>
                              </div>
                          </div>

                          <a href={gameLink} target="_blank" rel="noopener noreferrer" className="block">
                              <Button className="w-full bg-neon-cyan hover:bg-neon-cyan/80 text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all">
                                  JUGAR EN CHESS.COM
                                  <ExternalLink className="ml-2 w-5 h-5" />
                              </Button>
                          </a>

                          <div className="relative">
                              <Input readOnly value={gameLink} className="pr-10 bg-black/40 border-white/10 text-gray-400" />
                              <Button
                                  size="sm"
                                  variant="ghost"
                                  className="absolute right-0 top-0 h-full text-gray-400 hover:text-white"
                                  onClick={() => navigator.clipboard.writeText(gameLink)}
                              >
                                  <Copy className="w-4 h-4" />
                              </Button>
                          </div>
                      </div>
                  )}
              </CardContent>
          </Card>

          {/* Right Side: Verification */}
          <Card className="bg-[#050505]/80 border-white/10">
              <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-neon-magenta" />
                      Verificar Resultado
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  <p className="text-gray-400 text-sm">
                      Una vez que la partida termine en Chess.com, regresa aquí y presiona verificar para reclamar tu premio.
                  </p>

                  <AnimatePresence mode="wait">
                      {verifyStatus === 'COMPLETED' ? (
                          <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center space-y-3"
                          >
                              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                              <h3 className="text-xl font-bold text-green-400">¡Verificado!</h3>
                              <p className="text-gray-300">La partida ha finalizado y los fondos han sido transferidos.</p>
                              <Button
                                onClick={() => router.push('/dashboard')}
                                variant="outline"
                                className="mt-4 border-green-500/30 text-green-400 hover:bg-green-500/10"
                              >
                                Volver al Inicio
                              </Button>
                          </motion.div>
                      ) : (
                          <div className="space-y-4">
                               <Button
                                  onClick={handleVerify}
                                  disabled={verifying || !gameLink}
                                  className={`w-full font-bold h-12 text-lg transition-all duration-300 ${
                                      verifying || !gameLink
                                      ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                                      : 'bg-neon-magenta hover:bg-neon-magenta/80 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)]'
                                  }`}
                                  >
                                  {verifying ? (
                                      <>
                                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                      Verificando...
                                      </>
                                  ) : (
                                      "VERIFICAR PARTIDA"
                                  )}
                                </Button>

                                {verifyStatus !== 'IDLE' && (
                                    <div className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${
                                        verifyStatus === 'ERROR'
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                    }`}>
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span>{verifyMessage}</span>
                                    </div>
                                )}
                          </div>
                      )}
                  </AnimatePresence>
              </CardContent>
          </Card>
      </div>
    </div>
  )
}
