import { cn } from "@/lib/utils"
import { Swords } from "lucide-react"

interface BetCardProps {
  gameTitle: string
  winCondition: string
  betAmount: number
  onAccept?: () => void
}

export default function BetCard({ gameTitle, winCondition, betAmount, onAccept }: BetCardProps) {
  // Helper to format enums (e.g. LEAGUE_OF_LEGENDS -> League Of Legends)
  const formatText = (text: string) => {
    return text
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      // Optional: specific fixes for known acronyms if needed
      .replace(/\bCod\b/g, 'CoD')
      .replace(/\bFc\b/g, 'FC');
  }

  const displayTitle = formatText(gameTitle);
  const displayCondition = formatText(winCondition);

  // Format currency
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(betAmount)

  return (
    <div className={cn(
      "glass-card p-6 flex flex-col justify-between h-full border-l-4 border-l-neon-magenta hover:border-l-neon-cyan transition-all duration-300 group relative overflow-hidden"
    )}>
      {/* Background glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">{displayTitle}</h3>
            <p className="text-sm text-gray-400 mt-1">{displayCondition}</p>
          </div>
          <div className="p-2 bg-white/5 rounded-lg text-neon-magenta group-hover:text-neon-cyan transition-colors">
            <Swords className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <div className="flex justify-between items-end mb-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Apuesta</span>
          <span className="font-mono text-2xl font-bold text-neon-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">
            {formattedAmount}
          </span>
        </div>

        <button
          onClick={onAccept}
          className="w-full py-2.5 px-4 bg-white/10 hover:bg-neon-magenta/20 text-white text-sm font-medium rounded-lg border border-white/10 hover:border-neon-magenta/50 transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-[0_0_15px_rgba(217,70,239,0.2)]"
        >
          <span>Aceptar Reto</span>
        </button>
      </div>
    </div>
  )
}
