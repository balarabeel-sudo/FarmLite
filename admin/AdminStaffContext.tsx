import { createContext, useContext } from 'react'
import type { StaffSession } from './adminAuth'

export const AdminStaffContext = createContext<StaffSession | null>(null)

// Read the signed-in staff member's session (role + permissions) anywhere inside
// an AdminProtectedRoute subtree.
export function useStaff(): StaffSession {
  const ctx = useContext(AdminStaffContext)
  if (!ctx) throw new Error('useStaff() must be used inside AdminProtectedRoute')
  return ctx
}
