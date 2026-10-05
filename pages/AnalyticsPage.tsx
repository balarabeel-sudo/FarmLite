import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icons'
import AnalyticsView from '../AnalyticsView'
import { fetchUserAnalytics } from '../analyticsShared'
import type { AnalyticsData } from '../analyticsShared'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  text: '#1A2E1A',
}

// The user's own analytics. Premium accounts see real data; free accounts see a blurred sample.
export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [days, setDays] = useState(28)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchUserAnalytics(days)
    if (res.error) setError(res.error)
    else setData(res.data || null)
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '760px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Analytics</p>
      </div>
      <div style={{ padding: '16px' }}>
        <AnalyticsView
          audience="user"
          data={data}
          loading={loading}
          error={error}
          days={days}
          onDays={setDays}
          onRetry={load}
          onUpgrade={() => navigate('/premium')}
        />
      </div>
    </div>
  )
}
