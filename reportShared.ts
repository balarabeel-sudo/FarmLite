import { supabase } from './supabaseClient'

export type ReportType = 'user' | 'post' | 'comment' | 'group' | 'marketplace' | 'company' | 'other'
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: 'user', label: 'User' },
  { key: 'post', label: 'Post' },
  { key: 'comment', label: 'Comment' },
  { key: 'group', label: 'Group' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'company', label: 'Company' },
  { key: 'other', label: 'Other' },
]

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'scam', label: 'Scam/Fraud' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'hate', label: 'Hate or abusive content' },
  { key: 'fake_account', label: 'Fake account' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'dangerous', label: 'Dangerous activity' },
  { key: 'false_info', label: 'False information' },
  { key: 'marketplace_issue', label: 'Marketplace issue' },
  { key: 'other', label: 'Other' },
]

export const typeLabel = (k: string) => REPORT_TYPES.find((t) => t.key === k)?.label || k
export const reasonLabel = (k: string) => REPORT_REASONS.find((r) => r.key === k)?.label || k

// Only offer reasons that make sense for what is being reported
export function reasonsFor(type: ReportType) {
  return REPORT_REASONS.filter((r) => {
    if (r.key === 'marketplace_issue') return type === 'marketplace' || type === 'company'
    if (r.key === 'fake_account') return type === 'user' || type === 'company'
    return true
  })
}

export type SubmitReportArgs = {
  type: ReportType
  contentId?: string | null // the post / comment / listing / group / company id
  userId?: string | null // the reported account (required for type "user")
  contentTable?: 'equipment' | null // set to 'equipment' when reporting an equipment listing (type "marketplace")
  reason: string
  description?: string
}

export async function submitReport(a: SubmitReportArgs): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('submit_report', {
    p_type: a.type,
    p_content_id: a.contentId ?? null,
    p_user_id: a.userId ?? null,
    p_reason: a.reason,
    p_description: a.description?.trim() || null,
    p_content_table: a.contentTable ?? null,
  })
  if (error) return { ok: false, message: error.message || 'Could not send your report. Please try again.' }
  return { ok: true }
}
