"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, Swords, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

const sidebarItems = [
  {
    title: "Inicio",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Jugar Ajedrez",
    href: "/dashboard/matchmaking",
    icon: Swords,
  },
  {
    title: "Mi Billetera",
    href: "/dashboard/wallet",
    icon: Wallet,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#050505] h-[calc(100vh-64px)] fixed top-16 left-0 overflow-y-auto z-40">
      <div className="flex-1 py-6 px-4 space-y-4">
        <div className="px-2 mb-6">
           <h2 className="text-xl font-bold text-white tracking-tight">Panel de Control</h2>
        </div>

        <nav className="space-y-2">
          {sidebarItems.map((item) => {
            const isMatchmaking = item.href === "/dashboard/matchmaking"
            const isActive = pathname === item.href || pathname?.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? isMatchmaking
                      ? "bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30"
                      : "bg-white/10 text-neon-cyan"
                    : isMatchmaking
                    ? "text-neon-magenta/80 hover:text-neon-magenta hover:bg-neon-magenta/10 border border-transparent hover:border-neon-magenta/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5", isMatchmaking && "animate-pulse")} />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/5">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-3"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}
