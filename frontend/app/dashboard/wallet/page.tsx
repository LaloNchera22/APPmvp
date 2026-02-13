import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Wallet, Trophy } from "lucide-react"

export default async function WalletPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch Wallet
  const { data: walletData, error: walletError } = await supabase
    .from("wallets")
    .select("balance, escrow")
    .eq("userId", user.id)
    .single()

  if (walletError) {
    console.error("Error fetching wallet:", walletError)
  }

  const balance = Number(walletData?.balance || 0)
  const escrow = Number(walletData?.escrow || 0)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Mi Cartera</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Balance Card - Neon Cyan */}
           <div className="glass-card p-6 border-l-4 border-l-neon-cyan relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
               <Wallet className="w-24 h-24 text-neon-cyan" />
             </div>
             <h2 className="text-lg font-medium text-gray-400 mb-1">Balance Disponible</h2>
             <div className="font-mono text-4xl font-bold text-neon-cyan drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
               {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)}
             </div>
             <div className="mt-4 flex gap-2 relative z-10">
                <button className="px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan text-sm font-medium rounded-lg border border-neon-cyan/20 transition-colors">
                  Depositar
                </button>
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg border border-white/10 transition-colors">
                  Retirar
                </button>
             </div>
           </div>

           {/* Escrow Card - Purple/Magenta */}
           <div className="glass-card p-6 border-l-4 border-l-neon-magenta relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
               <Trophy className="w-24 h-24 text-neon-magenta" />
             </div>
             <h2 className="text-lg font-medium text-gray-400 mb-1">En Juego (Escrow)</h2>
             <div className="font-mono text-4xl font-bold text-neon-magenta drop-shadow-[0_0_10px_rgba(217,70,239,0.4)]">
               {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(escrow)}
             </div>
             <p className="text-xs text-gray-500 mt-4">
               Fondos bloqueados en partidas activas.
             </p>
           </div>
        </div>

        {/* Transaction History (Placeholder) */}
        <div className="glass-card p-6 rounded-xl border border-white/10 mt-6">
            <h3 className="text-xl font-bold text-white mb-4">Historial de Transacciones</h3>
            <div className="text-center py-8 text-gray-400 text-sm">
                No hay transacciones recientes.
            </div>
        </div>
    </div>
  )
}
