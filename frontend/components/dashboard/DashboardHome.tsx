'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Gamepad2, Zap, ArrowRight, ShieldCheck, Gamepad } from 'lucide-react';

// Mock Data
const LIVE_BETS = [
  { id: 1, game: 'League of Legends', user: 'FakerFan99', amount: 50.00, type: '1v1 Mid Lane' },
  { id: 2, game: 'FIFA 24', user: 'GoalMachine', amount: 25.00, type: 'Ultimate Team' },
  { id: 3, game: 'Warzone', user: 'SniperElite', amount: 100.00, type: 'Kill Race' },
];

export default function DashboardHome() {
  const [balance, setBalance] = useState(1250.50);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Logic to simulate live feed updates would go here
      // For now, just a placeholder effect
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 pb-24 md:p-8">
      {/* Header / Balance Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400 text-sm tracking-widest uppercase">Saldo Total</span>
          <Wallet className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="text-4xl md:text-5xl font-mono font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-magenta-500">
          ${balance.toFixed(2)}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
           <button className="flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 py-3 px-4 rounded-xl text-sm font-medium transition-all backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]">
             <span>Depositar</span>
           </button>
           <button className="flex items-center justify-center gap-2 bg-magenta-500/10 hover:bg-magenta-500/20 border border-magenta-500/30 text-magenta-400 py-3 px-4 rounded-xl text-sm font-medium transition-all backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]">
             <span>Retirar</span>
           </button>
        </div>
      </motion.div>

      {/* Action Button */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <button className="w-full relative group overflow-hidden p-[1px] rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600">
            <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors duration-300" />
            <div className="relative bg-[#0a0a0a] rounded-[15px] p-5 flex items-center justify-between group-hover:bg-[#0a0a0a]/90 transition-all">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                        <Gamepad2 className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-lg text-white">Crear Reto</h3>
                        <p className="text-gray-400 text-sm">Crea una partida y define la apuesta</p>
                    </div>
                </div>
                <div className="bg-white/10 p-2 rounded-full group-hover:bg-white/20 transition-colors">
                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />
                </div>
            </div>
        </button>
      </motion.div>

      {/* Live Lobby */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                Live Lobby
            </h2>
            <div className="flex items-center gap-2 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-400 font-mono font-bold tracking-wider">LIVE</span>
            </div>
        </div>

        <div className="space-y-3">
            {LIVE_BETS.map((bet, i) => (
                <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (i * 0.1) }}
                    whileHover={{ scale: 1.02 }}
                    className="group relative bg-white/5 border border-white/10 hover:border-cyan-500/50 rounded-xl p-4 backdrop-blur-sm transition-all overflow-hidden"
                >
                    {/* Glassmorphism gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/0 to-cyan-500/0 group-hover:via-cyan-500/5 transition-all duration-500" />

                    <div className="relative flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                           <Gamepad className="w-4 h-4 text-gray-500" />
                           <span className="text-xs font-bold text-gray-300 tracking-wide uppercase">
                               {bet.game}
                           </span>
                        </div>
                        <span className="font-mono text-lg text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                            ${bet.amount.toFixed(2)}
                        </span>
                    </div>

                    <div className="relative flex justify-between items-end">
                        <div>
                            <p className="font-medium text-white text-sm mb-1">{bet.type}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-green-500" />
                                <span className="text-gray-400">@{bet.user}</span>
                            </p>
                        </div>
                        <button className="bg-white/5 hover:bg-cyan-500 hover:text-black border border-white/10 hover:border-cyan-400 text-white text-xs font-bold py-2 px-5 rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/25">
                            ACEPTAR
                        </button>
                    </div>
                </motion.div>
            ))}
        </div>
      </div>

      {/* Bottom Nav Simulation */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-6 z-50">
        <div className="flex flex-col items-center gap-1 text-cyan-400">
           <Zap className="w-6 h-6" />
           <span className="text-[10px] font-medium">Lobby</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors">
           <Gamepad2 className="w-6 h-6" />
           <span className="text-[10px] font-medium">My Games</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors">
           <Wallet className="w-6 h-6" />
           <span className="text-[10px] font-medium">Wallet</span>
        </div>
      </div>
    </div>
  );
}
