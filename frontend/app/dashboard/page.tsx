import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function Dashboard() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center space-y-4">
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-magenta">
        Bienvenido al Dashboard
      </h1>
      <p className="text-gray-400">
        Has iniciado sesión correctamente como <span className="text-white font-mono">{user.email}</span>.
      </p>
    </div>
  )
}
