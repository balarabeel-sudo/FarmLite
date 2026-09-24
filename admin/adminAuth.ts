import { supabase } from '../supabaseClient'

export type StaffSession = {
  staffId: string
  userId: string
  fullName: string
  email: string
  roleId: string
  roleName: string
  permissions: Set<string>
}

// Loads the current signed-in user's staff record, role and permission set.
// Returns null if the user is not an active staff member - the caller then
// treats them as a normal (non-admin) user and denies access.
export async function loadStaffSession(): Promise<StaffSession | null> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, user_id, full_name, email, status, role_id, roles(id, name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  let activeStaff = staff

  // First login after being invited: claim the pending row by matching email.
  if (!activeStaff && !error && user.email) {
    const { data: invited } = await supabase
      .from('staff')
      .select('id, user_id, full_name, email, status, role_id, roles(id, name)')
      .eq('status', 'invited')
      .ilike('email', user.email)
      .is('user_id', null)
      .maybeSingle()

    if (invited) {
      const { data: claimed } = await supabase
        .from('staff')
        .update({ user_id: user.id, status: 'active' })
        .eq('id', invited.id)
        .select('id, user_id, full_name, email, status, role_id, roles(id, name)')
        .maybeSingle()
      activeStaff = claimed || null
    }
  }

  if (error || !activeStaff || !activeStaff.role_id) return null

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permissions(key)')
    .eq('role_id', activeStaff.role_id)

  const permissions = new Set<string>(
    (perms || []).map((row: any) => row.permissions?.key).filter(Boolean)
  )

  const role = activeStaff.roles as any

  return {
    staffId: activeStaff.id,
    userId: activeStaff.user_id,
    fullName: activeStaff.full_name,
    email: activeStaff.email,
    roleId: activeStaff.role_id,
    roleName: role?.name || '',
    permissions,
  }
}

export function hasPermission(session: StaffSession | null, key: string): boolean {
  return !!session && session.permissions.has(key)
}

// Records an admin action. Never blocks the UI on failure - the action itself
// already happened; a missed audit row is a background concern, not a user-facing error.
export async function logAdminAction(action: string, target?: { type: string; id: string; label?: string }, metadata?: Record<string, unknown>) {
  try {
    await supabase.from('audit_logs').insert({
      action,
      target_type: target?.type || null,
      target_id: target?.id || null,
      target_label: target?.label || null,
      metadata: metadata || {},
    })
  } catch {
    // best-effort only
  }
}
