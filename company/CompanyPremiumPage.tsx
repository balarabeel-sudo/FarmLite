import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import PremiumFlow from '../PremiumFlow'
import { clearCheckoutContext } from '../premiumShared'
import type { CompanyCtx } from './CompanyLayout'

// Company Premium: same flow as the user's, but for the company the person owns.
export default function CompanyPremiumPage() {
  const { company, reload } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref') || undefined

  const leave = () => {
    clearCheckoutContext()
    navigate('/company', { replace: true })
  }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1A2E1A', marginBottom: '16px' }}>Premium</h1>
      <PremiumFlow
        audience="company"
        companyId={company.id}
        companyName={company.name}
        initialReference={reference}
        wide
        onExit={leave}
        onDone={leave}
        onChanged={reload}
      />
    </div>
  )
}
