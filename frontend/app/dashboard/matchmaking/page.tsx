"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, UserX, Gamepad2 } from "lucide-react"
import BetCard from "@/components/BetCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Define valid games based on Schema Enum GameTitle
const VALID_GAMES = [
  { id: "LEAGUE_OF_LEGENDS", name: "League of Legends" },
  { id: "VALORANT", name: "Valorant" },
  { id: "COD_WARZONE", name: "CoD: Warzone" },
  { id: "DOTA_2", name: "Dota 2" },
  { id: "FC_24", name: "EA FC 24" },
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

export default function MatchmakingPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [isInLobby, setIsInLobby] = useState(false)

  // Ref to track the created proposal ID for cleanup
  const myProposalIdRef = useRef<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId)
    setLoading(true)
  }

  // Handle accepting a proposal
  const handleAcceptProposal = async (proposal: Proposal) => {
      try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Create active challenge (History/Game)
          const { error: insertError } = await supabase.from("challenges").insert({
              game: proposal.game,
              metric: "MATCH_WINNER",
              bet_amount: proposal.bet_amount,
              status: "ACCEPTED",
              creator_id: proposal.creator_id,
              // Note: opponent_id is omitted as schema is unverified,
              // assuming creator_id and status are sufficient to start.
          })

          if (insertError) throw insertError

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
        const { data: existingProposal, error: fetchError } = await supabase
            .from("active_proposals")
            .select("id")
            .eq("creator_id", user.id)
            .maybeSingle() // Use maybeSingle to avoid error if not found

        if (existingProposal) {
            myProposalIdRef.current = existingProposal.id
            setIsInLobby(true)
        } else {
             // Create new proposal
            const { data: newProposal, error: insertError } = await supabase
            .from("active_proposals")
            .insert({
                game: selectedGame,
                bet_amount: 0,
                creator_id: user.id,
            })
            .select()
            .single()

            if (insertError) {
                console.error("Error creating matchmaking entry:", insertError)
                setError("No se pudo conectar al servidor de emparejamiento. Intenta de nuevo.")
                setLoading(false)
                return
            }

            if (newProposal) {
                myProposalIdRef.current = newProposal.id
                setIsInLobby(true)
            }
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
            },
            (payload) => {
              setProposals((prev) => prev.filter((p) => p.id !== payload.old.id))
            }
          )
          .subscribe()

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

      // Cleanup on unmount
      const idToDelete = myProposalIdRef.current
      if (idToDelete) {
        supabase.from("active_proposals").delete().eq("id", idToDelete).then(({ error }) => {
            if (error) console.error("Error cleaning up matchmaking entry:", error)
        })
      }
    }
  }, [selectedGame, router, supabase])

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
                {isInLobby ? "Estás en la sala. Esperando oponentes..." : "Conectando..."}
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-neon-cyan animate-spin" />
            <p className="text-gray-400">Conectando a la sala...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-neon-magenta animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Buscando oponentes...</p>
            <p className="text-gray-500 text-sm mt-2">No hay oponentes disponibles en este momento.</p>
        </div>
      ) : (
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
      )}
    </div>
  )
}
