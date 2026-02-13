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
    <div className="w-full bg-[#0a0a0a]/50 border-y border-white/5 overflow-hidden py-3 backdrop-blur-sm">
      <div className="flex w-full whitespace-nowrap overflow-hidden relative">
        <motion.div
          className="flex gap-12 items-center pl-12"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
        >
          {[...MOCK_BETS, ...MOCK_BETS, ...MOCK_BETS, ...MOCK_BETS].map((bet, idx) => (
            <div key={`${bet.id}-${idx}`} className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-neon-cyan/80 font-mono font-bold text-base">${bet.amount}</span>
              <span className="text-gray-500 text-xs uppercase tracking-wider">WIN</span>
              <span className="font-bold text-gray-300 flex items-center gap-2">
                 {bet.game === "LoL" && <Swords className="w-4 h-4 text-gray-500" />}
                 {bet.game === "Warzone" && <Crosshair className="w-4 h-4 text-gray-500" />}
                 {bet.game === "FIFA" && <Gamepad2 className="w-4 h-4 text-gray-500" />}
                 {bet.game}
              </span>
              <span className="text-gray-600">|</span>
              <span className="text-xs text-gray-500 font-medium">@{bet.user}</span>
            </div>
          ))}
        </motion.div>

        {/* Gradient fades for edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  )
}
