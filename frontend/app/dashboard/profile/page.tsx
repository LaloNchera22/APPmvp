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
      <h1 className="text-3xl font-bold text-foreground uppercase tracking-tighter">Mi Perfil</h1>
      <div className="yeezy-card p-6">
        <div className="flex items-center gap-6 mb-8 border-b-4 border-foreground pb-8">
           <div className="w-24 h-24 bg-foreground text-background flex items-center justify-center text-4xl font-bold shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] border-2 border-foreground">
             {profile?.username?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase()}
           </div>
           <div>
             <h2 className="text-3xl font-bold text-foreground uppercase">{profile?.username || "Usuario"}</h2>
             <p className="text-foreground/80 font-bold uppercase">{user.email}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-4 bg-yeezy-light border-2 border-foreground">
              <label className="text-sm font-bold uppercase text-foreground/60">ID de Usuario</label>
              <p className="text-foreground font-pixel text-xs mt-2 truncate">{user.id}</p>
           </div>
           <div className="p-4 bg-yeezy-light border-2 border-foreground">
              <label className="text-sm font-bold uppercase text-foreground/60">Fecha de Registro</label>
              <p className="text-foreground font-pixel text-sm mt-2">{new Date(user.created_at).toLocaleDateString()}</p>
           </div>
        </div>
      </div>
    </div>
  )
}
