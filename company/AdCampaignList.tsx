import { useNavigate } from 'react-router-dom'
import Icon from '../Icons'
import { ctr, displayStatus, fmtDate, money, placementLabel } from './adShared'
import type { AdRow } from './adShared'

const COLORS = { bg: '#F8FAF6', card: '#FFFFFF', border: '#E5EFE5', green: '#16A34A', greenSoft: '#DCFCE7', text: '#1A2E1A', textMuted: '#5B6B5B' }

// A list of campaigns; each row opens the campaign page.
export default function AdCampaignList({ ads }: { ads: AdRow[] }) {
  const navigate = useNavigate()
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
      {ads.map((a, i) => {
        const st = displayStatus(a)
        const shows = a.status === 'active' || a.status === 'paused' || a.status === 'completed' || (a.impressions || 0) > 0
        return (
          <div key={a.id} onClick={() => navigate(`/company/ads/${a.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: i === 0 ? 'none' : `1px solid ${COLORS.bg}`, cursor: 'pointer', flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: COLORS.greenSoft, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {a.image_url ? <img src={a.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={a.target_type === 'company' ? 'building' : 'leaf'} size={22} color={COLORS.green} />}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{a.headline}</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 3 }}>
                {a.target_type === 'listing' ? 'Listing' : 'Company'} · {a.days} days · {money(a.amount, a.currency)}
                {a.starts_at ? ` · ${fmtDate(a.starts_at)} to ${fmtDate(a.ends_at)}` : ''}
              </p>
              {a.placements?.length > 0 && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 2 }}>{a.placements.map(placementLabel).join(', ')}</p>}
            </div>
            {shows && (
              <div style={{ display: 'flex', gap: 18, fontSize: '12px', color: COLORS.textMuted }}>
                <span><b style={{ color: COLORS.text }}>{a.impressions || 0}</b> views</span>
                <span><b style={{ color: COLORS.text }}>{a.clicks || 0}</b> clicks</span>
                <span><b style={{ color: COLORS.text }}>{ctr(a.impressions || 0, a.clicks || 0)}</b> rate</span>
              </div>
            )}
            <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
          </div>
        )
      })}
    </div>
  )
}
