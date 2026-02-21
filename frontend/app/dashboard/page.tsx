"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { Swords, Wallet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchWallet = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("wallets")
        .select("balance")
        .eq("userId", user.id)
        .single()

      if (!error && data) {
        setBalance(data.balance)
      }
      setLoading(false)
    }

    fetchWallet()
  }, [supabase])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center animate-in fade-in duration-500">

      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Bienvenido, Jugador</h1>
        <p className="text-gray-400 text-lg">Tu plataforma de ajedrez por dinero real.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-w-[300px] backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3 mb-2 text-gray-400">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Saldo Disponible</span>
        </div>
        {loading ? (
            <Loader2 className="w-8 h-8 text-neon-cyan animate-spin mx-auto" />
        ) : (
            <div className="text-4xl font-mono font-bold text-white flex items-center justify-center gap-1">
                <span className="text-neon-cyan">$</span>
                {balance !== null ? balance.toFixed(2) : "0.00"}
            </div>
        )}
      </div>

      <Link href="/dashboard/matchmaking">
        <Button className="bg-neon-magenta hover:bg-neon-magenta/90 text-white font-bold text-xl px-10 py-8 rounded-2xl shadow-[0_0_30px_rgba(217,70,239,0.4)] hover:shadow-[0_0_50px_rgba(217,70,239,0.6)] transition-all transform hover:-translate-y-1 group">
            <Swords className="w-8 h-8 mr-3 group-hover:rotate-12 transition-transform" />
            Crear Partida de Ajedrez
        </Button>
      </Link>

    </div>
  )
}
