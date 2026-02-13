"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, Wallet, LogOut, User as UserIcon, Trophy, Home } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { User } from "@supabase/supabase-js"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState("0.00")
  const [username, setUsername] = useState<string | null>(null)
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
          .eq("user_id", currentUser.id)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/60 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Home className="h-6 w-6 text-white hover:text-neon-cyan transition-colors" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {user ? (
              <>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
                  <Wallet className="h-4 w-4 text-neon-cyan" />
                  <span className="font-mono text-sm font-bold text-white">${balance}</span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-9 w-9 border border-white/10 transition-transform hover:scale-105">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || ""} />
                        <AvatarFallback>
                          {user.email?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-white">
                          {username || user.user_metadata?.full_name || "Usuario"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground text-gray-400">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Trophy className="mr-2 h-4 w-4" />
                      <span>Mis Retos</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/login">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5">
                    Ingresar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="neon" className="font-bold">
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
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white focus:outline-none"
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
            className="md:hidden border-b border-white/5 bg-[#050505]"
          >
            <div className="space-y-1 px-4 pb-3 pt-2">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar className="h-10 w-10 border border-white/10">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback>{user.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {username || user.user_metadata?.full_name || user.email}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                         Saldo: ${balance}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                     <Button variant="ghost" className="w-full justify-start text-gray-300">
                        <UserIcon className="mr-2 h-4 w-4" /> Perfil
                     </Button>
                     <Button variant="ghost" className="w-full justify-start text-gray-300">
                        <Trophy className="mr-2 h-4 w-4" /> Mis Retos
                     </Button>
                     <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-500/10"
                     >
                        <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                     </Button>
                  </div>
                </>
              ) : (
                <div className="grid gap-2 p-2">
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    <Button variant="glass" className="w-full justify-center">
                      Ingresar
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsOpen(false)}>
                    <Button variant="neon" className="w-full justify-center">
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
