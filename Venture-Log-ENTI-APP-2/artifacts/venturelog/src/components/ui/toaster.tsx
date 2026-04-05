/**
 * components/ui/toaster.tsx — Toaster Component (shadcn/ui)
 *
 * Renders all active toast notifications from the useToast hook.
 * Mounted once in App.tsx so toasts can appear from any page.
 * Iterates over the current toasts array and renders each one
 * using the Toast, ToastTitle, ToastDescription, and ToastClose
 * primitives from toast.tsx.
 *
 * Exports: Toaster
 */
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
