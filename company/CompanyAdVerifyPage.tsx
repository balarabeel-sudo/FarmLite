import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const COLORS = { green: '#16A34A', greenDark: '#166534', text: '#1A2E1A', textMuted: '#5B6B5B', red: '#B91C1C' }

// Route: /company/ads/verify?reference=AD_...  (Paystack sends the owner back here after paying)
// The server confirms the payment with Paystack; only then does the ad start.
export default function CompanyAdVerifyPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reference = params.get('reference') || params.get('trxref') || ''
  const [state, setState] = useState<'checking' | 'active' | 'failed' | 'cancelled' | 'pending' | 'error'>('checking')
  const [adId, setAdId] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!reference) { setState('error'); return }

    let tries = 0
    const check = async () => {
      tries += 1
      const { data, error } = await supabase.functions.invoke('ads-verify', { body: { reference } })
      if (data?.ad_id) setAdId(data.ad_id)
      if (error || data?.error) return setState('error')
      if (data?.status === 'active') return setState('active')
      if (data?.status === 'failed') return setState('failed')
      if (data?.status === 'cancelled') return setState('cancelled')
      if (data?.status === 'pending' && tries < 6) { setTimeout(check, 2500); return }
      setState('pending')
    }
    check()
  }, [reference])

  const goAd = () => navigate(adId ? `/company/ads/${adId}` : '/company/ads', { replace: true })

  const copy: Record<typeof state, { title: string; text: string; color: string }> = {
    checking: { title: 'Confirming your payment…', text: 'Please wait a moment. Do not close this page.', color: COLORS.text },
    active: { title: 'Payment received. Your ad is live!', text: 'Your ad is now running. You can follow impressions and clicks on its page.', color: COLORS.greenDark },
    failed: { title: 'The payment did not go through', text: 'You were not charged for this ad. You can try paying again from the ad page.', color: COLORS.red },
    cancelled: { title: 'Payment cancelled', text: 'Nothing was charged. You can pay again from the ad page whenever you are ready.', color: COLORS.text },
    pending: { title: 'Still waiting for confirmation', text: 'The payment has not been confirmed yet. Open the ad page in a minute to check its status.', color: COLORS.text },
    error: { title: 'We could not confirm the payment', text: 'If money left your account, it will be matched to your ad. Open the ad page and check again shortly.', color: COLORS.red },
  }
  const c = copy[state]

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
      <p style={{ fontSize: '20px', fontWeight: 800, color: c.color }}>{c.title}</p>
      <p style={{ fontSize: '13.5px', color: COLORS.textMuted, lineHeight: 1.6, marginTop: 10 }}>{c.text}</p>
      {state !== 'checking' && (
        <div onClick={goAd} style={{ display: 'inline-block', marginTop: 22, padding: '12px 28px', borderRadius: 12, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer' }}>
          Go to my ad
        </div>
      )}
    </div>
  )
}
