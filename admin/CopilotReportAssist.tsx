import { useEffect, useState } from 'react'
import { askCopilot, decideSuggestion, latestSuggestion } from './copilotShared'
import type { ReportAction, ReportTriage, StoredSuggestion } from './copilotShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', greenTint: '#ECF7EF', text: '#0F1A0F', textMuted: '#6B7280', red: '#B91C1C', amber: '#92400E', amberBg: '#FFFBEB' }

const ACTION_LABEL: Record<ReportAction, string> = {
  remove_content: 'Remove the reported content',
  keep_content: 'Keep it and close the report',
  restrict_user: 'Restrict the account',
  needs_human: 'Needs your own judgement',
}
const SEVERITY_COLOR: Record<ReportTriage['severity'], { fg: string; bg: string }> = {
  low: { fg: '#166534', bg: '#DCFCE7' },
  medium: { fg: '#92400E', bg: '#FEF3C7' },
  high: { fg: '#B91C1C', bg: '#FEE2E2' },
}

type Props = {
  reportId: string
  busy?: boolean
  // Called when the staff member chooses to follow the suggestion. The page then opens its normal confirmation.
  onUse: (action: Exclude<ReportAction, 'needs_human'>, reason: string) => void
}

// "AI suggestion" box inside the report drawer. Asked only when the staff member taps the button.
export default function CopilotReportAssist({ reportId, busy, onUse }: Props) {
  const [sug, setSug] = useState<StoredSuggestion<ReportTriage> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setSug(null)
    setError('')
    latestSuggestion<ReportTriage>('report_triage', reportId).then((s) => { if (alive) setSug(s) }).catch(() => {})
    return () => { alive = false }
  }, [reportId])

  const ask = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await askCopilot<ReportTriage>('report_triage', { report_id: reportId })
      setSug({ id: r.id, content: r.content, status: 'pending', created_at: new Date().toISOString() })
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (!sug) return
    try { await decideSuggestion(sug.id, decision) } catch { /* the main action still works */ }
    setSug({ ...sug, status: decision })
  }

  const c = sug?.content
  const sev = c ? SEVERITY_COLOR[c.severity] : null

  return (
    <div style={{ border: `1px solid ${A.border}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', background: A.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: c ? '10px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 800, color: A.text }}>AI suggestion</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: A.green, background: A.greenTint, borderRadius: '999px', padding: '2px 8px' }}>AI</span>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={ask}
          style={{ fontSize: '12px', fontWeight: 700, color: A.green, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: '6px', padding: '5px 10px', cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Thinking...' : c ? 'Ask again' : 'Get suggestion'}
        </button>
      </div>

      {error && <p style={{ fontSize: '12.5px', color: A.red, margin: '8px 0 0' }}>{error}</p>}

      {c && sev && (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: sev.fg, background: sev.bg, borderRadius: '999px', padding: '2px 9px', textTransform: 'capitalize' }}>{c.severity} severity</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: A.textMuted, background: '#F3F4F6', borderRadius: '999px', padding: '2px 9px', textTransform: 'capitalize' }}>{c.category.replace(/_/g, ' ')}</span>
            <span style={{ fontSize: '11px', color: A.textMuted }}>{Math.round(c.confidence * 100)}% sure</span>
          </div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: A.text, margin: '0 0 4px' }}>{ACTION_LABEL[c.action]}</p>
          <p style={{ fontSize: '12.5px', color: A.textMuted, lineHeight: 1.55, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{c.reason}</p>

          {sug.status === 'pending' ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {c.action !== 'needs_human' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => { await decide('accepted'); onUse(c.action as Exclude<ReportAction, 'needs_human'>, c.reason) }}
                  style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', background: A.green, border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>
                  Use this suggestion
                </button>
              )}
              <button
                type="button"
                onClick={() => decide('rejected')}
                style={{ fontSize: '12.5px', fontWeight: 700, color: A.textMuted, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>
                Not helpful
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '11.5px', color: A.textMuted, margin: 0 }}>
              {sug.status === 'accepted' ? 'You chose to use this suggestion.' : 'You marked this suggestion as not helpful.'}
            </p>
          )}
          <p style={{ fontSize: '11px', color: A.textMuted, margin: '10px 0 0' }}>
            "Use this suggestion" only opens the normal confirmation. Nothing happens until you confirm.
          </p>
        </>
      )}
    </div>
  )
}
