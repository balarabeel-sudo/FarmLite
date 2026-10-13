import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { CompanyCtx } from './CompanyLayout'
import AdsTabs from './AdsTabs'
import AdCampaignList from './AdCampaignList'
import { displayStatus } from './adShared'
import type { AdRow } from './adShared'

const COLORS = { card: '#FFFFFF', border: '#E5EFE5', green: '#16A34A', text: '#1A2E1A', textMuted: '#5B6B5B', red: '#B91C1C' }

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'In review' },
  { key: 'approved', label: 'Awaiting payment' },
  { key: 'running', label: 'Running' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Rejected / cancelled' },
]

// Route: /company/ads/campaigns
export default function CompanyAdCampaignsPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [ads, setAds] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: e } = await supabase.rpc('ads_company_list', { p_company: company.id })
    if (e) setError(true)
    else setAds((data || []) as AdRow[])
    setLoading(false)
  }, [company.id])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    return ads.filter((a) => {
      const k = displayStatus(a).key
      if (filter === 'all') return true
      if (filter === 'completed') return k === 'completed' || k === 'ended'
      if (filter === 'closed') return k === 'rejected' || k === 'cancelled'
      return k === filter
    })
  }, [ads, filter])

  return (
    <div style={{ maxWidth: 1000 }}>
      <AdsTabs active="campaigns" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <span key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', background: filter === f.key ? COLORS.green : COLORS.card, color: filter === f.key ? 'white' : COLORS.textMuted, border: `1px solid ${filter === f.key ? COLORS.green : COLORS.border}` }}>
            {f.label}
          </span>
        ))}
      </div>

      {error ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22 }}>
          <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: 10 }}>Could not load your campaigns.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
      ) : shown.length === 0 ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22 }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{ads.length === 0 ? 'No advertising campaigns yet.' : 'No campaigns match this filter.'}</p>
          {ads.length === 0 && company.status === 'verified' && (
            <div role="button" onClick={() => navigate('/company/ads/new')} style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 10, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>Create Your First Ad</div>
          )}
        </div>
      ) : (
        <AdCampaignList ads={shown} />
      )}
    </div>
  )
}
