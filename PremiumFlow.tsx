import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icons'
import { PlanTable, DurationSlider } from './PremiumComparison'
import { CountryField } from './CountryPicker'
import type { Country } from './countryData'
import {
  USER_FEATURES,
  COMPANY_FEATURES,
  fetchPrices,
  fetchLimits,
  saveCountry,
  startCheckout,
  verifyPayment,
  findPendingReference,
  saveCheckoutContext,
  clearCheckoutContext,
  formatMoney,
  formatDate,
  planLabel,
} from './premiumShared'
import type { Audience, PriceInfo, VerifyResult, Limits } from './premiumShared'

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  greenSoft: 'var(--fx-tint-green)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: '#DC2626',
  dark: '#0E2A16',
}

type Step = 'loading' | 'review' | 'order' | 'pay' | 'verifying' | 'success' | 'failed'

type Props = {
  audience: Audience
  companyId?: string | null
  companyName?: string | null
  // set when the user comes back from the payment page
  initialReference?: string
  wide?: boolean
  // open on the benefits page even when Premium is already active
  showBenefits?: boolean
  onExit: () => void
  onDone: () => void
  // called after Premium was activated so the page can refresh its own data
  onChanged?: () => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function PremiumFlow({ audience, companyId, companyName, initialReference, wide, showBenefits, onExit, onDone, onChanged }: Props) {
  const isCompany = audience === 'company'
  const productName = isCompany ? 'Farmxie Company Premium' : 'Farmxie Premium'
  const [step, setStep] = useState<Step>('loading')
  const [info, setInfo] = useState<PriceInfo | null>(null)
  const [months, setMonths] = useState(6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [stuck, setStuck] = useState(false)
  const [limits, setLimits] = useState<Limits>({})
  const [failMsg, setFailMsg] = useState<string | null>(null)
  // Real numbers from the database replace the placeholder text (declared after `limits` on purpose)
  const baseFeatures = isCompany ? COMPANY_FEATURES : USER_FEATURES
  const features = baseFeatures.map((f) => {
    const l = f.limitKey ? limits[f.limitKey] : undefined
    return l ? { ...f, free: String(l.free), premium: String(l.premium) } : f
  })
  const started = useRef(false)

  const price = info?.prices.find((p) => p.months === months) || null
  const isActive = !!info?.status?.is_premium
  // Premium that ran out: it has an expiry date in the past and is no longer active
  const expired = !!info && !isActive && !!info.status?.premium_until
  const ctaVerb = isActive ? 'Extend' : expired ? 'Renew' : 'Upgrade'
  const ctaLabel = price && info ? `${ctaVerb} for ${formatMoney(price.amount, info.currency)}` : `${ctaVerb} Premium`

  // The price depends on the country, so a missing country is chosen here before anything is paid
  const chooseCountry = async (c: Country) => {
    setBusy(true)
    setError(null)
    const err = await saveCountry(audience, companyId, { name: c.name, code: c.code })
    if (err) {
      setError(err)
      setBusy(false)
      return
    }
    const { info: loaded, error: e } = await fetchPrices(audience, companyId)
    if (e || !loaded) {
      setError(e || 'Could not load Premium prices')
    } else {
      setInfo(loaded)
      setMonths((m) => (loaded.prices.some((x) => x.months === m) ? m : loaded.prices.length ? loaded.prices[loaded.prices.length - 1].months : m))
    }
    setBusy(false)
  }

  const runVerify = async (reference: string) => {
    setStep('verifying')
    setStuck(false)
    setError(null)
    for (let i = 0; i < 6; i++) {
      const r = await verifyPayment(reference)
      if (r.error) {
        setError(r.error)
        setStuck(true)
        return
      }
      if (r.status === 'active') {
        setResult(r)
        setStep('success')
        clearCheckoutContext()
        onChanged?.()
        return
      }
      if (r.status === 'failed' || r.status === 'mismatch') {
        setFailMsg(null)
        setStep('failed')
        clearCheckoutContext()
        return
      }
      if (r.status === 'cancelled') {
        setNotice('The payment was cancelled. Nothing was charged and Premium was not activated.')
        setStep('order')
        clearCheckoutContext()
        return
      }
      await sleep(3000)
    }
    setStuck(true)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    fetchLimits().then(setLimits).catch(() => {})
    ;(async () => {
      const { info: loaded, error: e } = await fetchPrices(audience, companyId)
      if (e || !loaded) {
        setError(e || 'Could not load Premium prices')
        setStep('review')
        return
      }
      setInfo(loaded)
      // Start on a plan length that really exists for this country
      setMonths((m) => (loaded.prices.some((x) => x.months === m) ? m : loaded.prices.length ? loaded.prices[loaded.prices.length - 1].months : m))

      if (initialReference) {
        runVerify(initialReference)
        return
      }

      // A payment that was made but never confirmed (closed tab etc.) gets confirmed now
      const pending = await findPendingReference(audience, companyId)
      if (pending) {
        const r = await verifyPayment(pending)
        if (r.status === 'active') {
          setResult(r)
          setStep('success')
          onChanged?.()
          return
        }
      }

      setStep('review')
    })()
  }, [])

  const pay = async () => {
    setBusy(true)
    setError(null)
    const r = await startCheckout(audience, months, companyId)
    if (r.error || !r.authorization_url) {
      setError(r.error || 'Could not start the payment. Please try again.')
      setBusy(false)
      return
    }
    saveCheckoutContext({ audience, companyId, reference: r.reference })
    window.location.href = r.authorization_url
  }

  const back = () => {
    setError(null)
    setNotice(null)
    if (step === 'order') setStep('review')
    else if (step === 'pay') setStep('order')
    else onExit()
  }

  const container: CSSProperties = { maxWidth: wide ? 760 : undefined, margin: '0 auto' }
  const showBack = step === 'order' || step === 'pay'

  if (step === 'loading') {
    return <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
  }

  return (
    <div style={container}>
      {showBack && (
        <div onClick={back} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px' }}>
          <Icon name="arrowLeft" size={16} color={COLORS.textMuted} />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted }}>Back</span>
        </div>
      )}

      {error && step !== 'verifying' && (
        <div style={{ background: 'var(--fx-tint-red2)', color: COLORS.red, borderRadius: '12px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '12px' }}>{error}</div>
      )}
      {notice && (
        <div style={{ background: COLORS.greenSoft, color: COLORS.greenDark, borderRadius: '12px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '12px' }}>{notice}</div>
      )}

      {/* 1. Free vs Premium and plan length */}
      {step === 'review' && (
        <>
          <h2 style={{ fontSize: wide ? '24px' : '22px', fontWeight: 500, color: COLORS.text, lineHeight: 1.3, margin: '2px 0 18px' }}>
            {isCompany ? 'Grow your company with advanced tools, analytics and visibility' : 'Get more access with advanced tools and insights for your farm'}
          </h2>
          {isCompany && companyName && <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '-10px 0 16px' }}>For: <b>{companyName}</b></p>}

          {isActive && (
            <div style={{ background: '#166534', border: `1px solid #B8860B`, borderRadius: '20px', padding: '16px 18px', color: 'white', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="crown" size={20} color="#F5D060" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '15.5px', fontWeight: 800 }}>Premium Active ✓</p>
                {info?.status?.premium_until && (
                  <p style={{ fontSize: '12px', color: '#D1FAE5', marginTop: '2px' }}>Active until <b style={{ color: 'white' }}>{formatDate(info.status.premium_until)}</b></p>
                )}
              </div>
            </div>
          )}

          {expired && (
            <div style={{ background: 'var(--fx-tint-amber)', color: 'var(--fx-amber-text)', borderRadius: '16px', padding: '11px 13px', fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.5 }}>
              <b>Premium Expired</b> on {formatDate(info?.status?.premium_until)}. Your data is safe. Renew to get Premium tools back.
            </div>
          )}

          {info?.country_missing && (
            <div style={{ background: 'var(--fx-tint-amber)', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
              <p style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--fx-amber-text)' }}>Choose your country</p>
              <p style={{ fontSize: '12px', color: 'var(--fx-amber-text)', margin: '4px 0 10px', lineHeight: 1.45 }}>
                Premium prices depend on your country. Pick it once to see your price.
                {isCompany ? ' This is the country of your company.' : ''}
              </p>
              <CountryField value={null} onChange={chooseCountry} disabled={busy} placeholder="Select country" title="Select your country" style={{ marginBottom: 0 }} />
            </div>
          )}

          {info && info.prices.length > 0 && !info.country_missing && (
            <DurationSlider prices={info.prices} currency={info.currency} months={months} onChange={setMonths} />
          )}
          {info && info.prices.length === 0 && (
            <p style={{ fontSize: '12.5px', color: COLORS.red, margin: '0 2px 12px' }}>No Premium price is configured for your country yet.</p>
          )}

          <PlanTable features={features} proLabel="Pro" />


          <div style={{
            position: wide ? 'static' : 'sticky', bottom: 0, zIndex: 5, marginTop: '10px',
            background: wide ? 'transparent' : 'linear-gradient(to top, var(--fx-card) 78%, rgba(255,255,255,0))',
            padding: '18px 0 calc(12px + env(safe-area-inset-bottom, 0px))',
          }}>
            <PrimaryButton label={ctaLabel} onClick={() => setStep('order')} disabled={!price || !!info?.country_missing} />
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', margin: '10px 0 0', lineHeight: 1.4 }}>
              {price ? `One-time payment for ${planLabel(price.months).toLowerCase()}. Does not renew automatically.` : 'Choose a plan length to continue.'}
            </p>
          </div>
        </>
      )}

      {/* 3. Order summary */}
      {step === 'order' && info && (!price ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Please choose a plan first.</p>
      ) : (
        <>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Order Summary</h2>
          <SummaryCard
            productName={productName}
            rows={[
              ['Plan', planLabel(months)],
              ['Country', info.country],
              ['Currency', info.currency],
              ['Price', formatMoney(price.amount, info.currency)],
              ['Total', formatMoney(price.amount, info.currency)],
            ]}
          />
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '10px 2px 16px' }}>You will not be charged until you pay on the next screen.</p>
          <PrimaryButton label="Continue to Payment" onClick={() => setStep('pay')} />
        </>
      ))}

      {/* 4. Payment */}
      {step === 'pay' && info && price && (
        <>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginBottom: '14px' }}>Payment</h2>
          <SummaryCard
            productName={productName}
            rows={[
              ['Selected plan', planLabel(months)],
              ['Price', formatMoney(price.amount, info.currency)],
              ['Currency', info.currency],
            ]}
          />
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '10px 2px 16px' }}>
            You will be taken to our secure payment page. Premium is activated only after the payment is verified.
          </p>
          <PrimaryButton label={busy ? 'Please wait…' : `Pay ${formatMoney(price.amount, info.currency)}`} onClick={pay} disabled={busy} />
        </>
      )}

      {/* 5. Verifying */}
      {step === 'verifying' && (
        <div style={{ textAlign: 'center', padding: '40px 10px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '28px', background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Icon name="shield" size={26} color={COLORS.green} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{stuck ? 'Still confirming your payment' : 'Verifying your payment…'}</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
            {stuck
              ? (error || 'This is taking longer than usual. If you were charged, your Premium will be activated as soon as the payment is confirmed.')
              : 'Please wait a moment. Do not close this page.'}
          </p>
          {stuck && (
            <div style={{ maxWidth: 280, margin: '18px auto 0' }}>
              <PrimaryButton label="Check again" onClick={() => initialReference ? runVerify(initialReference) : window.location.reload()} />
              <GhostButton label="Back to Farmxie" onClick={onExit} />
            </div>
          )}
        </div>
      )}

      {/* 6. Success */}
      {step === 'success' && result && (
        <div style={{ textAlign: 'center', padding: '20px 4px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Icon name="crown" size={30} color="white" />
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>
            Welcome to {productName} 🎉
          </h2>
          <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '6px 0 18px' }}>Your Premium membership is now active.</p>
          <div style={{ textAlign: 'left' }}>
            <SummaryCard
              productName={productName}
              rows={[
                ['Plan', planLabel(result.months || months)],
                ['Amount', formatMoney(result.amount || 0, result.currency || info?.currency || 'NGN')],
                ['Active Until', formatDate(result.expires_at)],
              ]}
            />
          </div>
          <div style={{ marginTop: '18px' }}>
            <PrimaryButton label="Start Using Premium" onClick={onDone} />
          </div>
        </div>
      )}

      {/* 7. Failed */}
      {step === 'failed' && (
        <div style={{ textAlign: 'center', padding: '30px 4px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: 'var(--fx-tint-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Icon name="shield" size={28} color={COLORS.red} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Payment unsuccessful</h2>
          <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '6px 0 20px', lineHeight: 1.5 }}>
            {failMsg || 'Your payment was not completed. Your Premium membership has not been activated.'}
          </p>
          <div style={{ maxWidth: 280, margin: '0 auto' }}>
            <PrimaryButton label="Try Again" onClick={() => { setNotice(null); setStep(info ? 'order' : 'review') }} />
            <GhostButton label="Cancel" onClick={onExit} />
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ productName, rows }: { productName: string; rows: [string, string][] }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: `1px solid ${COLORS.bg}`, marginBottom: '4px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="crown" size={16} color={COLORS.green} />
        </div>
        <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{productName}</p>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '9px 0', borderBottom: `1px solid ${COLORS.bg}` }}>
          <span style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{k}</span>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        textAlign: 'center', padding: '16px', borderRadius: '999px', fontWeight: 700, fontSize: '17px',
        background: disabled ? '#9AA89E' : COLORS.dark, color: 'white', cursor: disabled ? 'default' : 'pointer',
      }}>
      {label}
    </div>
  )
}

function GhostButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ textAlign: 'center', padding: '14px', borderRadius: '999px', fontWeight: 700, fontSize: '15px', color: COLORS.textMuted, cursor: 'pointer', marginTop: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
      {label}
    </div>
  )
}
