import { useEffect, useRef, useState } from 'react'
import Icon from './Icons'
import {
  USER_BENEFITS,
  COMPANY_BENEFITS,
  fetchPrices,
  startCheckout,
  verifyPayment,
  findPendingReference,
  saveCheckoutContext,
  clearCheckoutContext,
  formatMoney,
  formatDate,
  planLabel,
} from './premiumShared'
import type { Audience, PriceInfo, VerifyResult } from './premiumShared'

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
  onExit: () => void
  onDone: () => void
  // called after Premium was activated so the page can refresh its own data
  onChanged?: () => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function PremiumFlow({ audience, companyId, companyName, initialReference, wide, onExit, onDone, onChanged }: Props) {
  const isCompany = audience === 'company'
  const productName = isCompany ? 'FarmLite Company Premium' : 'FarmLite Premium'
  const benefits = isCompany ? COMPANY_BENEFITS : USER_BENEFITS

  const [step, setStep] = useState<Step>('loading')
  const [info, setInfo] = useState<PriceInfo | null>(null)
  const [months, setMonths] = useState(6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [stuck, setStuck] = useState(false)
  const [failMsg, setFailMsg] = useState<string | null>(null)
  const started = useRef(false)

  const price = info?.prices.find((p) => p.months === months) || null

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

      setStep(loaded.status?.is_premium ? 'active' : 'review')
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
    if (step === 'plan') setStep(info?.status?.is_premium ? 'active' : 'review')
    else if (step === 'order') setStep('plan')
    else if (step === 'pay') setStep('order')
    else onExit()
  }

  const container: React.CSSProperties = { maxWidth: wide ? 760 : undefined, margin: '0 auto' }
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
          <Hero title="Premium Active" subtitle={`${productName} is active${info?.status?.premium_until ? ` until ${formatDate(info.status.premium_until)}` : ''}.`} />
          <BenefitsGrid benefits={benefits} />
          <PrimaryButton label="Extend Premium" onClick={() => setStep('plan')} />
        </>
      )}

      {/* 1. Review benefits (no prices yet) */}
      {step === 'review' && (
        <>
          <Hero
            title={productName}
            subtitle={isCompany ? 'Grow your company presence, visibility and insights on FarmLite.' : 'Unlock more tools, insights and opportunities on FarmLite.'}
            company={isCompany ? companyName : null}
          />
          {!isCompany && (
            <div style={{ background: COLORS.greenSoft, borderRadius: '14px', padding: '14px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="checkCircle" size={18} color="white" />
              </div>
              <div>
                <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.greenDark }}>Premium Short Videos</p>
                <p style={{ fontSize: '12.5px', color: COLORS.text, marginTop: '3px', lineHeight: 1.5 }}>Upload short videos up to 20 seconds.</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '5px', lineHeight: 1.5 }}>
                  Free users can still watch Short Videos created by Premium users, but cannot upload their own.
                </p>
              </div>
            </div>
          )}
          <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
            {isCompany ? 'Company Premium Benefits' : 'Premium Benefits'}
          </p>
          <BenefitsGrid benefits={benefits} />
          <PrimaryButton label="Continue" onClick={() => setStep('plan')} disabled={!info} />
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
              ['Price', formatMoney(price.amount, info.currency)],
              ['Billing', 'One-time payment for the selected period'],
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
              <GhostButton label="Back to FarmLite" onClick={onExit} />
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

function Hero({ title, subtitle, company }: { title: string; subtitle: string; company?: string | null }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDark})`, borderRadius: '18px', padding: '22px 18px', color: 'white', marginBottom: '16px' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
        <Icon name="crown" size={22} color="white" />
      </div>
      <p style={{ fontSize: '20px', fontWeight: 800 }}>{title}</p>
      <p style={{ fontSize: '12.5px', color: '#DCFCE7', marginTop: '5px', lineHeight: 1.5 }}>{subtitle}</p>
      {company && <p style={{ fontSize: '11.5px', color: '#DCFCE7', marginTop: '8px', opacity: 0.9 }}>For: {company}</p>}
    </div>
  )
}

function BenefitsGrid({ benefits }: { benefits: { icon: string; title: string; text: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginBottom: '20px' }}>
      {benefits.map((b) => (
        <div key={b.title} style={{ background: COLORS.card, borderRadius: '14px', padding: '12px', display: 'flex', gap: '11px', alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: COLORS.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={b.icon} size={16} color={COLORS.green} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{b.title}</p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', lineHeight: 1.45 }}>{b.text}</p>
          </div>
        </div>
      ))}
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
