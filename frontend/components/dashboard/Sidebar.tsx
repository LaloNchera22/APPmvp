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
    <div className="hidden md:flex flex-col w-64 border-r-4 border-foreground bg-background h-[calc(100vh-64px)] fixed top-16 left-0 overflow-y-auto z-40">
      <div className="flex-1 py-6 px-4 space-y-4">
        <div className="px-2 mb-6 border-b-4 border-foreground pb-4">
           <h2 className="text-xl font-bold text-foreground uppercase tracking-tighter">Panel de Control</h2>
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
                  "flex items-center gap-3 px-3 py-3 font-bold uppercase transition-all border-2",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] translate-x-[-2px] translate-y-[-2px]"
                    : "bg-background text-foreground border-transparent hover:border-foreground hover:bg-yeezy-light"
                )}
              >
                <item.icon className={cn("w-5 h-5", isMatchmaking && !isActive && "animate-pulse")} />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t-4 border-foreground bg-yeezy-light">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:bg-red-600 hover:text-background rounded-none font-bold uppercase gap-3 transition-colors border-2 border-transparent hover:border-red-600"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}
