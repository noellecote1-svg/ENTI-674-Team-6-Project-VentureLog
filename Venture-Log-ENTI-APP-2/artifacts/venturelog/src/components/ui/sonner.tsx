/**
 * components/ui/sonner.tsx — Sonner Toast Component (shadcn/ui)
 *
 * An alternative toast notification system using the Sonner library.
 * Automatically inherits the current theme (light/dark/system).
 * Styled to match VentureLog's background, border, and text colors.
 * Note: VentureLog primarily uses the custom use-toast/Toaster system.
 * This provides an alternative if Sonner's toast API is preferred.
 *
 * Exports: Toaster
 */
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
