import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { askCopilot } from './copilotShared'
import type { BriefingContent } from './copilotShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', greenTint: '#ECF7EF', text: '#0F1A0F', textMuted: '#6B7280', red: '#B91C1C' }

// "Today's briefing" card for the Overview page: what needs attention first, in plain words.
export default function CopilotBriefing() {
  const navigate = useNavigate()
  const [data, setData] = useState<BriefingContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    setLoading(true)
    setError('')
    try {
      const r = await askCopilot<BriefingContent>('briefing', { refresh })
      setData(r.content)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px 18px', marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: A.text }}>Today's briefing</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: A.green, background: A.greenTint, borderRadius: '999px', padding: '2px 8px' }}>AI</span>
        </div>
        <span
          role="button"
          onClick={() => !loading && load(true)}
          style={{ fontSize: '12px', fontWeight: 700, color: A.green, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }}>
          {loading ? 'Working...' : 'Refresh'}
        </span>
      </div>

      {loading && !data ? (
        <p style={{ fontSize: '13px', color: A.textMuted, margin: 0 }}>Preparing your briefing...</p>
      ) : error && !data ? (
        <p style={{ fontSize: '13px', color: A.red, margin: 0 }}>{error}</p>
      ) : data ? (
        <>
          <p style={{ fontSize: '13.5px', color: A.text, lineHeight: 1.55, margin: '0 0 12px' }}>{data.summary}</p>
          {data.priorities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.priorities.map((p) => (
                <div
                  key={p.title}
                  onClick={() => navigate(p.path)}
                  style={{ border: `1px solid ${A.border}`, borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: A.text, margin: 0 }}>{p.title}</p>
                    <p style={{ fontSize: '12px', color: A.textMuted, margin: '2px 0 0' }}>{p.why}</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: A.green, flexShrink: 0 }}>Open</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
      <p style={{ fontSize: '11px', color: A.textMuted, margin: '12px 0 0' }}>
        The assistant only suggests. You decide and confirm every action.
      </p>
    </div>
  )
}
