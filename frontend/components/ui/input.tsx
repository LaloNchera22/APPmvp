import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-none border-2 border-foreground bg-background px-4 py-2 text-sm font-bold text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:bg-yeezy-light disabled:cursor-not-allowed disabled:opacity-50 transition-all uppercase",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
