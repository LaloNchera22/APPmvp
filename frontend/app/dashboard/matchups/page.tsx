import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import BetCard from "@/components/BetCard"
import { Swords } from "lucide-react"

interface Challenge {
  id: string
  game: string
  metric: string
  betAmount: number
  status: string
  createdAt: string
}

export default async function MatchupsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch Open Challenges
  const { data: challengesData, error: challengesError } = await supabase
    .from("challenges")
    .select("*")
    .eq("status", "OPEN")
    .order("createdAt", { ascending: false })

  if (challengesError) {
    console.error("Error fetching challenges:", challengesError)
  }

  // Cast to Challenge[] to fix 'any' type error
  const challenges = (challengesData as unknown as Challenge[]) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Swords className="text-neon-magenta w-8 h-8" />
              Retos Disponibles
            </h1>
            {/* Optional Filter Button */}
            <button className="text-sm text-gray-400 hover:text-white transition-colors">
              Ver Todos
            </button>
      </div>

      {!challenges || challenges.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <p className="text-gray-400">No hay retos disponibles en este momento.</p>
            <button className="mt-4 px-6 py-2 bg-neon-magenta/10 hover:bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/20 rounded-lg transition-all">
            Crear Reto
            </button>
        </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {challenges.map((challenge) => (
            <BetCard
                key={challenge.id}
                gameTitle={challenge.game || "Unknown Game"}
                winCondition={challenge.metric || "Unknown Rule"}
                betAmount={Number(challenge.betAmount || 0)}
            />
            ))}
        </div>
      )}
    </div>
  )
}
