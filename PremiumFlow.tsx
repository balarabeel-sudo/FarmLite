import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icons'
import { VersusBanner, ComparisonTable, IncludedGrid, PremiumPill } from './PremiumComparison'
import {
  USER_FEATURES,
  COMPANY_FEATURES,
  USER_INCLUDED,
  COMPANY_INCLUDED,
  fetchPrices,
  fetchLimits,
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
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Step = 'loading' | 'active' | 'review' | 'plan' | 'order' | 'pay' | 'verifying' | 'success' | 'failed'

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
  const baseFeatures = isCompany ? COMPANY_FEATURES : USER_FEATURES
  // Real numbers from the database replace the placeholder text
  const features = baseFeatures.map((f) =>
    f.limitKey && limits[f.limitKey]
      ? { ...f, free: `${limits[f.limitKey].free}${f.unit || ''}`, premium: `${limits[f.limitKey].premium}${f.unit || ''}` }
      : f,
  )
  const included = isCompany ? COMPANY_INCLUDED : USER_INCLUDED

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
  const started = useRef(false)
  const includedRef = useRef<HTMLDivElement>(null)

  const price = info?.prices.find((p) => p.months === months) || null
  const isActive = !!info?.status?.is_premium
  // Premium that ran out: it has an expiry date in the past and is no longer active
  const expired = !!info && !isActive && !!info.status?.premium_until
  const ctaLabel = isActive ? 'Extend Premium' : expired ? 'Renew Premium' : isCompany ? 'Upgrade to Company Premium' : 'Upgrade to Premium'

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

      setStep(loaded.status?.is_premium && !showBenefits ? 'active' : 'review')
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
    if (step === 'plan') setStep('review')
    else if (step === 'order') setStep('plan')
    else if (step === 'pay') setStep('order')
    else onExit()
  }

  const container: CSSProperties = { maxWidth: wide ? 760 : undefined, margin: '0 auto' }
  const showBack = step === 'plan' || step === 'order' || step === 'pay'

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
        <div style={{ background: '#FEF2F2', color: COLORS.red, borderRadius: '12px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '12px' }}>{error}</div>
      )}
      {notice && (
        <div style={{ background: COLORS.greenSoft, color: COLORS.greenDark, borderRadius: '12px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '12px' }}>{notice}</div>
      )}

      {/* Already Premium */}
      {step === 'active' && (
        <>
          <div style={{ background: COLORS.greenDark, border: `1px solid #B8860B`, borderRadius: '16px', padding: '20px 18px', color: 'white', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="crown" size={22} color="#F5D060" />
              </div>
              <div>
                <p style={{ fontSize: '17px', fontWeight: 800 }}>Premium Active ✓</p>
                <p style={{ fontSize: '12px', color: '#D1FAE5', marginTop: '3px' }}>{productName}</p>
              </div>
            </div>
            {info?.status?.premium_until && (
              <p style={{ fontSize: '12.5px', color: '#D1FAE5', marginTop: '14px' }}>Active until: <b style={{ color: 'white' }}>{formatDate(info.status.premium_until)}</b></p>
            )}
          </div>
          <PrimaryButton label="Extend Premium" onClick={() => setStep('plan')} />
          <GhostButton label="View Benefits" onClick={() => setStep('review')} />
        </>
      )}

      {/* 1. Review: Free vs Premium (no prices yet) */}
      {step === 'review' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <PremiumPill label={isCompany ? 'FARMXIE PREMIUM' : 'FARMXIE PREMIUM'} />
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: COLORS.text, lineHeight: 1.25, margin: '10px 0 6px' }}>
              {isCompany ? 'Grow Your Company with Farmxie Premium' : 'Grow More With Farmxie Premium'}
            </h2>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>
              {isCompany
                ? 'Unlock advanced business tools, analytics, visibility and marketplace capabilities.'
                : 'Unlock more tools, insights and opportunities for your farm, marketplace and community.'}
            </p>
            {isCompany && companyName && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '6px' }}>For: <b>{companyName}</b></p>}
          </div>

          {expired && (
            <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '12px', padding: '11px 13px', fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.5 }}>
              <b>Premium Expired</b> on {formatDate(info?.status?.premium_until)}. Your data is safe. Renew to get Premium tools back.
            </div>
          )}

          <VersusBanner company={isCompany} />

          <div style={{ marginBottom: '22px' }}>
            <PrimaryButton label={ctaLabel} onClick={() => setStep('plan')} disabled={!info} />
            <GhostButton label="View All Benefits" onClick={() => includedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          </div>

          <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>Free vs Premium</p>
          <ComparisonTable features={features} company={isCompany} />
          <p style={{ fontSize: '10.5px', color: COLORS.textMuted, margin: '8px 2px 22px', lineHeight: 1.5 }}>
            Features marked <b>Soon</b> are being rolled out and unlock automatically for Premium members as they go live.
          </p>

          <div ref={includedRef} style={{ scrollMarginTop: '70px' }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              {isCompany ? 'Everything in Company Premium' : 'Everything included with Premium'}
            </p>
            <IncludedGrid items={included} />
          </div>

          <div style={{ marginTop: '22px' }}>
            <PrimaryButton label={ctaLabel} onClick={() => setStep('plan')} disabled={!info} />
          </div>
        </>
      )}

      {/* 2. Choose duration */}
      {step === 'plan' && info && (
        <>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text, marginBottom: '4px' }}>Choose your plan</h2>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '14px' }}>{productName} · prices in {info.currency}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
            {info.prices.map((p) => {
              const selected = p.months === months
              return (
                <div
                  key={p.months}
                  onClick={() => setMonths(p.months)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '14px', cursor: 'pointer',
                    background: selected ? COLORS.greenSoft : COLORS.card,
                    border: `2px solid ${selected ? COLORS.green : COLORS.border}`,
                  }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '10px', border: `2px solid ${selected ? COLORS.green : COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected && <div style={{ width: '10px', height: '10px', borderRadius: '5px', background: COLORS.green }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>
                      {planLabel(p.months)}
                      {p.months === 6 && <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 800, color: 'white', background: COLORS.green, borderRadius: '8px', padding: '2px 7px' }}>Best Value</span>}
                    </p>
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.greenDark }}>{formatMoney(p.amount, info.currency)}</p>
                </div>
              )
            })}
          </div>
          {info.prices.length === 0 && <p style={{ fontSize: '12.5px', color: COLORS.red, marginBottom: '12px' }}>No Premium price is configured for your country yet.</p>}
          <PrimaryButton label="Continue" onClick={() => setStep('order')} disabled={!price} />
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
          <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
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
        textAlign: 'center', padding: '13px', borderRadius: '12px', fontWeight: 800, fontSize: '14px',
        background: disabled ? '#A7D7B4' : COLORS.green, color: 'white', cursor: disabled ? 'default' : 'pointer',
      }}>
      {label}
    </div>
  )
}

function GhostButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ textAlign: 'center', padding: '12px', borderRadius: '12px', fontWeight: 700, fontSize: '13.5px', color: COLORS.textMuted, cursor: 'pointer', marginTop: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
      {label}
    </div>
  )
}
