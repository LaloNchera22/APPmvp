import { AuthForm } from "@/components/auth/AuthForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Registro",
  description: "Crea tu cuenta",
}

export default function RegisterPage() {
  return (
    <div className="container relative flex h-[calc(100vh-64px)] flex-col items-center justify-center lg:px-0">
      <div className="absolute inset-0 z-[-1]">
         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-neon-magenta/5 rounded-full blur-[100px]" />
      </div>
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] relative z-10">
        <AuthForm type="register" />
      </div>
    </div>
  )
}
