import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import {
  FD, STATUS_META, timeAgo, destinationText, sourceText, quantityText,
  type FarmDeskRequest,
} from '../farmDeskShared'

type Tab = 'active' | 'completed' | 'cancelled'

const TAB_STATUSES: Record<Tab, string[]> = {
  active: ['new', 'reviewing', 'sourcing', 'options_found', 'quotation_ready', 'customer_review', 'confirmed', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled', 'unable_to_source'],
}

export default function FarmDeskPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [requests, setRequests] = useState<FarmDeskRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [tab, setTab] = useState<Tab>('active')

  const load = async () => {
    if (!user) return
    setNetError(false)
    setLoading(true)
    const { data, error } = await supabase
      .from('farm_desk_requests')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      setNetError(true)
      setLoading(false)
      return
    }
    setRequests((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const shown = requests.filter((r) => TAB_STATUSES[tab].includes(r.status))
  const counts: Record<Tab, number> = {
    active: requests.filter((r) => TAB_STATUSES.active.includes(r.status)).length,
    completed: requests.filter((r) => TAB_STATUSES.completed.includes(r.status)).length,
    cancelled: requests.filter((r) => TAB_STATUSES.cancelled.includes(r.status)).length,
  }

  return (
    <div style={{ minHeight: '100vh', background: FD.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header title="Farm Desk" onBack={() => navigate(-1)} />

      {/* Hero */}
      <div style={{ margin: '16px', borderRadius: '18px', padding: '22px 20px', color: 'white', background: `linear-gradient(135deg, ${FD.green}, ${FD.greenDark})` }}>
        <p style={{ fontSize: '19px', fontWeight: 800, lineHeight: 1.3 }}>Tell Farmxie what you need.<br />We'll help you find it.</p>
        <p style={{ fontSize: '12px', color: '#DCFCE7', marginTop: '8px', lineHeight: 1.5 }}>
          Can't find it in the Marketplace? Send a request and our team will source suppliers for you.
        </p>
        <div
          onClick={() => navigate('/farm-desk/new')}
          style={{ marginTop: '16px', background: 'white', color: FD.greenDark, borderRadius: '12px', padding: '12px', textAlign: 'center', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer' }}>
          Create a Request
        </div>
      </div>

      {/* My requests */}
      <div style={{ padding: '4px 16px 0' }}>
        <p style={{ fontSize: '15px', fontWeight: 800, color: FD.text, marginBottom: '10px' }}>My Requests</p>

        <div style={{ display: 'flex', gap: '6px', background: '#E7F8EC', borderRadius: '12px', padding: '4px', marginBottom: '14px' }}>
          {(['active', 'completed', 'cancelled'] as Tab[]).map((t) => (
            <div
              key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: tab === t ? FD.card : 'transparent', color: tab === t ? FD.green : FD.textMuted, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize' }}>
              {t} ({counts[t]})
            </div>
          ))}
        </div>

        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '14px', padding: '14px' }}>
                <div style={{ height: '10px', width: '30%', background: FD.bg, borderRadius: '5px' }} />
                <div style={{ height: '13px', width: '60%', background: FD.bg, borderRadius: '5px', marginTop: '10px' }} />
                <div style={{ height: '10px', width: '45%', background: FD.bg, borderRadius: '5px', marginTop: '10px' }} />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '34px 10px', background: FD.card, border: `1px dashed ${FD.border}`, borderRadius: '14px' }}>
            <Icon name="leaf" size={28} color={FD.green} />
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: FD.text, marginTop: '10px' }}>
              {requests.length === 0 ? 'No requests yet' : `No ${tab} requests`}
            </p>
            <p style={{ fontSize: '12px', color: FD.textMuted, marginTop: '4px' }}>
              {requests.length === 0 ? 'Create your first Farm Desk request and Farmxie will start looking.' : 'Requests will show here.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {shown.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.new
              return (
                <div
                  key={r.id}
                  onClick={() => navigate(`/farm-desk/${r.id}`)}
                  style={{ background: FD.card, border: `1px solid ${FD.border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: FD.textMuted, letterSpacing: '0.3px' }}>{r.request_code}</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, background: meta.bg, color: meta.fg, padding: '3px 9px', borderRadius: '10px' }}>{meta.label}</span>
                  </div>
                  <p style={{ fontSize: '14.5px', fontWeight: 800, color: FD.text, marginTop: '6px' }}>
                    {quantityText(r) !== '-' ? `${quantityText(r)} · ` : ''}{r.title}
                  </p>
                  <p style={{ fontSize: '12px', color: FD.textMuted, marginTop: '4px' }}>
                    {sourceText(r)} → {destinationText(r)}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: FD.textMuted }}>Updated {timeAgo(r.updated_at)}</span>
                    <Icon name="chevronRight" size={16} color={FD.textMuted} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: FD.card, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={FD.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: FD.text }}>{title}</p>
    </div>
  )
}
