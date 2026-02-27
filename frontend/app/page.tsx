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

      {/* Hero Section */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full max-w-7xl px-4 md:px-6 py-12 md:py-24 flex flex-col items-center text-center gap-8 relative z-10"
      >
        <motion.div variants={item} className="inline-flex items-center rounded-none border-2 border-foreground bg-yeezy-light px-3 py-1 text-sm font-medium text-foreground">
          <span className="mr-2 flex h-2 w-2 relative">
             <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
          </span>
          MVP Alpha Live Now
        </motion.div>

        <motion.h1 variants={item} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-foreground">
          Monetiza tu <br />
          <span className="text-yeezy-dark">
            Habilidad
          </span>
        </motion.h1>

        <motion.p variants={item} className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8 text-foreground/80">
          La primera plataforma P2P donde tus victorias en LoL, Warzone y FIFA se convierten en dinero real. Sin intermediarios, asegurado por contrato inteligente.
        </motion.p>

        <motion.div variants={item} className="flex gap-4 flex-col sm:flex-row mt-8">
          <Link href="/register">
            <Button size="lg" className="yeezy-button h-14 px-8 text-lg gap-2">
              Empezar Reto <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" className="yeezy-button bg-yeezy-light text-foreground h-14 px-8 text-lg">
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
            className="yeezy-card p-8 transition-all duration-300"
          >
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="p-3 bg-foreground w-fit text-background">
                <Monitor className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-foreground">1. Conecta tu Juego</h3>
                <p className="text-foreground/80 text-sm leading-relaxed">Vincula tu cuenta de Riot, Steam o Activision. Nuestro oráculo verifica tus estadísticas en tiempo real.</p>
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
            className="yeezy-card p-8 transition-all duration-300 md:col-span-1"
          >
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="p-3 bg-foreground w-fit text-background">
                <Swords className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-foreground">2. Acepta un Reto</h3>
                <p className="text-foreground/80 text-sm leading-relaxed">Busca oponentes de tu nivel en el Lobby. Define el monto y las condiciones de victoria.</p>
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
             className="yeezy-card p-8 transition-all duration-300"
          >
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="p-3 bg-foreground w-fit text-background">
                <Wallet className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-foreground">3. Gana Dinero Real</h3>
                <p className="text-foreground/80 text-sm leading-relaxed">Al finalizar la partida, el ganador recibe el premio automáticamente. Retiros instantáneos.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
