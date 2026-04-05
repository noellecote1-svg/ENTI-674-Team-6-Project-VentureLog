/**
 * hooks/use-toast.ts — Toast Notification System
 *
 * Implements a global toast notification system for the app.
 * Toasts are brief, non-blocking messages that appear in the corner
 * of the screen to confirm actions or show errors (e.g. "Saved",
 * "Failed to load", "Decision logged").
 *
 * Architecture: uses a module-level state store (not React Context)
 * so that the toast() function can be called from anywhere — including
 * outside React components (e.g. in API error handlers).
 *
 * Key design decisions:
 *   - TOAST_LIMIT = 1: Only one toast shown at a time to avoid clutter
 *   - TOAST_REMOVE_DELAY: Long delay before removing dismissed toasts
 *     so the exit animation can play smoothly
 *   - Uses a reducer pattern (like Redux) for predictable state updates
 *
 * Usage:
 *   // Inside a component:
 *   const { toast } = useToast()
 *   toast({ title: "Saved", description: "Your entry was saved." })
 *
 *   // Outside a component (e.g. in an API handler):
 *   import { toast } from "@/hooks/use-toast"
 *   toast({ title: "Error", variant: "destructive" })
 */

import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// Maximum number of toasts visible at once — keeps the UI clean
const TOAST_LIMIT = 1

// How long (ms) before a dismissed toast is fully removed from state.
// Set very high to allow smooth CSS exit animations to complete.
const TOAST_REMOVE_DELAY = 1000000

// A toast with all its display properties plus a unique ID
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// All possible action types for the reducer
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",       // Show a new toast
  UPDATE_TOAST: "UPDATE_TOAST", // Update an existing toast's content
  DISMISS_TOAST: "DISMISS_TOAST", // Start the dismiss animation
  REMOVE_TOAST: "REMOVE_TOAST",   // Fully remove from state after animation
} as const

// Auto-incrementing ID generator — wraps at MAX_SAFE_INTEGER
let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

// Union type of all possible actions the reducer can handle
type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] }

interface State {
  toasts: ToasterToast[]
}

// Tracks pending removal timeouts so we don't schedule duplicates
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * addToRemoveQueue()
 * Schedules a toast to be fully removed from state after TOAST_REMOVE_DELAY.
 * This gives the exit animation time to play before the element disappears.
 * Prevents scheduling duplicate timeouts for the same toast ID.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return // Already queued for removal
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId: toastId })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * reducer()
 * Pure function that computes the next toast state given an action.
 * Follows the standard Redux reducer pattern for predictable updates.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // Add new toast to the front, enforce the limit by slicing
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      // Merge updated fields into the matching toast
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Schedule removal — done here as a side effect for simplicity
      if (toastId) {
        addToRemoveQueue(toastId) // Dismiss one specific toast
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id) // Dismiss all toasts
        })
      }

      // Set open: false to trigger the exit animation
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      }
    }

    case "REMOVE_TOAST":
      // Fully remove from state — called after the exit animation completes
      if (action.toastId === undefined) {
        return { ...state, toasts: [] } // Clear all
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// ─── MODULE-LEVEL STATE STORE ──────────────────────────────────────────────
// This pattern allows toast() to be called from outside React components.
// All subscribed components are notified whenever state changes.

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  // Notify all subscribed components to re-render with new state
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────

type Toast = Omit<ToasterToast, "id">

/**
 * toast()
 * The primary function for showing a toast notification.
 * Can be called from anywhere — inside or outside React components.
 * Returns controls to update or dismiss the toast programmatically.
 *
 * @example
 *   toast({ title: "Saved!", description: "Your entry was saved." })
 *   toast({ title: "Error", variant: "destructive" })
 */
function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } })

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      // Auto-dismiss when the toast's close button is clicked
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return { id, dismiss, update }
}

/**
 * useToast()
 * React hook that subscribes a component to the toast state store.
 * Returns the current toasts array plus the toast() and dismiss() functions.
 *
 * Usage inside components:
 *   const { toast } = useToast()
 *   toast({ title: "Done!" })
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    // Subscribe this component to state updates
    listeners.push(setState)
    return () => {
      // Unsubscribe on unmount to prevent memory leaks
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
