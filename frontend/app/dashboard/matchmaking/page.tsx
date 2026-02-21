"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, UserX, Gamepad2, Plus, Trash2, Wallet, X, Copy } from "lucide-react"
import BetCard from "@/components/BetCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Creator {
    username: string
}

interface Proposal {
  id: string
  game?: string
  betAmount: number
  creatorId: string
  createdAt?: string
  creator?: Creator
  status?: string
}

interface Challenge {
  id: string
  game: string
  status: string
  creatorId: string
  challengerId: string
}

const CHESS_GAME_TYPE = "CHESS_COM"

export default function MatchmakingPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isInLobby, setIsInLobby] = useState(false)
  const [betAmount, setBetAmount] = useState<string>("0")
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [insufficientFunds, setInsufficientFunds] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [matchModalOpen, setMatchModalOpen] = useState(false)
  const [acceptedMatch, setAcceptedMatch] = useState<{ id: string, gameLink: string } | null>(null)

  // Ref to track the created proposal ID for cleanup
  const myProposalIdRef = useRef<string | null>(null)
  const isProposalAccepted = useRef(false)

  // Refs for cleanup access
  const accessTokenRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  // Initialize Supabase client
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  // Sync userId to ref and get session token
  useEffect(() => {
    userIdRef.current = userId

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        accessTokenRef.current = session.access_token
      }
    }
    getSession()
  }, [userId, supabase])

  // Redirect if active challenge found
  useEffect(() => {
      const checkActiveChallenge = async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Check if user is in an active challenge
          const { data: challenge } = await supabase
              .from("challenges")
              .select("id, status")
              .eq("status", "IN_PROGRESS")
              .or(`creatorId.eq.${user.id},challengerId.eq.${user.id}`)
              .maybeSingle()

          if (challenge) {
              router.push(`/dashboard/match/${challenge.id}`)
          }

          // Listen for challenges updates (someone accepted my proposal -> IN_PROGRESS)
          const channel = supabase
              .channel("my_challenges_lobby")
              .on(
                  "postgres_changes",
                  {
                      event: "UPDATE",
                      schema: "public",
                      table: "challenges",
                      filter: `creatorId=eq.${user.id}`,
                  },
                  (payload) => {
                      const newChallenge = payload.new as Challenge
                      if (newChallenge.status === "IN_PROGRESS") {
                          isProposalAccepted.current = true
                          router.push(`/dashboard/match/${newChallenge.id}`)
                      }
                  }
              )
              .subscribe()

          return () => {
              supabase.removeChannel(channel)
          }
      }

      checkActiveChallenge()
  }, [supabase, router])

  const deleteChallenge = useCallback(async (challengeId: string) => {
    try {
      const response = await fetch('/api/matchmaking/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId })
      })

      if (!response.ok) {
         console.error("Error deleting challenge API:", await response.text())
         setError("Error al cancelar la propuesta, se ha eliminado de tu vista local.")
      } else {
         console.log("Challenge deleted successfully")
      }

      // Optimistic update to hide from UI immediately
      setProposals(prev => prev.filter(p => p.id !== challengeId))

      if (myProposalIdRef.current === challengeId) {
          myProposalIdRef.current = null
          setIsInLobby(false)
      }
    } catch (e) {
      console.error("Error in deleteChallenge:", e)
    }
  }, [])

  // Create a new proposal manually (Insert into challenges with status OPEN, with lock)
  const handleCreateProposal = async () => {
    setCreatingProposal(true)
    setError(null)
    setErrorDetails(null)
    setInsufficientFunds(false)

    try {
        const amount = parseFloat(betAmount)
        if (isNaN(amount) || amount <= 0) {
            setError("registra saldo en tu cuenta")
            setCreatingProposal(false)
            return
        }

        const response = await fetch('/api/matchmaking/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ betAmount: amount, game: CHESS_GAME_TYPE })
        })

        const data = await response.json()

        if (!response.ok) {
            const errorMessage = data.error || 'Error al crear la propuesta.'
            if (errorMessage.toLowerCase().includes("saldo insuficiente") || errorMessage.toLowerCase().includes("funds")) {
                setInsufficientFunds(true)
            } else {
                setError(errorMessage)
                if (data.details) setErrorDetails(data.details)
            }
            return
        }

        if (data) {
            isProposalAccepted.current = true
            router.push(`/dashboard/match/${data.id}`)
        }
    } catch (e) {
        console.error("Unexpected error:", e)
        setError("Ocurrió un error inesperado al crear la propuesta.")
    } finally {
        setCreatingProposal(false)
    }
  }

  // Cancel own proposal (Delete from challenges)
  const handleCancelProposal = async () => {
      if (!myProposalIdRef.current) return

      await deleteChallenge(myProposalIdRef.current)
  }

  // Handle accepting a proposal
  const handleAcceptProposal = async (proposal: Proposal) => {
      setInsufficientFunds(false)
      setError(null)
      setErrorDetails(null)

      try {
          // Call API endpoint to handle transaction securely
          const response = await fetch('/api/matchmaking/accept', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ challengeId: proposal.id })
          })

          const data = await response.json()

          if (!response.ok) {
              const errorMessage = data.error || 'Error al aceptar el reto.'

              // Check for insufficient funds to show UI helper
              if (errorMessage.toLowerCase().includes("saldo insuficiente") || errorMessage.toLowerCase().includes("funds")) {
                   setInsufficientFunds(true)
                   setError(null)
              } else {
                   setError(errorMessage)
                   if (data.details) setErrorDetails(data.details)
                   if (data.hint) setErrorDetails(prev => prev ? `${prev} - ${data.hint}` : data.hint)
                   console.error("Server error details:", data)
              }
              return
          }

          myProposalIdRef.current = null

          // Open Modal with Link instead of immediate redirect
          if (data.challengeId) {
             setAcceptedMatch({ id: data.challengeId, gameLink: data.gameLink })
             setMatchModalOpen(true)
          }

      } catch (e) {
          console.error("Error accepting proposal:", e)
          setError("Error de conexión al aceptar el reto.")
      }
  }

  // Cleanup effect: Handle component unmount and browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Prevent cleanup if match started
      if (isProposalAccepted.current) return

      // Use fetch with keepalive as a reliable way to send request during unload
      // We prioritize canceling the current tracked proposal
      if (myProposalIdRef.current) {
          fetch('/api/matchmaking/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ challengeId: myProposalIdRef.current }),
              keepalive: true
          }).catch(console.error)
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)

      // Cleanup when navigating away (component unmount)
      if (!isProposalAccepted.current && userIdRef.current) {
         // Perform cleanup using Supabase client
         const cleanup = async () => {
             // Fetch any open challenges created by this user (to handle zombies)
             const { data: challenges } = await supabase
                .from("challenges")
                .select("id")
                .eq("creatorId", userIdRef.current)
                .eq("status", "OPEN")

             if (challenges && challenges.length > 0) {
                 for (const challenge of challenges) {
                     await fetch('/api/matchmaking/cancel', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ challengeId: challenge.id })
                     }).catch(console.error)
                 }
             }
         }
         cleanup()
      }
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const fetchProposals = async () => {
      if (!mounted) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch active proposals (Open Challenges) for Chess from challenges table
        const { data, error } = await supabase
          .from("challenges")
          .select("*, creator:profiles!creatorId(username)")
          .eq("game", CHESS_GAME_TYPE)
          .eq("status", "OPEN")
          // Removed neq filter to allow seeing own proposal for validation
          .order("createdAt", { ascending: false })

        if (error) {
          console.error("Error fetching lobby:", error)
          setError(`Error al cargar oponentes: ${error.message} (Code: ${error.code})`)
        } else {
          if (mounted) {
              setError(null)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const mappedProposals = (data || []).map((item: any) => ({
                  ...item,
                  creator: item.creator || undefined
              }))
              setProposals(mappedProposals as Proposal[])
          }
        }
      } catch (err) {
        console.error("Unexpected error in fetchProposals:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const initMatchmaking = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }
        setUserId(user.id)

        // Check if user already has a proposal (Open Challenge)
        const { data: existingProposal } = await supabase
            .from("challenges")
            .select("id")
            .eq("creatorId", user.id)
            .eq("status", "OPEN")
            .maybeSingle()

        if (existingProposal) {
            myProposalIdRef.current = existingProposal.id
            setIsInLobby(true)
        } else {
            setIsInLobby(false)
        }

        // Initial fetch
        await fetchProposals()

        if (!mounted) return

        // Realtime subscription to challenges table
        channel = supabase
          .channel("public:challenges_chess")
          .on(
            "postgres_changes",
            {
              event: "*", // Listen to INSERT, UPDATE, DELETE
              schema: "public",
              table: "challenges",
              filter: `game=eq.${CHESS_GAME_TYPE}`, // Filter by game type
            },
            (payload) => {
              console.log("Realtime event received:", payload)
              fetchProposals()
            }
          )
          .subscribe()

      } catch (e) {
        console.error("Unexpected error:", e)
        setError("Ocurrió un error inesperado.")
        setLoading(false)
      }
    }

    initMatchmaking()

    return () => {
      mounted = false
      if (channel) {
          supabase.removeChannel(channel)
      }
    }
  }, [router, supabase])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Swords className="text-neon-magenta w-8 h-8 animate-pulse" />
            Sala de Emparejamiento
            </h1>
            <p className="text-gray-400 mt-2">
                {isInLobby ? "Esperando un oponente..." : "Busca un reto o crea uno nuevo."}
            </p>
        </div>
        <div className="flex gap-2">
            <Button
                variant="destructive"
                onClick={() => router.push("/dashboard")}
                className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 backdrop-blur-md"
            >
                <UserX className="w-4 h-4 mr-2" />
                Salir
            </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 break-words">
            {error === "registra saldo en tu cuenta" ? (
                <p className="font-bold">{error}</p>
            ) : (
                <>
                    <p className="font-bold mb-1">Error de Conexión:</p>
                    {error}
                    {errorDetails && (
                        <p className="text-sm mt-2 text-red-300 font-mono bg-red-950/30 p-2 rounded border border-red-500/10">
                            Detalles: {errorDetails}
                        </p>
                    )}
                    {(!errorDetails || errorDetails.includes("RLS")) && (
                        <p className="text-sm mt-2 text-gray-400">
                             Si el problema persiste, contacta a soporte enviando este error.
                        </p>
                    )}
                </>
            )}
        </div>
      )}

      {insufficientFunds && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col md:flex-row items-center justify-between mb-6 backdrop-blur-sm gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-full shrink-0">
                    <Wallet className="w-6 h-6 text-red-400" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm">Saldo Insuficiente</h3>
                    <p className="text-gray-400 text-xs">No tienes suficientes fondos en tu cartera para realizar esta operación.</p>
                </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Button
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-9 text-xs flex-1 md:flex-none"
                    onClick={() => router.push("/dashboard/wallet")}
                >
                    Ingresar Dinero
                </Button>
                <button
                    onClick={() => setInsufficientFunds(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
      )}

      {/* Control Panel for Proposals */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          {!isInLobby ? (
              <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:w-1/3">
                      <label className="text-sm text-gray-400 mb-2 block">Monto de Apuesta (USD)</label>
                      <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          placeholder="0.00"
                          className="bg-black/20 border-white/10 text-white"
                      />
                  </div>
                  <Button
                      onClick={handleCreateProposal}
                      disabled={creatingProposal}
                      className="bg-neon-magenta hover:bg-neon-magenta/80 text-white w-full md:w-auto"
                  >
                      {creatingProposal ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                          <Plus className="w-4 h-4 mr-2" />
                      )}
                      Crear Propuesta
                  </Button>
              </div>
          ) : (
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 text-neon-magenta animate-spin" />
                      <div>
                          <p className="text-white font-medium">Buscando oponentes...</p>
                          <p className="text-sm text-gray-400">Tu propuesta está visible para otros jugadores.</p>
                      </div>
                  </div>
                  <Button
                      variant="destructive"
                      onClick={handleCancelProposal}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
                  >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Cancelar Búsqueda
                  </Button>
              </div>
          )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-neon-magenta animate-spin" />
            <p className="text-gray-400">Cargando propuestas...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <Gamepad2 className="w-8 h-8 text-neon-magenta mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No hay otras propuestas activas. ¡Sé el primero en crear una!</p>
        </div>
      ) : (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Oponentes Disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proposals.map((proposal) => (
                <BetCard
                    key={proposal.id}
                    gameTitle="Partida Competitiva"
                    winCondition={proposal.creator?.username ? `Usuario: ${proposal.creator.username}` : "Usuario Anónimo"}
                    betAmount={proposal.betAmount}
                    disabled={false}
                    actionLabel={userId === proposal.creatorId ? "Cancelar" : "Aceptar Reto"}
                    onAccept={userId === proposal.creatorId ? () => deleteChallenge(proposal.id) : () => handleAcceptProposal(proposal)}
                />
                ))}
            </div>
        </div>
      )}

      {/* Match Accepted Modal */}
      {matchModalOpen && acceptedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-neon-magenta/30 rounded-2xl p-6 max-w-md w-full relative shadow-[0_0_50px_rgba(217,70,239,0.15)] animate-in zoom-in-95 duration-300">
            <button
                onClick={() => router.push(`/dashboard/match/${acceptedMatch.id}`)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4 pt-2">
                <div className="w-16 h-16 bg-neon-magenta/10 rounded-full flex items-center justify-center mb-2 ring-1 ring-neon-magenta/30">
                    <Swords className="w-8 h-8 text-neon-magenta" />
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">¡Reto Aceptado!</h2>
                    <p className="text-gray-400 text-sm">
                        Se ha generado tu enlace de partida.
                    </p>
                </div>

                <div className="w-full bg-black/40 p-3 rounded-lg border border-white/10 flex items-center gap-3 group hover:border-neon-magenta/30 transition-colors">
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Enlace de Juego</p>
                        <p className="text-neon-cyan text-sm font-mono truncate">
                            {acceptedMatch.gameLink}
                        </p>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="hover:bg-white/10 shrink-0 h-8 w-8 text-gray-400 hover:text-white"
                        onClick={() => {
                            navigator.clipboard.writeText(acceptedMatch.gameLink)
                        }}
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                </div>

                <div className="w-full space-y-3 pt-2">
                     <a
                        href={acceptedMatch.gameLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full"
                     >
                        <Button className="w-full bg-neon-magenta hover:bg-neon-magenta/90 text-white font-bold h-11 shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] transition-all">
                            <Gamepad2 className="w-4 h-4 mr-2" />
                            Jugar Ahora en Chess.com
                        </Button>
                     </a>

                     <Button
                        variant="outline"
                        onClick={() => router.push(`/dashboard/match/${acceptedMatch.id}`)}
                        className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white h-11"
                     >
                        Ir a la Sala de Espera
                     </Button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
