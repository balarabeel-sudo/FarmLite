import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../Icons'
import PremiumFlow from '../PremiumFlow'
import { readCheckoutContext, clearCheckoutContext } from '../premiumShared'

const COLORS = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A2E1A',
}

// Used for both /premium (start) and /premium/verify (return from the payment page).
export default function PremiumPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref') || undefined
  const showBenefits = params.get('benefits') === '1'

  // A company payment returns to the company dashboard instead
  const ctx = reference ? readCheckoutContext() : null
  const goesToCompany = !!reference && ctx?.audience === 'company'

  useEffect(() => {
    if (goesToCompany) navigate(`/company/premium?reference=${reference}`, { replace: true })
  }, [goesToCompany, reference, navigate])

  if (goesToCompany) return null

  const leave = () => {
    clearCheckoutContext()
    navigate('/profile', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '16px' }}>
      <div style={{ padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 8px' }}>
        <div
          role="button"
          aria-label="Back"
          onClick={leave}
          style={{ width: '44px', height: '44px', borderRadius: '22px', background: COLORS.card, boxShadow: '0 1px 6px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
      </div>
      <div style={{ padding: '8px 16px 0' }}>
        <PremiumFlow audience="user" initialReference={reference} showBenefits={showBenefits} onExit={leave} onDone={leave} />
      </div>
    </div>
  )
}
