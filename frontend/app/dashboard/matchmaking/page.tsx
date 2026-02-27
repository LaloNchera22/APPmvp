"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Swords, Loader2, DollarSign } from "lucide-react"

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 font-mono">
      <div className="yeezy-card w-full max-w-md p-8 flex flex-col items-center text-center">
        <div className="mb-6 border-4 border-foreground p-4 bg-background">
          <Swords className="w-12 h-12 text-foreground" />
        </div>

        <h1 className="text-2xl font-pixel uppercase mb-2 text-foreground">Crear Reto de Ajedrez</h1>
        <p className="text-foreground/80 mb-8 font-bold">DEFINE EL VALOR DE LA APUESTA PARA GENERAR TU ENLACE.</p>

        <form onSubmit={handleCreateChallenge} className="w-full space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-sm font-pixel uppercase text-foreground block">Monto a Apostar (USD)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground" />
              <input
                type="number"
                step="0.01"
                min="0.1"
                placeholder="0.00"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full pl-12 h-14 bg-background border-4 border-foreground text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-0 text-xl font-bold rounded-none shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] transition-all"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="p-3 border-4 border-red-500 bg-red-100 text-red-700 font-bold text-sm uppercase text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="yeezy-button w-full h-14 flex items-center justify-center text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                CREANDO...
              </>
            ) : (
              "GENERAR LINK DE RETO"
            )}
          </button>

          <p className="text-xs text-foreground/70 text-center font-bold px-4 uppercase mt-4">
            Al crear el reto, el monto se descontará de tu billetera temporalmente hasta que finalice la partida.
          </p>
        </form>
      </div>
    </div>
  )
}
