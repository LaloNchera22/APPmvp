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
      <h1 className="text-3xl font-bold text-foreground uppercase tracking-tighter">Mi Cartera</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Balance Card */}
           <div className="yeezy-card p-6 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity pointer-events-none">
               <Wallet className="w-24 h-24 text-foreground" />
             </div>
             <h2 className="text-lg font-bold uppercase text-foreground/80 mb-2">Balance Disponible</h2>
             <div className="font-pixel text-4xl font-bold text-foreground">
               {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)}
             </div>
             <div className="mt-8 flex gap-4 relative z-10">
                <button className="yeezy-button px-6 py-3 text-sm flex-1">
                  Depositar
                </button>
                <button className="yeezy-button bg-background text-foreground px-6 py-3 text-sm flex-1">
                  Retirar
                </button>
             </div>
           </div>

           {/* Escrow Card */}
           <div className="yeezy-card p-6 relative overflow-hidden group bg-foreground text-background shadow-[8px_8px_0px_0px_rgba(244,244,240,1)]">
             <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity pointer-events-none">
               <Trophy className="w-24 h-24 text-background" />
             </div>
             <h2 className="text-lg font-bold uppercase text-background/80 mb-2">En Juego (Escrow)</h2>
             <div className="font-pixel text-4xl font-bold text-background">
               {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(escrow)}
             </div>
             <p className="text-xs font-bold uppercase text-background/60 mt-8">
               Fondos bloqueados en partidas activas.
             </p>
           </div>
        </div>

        {/* Transaction History (Placeholder) */}
        <div className="yeezy-card p-6 mt-6">
            <h3 className="text-xl font-bold text-foreground uppercase tracking-tighter mb-6">Historial de Transacciones</h3>
            <div className="text-center py-12 text-foreground/60 text-sm font-bold uppercase border-4 border-dashed border-foreground/20">
                No hay transacciones recientes.
            </div>
        </div>
    </div>
  )
}
