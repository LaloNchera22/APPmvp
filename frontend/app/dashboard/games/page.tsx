import { Swords, Gamepad2 } from "lucide-react"

const games = [
  {
    id: "lol",
    title: "League of Legends",
  },
  {
    id: "valorant",
    title: "Valorant",
  },
  {
    id: "warzone",
    title: "CoD: Warzone",
  },
  {
    id: "dota2",
    title: "Dota 2",
  },
  {
    id: "fifa",
    title: "EA FC 24",
  },
]

export default function GamesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 font-sans capitalize tracking-normal">
          <Gamepad2 className="w-8 h-8 text-[#d946ef]" />
          Selecciona tu Juego
        </h1>
        <p className="text-gray-400 text-sm font-sans font-normal normal-case pt-2">Elige el juego para entrar a la sala de emparejamiento.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
        {games.map((game) => (
          <div
            key={game.id}
            className="bg-[#111111] border border-[#222222] rounded-xl p-8 flex flex-col items-center justify-center gap-4 hover:border-[#333333] hover:bg-[#161616] transition-colors cursor-pointer min-h-[160px] shadow-none"
          >
             <Swords className="w-10 h-10 text-[#d946ef]" />
             <h3 className="text-lg font-bold text-white text-center font-sans normal-case tracking-normal">{game.title}</h3>
          </div>
        ))}
      </div>
    </div>
  )
}
