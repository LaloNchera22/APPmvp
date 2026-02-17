"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Swords, Send, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Define valid games based on Schema Enum GameTitle
const VALID_GAMES = [
  { id: "LEAGUE_OF_LEGENDS", name: "League of Legends" },
  { id: "VALORANT", name: "Valorant" },
  { id: "COD_WARZONE", name: "CoD: Warzone" },
  { id: "DOTA_2", name: "Dota 2" },
  { id: "FC_24", name: "EA FC 24" },
  { id: "CHESS_COM", name: "Chess.com" },
]

export default function DashboardPage() {
  const [inviteData, setInviteData] = useState({
    username: "",
    amount: "",
    challenge: ""
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Validate Amount
      const amount = parseFloat(inviteData.amount)
      if (isNaN(amount) || amount <= 0) {
        alert("Por favor ingresa un monto válido mayor a 0.")
        setLoading(false)
        return
      }

      // Validate Game
      const gameInput = inviteData.challenge.trim()
      const validGame = VALID_GAMES.find(
        (g) => g.id === gameInput || g.name.toLowerCase() === gameInput.toLowerCase()
      )

      if (!validGame) {
        alert(`Juego no válido. Juegos soportados: ${VALID_GAMES.map(g => g.name).join(", ")}`)
        setLoading(false)
        return
      }

      // Lookup Opponent
      const { data: opponentData, error: opponentError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", inviteData.username.trim())
        .maybeSingle()

      if (opponentError || !opponentData) {
        console.error("Opponent lookup error:", opponentError)
        alert("Usuario no encontrado. Verifica el nombre de usuario.")
        setLoading(false)
        return
      }

      if (opponentData.id === user.id) {
        alert("No puedes retarte a ti mismo.")
        setLoading(false)
        return
      }

      // Lock Bet
      const { error: lockError } = await supabase.rpc("lock_bet", {
        p_user_id: user.id,
        p_amount: amount
      })

      if (lockError) {
        console.error("Lock bet error:", lockError)
        alert("Error al bloquear saldo: " + lockError.message)
        setLoading(false)
        return
      }

      // Create Challenge
      const { error: insertError } = await supabase.from("challenges").insert({
        game: validGame.id,
        metric: "MATCH_WINNER",
        betAmount: amount,
        status: "OPEN",
        creatorId: user.id,
        challengerId: opponentData.id
      })

      if (insertError) {
        console.error("Challenge insert error:", insertError)
        alert("Error al crear el reto: " + insertError.message)
        // Ideally we should rollback lock_bet here, but we can't easily.
        // Alert user to contact support if money was deducted.
      } else {
        alert(`Invitación enviada a ${inviteData.username} para ${validGame.name} por $${amount}`)
        setInviteData({ username: "", amount: "", challenge: "" })
      }

    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Ocurrió un error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Inicio</h1>
        <p className="text-gray-400">Bienvenido a tu panel de control de apuestas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Send Invitation */}
        <Card className="border-neon-cyan/20 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-neon-cyan" />
              Mandar Invitación
            </CardTitle>
            <CardDescription>
              Desafía directamente a otro usuario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Usuario a retar</label>
                <Input
                  placeholder="Ej. PlayerOne"
                  value={inviteData.username}
                  onChange={(e) => setInviteData({...inviteData, username: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Cantidad de la apuesta ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={inviteData.amount}
                  onChange={(e) => setInviteData({...inviteData, amount: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                  min="0"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Reto / Juego</label>
                <Input
                  placeholder="Ej. League of Legends"
                  value={inviteData.challenge}
                  onChange={(e) => setInviteData({...inviteData, challenge: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Juegos válidos: {VALID_GAMES.map(g => g.name).join(", ")}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 hover:bg-neon-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Reto"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Section 2: Matchmaking */}
        <Card className="border-neon-magenta/20 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-neon-magenta" />
              Emparejamiento Rápido
            </CardTitle>
            <CardDescription>
              Busca oponentes disponibles en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-neon-magenta/5 border border-neon-magenta/10">
              <p className="text-sm text-gray-300 leading-relaxed">
                Entra a la sala de espera para encontrar otros usuarios que están buscando un reto.
                Tu propuesta estará visible mientras permanezcas en la sala.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <Swords className="w-16 h-16 text-neon-magenta/50 animate-pulse" />
              <Link href="/dashboard/matchmaking" className="w-full">
                <Button className="w-full bg-neon-magenta hover:bg-neon-magenta/80 text-black font-bold text-lg py-6 shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] transition-all">
                  Empezar Emparejamiento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}