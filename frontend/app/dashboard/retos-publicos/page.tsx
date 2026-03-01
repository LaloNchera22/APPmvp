import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Swords } from "lucide-react"

interface Challenge {
  id: string
  game: string
  metric: string
  betAmount: number
  status: string
  createdAt: string
  creatorId: string
  type: string
}

export default async function PublicChallengesPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch Open Public Challenges
  const { data: challengesData, error: challengesError } = await supabase
    .from("challenges")
    .select("*")
    .eq("status", "OPEN")
    .eq("match_type", "public")
    .order("createdAt", { ascending: false })

  if (challengesError) {
    console.error("Error fetching challenges:", challengesError)
  }

  const challenges = (challengesData as unknown as Challenge[]) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 uppercase font-pixel">
              <Swords className="text-foreground w-8 h-8" />
              Retos Públicos
            </h1>
      </div>

      {!challenges || challenges.length === 0 ? (
        <div className="text-center py-20 bg-background border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
            <p className="text-foreground/80 font-bold uppercase text-xl">No hay retos disponibles en este momento.</p>
        </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {challenges.map((challenge) => (
            <div key={challenge.id} className="yeezy-card p-6 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-pixel text-lg text-foreground uppercase">Ajedrez</h3>
                    <p className="text-sm font-bold text-foreground/60 uppercase">
                      1v1 Nativo
                    </p>
                  </div>
              </div>

              <div className="space-y-1 my-4">
                  <p className="text-sm text-foreground/60 font-bold uppercase">Premio Total</p>
                  <p className="text-3xl font-black text-foreground">
                    ${(Number(challenge.betAmount) * 2).toFixed(2)}
                  </p>
              </div>

              {challenge.creatorId !== user.id ? (
                  <form action={`/dashboard/play/${challenge.id}`}>
                      <button type="submit" className="yeezy-button w-full font-bold">
                        Aceptar por ${challenge.betAmount}
                      </button>
                  </form>
              ) : (
                  <button disabled className="yeezy-button bg-foreground/10 text-foreground/50 border-foreground/10 cursor-not-allowed w-full font-bold">
                    Tu Reto
                  </button>
              )}
            </div>
            ))}
        </div>
      )}
    </div>
  )
}
