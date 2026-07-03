import { useContext } from 'react'
import { ToastCtx } from './toastCtx'

export function useToast() {
  const ctx = useContext(ToastCtx)
  return ctx ?? { success: () => {}, error: () => {}, info: () => {} }
}
