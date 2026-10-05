import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import AnalyticsView from '../AnalyticsView'
import { fetchCompanyAnalytics } from '../analyticsShared'
import type { AnalyticsData } from '../analyticsShared'
import type { CompanyCtx } from './CompanyLayout'

// Company analytics inside the company dashboard (owner only; Premium companies see real data).
export default function CompanyAnalyticsPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [days, setDays] = useState(28)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchCompanyAnalytics(company.id, days)
    if (res.error) setError(res.error)
    else setData(res.data || null)
    setLoading(false)
  }, [company.id, days])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1A2E1A', marginBottom: '16px' }}>Analytics</h1>
      <AnalyticsView
        audience="company"
        data={data}
        loading={loading}
        error={error}
        days={days}
        onDays={setDays}
        onRetry={load}
        onUpgrade={() => navigate('/company/premium')}
      />
    </div>
  )
}
