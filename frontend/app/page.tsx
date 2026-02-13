"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Monitor, Swords, Wallet } from "lucide-react"
import LiveTicker from "@/components/LiveTicker"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-start overflow-hidden pt-20">

      {/* Background Glows */}
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/10 rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-magenta/10 rounded-full blur-[120px] opacity-20 animate-pulse" />
      </div>

      {/* Hero Section */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full max-w-7xl px-4 md:px-6 py-12 md:py-24 flex flex-col items-center text-center gap-8 relative z-10"
      >
        <motion.div variants={item} className="inline-flex items-center rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-sm font-medium text-neon-cyan backdrop-blur-sm">
          <span className="mr-2 flex h-2 w-2 relative">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan"></span>
          </span>
          MVP Alpha Live Now
        </motion.div>

        <motion.h1 variants={item} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-500 drop-shadow-sm">
          Monetiza tu <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-magenta drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            Habilidad
          </span>
        </motion.h1>

        <motion.p variants={item} className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8 text-gray-400">
          La primera plataforma P2P donde tus victorias en LoL, Warzone y FIFA se convierten en dinero real. Sin intermediarios, asegurado por contrato inteligente.
        </motion.p>

        <motion.div variants={item} className="flex gap-4 flex-col sm:flex-row">
          <Link href="/register">
            <Button size="lg" variant="neon" className="h-14 px-8 text-lg gap-2">
              Empezar Reto <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="glass" className="h-14 px-8 text-lg border border-white/10 hover:bg-white/5">
              Ver Demo
            </Button>
          </Link>
        </motion.div>
      </motion.section>

      {/* Live Ticker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="w-full mb-20"
      >
        <LiveTicker />
      </motion.div>

      {/* Feature Grid (Bento) */}
      <section className="w-full max-w-7xl px-4 md:px-6 pb-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:border-neon-cyan/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="p-3 bg-white/10 w-fit rounded-xl text-neon-cyan shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Monitor className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white group-hover:text-neon-cyan transition-colors">1. Conecta tu Juego</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Vincula tu cuenta de Riot, Steam o Activision. Nuestro oráculo verifica tus estadísticas en tiempo real.</p>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:border-neon-magenta/50 transition-all duration-300 md:col-span-1"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-neon-magenta/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="p-3 bg-white/10 w-fit rounded-xl text-neon-magenta shadow-[0_0_15px_rgba(217,70,239,0.2)]">
                <Swords className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white group-hover:text-neon-magenta transition-colors">2. Acepta un Reto</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Busca oponentes de tu nivel en el Lobby. Define el monto y las condiciones de victoria.</p>
              </div>
            </div>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             viewport={{ once: true }}
             whileHover={{ y: -5 }}
             className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:border-green-500/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="p-3 bg-white/10 w-fit rounded-xl text-green-400 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                <Wallet className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white group-hover:text-green-400 transition-colors">3. Gana Dinero Real</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Al finalizar la partida, el ganador recibe el premio automáticamente. Retiros instantáneos.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
