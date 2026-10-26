import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { logAdminAction } from './adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#DC2626', amber: '#B45309' }

type Req = { user_id: string; full_name: string | null; username: string | null; reason: string | null; requested_at: string; scheduled_for: string; due: boolean; blockers: string[] }

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// Pending account-deletion requests (shown on the Users page for staff who can manage users).
// "Delete account" is only possible once the 30 days are over and nothing is left to settle.
export default function DeletionRequests() {
  const [items, setItems] = useState<Req[]>([])
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('account_deletions_admin_list')
    if (!error) setItems((data || []) as Req[])
  }, [])
  useEffect(() => { load() }, [load])

  const remove = async (r: Req) => {
    const name = r.full_name || r.username || r.user_id
    const typed = window.prompt(`Permanently delete ${name}? This cannot be undone.\nType DELETE to confirm.`)
    if (typed?.trim().toUpperCase() !== 'DELETE') return
    setBusy(r.user_id)
    const { error } = await supabase.rpc('admin_process_account_deletion', { p_user: r.user_id })
    setBusy('')
    if (error) {
      window.alert(error.message.includes('linked_records_exist')
        ? 'This account still has records linked to it (for example payments or orders), so it cannot be deleted automatically. Handle it in the Supabase dashboard.'
        : error.message)
      return
    }
    await logAdminAction('Deleted user account (own request)', { type: 'user', id: r.user_id, label: name })
    load()
  }

  if (items.length === 0) return null

  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: A.text, margin: '0 0 8px' }}>Account deletion requests ({items.length})</p>
      {items.map((r) => (
        <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: `1px solid ${A.border}`, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: A.text, margin: 0 }}>{r.full_name || r.username || r.user_id}{r.username ? ` (@${r.username})` : ''}</p>
            <p style={{ fontSize: '12px', color: A.textMuted, margin: '2px 0 0' }}>
              Requested {fmt(r.requested_at)} · {r.due ? 'Due now' : `Due ${fmt(r.scheduled_for)}`}
              {r.blockers.length > 0 ? ` · Blocked: ${r.blockers.join(', ').replace(/_/g, ' ')}` : ''}
            </p>
            {r.reason && <p style={{ fontSize: '12px', color: A.textMuted, margin: '2px 0 0' }}>Reason: {r.reason}</p>}
          </div>
          <div
            onClick={r.due && r.blockers.length === 0 && busy !== r.user_id ? () => remove(r) : undefined}
            role="button"
            style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, color: 'white', background: A.red, cursor: r.due && r.blockers.length === 0 ? 'pointer' : 'default', opacity: r.due && r.blockers.length === 0 && busy !== r.user_id ? 1 : 0.4 }}>
            {busy === r.user_id ? 'Deleting...' : 'Delete account'}
          </div>
        </div>
      ))}
    </div>
  )
}
