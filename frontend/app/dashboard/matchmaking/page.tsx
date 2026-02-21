"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Swords, Loader2, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MatchmakingPage() {
  const [betAmount, setBetAmount] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const amount = parseFloat(betAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Por favor ingresa un monto válido.")
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/matchmaking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount: amount })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error && data.error.toLowerCase().includes("saldo insuficiente")) {
             setError("registra saldo en tu cuenta")
        } else {
             setError(data.error || "Error al crear el reto.")
        }
        setLoading(false)
        return
      }

      // Redirect to match room
      router.push(`/dashboard/match/${data.id}`)

    } catch (err) {
      console.error(err)
      setError("Error de conexión.")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md bg-[#050505] border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
            <div className="mx-auto w-16 h-16 bg-neon-magenta/10 rounded-full flex items-center justify-center ring-1 ring-neon-magenta/30">
                <Swords className="w-8 h-8 text-neon-magenta animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Crear Reto de Ajedrez</CardTitle>
            <p className="text-gray-400 text-sm">Define el valor de la apuesta para generar tu enlace.</p>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleCreateChallenge} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">Monto a Apostar (USD)</label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <Input
                            type="number"
                            step="0.01"
                            min="0.1"
                            placeholder="0.00"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-neon-magenta/50 focus:ring-neon-magenta/20 text-lg"
                            autoFocus
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-neon-magenta hover:bg-neon-magenta/90 text-white font-bold text-lg shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] transition-all"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Creando...
                        </>
                    ) : (
                        "Generar Link de Reto"
                    )}
                </Button>

                <p className="text-xs text-gray-500 text-center px-4">
                    Al crear el reto, el monto se descontará de tu billetera temporalmente hasta que finalice la partida.
                </p>
            </form>
        </CardContent>
      </Card>
    </div>
  )
}
