import { supabase } from '../supabaseClient'

// Helpers for the admin AI assistant. The assistant only suggests; staff always decide.
// Nothing here changes data except recording whether a suggestion was used.

export type CopilotKind = 'briefing' | 'report_triage' | 'farm_desk_assist'

export type BriefingContent = {
  counts: Record<string, unknown>
  summary: string
  priorities: { title: string; why: string; path: string }[]
}

export type ReportAction = 'remove_content' | 'keep_content' | 'restrict_user' | 'needs_human'
export type ReportTriage = {
  action: ReportAction
  severity: 'low' | 'medium' | 'high'
  category: string
  reason: string
  confidence: number
}

export type FarmDeskAssist = {
  summary: string
  needs: { label: string; value: string }[]
  missing_info: string[]
  matches: { type: 'listing' | 'company'; id: string; title: string; detail: string; path: string; reason: string }[]
  draft_reply: string
  next_steps: string[]
}

export type StoredSuggestion<T> = { id: string; content: T; status: 'pending' | 'accepted' | 'rejected'; created_at: string }

// Asks the assistant (edge function "admin-copilot"). Throws an Error with a readable message.
export async function askCopilot<T>(action: CopilotKind, payload: Record<string, unknown> = {}): Promise<{ id: string; content: T; cached?: boolean }> {
  const { data, error } = await supabase.functions.invoke('admin-copilot', { body: { action, ...payload } })
  if (error) {
    let msg = 'The assistant is not available right now.'
    try {
      const body = await (error as any).context?.json?.()
      if (body?.error) msg = String(body.error)
    } catch { /* keep the generic message */ }
    throw new Error(msg)
  }
  if (!data || (data as any).error) throw new Error((data as any)?.error || 'The assistant could not answer.')
  return data as { id: string; content: T; cached?: boolean }
}

// The most recent suggestion already made for one report / Farm Desk request (so it is not asked again by accident).
export async function latestSuggestion<T>(kind: Exclude<CopilotKind, 'briefing'>, targetId: string): Promise<StoredSuggestion<T> | null> {
  const { data } = await supabase.from('ai_suggestions').select('id, content, status, created_at')
    .eq('kind', kind).eq('target_id', targetId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as StoredSuggestion<T> | null) ?? null
}

// Records what the staff member did with a suggestion (also written to the audit log).
export async function decideSuggestion(id: string, decision: 'accepted' | 'rejected', note?: string): Promise<void> {
  const { error } = await supabase.rpc('ai_suggestion_decide', { p_id: id, p_decision: decision, p_note: note ?? null })
  if (error) throw new Error(error.message)
}
