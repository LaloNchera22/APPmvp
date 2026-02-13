import { Swords, Gamepad2, Trophy } from "lucide-react"

const games = [
  {
    id: "lol",
    title: "League of Legends",
    description: "Invoca, lucha y destruye el nexo enemigo.",
    icon: Swords,
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
    border: "border-neon-cyan/20",
  },
  {
    id: "warzone",
    title: "Call of Duty: Warzone",
    description: "Sobrevive hasta el final en el battle royale definitivo.",
    icon: Trophy,
    color: "text-neon-magenta",
    bg: "bg-neon-magenta/10",
    border: "border-neon-magenta/20",
  },
  {
    id: "fifa",
    title: "EA Sports FC 24",
    description: "Compite en el campo y demuestra tus habilidades.",
    icon: Gamepad2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
]

export default function GamesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Juegos Disponibles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <div key={game.id} className={`glass-card p-6 rounded-xl border ${game.border} hover:scale-[1.02] transition-transform cursor-pointer group`}>
             <div className={`w-12 h-12 rounded-lg ${game.bg} flex items-center justify-center mb-4`}>
                <game.icon className={`w-6 h-6 ${game.color}`} />
             </div>
             <h3 className="text-xl font-bold text-white mb-2 group-hover:text-neon-cyan transition-colors">{game.title}</h3>
             <p className="text-gray-400 text-sm mb-6">{game.description}</p>
             <button className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors">
               Ver Retos
             </button>
          </div>
        ))}
      </div>
    </div>
  )
}
