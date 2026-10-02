import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { WITHDRAWAL_COLUMNS, WITHDRAWAL_STATUS } from '../../walletShared'
import type { Withdrawal, WithdrawalStatus } from '../../walletShared'

const A = { surface: '#FFFFFF', border: '#E3E7E3', bg: '#F7F8F7', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#DC2626' }

type Person = { full_name: string | null; username: string | null }
type Filter = 'all' | WithdrawalStatus
type Row = Withdrawal & { reference: string }

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'processing', label: 'Sending' },
  { value: 'paid', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const ngn = (n: number) => `NGN ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function WithdrawalsPage() {
  const navigate = useNavigate()
  const staff = useStaff()
  const canManage = staff.permissions.has('wallet.manage')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [filter, setFilter] = useState<Filter>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const load = async () => {
    setError(false)
    setLoading(true)
    const { data, error: e } = await supabase
      .from('withdrawal_requests').select(`${WITHDRAWAL_COLUMNS}, reference`).order('created_at', { ascending: false }).limit(200)
    if (e) { setError(true); setLoading(false); return }
    const list = (data || []).map((w: any) => ({ ...w, amount: Number(w.amount) })) as Row[]
    setRows(list)
    const ids = Array.from(new Set(list.map((w) => w.user_id)))
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('user_id, full_name, username').in('user_id', ids)
      const map: Record<string, Person> = {}
      for (const x of (p || []) as any[]) map[x.user_id] = { full_name: x.full_name, username: x.username }
      setPeople(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const nameOf = (id: string) => people[id]?.full_name || people[id]?.username || 'Unknown'
  const visible = useMemo(() => rows.filter((r) => filter === 'all' || r.status === filter), [rows, filter])
  const pendingCount = rows.filter((r) => r.status === 'pending').length

  const runPayout = async (w: Row, action: 'approve' | 'check') => {
    if (action === 'approve') {
      const ok = window.confirm(`Send ${ngn(w.amount)} to ${w.account_name} (${w.bank_name} ${w.account_number}) through Paystack? This moves real money in live mode.`)
      if (!ok) return
    }
    setBusyId(w.id)
    setMessage(null)
    const { data, error: fe } = await supabase.functions.invoke('paystack-payout', { body: { action, id: w.id } })
    const status = data?.status as string | undefined
    if (data?.error) setMessage({ type: 'error', text: data.error })
    else if (fe) setMessage({ type: 'error', text: fe.message })
    else if (status === 'paid') setMessage({ type: 'ok', text: 'Sent. The money is on its way to the bank account.' })
    else if (status === 'failed') setMessage({ type: 'error', text: 'The transfer failed and the money was returned to the wallet.' })
    else setMessage({ type: 'ok', text: data?.message || `Status: ${status}` })
    setBusyId(null)
    load()
  }

  const reject = async (w: Row) => {
    if (!rejectNote.trim()) { setMessage({ type: 'error', text: 'Write the reason. The user will see it.' }); return }
    setBusyId(w.id)
    setMessage(null)
    const { error: re } = await supabase.rpc('admin_reject_withdrawal', { p_id: w.id, p_note: rejectNote.trim() })
    if (re) setMessage({ type: 'error', text: re.message })
    else { setMessage({ type: 'ok', text: 'Rejected. The money was returned to the wallet.' }); setRejecting(null); setRejectNote('') }
    setBusyId(null)
    load()
  }

  return (
    <AdminLayout title="Wallet & Escrow">
      <Tabs active="withdrawals" onOrders={() => navigate('/admin/wallet')} pending={pendingCount} />

      {message && (
        <div onClick={() => setMessage(null)} style={{
          padding: '11px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          background: message.type === 'ok' ? '#DCFCE7' : '#FEE2E2', color: message.type === 'ok' ? '#166534' : '#B91C1C',
        }}>{message.text}</div>
      )}

      {error ? (
        <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load withdrawals. You may not have permission.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {FILTERS.map((f) => {
              const active = filter === f.value
              return (
                <span key={f.value} onClick={() => setFilter(f.value)} style={{
                  padding: '6px 13px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: active ? A.green : A.surface, color: active ? 'white' : A.text, border: `1px solid ${active ? A.green : A.border}`,
                }}>{f.label}</span>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <p style={{ fontSize: '13px', color: A.textMuted }}>Loading...</p>
            ) : visible.length === 0 ? (
              <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '20px', fontSize: '13px', color: A.textMuted }}>
                No withdrawals here.
              </div>
            ) : (
              visible.map((w) => {
                const st = WITHDRAWAL_STATUS[w.status]
                const busy = busyId === w.id
                return (
                  <div key={w.id} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: '17px', fontWeight: 800, color: A.text }}>{ngn(w.amount)}</p>
                        <p style={{ fontSize: '12.5px', color: A.textMuted, marginTop: '3px' }}>
                          {nameOf(w.user_id)} · {new Date(w.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: st.bg, color: st.color }}>{st.label}</span>
                    </div>

                    <div style={{ background: A.bg, borderRadius: '8px', padding: '10px 12px', marginTop: '12px', fontSize: '12.5px', color: A.text, lineHeight: 1.6 }}>
                      <div><span style={{ color: A.textMuted }}>Bank: </span>{w.bank_name}</div>
                      <div><span style={{ color: A.textMuted }}>Account: </span>{w.account_number}</div>
                      <div><span style={{ color: A.textMuted }}>Name: </span>{w.account_name}</div>
                      <div style={{ color: A.textMuted, fontSize: '11px', marginTop: '4px' }}>Ref: {w.reference}</div>
                    </div>

                    {w.admin_note && <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '10px' }}>Note: {w.admin_note}</p>}

                    {canManage && (w.status === 'pending' || w.status === 'processing') && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                        {w.status === 'pending' && (
                          <>
                            <button disabled={busy} onClick={() => runPayout(w, 'approve')} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: A.green, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                              {busy ? 'Working...' : 'Approve and send'}
                            </button>
                            <button disabled={busy} onClick={() => { setRejecting(rejecting === w.id ? null : w.id); setRejectNote('') }} style={{ padding: '9px 16px', borderRadius: '8px', border: `1px solid ${A.red}`, background: A.surface, color: A.red, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                              Reject
                            </button>
                          </>
                        )}
                        {w.status === 'processing' && (
                          <button disabled={busy} onClick={() => runPayout(w, 'check')} style={{ padding: '9px 16px', borderRadius: '8px', border: `1px solid ${A.green}`, background: A.surface, color: A.green, fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                            {busy ? 'Checking...' : 'Check status'}
                          </button>
                        )}
                      </div>
                    )}

                    {rejecting === w.id && (
                      <div style={{ marginTop: '12px' }}>
                        <textarea
                          value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} placeholder="Reason (the user will see this)"
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${A.border}`, fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '8px' }}
                        />
                        <button disabled={busy} onClick={() => reject(w)} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: A.red, color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                          Confirm rejection and refund wallet
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}

export function Tabs({ active, onOrders, pending }: { active: 'orders' | 'withdrawals'; onOrders?: () => void; pending?: number }) {
  const navigate = useNavigate()
  const tab = (key: 'orders' | 'withdrawals', label: string, go: () => void, badge?: number) => {
    const on = active === key
    return (
      <span key={key} onClick={go} style={{
        padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: on ? A.green : A.textMuted,
        borderBottom: `2px solid ${on ? A.green : 'transparent'}`, display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}>
        {label}
        {badge ? <span style={{ background: A.red, color: 'white', borderRadius: '999px', fontSize: '10.5px', padding: '1px 7px' }}>{badge}</span> : null}
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${A.border}`, marginBottom: '18px' }}>
      {tab('orders', 'Orders', onOrders || (() => navigate('/admin/wallet')))}
      {tab('withdrawals', 'Withdrawals', () => navigate('/admin/wallet/withdrawals'), pending)}
    </div>
  )
}
