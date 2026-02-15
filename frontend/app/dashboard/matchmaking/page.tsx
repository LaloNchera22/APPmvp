"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, UserX, Gamepad2, Crown, Plus, Trash2 } from "lucide-react"
import BetCard from "@/components/BetCard"
import MatchStatus from "@/components/MatchStatus"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// Define valid games based on Schema Enum GameTitle
const VALID_GAMES = [
  { id: "LEAGUE_OF_LEGENDS", name: "League of Legends" },
  { id: "VALORANT", name: "Valorant" },
  { id: "COD_WARZONE", name: "CoD: Warzone" },
  { id: "DOTA_2", name: "Dota 2" },
  { id: "FC_24", name: "EA FC 24" },
  { id: "CHESS", name: "Chess.com" },
]

interface Creator {
    username: string
}

interface Proposal {
  id: string
  game: string
  bet_amount: number
  creator_id: string
  created_at?: string
  creator?: Creator
}

interface Challenge {
  id: string
  game: string
  status: string
  creator_id: string
  challenger_id: string
}

export default function MatchmakingPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [isInLobby, setIsInLobby] = useState(false)
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [betAmount, setBetAmount] = useState<string>("0")
  const [creatingProposal, setCreatingProposal] = useState(false)

  // Ref to track the created proposal ID for cleanup
  const myProposalIdRef = useRef<string | null>(null)

  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId)
    setLoading(true)
    setError(null)
  }

  // Create a new proposal manually
  const handleCreateProposal = async () => {
    if (!selectedGame) return

    setCreatingProposal(true)
    setError(null)

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push("/login")
            return
        }

        const amount = parseFloat(betAmount)
        if (isNaN(amount) || amount <= 0) {
            setError("Monto de apuesta inválido. Debe ser mayor a 0.")
            setCreatingProposal(false)
            return
        }

        // Create new proposal
        const { data: newProposal, error: insertError } = await supabase
            .from("active_proposals")
            .insert({
                game: selectedGame,
                bet_amount: amount,
                creator_id: user.id,
            })
            .select()
            .single()

        if (insertError) {
            console.error("Error creating matchmaking entry:", insertError.message, insertError)
            setError("No se pudo conectar al servidor de emparejamiento. Intenta de nuevo.")
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

  // Cancel own proposal
  const handleCancelProposal = async () => {
      if (!myProposalIdRef.current) return

      try {
          const { error } = await supabase
              .from("active_proposals")
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
      try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Lock Bet
          const { error: lockError } = await supabase.rpc("lock_bet", {
              p_user_id: user.id,
              p_amount: proposal.bet_amount
          })

          if (lockError) {
              console.error("Lock bet error:", lockError)
              setError("Error al bloquear saldo: " + lockError.message)
              return
          }

          // Create active challenge (History/Game)
          const { data: newChallenge, error: insertError } = await supabase.from("challenges").insert({
              game: proposal.game,
              metric: "MATCH_WINNER",
              bet_amount: proposal.bet_amount,
              status: "ACCEPTED",
              creator_id: proposal.creator_id,
              challenger_id: user.id
          })
          .select()
          .single()

          if (insertError) throw insertError

          if (newChallenge) {
             setActiveChallenge(newChallenge)
          }

          // Delete the accepted proposal
          const { error: deleteError } = await supabase
              .from("active_proposals")
              .delete()
              .eq("id", proposal.id)

          if (deleteError) throw deleteError

          // Cleanup my own proposal if exists
          if (myProposalIdRef.current) {
              await supabase.from("active_proposals").delete().eq("id", myProposalIdRef.current)
          }

          alert("¡Reto aceptado! La partida ha comenzado.")

      } catch (e) {
          console.error("Error accepting proposal:", e)
          setError("Error al aceptar el reto. Intenta de nuevo.")
      }
  }

  // Effect to check for active challenges and listen for new ones (as creator)
  useEffect(() => {
      const checkActiveChallenge = async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Check if user is in an active challenge
          const { data: challenge } = await supabase
              .from("challenges")
              .select("*")
              .eq("status", "ACCEPTED")
              .or(`creator_id.eq.${user.id},challenger_id.eq.${user.id}`)
              .maybeSingle()

          if (challenge) {
              setActiveChallenge(challenge)
          }

          // Listen for challenges created where I am the creator (someone accepted my proposal)
          const channel = supabase
              .channel("my_challenges")
              .on(
                  "postgres_changes",
                  {
                      event: "INSERT",
                      schema: "public",
                      table: "challenges",
                      filter: `creator_id=eq.${user.id}`,
                  },
                  (payload) => {
                      setActiveChallenge(payload.new as Challenge)
                  }
              )
              .subscribe()

          return () => {
              supabase.removeChannel(channel)
          }
      }

      checkActiveChallenge()
  }, [supabase])

  useEffect(() => {
    if (!selectedGame) return

    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const initMatchmaking = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        // Check if user already has a proposal
        const { data: existingProposal } = await supabase
            .from("active_proposals")
            .select("id")
            .eq("creator_id", user.id)
            .maybeSingle()

        if (existingProposal) {
            myProposalIdRef.current = existingProposal.id
            setIsInLobby(true)
        } else {
            // Do NOT automatically create proposal
            setIsInLobby(false)
        }

        // Initial fetch of opponents
        fetchProposals()

        if (!mounted) return

        // Realtime subscription
        channel = supabase
          .channel("matchmaking_lobby")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "active_proposals",
              filter: `game=eq.${selectedGame}`,
            },
            () => {
              fetchProposals()
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "active_proposals",
              filter: `game=eq.${selectedGame}`,
            },
            (payload) => {
              setProposals((prev) => prev.filter((p) => p.id !== payload.old.id))
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              console.log("Subscribed to matchmaking lobby")
            } else if (status === "CHANNEL_ERROR") {
              console.error("Subscription error")
              setError("Error de conexión en tiempo real.")
            } else if (status === "TIMED_OUT") {
              console.error("Subscription timed out")
              setError("Tiempo de espera agotado al conectar.")
            } else if (status === "CLOSED") {
              console.log("Subscription closed")
            }
          })

      } catch (e) {
        console.error("Unexpected error:", e)
        setError("Ocurrió un error inesperado.")
        setLoading(false)
      }
    }

    const fetchProposals = async () => {
      if (!mounted) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch active proposals for the selected game, excluding self
      const { data, error } = await supabase
        .from("active_proposals")
        .select("*, creator:profiles(username)")
        .eq("game", selectedGame)
        .neq("creator_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching lobby:", error)
        setError("Error al cargar oponentes.")
      } else {
        if (mounted) {
            setProposals((data as unknown as Proposal[]) || [])
            setLoading(false)
        }
      }
    }

    initMatchmaking()

    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)

      // Cleanup on unmount - OPTIONAL: We can choose NOT to delete on unmount if we want persistence,
      // but typically matchmaking lobbies remove you when you leave.
      // The original code deleted it. I'll keep it for now to avoid stale proposals.
      const idToDelete = myProposalIdRef.current
      if (idToDelete) {
        supabase.from("active_proposals").delete().eq("id", idToDelete).then(({ error }) => {
            if (error) console.error("Error cleaning up matchmaking entry:", error)
        })
      }
    }
  }, [selectedGame, router, supabase])

  if (activeChallenge) {
    return (
       <div className="space-y-6">
           <h1 className="text-3xl font-bold text-white flex items-center gap-2 mb-6">
               <Crown className="text-yellow-400 w-8 h-8" />
               Partida en Curso
           </h1>
           <MatchStatus challengeId={activeChallenge.id} />
       </div>
    )
  }

  // If no game selected, show selection screen
  if (!selectedGame) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Gamepad2 className="text-neon-magenta w-8 h-8" />
                Selecciona tu Juego
            </h1>
            <p className="text-gray-400">
                Elige el juego para entrar a la sala de emparejamiento.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {VALID_GAMES.map((game) => (
                    <Card
                        key={game.id}
                        className="cursor-pointer hover:border-neon-cyan transition-all bg-white/5 border-white/10"
                        onClick={() => handleGameSelect(game.id)}
                    >
                        <CardContent className="p-6 flex items-center justify-center flex-col gap-4">
                            <Swords className="w-12 h-12 text-neon-magenta" />
                            <h3 className="text-xl font-bold text-white">{game.name}</h3>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Swords className="text-neon-magenta w-8 h-8 animate-pulse" />
            Sala de Emparejamiento: {VALID_GAMES.find(g => g.id === selectedGame)?.name}
            </h1>
            <p className="text-gray-400 mt-2">
                {isInLobby ? "Esperando un oponente..." : "Observando sala..."}
            </p>
        </div>
        <div className="flex gap-2">
             <Button
                variant="outline"
                onClick={() => setSelectedGame(null)}
                className="border-white/20 text-white hover:bg-white/10"
            >
                Cambiar Juego
            </Button>
            <Button
                variant="destructive"
                onClick={() => router.push("/dashboard")}
                className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 backdrop-blur-md"
            >
                <UserX className="w-4 h-4 mr-2" />
                Salir de la Sala
            </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            {error}
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
                      <Loader2 className="w-6 h-6 text-neon-cyan animate-spin" />
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
            <Loader2 className="w-10 h-10 text-neon-cyan animate-spin" />
            <p className="text-gray-400">Cargando propuestas...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-neon-magenta animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No hay otras propuestas activas.</p>
            <p className="text-gray-500 text-sm mt-2">Sé el primero en crear una propuesta.</p>
        </div>
      ) : (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Oponentes Disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proposals.map((proposal) => (
                <BetCard
                    key={proposal.id}
                    gameTitle="Retador Disponible"
                    winCondition={proposal.creator?.username ? `Usuario: ${proposal.creator.username}` : "Usuario Anónimo"}
                    betAmount={proposal.bet_amount}
                    onAccept={() => handleAcceptProposal(proposal)}
                />
                ))}
            </div>
        </div>
      )}
    </div>
  )
}
