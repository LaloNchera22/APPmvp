import { Swords, Gamepad2, Trophy, Crown } from "lucide-react"

const games = [
  {
    id: "chess",
    title: "Chess.com",
    description: "Demuestra tu estrategia en el tablero de 64 casillas.",
    icon: Crown,
  },
  {
    id: "lol",
    title: "League of Legends",
    description: "Invoca, lucha y destruye el nexo enemigo.",
    icon: Swords,
  },
  {
    id: "warzone",
    title: "Call of Duty: Warzone",
    description: "Sobrevive hasta el final en el battle royale definitivo.",
    icon: Trophy,
  },
  {
    id: "fifa",
    title: "EA Sports FC 24",
    description: "Compite en el campo y demuestra tus habilidades.",
    icon: Gamepad2,
  },
]

export default function GamesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground uppercase tracking-tighter">Juegos Disponibles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <div key={game.id} className="yeezy-card p-6 hover:-translate-y-1 transition-transform cursor-pointer group">
             <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center mb-4">
                <game.icon className="w-6 h-6" />
             </div>
             <h3 className="text-xl font-bold text-foreground mb-2 uppercase group-hover:underline">{game.title}</h3>
             <p className="text-foreground/80 text-sm mb-6 font-bold">{game.description}</p>
             <button className="yeezy-button w-full py-3 text-sm">
               Ver Retos
             </button>
          </div>
        ))}
      </div>
    </div>
  )
}
