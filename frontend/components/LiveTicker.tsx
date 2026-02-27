"use client"

import { motion } from "framer-motion"
import { Gamepad2, Crosshair, Swords } from "lucide-react"

const MOCK_BETS = [
  { id: 1, game: "LoL", user: "FakerFan", amount: 20, type: "1v1 Mid" },
  { id: 2, game: "Warzone", user: "SniperElite", amount: 50, type: "Kill Race" },
  { id: 3, game: "FIFA", user: "GoalMachine", amount: 15, type: "Ultimate Team" },
  { id: 4, game: "Valorant", user: "JettMain", amount: 100, type: "Spike Rush" },
  { id: 5, game: "CS2", user: "GlobalElite", amount: 30, type: "Wingman" },
  { id: 6, game: "Dota 2", user: "InvokerGod", amount: 45, type: "1v1 Mid" },
]

export default function LiveTicker() {
  return (
    <div className="w-full bg-foreground border-y-4 border-foreground overflow-hidden py-4 text-background">
      <div className="flex w-full whitespace-nowrap overflow-hidden relative">
        <motion.div
          className="flex gap-16 items-center pl-16"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
        >
          {[...MOCK_BETS, ...MOCK_BETS, ...MOCK_BETS, ...MOCK_BETS].map((bet, idx) => (
            <div key={`${bet.id}-${idx}`} className="flex items-center gap-4 text-sm font-bold uppercase tracking-wider">
              <span className="font-pixel text-base">${bet.amount}</span>
              <span className="text-background/50">WIN</span>
              <span className="flex items-center gap-2">
                 {bet.game === "LoL" && <Swords className="w-5 h-5" />}
                 {bet.game === "Warzone" && <Crosshair className="w-5 h-5" />}
                 {bet.game === "FIFA" && <Gamepad2 className="w-5 h-5" />}
                 {bet.game}
              </span>
              <span className="text-background/20">|</span>
              <span className="text-background/80">@{bet.user}</span>
            </div>
          ))}
        </motion.div>

        {/* Gradient fades for edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-foreground to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-foreground to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  )
}
