"use client"

import { useState } from "react"
import Link from "next/link"
import { Swords, Send, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  const [inviteData, setInviteData] = useState({
    username: "",
    amount: "",
    challenge: ""
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock invitation logic
    console.log("Sending invitation:", inviteData)
    alert(`Invitación enviada a ${inviteData.username} para ${inviteData.challenge} por $${inviteData.amount}`)
    setInviteData({ username: "", amount: "", challenge: "" })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Inicio</h1>
        <p className="text-gray-400">Bienvenido a tu panel de control de apuestas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Send Invitation */}
        <Card className="border-neon-cyan/20 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-neon-cyan" />
              Mandar Invitación
            </CardTitle>
            <CardDescription>
              Desafía directamente a otro usuario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Usuario a retar</label>
                <Input
                  placeholder="Ej. PlayerOne"
                  value={inviteData.username}
                  onChange={(e) => setInviteData({...inviteData, username: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Cantidad de la apuesta ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={inviteData.amount}
                  onChange={(e) => setInviteData({...inviteData, amount: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Reto / Juego</label>
                <Input
                  placeholder="Ej. 1v1 Mid Lane"
                  value={inviteData.challenge}
                  onChange={(e) => setInviteData({...inviteData, challenge: e.target.value})}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 hover:bg-neon-cyan/20">
                Enviar Reto
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Section 2: Matchmaking */}
        <Card className="border-neon-magenta/20 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-neon-magenta" />
              Emparejamiento Rápido
            </CardTitle>
            <CardDescription>
              Busca oponentes disponibles en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-neon-magenta/5 border border-neon-magenta/10">
              <p className="text-sm text-gray-300 leading-relaxed">
                Entra a la sala de espera para encontrar otros usuarios que están buscando un reto.
                Tu propuesta estará visible mientras permanezcas en la sala.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <Swords className="w-16 h-16 text-neon-magenta/50 animate-pulse" />
              <Link href="/dashboard/matchmaking" className="w-full">
                <Button className="w-full bg-neon-magenta hover:bg-neon-magenta/80 text-black font-bold text-lg py-6 shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] transition-all">
                  Empezar Emparejamiento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
