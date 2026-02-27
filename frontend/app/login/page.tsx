import { AuthForm } from "@/components/auth/AuthForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login",
  description: "Ingresa a tu cuenta",
}

export default function LoginPage() {
  return (
    <div className="container relative flex h-[calc(100vh-64px)] flex-col items-center justify-center lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] relative z-10">
        <AuthForm type="login" />
      </div>
    </div>
  )
}
