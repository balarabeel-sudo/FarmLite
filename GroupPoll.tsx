import { useState } from 'react'
import { supabase } from './supabaseClient'
import Icon from './Icons'

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenSoft: 'var(--fx-tint-green)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: '#DC2626',
}

export type PollOption = { id: string; label: string; position: number }
export type PollData = {
  id: string
  post_id: string
  community_id: string
  created_by: string
  description: string | null
  multiple: boolean
  closes_at: string | null
  closed_at: string | null
  group_poll_options: PollOption[]
}
export type PollState = { total: number; counts: Record<string, number>; mine: string[] }

// Counts come from the database function (never calculated from client data); "mine" is the user's own vote rows.
export async function fetchPollStates(pollIds: string[], userId: string): Promise<Record<string, PollState>> {
  const out: Record<string, PollState> = {}
  if (pollIds.length === 0) return out
  const [res, mine] = await Promise.all([
    supabase.rpc('group_poll_results', { p_polls: pollIds }),
    supabase.from('group_poll_votes').select('poll_id, option_id').eq('user_id', userId).in('poll_id', pollIds),
  ])
  for (const id of pollIds) out[id] = { total: 0, counts: {}, mine: [] }
  for (const r of (res.data || []) as { poll_id: string; option_id: string; votes: number; total_voters: number }[]) {
    out[r.poll_id].counts[r.option_id] = Number(r.votes)
    out[r.poll_id].total = Number(r.total_voters)
  }
  for (const v of (mine.data || []) as { poll_id: string; option_id: string }[]) out[v.poll_id]?.mine.push(v.option_id)
  return out
}

export const pollIsClosed = (p: PollData) => !!p.closed_at || (!!p.closes_at && new Date(p.closes_at).getTime() <= Date.now())

function closesText(p: PollData) {
  if (p.closed_at) return 'Closed'
  if (!p.closes_at) return 'Open'
  const ms = new Date(p.closes_at).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `Closes in ${Math.max(mins, 1)}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `Closes in ${hours}h`
  return `Closes in ${Math.floor(hours / 24)}d`
}

export default function GroupPoll({
  poll, state, canVote, canManage, onChanged,
}: {
  poll: PollData
  state: PollState | undefined
  canVote: boolean
  canManage: boolean // poll creator or group moderator
  onChanged: (pollId: string) => void
}) {
  const [selected, setSelected] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const closed = pollIsClosed(poll)
  const st: PollState = state || { total: 0, counts: {}, mine: [] }
  const current = selected ?? st.mine
  const changed = selected !== null && [...selected].sort().join() !== [...st.mine].sort().join()
  const options = [...poll.group_poll_options].sort((a, b) => a.position - b.position)

  const toggle = (id: string) => {
    if (closed || !canVote || busy) return
    setError('')
    if (poll.multiple) setSelected(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
    else setSelected([id])
  }

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true)
    setError('')
    const { error: e } = await fn()
    setBusy(false)
    if (e) { setError(e.message); return }
    setSelected(null)
    onChanged(poll.id)
  }

  const submit = () => run(() => supabase.rpc('group_poll_vote', { p_poll: poll.id, p_options: current }))
  const retract = () => run(() => supabase.rpc('group_poll_clear_vote', { p_poll: poll.id }))
  const close = () => { if (window.confirm('Close this poll? Nobody will be able to vote after this.')) run(() => supabase.rpc('group_close_poll', { p_poll: poll.id })) }

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
      {poll.description && <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.5, marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{poll.description}</p>}

      <div role={poll.multiple ? 'group' : 'radiogroup'} aria-label="Poll options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((o) => {
          const votes = st.counts[o.id] || 0
          const pct = st.total > 0 ? Math.round((votes / st.total) * 100) : 0
          const isMine = current.includes(o.id)
          return (
            <div
              key={o.id}
              role={poll.multiple ? 'checkbox' : 'radio'}
              aria-checked={isMine}
              tabIndex={closed || !canVote ? -1 : 0}
              onClick={() => toggle(o.id)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(o.id) } }}
              style={{
                position: 'relative', overflow: 'hidden', borderRadius: '10px', background: COLORS.card,
                border: `1.5px solid ${isMine ? COLORS.green : COLORS.border}`, cursor: closed || !canVote ? 'default' : 'pointer',
              }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isMine ? 'var(--fx-bd-green)' : COLORS.greenSoft, transition: 'width .3s' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
                <div style={{ width: '16px', height: '16px', flexShrink: 0, borderRadius: poll.multiple ? '4px' : '8px', border: `1.5px solid ${isMine ? COLORS.green : COLORS.border}`, background: isMine ? COLORS.green : COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isMine && <Icon name="check" size={11} color="white" />}
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: isMine ? 700 : 500, color: COLORS.text, wordBreak: 'break-word' }}>{o.label}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted, whiteSpace: 'nowrap' }}>{pct}% · {votes}</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '8px' }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <p style={{ fontSize: '11px', color: COLORS.textMuted, flex: 1 }}>
          {st.total} {st.total === 1 ? 'voter' : 'voters'} · {closesText(poll)}{poll.multiple ? ' · Multiple choice' : ''}
        </p>
        {!closed && canVote && changed && current.length > 0 && (
          <div role="button" onClick={busy ? undefined : submit} style={{ background: COLORS.green, color: 'white', padding: '7px 14px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving...' : st.mine.length ? 'Change vote' : 'Vote'}
          </div>
        )}
        {!closed && canVote && !changed && st.mine.length > 0 && (
          <div role="button" onClick={busy ? undefined : retract} style={{ color: COLORS.textMuted, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>Remove vote</div>
        )}
        {!closed && canManage && (
          <div role="button" onClick={busy ? undefined : close} style={{ color: COLORS.red, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>Close poll</div>
        )}
      </div>
      {!canVote && !closed && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '6px' }}>Join this group to vote.</p>}
    </div>
  )
}
