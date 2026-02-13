"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, Swords, UserX } from "lucide-react"
import BetCard from "@/components/BetCard"
import { Button } from "@/components/ui/button"

interface Challenge {
  id: string
  game: string
  metric: string
  betAmount: number
  status: string
}

export default function MatchmakingPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ref to track the created challenge ID for cleanup
  const myChallengeIdRef = useRef<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    let intervalId: NodeJS.Timeout
    let mounted = true

    const initMatchmaking = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single()

        const username = profile?.username || "Jugador"

        // Insert challenge
        // Try 'SEARCHING' status first
        let { data: newChallenge, error: insertError } = await supabase
          .from("challenges")
          .insert({
            game: "Matchmaking",
            metric: username, // Storing username in metric field
            betAmount: 0,
            status: "SEARCHING"
          })
          .select()
          .single()

        if (insertError) {
            console.error("Error creating matchmaking entry (SEARCHING):", insertError)

            // Fallback: Try with status 'OPEN' if SEARCHING is invalid
            if (insertError.message?.includes("status") || insertError.code === "23514") { // check constraint
                 const retry = await supabase
                  .from("challenges")
                  .insert({
                    game: "Matchmaking",
                    metric: username,
                    betAmount: 0,
                    status: "OPEN"
                  })
                  .select()
                  .single()

                  newChallenge = retry.data
                  insertError = retry.error
            }
        }

        if (insertError) {
             console.error("Error creating matchmaking entry (Final):", insertError)
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

      // We fetch both SEARCHING and OPEN with game='Matchmaking' to cover both cases
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .in("status", ["SEARCHING", "OPEN"])
        .eq("game", "Matchmaking")
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
                Estás visible para otros jugadores. Esperando oponentes...
            </p>
        </div>
        <Button
            variant="destructive"
            onClick={() => router.push("/dashboard")}
            className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 backdrop-blur-md"
        >
            <UserX className="w-4 h-4 mr-2" />
            Salir de la Sala
        </Button>
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
                gameTitle="Jugador Disponible"
                winCondition={challenge.metric || "Usuario Anónimo"} // Display username here
                betAmount={0}
            />
            ))}
        </div>
      )}
    </div>
  )
}
