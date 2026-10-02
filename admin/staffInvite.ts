import { supabase } from '../supabaseClient'

export type StaffInviteResult = {
  email_sent: boolean
  email_error: string | null
  notified: boolean
  link: string
}

// Sends (or re-sends) the invitation email and the in-app notification for an invited staff member.
// Call it right after a staff row with status "invited" is created, and from a "Resend invitation" button.
export async function sendStaffInvite(staffId: string): Promise<StaffInviteResult> {
  const { data, error } = await supabase.functions.invoke('staff-invite', { body: { staff_id: staffId } })
  if (error) throw new Error(error.message)
  if (!data || data.error) throw new Error(data?.error || 'Could not send the invitation')
  return data as StaffInviteResult
}
