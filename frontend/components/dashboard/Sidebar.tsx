"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, Swords, LogOut, User, Gamepad2 } from "lucide-react"
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
    title: "Perfil",
    href: "/dashboard/perfil",
    icon: User,
  },
  {
    title: "Juegos",
    href: "/dashboard/games",
    icon: Gamepad2,
  },
  {
    title: "Cartera",
    href: "/dashboard/wallet",
    icon: Wallet,
  },
  {
    title: "Emparejamientos",
    href: "/dashboard/retos-publicos",
    icon: Swords,
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
    <div className="hidden md:flex flex-col w-64 border-r border-[#222222] bg-[#000000] h-[calc(100vh-64px)] fixed top-16 left-0 overflow-y-auto z-40">
      <div className="flex-1 py-6 px-4 space-y-4">
        <div className="px-2 mb-6">
           <h2 className="text-lg font-bold text-white font-sans tracking-normal capitalize">Panel de Control</h2>
        </div>

        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || (pathname?.startsWith(item.href) && item.href !== "/dashboard")

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-sans font-medium transition-all rounded-md normal-case tracking-normal",
                  isActive
                    ? "bg-[#222222] text-[#00a8ff]"
                    : "text-gray-400 hover:text-white hover:bg-[#111111]"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-[#00a8ff]" : "text-gray-400")} />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-[#222222] bg-[#000000]">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:bg-transparent hover:text-red-400 rounded-md font-sans font-medium gap-3 transition-colors px-3 py-2 h-auto normal-case tracking-normal"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}
