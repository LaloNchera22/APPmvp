import { cn } from "@/lib/utils"
import { Swords } from "lucide-react"

interface BetCardProps {
  gameTitle: string
  winCondition: string
  betAmount: number
  onAccept?: () => void
  disabled?: boolean
  actionLabel?: string
}

export default function BetCard({
  gameTitle,
  winCondition,
  betAmount,
  onAccept,
  disabled = false,
  actionLabel = "Aceptar Reto"
}: BetCardProps) {
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
      "yeezy-card p-6 flex flex-col justify-between h-full transition-all duration-300 group relative overflow-hidden",
      disabled ? "opacity-60 grayscale" : "hover:-translate-y-1"
    )}>
      <div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">{displayTitle}</h3>
            <p className="text-sm text-foreground/80 font-bold uppercase mt-1">{displayCondition}</p>
          </div>
          <div className="p-3 bg-foreground text-background shadow-[4px_4px_0px_0px_rgba(17,17,17,1)]">
            <Swords className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 border-t-4 border-foreground pt-6">
        <div className="flex justify-between items-end mb-6">
          <span className="text-xs text-foreground/60 uppercase font-bold tracking-wider">Apuesta</span>
          <span className="font-pixel text-2xl font-bold text-foreground">
            {formattedAmount}
          </span>
        </div>

        <button
          onClick={disabled ? undefined : onAccept}
          disabled={disabled}
          className={cn(
            "w-full py-4 px-6 text-sm flex items-center justify-center gap-2",
            disabled
              ? "bg-foreground/20 text-foreground/50 border-4 border-foreground/20 cursor-not-allowed font-bold uppercase"
              : "yeezy-button"
          )}
        >
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  )
}
