import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Mi Perfil</h1>
      <div className="glass-card p-6 rounded-xl border border-white/10">
        <div className="flex items-center gap-4">
           <div className="w-20 h-20 rounded-full bg-neon-cyan/20 flex items-center justify-center text-neon-cyan text-3xl font-bold border border-neon-cyan/50">
             {profile?.username?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase()}
           </div>
           <div>
             <h2 className="text-2xl font-bold text-white">{profile?.username || "Usuario"}</h2>
             <p className="text-gray-400">{user.email}</p>
           </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-4 bg-white/5 rounded-lg border border-white/5">
              <label className="text-sm text-gray-400">ID de Usuario</label>
              <p className="text-white font-mono text-sm mt-1">{user.id}</p>
           </div>
           <div className="p-4 bg-white/5 rounded-lg border border-white/5">
              <label className="text-sm text-gray-400">Fecha de Registro</label>
              <p className="text-white font-mono text-sm mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
           </div>
        </div>
      </div>
    </div>
  )
}
