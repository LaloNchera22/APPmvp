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

interface Challenge {
  id: string
  game: string
  metric: string
  betAmount: number
  status: string
  creator?: Creator
}

export default function MatchmakingPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<string | null>(null)

  // Ref to track the created challenge ID for cleanup
  const myChallengeIdRef = useRef<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId)
    setLoading(true)
  }

  useEffect(() => {
    if (!selectedGame) return

    let intervalId: NodeJS.Timeout
    let mounted = true

    const initMatchmaking = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        // Insert challenge with valid Enum values
        // game: selectedGame (e.g. LEAGUE_OF_LEGENDS)
        // metric: MATCH_WINNER (valid WinCondition)
        // status: OPEN (valid ChallengeStatus)
        const { data: newChallenge, error: insertError } = await supabase
          .from("challenges")
          .insert({
            game: selectedGame,
            metric: "MATCH_WINNER",
            betAmount: 0,
            status: "OPEN",
            creatorId: user.id,
          })
          .select()
          .single()

        if (insertError) {
             console.error("Error creating matchmaking entry:", insertError)
             setError("No se pudo conectar al servidor de emparejamiento. Intenta de nuevo.")
             setLoading(false)
             return
        }

        if (newChallenge) {
            myChallengeIdRef.current = newChallenge.id
        }

        // Initial fetch
        fetchChallenges()

        // Polling
        intervalId = setInterval(fetchChallenges, 5000)

      } catch (e) {
        console.error("Unexpected error:", e)
        setError("Ocurrió un error inesperado.")
        setLoading(false)
      }
    }

    const fetchChallenges = async () => {
      if (!mounted) return

      // Fetch OPEN challenges for the selected game
      // Include creator profile to show username
      const { data, error } = await supabase
        .from("challenges")
        .select("*, creator:profiles(username)")
        .eq("status", "OPEN")
        .eq("game", selectedGame)
        .neq("id", myChallengeIdRef.current || "00000000-0000-0000-0000-000000000000") // Exclude self
        .order("createdAt", { ascending: false })

      if (error) {
        console.error("Error fetching lobby:", error)
      } else {
        if (mounted) {
            setChallenges((data as unknown as Challenge[]) || [])
            setLoading(false)
        }
      }
    }

    initMatchmaking()

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
      // Cleanup
      const idToDelete = myChallengeIdRef.current
      if (idToDelete) {
        supabase.from("challenges").delete().eq("id", idToDelete).then(({ error }) => {
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
                Estás visible para otros jugadores. Esperando oponentes...
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
      ) : challenges.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-neon-magenta animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Buscando oponentes...</p>
            <p className="text-gray-500 text-sm mt-2">No hay otros jugadores buscando en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {challenges.map((challenge) => (
            <BetCard
                key={challenge.id}
                gameTitle="Jugador Disponible" // Or maybe "Retador"
                winCondition={challenge.creator?.username ? `Usuario: ${challenge.creator.username}` : "Usuario Anónimo"}
                betAmount={0}
            />
            ))}
        </div>
      )}
    </div>
  )
}
