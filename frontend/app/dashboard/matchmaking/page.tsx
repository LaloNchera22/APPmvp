"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, UserX, Gamepad2, Plus, Trash2, Wallet, X } from "lucide-react"
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

  // Ref to track the created proposal ID for cleanup
  const myProposalIdRef = useRef<string | null>(null)

  // Initialize Supabase client
  const [supabase] = useState(() => createClient())
  const router = useRouter()

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

  // Create a new proposal manually (Insert into challenges with status OPEN, no lock)
  const handleCreateProposal = async () => {
    setCreatingProposal(true)
    setError(null)
    setErrorDetails(null)
    setInsufficientFunds(false)

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        const amount = parseFloat(betAmount)
        if (isNaN(amount) || amount <= 0) {
            setError("registra saldo en tu cuenta")
            setCreatingProposal(false)
            return
        }

        // Check wallet balance
        const { data: wallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("userId", user.id)
            .single()

        const currentBalance = wallet ? Number(wallet.balance) : 0

        if (currentBalance < amount) {
            setInsufficientFunds(true)
            setCreatingProposal(false)
            return
        }

        // Create new proposal (Insert into challenges)
        const { data: newProposal, error: insertError } = await supabase
            .from("challenges")
            .insert({
                game: CHESS_GAME_TYPE,
                metric: 'MATCH_WINNER',
                betAmount: amount,
                status: 'OPEN',
                creatorId: user.id
                // challengerId is null, handled by backend Accept
            })
            .select()
            .single()

        if (insertError) {
            console.error("Error creating matchmaking entry:", insertError.message, insertError)
            setError(`Error al crear la propuesta: ${insertError.message}`)
            setErrorDetails(`${insertError.details || ''} ${insertError.hint || ''} (Code: ${insertError.code})`.trim())
            setCreatingProposal(false)
            return
        }

        if (newProposal) {
            myProposalIdRef.current = newProposal.id
            setIsInLobby(true)
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

      try {
          const { error } = await supabase
              .from("challenges")
              .delete()
              .eq("id", myProposalIdRef.current)

          if (error) {
              console.error("Error cancelling proposal:", error)
              setError("Error al cancelar la propuesta.")
              return
          }

          myProposalIdRef.current = null
          setIsInLobby(false)
      } catch (e) {
          console.error("Unexpected error cancelling:", e)
      }
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

          // Redirect to Match Room
          if (data.challengeId) {
             router.push(`/dashboard/match/${data.challengeId}`)
          }

      } catch (e) {
          console.error("Error accepting proposal:", e)
          setError("Error de conexión al aceptar el reto.")
      }
  }

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
          .select("*, creator:profiles(username)")
          .eq("game", CHESS_GAME_TYPE)
          .eq("status", "OPEN")
          .neq("creatorId", user.id) // Don't show own proposal in list (handled by lobby state)
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
            Sala de Ajedrez (Chess.com)
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
                    gameTitle="Ajedrez (Chess.com)"
                    winCondition={proposal.creator?.username ? `Usuario: ${proposal.creator.username}` : "Usuario Anónimo"}
                    betAmount={proposal.betAmount}
                    onAccept={() => handleAcceptProposal(proposal)}
                />
                ))}
            </div>
        </div>
      )}
    </div>
  )
}
