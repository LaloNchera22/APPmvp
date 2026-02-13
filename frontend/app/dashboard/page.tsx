import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import BetCard from "@/components/BetCard";
import { Wallet, Swords, Trophy } from "lucide-react";

interface Challenge {
  id: string;
  game: string;
  metric: string;
  betAmount: number;
  status: string;
  createdAt: string;
}

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch Wallet
  const { data: walletData, error: walletError } = await supabase
    .from("wallets")
    .select("balance, escrow")
    .eq("userId", user.id)
    .single();

  if (walletError) {
    console.error("Error fetching wallet:", walletError);
  }

  // Fetch Open Challenges
  const { data: challengesData, error: challengesError } = await supabase
    .from("challenges")
    .select("*")
    .eq("status", "OPEN")
    .order("createdAt", { ascending: false });

  if (challengesError) {
    console.error("Error fetching challenges:", challengesError);
  }

  // Cast to Challenge[] to fix 'any' type error
  const challenges = (challengesData as unknown as Challenge[]) || [];

  const balance = Number(walletData?.balance || 0);
  const escrow = Number(walletData?.escrow || 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-24 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
             <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-500">
               Dashboard
             </h1>
             <p className="text-gray-400 mt-1">Bienvenido, desafiante.</p>
          </div>
        </header>

        {/* Balance Section */}
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

        {/* Challenges Feed */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Swords className="text-neon-magenta w-6 h-6" />
              Retos Disponibles
            </h2>
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
        </section>
      </div>
    </div>
  );
}
