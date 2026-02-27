"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import GoogleButton from "@/components/auth/GoogleButton"

// Validation Schema
const authSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }),
})

type AuthFormValues = z.infer<typeof authSchema>

interface AuthFormProps {
  type: "login" | "register"
}

export function AuthForm({ type }: AuthFormProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const supabase = createClient()

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: AuthFormValues) {
    setIsLoading(true)

    try {
      if (type === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
        window.location.href = "/dashboard"
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
          },
        })
        if (error) throw error

        if (signUpData.session) {
          window.location.href = "/dashboard"
        } else {
          alert("Revisa tu email para confirmar tu cuenta")
        }
      }
    } catch (error) {
      alert((error as Error).message || "Ocurrió un error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: "google" | "discord") => {
     try {
        const { error } = await supabase.auth.signInWithOAuth({
           provider,
           options: {
              redirectTo: `${location.origin}/auth/callback?next=/dashboard`
           }
        })
        if (error) throw error
     } catch (error) {
        alert("Error con Social Login: " + (error as Error).message)
     }
  }

  return (
    <Card className="w-[350px] yeezy-card">
      <CardHeader>
        <CardTitle className="text-foreground">{type === "login" ? "Ingresar" : "Crear Cuenta"}</CardTitle>
        <CardDescription className="text-foreground/80">
          {type === "login"
            ? "Ingresa tu email y contraseña para continuar."
            : "Regístrate para empezar a ganar dinero."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Input
              id="email"
              placeholder="nombre@ejemplo.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Input
              id="password"
              placeholder="********"
              type="password"
              autoComplete="current-password"
              disabled={isLoading}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
               <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button disabled={isLoading} className="w-full yeezy-button">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {type === "login" ? "Ingresar" : "Registrarse"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-foreground" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-yeezy-light px-2 text-foreground">O continúa con</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
           <GoogleButton />
           <Button variant="outline" onClick={() => handleSocialLogin('discord')} className="w-full bg-background text-foreground border-2 border-foreground rounded-none shadow-[4px_4px_0px_0px_rgba(17,17,17,1)] hover:shadow-[0px_0px_0px_0px_rgba(17,17,17,1)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
              <span className="font-bold text-[#5865F2]">Continuar con Discord</span>
           </Button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-sm text-foreground">
            {type === "login" ? (
            <>
                ¿No tienes cuenta?{" "}
                <Link href="/register" className="font-bold hover:underline transition-colors">
                Regístrate
                </Link>
            </>
            ) : (
            <>
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-bold hover:underline transition-colors">
                Ingresa
                </Link>
            </>
            )}
        </div>
      </CardFooter>
    </Card>
  )
}
