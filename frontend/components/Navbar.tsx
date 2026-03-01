"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, Wallet, LogOut, User as UserIcon, Trophy, LayoutDashboard, Home } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { User } from "@supabase/supabase-js"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState("0.00")
  const [username, setUsername] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUserData = async (currentUser: User | null) => {
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", currentUser.id)
          .single()
        if (profile) setUsername(profile.username)

        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("userId", currentUser.id)
          .single()
        if (wallet) setBalance(Number(wallet.balance).toFixed(2))
      } else {
        setBalance("0.00")
        setUsername(null)
      }
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) await fetchUserData(user)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserData(session.user)
      else {
        setBalance("0.00")
        setUsername(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    const handleBalanceUpdate = async () => {
      if (!user) return
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("userId", user.id)
        .single()
      if (wallet) setBalance(Number(wallet.balance).toFixed(2))
    }

    window.addEventListener('balanceUpdated', handleBalanceUpdate)
    return () => window.removeEventListener('balanceUpdated', handleBalanceUpdate)
  }, [user, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push("/")
    router.refresh()
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#222222] bg-[#000000]">
      <div className="px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-white flex items-center justify-center p-2 rounded-md hover:bg-[#1a1a1a]">
             <Home className="w-6 h-6" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" className="text-foreground hover:bg-foreground hover:text-background rounded-none gap-2 font-bold uppercase transition-colors">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>

                <div className="flex items-center gap-2 border-2 border-foreground bg-yeezy-light px-4 py-1.5 shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                  <Wallet className="h-4 w-4 text-foreground" />
                  <span className="font-pixel text-sm font-bold text-foreground">${balance}</span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-none border-2 border-foreground bg-yeezy-light hover:bg-foreground hover:text-background shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] p-0 flex items-center justify-center">
                      <span className="font-bold text-sm">
                        {user.email?.substring(0, 2).toUpperCase()}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-none border-4 border-foreground bg-background shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold leading-none text-foreground uppercase">
                          {username || user.user_metadata?.full_name || "Usuario"}
                        </p>
                        <p className="text-xs leading-none text-foreground/70">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-foreground h-0.5" />
                    <DropdownMenuItem className="focus:bg-foreground focus:text-background rounded-none cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span className="font-bold uppercase text-sm">Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="focus:bg-foreground focus:text-background rounded-none cursor-pointer">
                      <Trophy className="mr-2 h-4 w-4" />
                      <span className="font-bold uppercase text-sm">Mis Retos</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-foreground h-0.5" />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:bg-red-600 focus:text-background rounded-none cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span className="font-bold uppercase text-sm">Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/login">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-transparent rounded-md text-sm font-sans font-medium transition-colors normal-case tracking-normal">
                    Ingresar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-[#000000] border border-[#00a8ff] text-[#00a8ff] hover:bg-[#00a8ff]/10 rounded-md text-sm font-sans font-medium px-4 h-9 normal-case tracking-normal shadow-none">
                    Registrarse
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 text-foreground hover:bg-foreground hover:text-background border-2 border-transparent hover:border-foreground transition-colors focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b-4 border-foreground bg-background"
          >
            <div className="space-y-1 px-4 pb-3 pt-2">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-foreground/20 pb-4">
                    <div className="h-10 w-10 border-2 border-foreground bg-yeezy-light flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_rgba(17,17,17,1)]">
                      {user.email?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground uppercase">
                        {username || user.user_metadata?.full_name || user.email}
                      </span>
                      <span className="text-xs text-foreground/70 font-pixel mt-1">
                         Saldo: ${balance}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                     <Button variant="ghost" className="w-full justify-start text-foreground hover:bg-foreground hover:text-background rounded-none font-bold uppercase">
                        <UserIcon className="mr-2 h-4 w-4" /> Perfil
                     </Button>
                     <Button variant="ghost" className="w-full justify-start text-foreground hover:bg-foreground hover:text-background rounded-none font-bold uppercase">
                        <Trophy className="mr-2 h-4 w-4" /> Mis Retos
                     </Button>
                     <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                       <Button variant="ghost" className="w-full justify-start text-foreground hover:bg-foreground hover:text-background rounded-none font-bold uppercase">
                          <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                       </Button>
                     </Link>
                     <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full justify-start text-red-600 hover:bg-red-600 hover:text-background rounded-none font-bold uppercase mt-4"
                     >
                        <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                     </Button>
                  </div>
                </>
              ) : (
                <div className="grid gap-3 p-2">
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" className="w-full justify-center rounded-none border-2 border-foreground font-bold uppercase hover:bg-foreground hover:text-background">
                      Ingresar
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsOpen(false)}>
                    <Button className="w-full justify-center yeezy-button">
                      Registrarse
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
