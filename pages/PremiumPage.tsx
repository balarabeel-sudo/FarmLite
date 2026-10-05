import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../Icons'
import PremiumFlow from '../PremiumFlow'
import { readCheckoutContext, clearCheckoutContext } from '../premiumShared'

const COLORS = {
  bg: '#F8FAF6',
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
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={leave} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Premium</p>
      </div>
      <div style={{ padding: '16px' }}>
        <PremiumFlow audience="user" initialReference={reference} showBenefits={showBenefits} onExit={leave} onDone={leave} />
      </div>
    </div>
  )
}
