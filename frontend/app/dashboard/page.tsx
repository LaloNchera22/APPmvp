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
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground uppercase tracking-tighter">Bienvenido, Jugador</h1>
        <p className="text-foreground/80 text-lg font-bold uppercase">Tu plataforma de ajedrez por dinero real.</p>
      </div>

      <div className="yeezy-card p-6 min-w-[300px]">
        <div className="flex items-center justify-center gap-3 mb-4 text-foreground">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Saldo Disponible</span>
        </div>
        {loading ? (
            <Loader2 className="w-8 h-8 text-foreground animate-spin mx-auto" />
        ) : (
            <div className="text-4xl font-pixel font-bold text-foreground flex items-center justify-center gap-2">
                <span>$</span>
                {balance !== null ? balance.toFixed(2) : "0.00"}
            </div>
        )}
      </div>

      <Link href="/dashboard/matchmaking">
        <Button className="yeezy-button text-xl px-10 py-8 group">
            <Swords className="w-8 h-8 mr-3 group-hover:rotate-12 transition-transform" />
            Crear Partida de Ajedrez
        </Button>
      </Link>

    </div>
  )
}
