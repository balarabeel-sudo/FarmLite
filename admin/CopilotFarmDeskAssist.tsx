import { useEffect, useState } from 'react'
import { askCopilot, decideSuggestion, latestSuggestion } from './copilotShared'
import type { FarmDeskAssist, StoredSuggestion } from './copilotShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', greenTint: '#ECF7EF', text: '#0F1A0F', textMuted: '#6B7280', red: '#B91C1C', bg: '#F5F7F5' }

type Props = {
  requestId: string
  // Only staff who can manage the request may put the draft into the message box
  canReply: boolean
  onUseDraft: (text: string) => void
}

const label = (t: string): React.CSSProperties => ({ fontSize: '11px', fontWeight: 800, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: t === 'first' ? '0 0 6px' : '14px 0 6px' })

// "AI assistant" card on a Farm Desk request: summary, missing details, possible suppliers, draft reply.
export default function CopilotFarmDeskAssist({ requestId, canReply, onUseDraft }: Props) {
  const [sug, setSug] = useState<StoredSuggestion<FarmDeskAssist> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setSug(null)
    setError('')
    latestSuggestion<FarmDeskAssist>('farm_desk_assist', requestId).then((s) => { if (alive) setSug(s) }).catch(() => {})
    return () => { alive = false }
  }, [requestId])

  const ask = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await askCopilot<FarmDeskAssist>('farm_desk_assist', { request_id: requestId })
      setSug({ id: r.id, content: r.content, status: 'pending', created_at: new Date().toISOString() })
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (!sug) return
    try { await decideSuggestion(sug.id, decision) } catch { /* not important for the staff member */ }
    setSug({ ...sug, status: decision })
  }

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const c = sug?.content

  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: A.text }}>AI assistant</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: A.green, background: A.greenTint, borderRadius: '999px', padding: '2px 8px' }}>AI</span>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={ask}
          style={{ fontSize: '12.5px', fontWeight: 700, color: A.green, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: '6px', padding: '6px 12px', cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Reading the request...' : c ? 'Analyse again' : 'Analyse this request'}
        </button>
      </div>

      {!c && !error && !loading && (
        <p style={{ fontSize: '12.5px', color: A.textMuted, margin: '8px 0 0' }}>
          Get a summary, missing details, possible suppliers and a draft reply to the customer.
        </p>
      )}
      {error && <p style={{ fontSize: '12.5px', color: A.red, margin: '8px 0 0' }}>{error}</p>}

      {c && (
        <div style={{ marginTop: '12px' }}>
          {c.summary && <p style={{ fontSize: '13.5px', color: A.text, lineHeight: 1.55, margin: 0 }}>{c.summary}</p>}

          {c.needs.length > 0 && (
            <>
              <p style={label('x')}>Key details</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {c.needs.map((n) => (
                  <div key={n.label} style={{ background: A.bg, borderRadius: '8px', padding: '8px 10px' }}>
                    <p style={{ fontSize: '11px', color: A.textMuted, margin: 0 }}>{n.label}</p>
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: A.text, margin: '2px 0 0' }}>{n.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {c.missing_info.length > 0 && (
            <>
              <p style={label('x')}>Still missing</p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: A.text, lineHeight: 1.6 }}>
                {c.missing_info.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </>
          )}

          {c.matches.length > 0 && (
            <>
              <p style={label('x')}>Possible suppliers already on Farmxie</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {c.matches.map((m) => (
                  <a key={m.id} href={m.path} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', border: `1px solid ${A.border}`, borderRadius: '8px', padding: '9px 12px', display: 'block' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: A.text, margin: 0 }}>{m.title} <span style={{ fontSize: '11px', fontWeight: 600, color: A.textMuted }}>({m.type === 'listing' ? 'listing' : 'company'})</span></p>
                    {m.detail && <p style={{ fontSize: '12px', color: A.textMuted, margin: '2px 0 0' }}>{m.detail}</p>}
                    {m.reason && <p style={{ fontSize: '12px', color: A.text, margin: '4px 0 0' }}>{m.reason}</p>}
                  </a>
                ))}
              </div>
            </>
          )}

          {c.draft_reply && (
            <>
              <p style={label('x')}>Draft reply to the customer</p>
              <div style={{ background: A.bg, borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: A.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.draft_reply}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {canReply && (
                  <button
                    type="button"
                    onClick={() => { onUseDraft(c.draft_reply); if (sug?.status === 'pending') decide('accepted') }}
                    style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', background: A.green, border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>
                    Put in message box
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copy(c.draft_reply)}
                  style={{ fontSize: '12.5px', fontWeight: 700, color: A.text, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {sug?.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => decide('rejected')}
                    style={{ fontSize: '12.5px', fontWeight: 700, color: A.textMuted, background: 'transparent', border: `1px solid ${A.border}`, borderRadius: '6px', padding: '7px 12px', cursor: 'pointer' }}>
                    Not helpful
                  </button>
                )}
              </div>
              <p style={{ fontSize: '11px', color: A.textMuted, margin: '8px 0 0' }}>Check and edit the draft before you send it. Nothing is sent automatically.</p>
            </>
          )}

          {c.next_steps.length > 0 && (
            <>
              <p style={label('x')}>Suggested next steps</p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: A.text, lineHeight: 1.6 }}>
                {c.next_steps.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
