import { useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import type { Currency } from '../LocaleContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import FarmLiteLogo from '../FarmLiteLogo'
import {
  getMyWallet, startTopup, verifyTopup, verifyOrderCode, verifyErrorMessage, useMoney, payFarmDeskFromWallet,
  fetchBanks, resolveAccount, requestWithdrawal, cancelWithdrawal, WITHDRAWAL_STATUS, WITHDRAWAL_COLUMNS,
  TX_LABELS,
} from '../walletShared'
import type { Wallet, WalletTx, Withdrawal, Bank } from '../walletShared'

// Dark green look for the wallet only.
const COLORS = {
  bg: '#04130C',
  card: '#0C2418',
  cardSoft: '#0F2D1F',
  border: '#1B4A31',
  green: '#16A34A',
  greenLight: '#4ADE80',
  text: 'var(--fx-tint-green3)',
  textMuted: '#8FB09C',
  red: '#F87171',
  amber: '#FBBF24',
  blue: '#60A5FA',
}

const HIDE_KEY = 'fl_wallet_hidden'
const PENDING_REF_KEY = 'fl_pending_topup_ref'
const QUICK_AMOUNTS = [1000, 5000, 10000, 50000]

function readHidden() {
  try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
}

export default function WalletPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currency, currencies, setCurrency } = useLocale()
  const money = useMoney()

  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [incoming, setIncoming] = useState(0)
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [hidden, setHidden] = useState(readHidden)
  const [banner, setBanner] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [curOpen, setCurOpen] = useState(false)
  const [firstName, setFirstName] = useState('')

  // ?pay=<farm_desk_payment_id> comes from the Pay with wallet button in a Farm Desk request
  const [payId, setPayId] = useState<string | null>(() => searchParams.get('pay'))
  const [sheet, setSheet] = useState<'topup' | 'verify' | 'pay' | 'withdraw' | null>(() => (searchParams.get('pay') ? 'pay' : null))

  const load = async () => {
    if (!user) return
    setNetError(false)
    try {
      const [w, txRes, incomingRes, wdRes] = await Promise.all([
        getMyWallet(),
        supabase.from('wallet_transactions')
          .select('id, type, available_delta, held_delta, order_id, reference, note, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('orders').select('amount').eq('seller_id', user.id).in('status', ['escrow_held', 'disputed']),
        supabase.from('withdrawal_requests').select(WITHDRAWAL_COLUMNS).eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])
      if (txRes.error || incomingRes.error) throw new Error('load failed')
      if (wdRes.error) throw new Error('load failed')
      setWithdrawals((wdRes.data || []).map((x: any) => ({ ...x, amount: Number(x.amount) })) as Withdrawal[])
      setWallet(w)
      setTxs((txRes.data || []).map((t: any) => ({
        ...t, available_delta: Number(t.available_delta), held_delta: Number(t.held_delta),
      })))
      setIncoming((incomingRes.data || []).reduce((sum: number, o: any) => sum + Number(o.amount), 0))
    } catch {
      setNetError(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('full_name, username').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        const n = ((data as any)?.full_name || (data as any)?.username || '').trim()
        setFirstName(n.split(/\s+/)[0] || '')
      }, () => {})
  }, [user])

  // Coming back from Paystack: ?reference=FL_xxx -> verify and credit the wallet
  useEffect(() => {
    const ref = searchParams.get('reference') || searchParams.get('trxref')
    const reference = ref || null
    if (!reference) return

    setSearchParams({}, { replace: true })
    ;(async () => {
      try {
        const res = await verifyTopup(reference)
        if (res.credited) setBanner({ type: 'ok', text: `Top-up successful: ${money.formatNgn(res.amount || 0)} added to your wallet.` })
        else if (res.already_credited) setBanner({ type: 'ok', text: 'This top-up was already added to your wallet.' })
        else setBanner({ type: 'error', text: `Payment not completed (${res.status || 'pending'}).` })
      } catch (e) {
        setBanner({ type: 'error', text: (e as Error).message })
      }
      try { sessionStorage.removeItem(PENDING_REF_KEY) } catch { /* ignore */ }
      load()
    })()
  }, [])

  const toggleHidden = () => {
    const next = !hidden
    setHidden(next)
    try { localStorage.setItem(HIDE_KEY, next ? '1' : '0') } catch { /* ignore */ }
  }

  const show = (ngn: number) => (hidden ? '••••••' : money.format(ngn))

  if (netError) {
    return (
      <Page>
        <Header onBack={() => navigate(-1)} onBell={() => navigate('/notifications')} onAvatar={() => navigate('/account')} />
        <NetworkError onRetry={load} />
      </Page>
    )
  }

  const activeCur = currencies.find((c: { code: string }) => c.code === currency)
  const visibleTxs = showAll ? txs : txs.slice(0, 4)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <Page>
      <Header onBack={() => navigate(-1)} onBell={() => navigate('/notifications')} onAvatar={() => navigate('/account')} />

      <div style={{ padding: '0 14px' }}>
        <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, lineHeight: 1.2 }}>{greeting}{firstName ? `, ${firstName}` : ''}</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>Your farm. Your business. Our network.</p>

        {banner && (
          <div onClick={() => setBanner(null)} style={{
            padding: '9px 11px', borderRadius: '10px', marginTop: '10px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
            background: banner.type === 'ok' ? 'rgba(34,197,94,0.14)' : 'rgba(248,113,113,0.14)',
            border: `1px solid ${banner.type === 'ok' ? 'rgba(34,197,94,0.45)' : 'rgba(248,113,113,0.45)'}`,
            color: banner.type === 'ok' ? COLORS.greenLight : COLORS.red,
          }}>
            {banner.text}
          </div>
        )}

        {/* Balance card */}
        <div style={{
          position: 'relative', borderRadius: '18px', padding: '12px 13px', border: `1px solid ${COLORS.border}`, marginTop: '12px',
          background: 'linear-gradient(145deg, #0F3A27 0%, #0B2A1C 55%, #082015 100%)', boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Icon name="wallet" size={16} color={COLORS.greenLight} />
              <p style={{ fontSize: '12px', fontWeight: 600, color: COLORS.text }}>Wallet Balance</p>
            </div>

            <div style={{ position: 'relative' }}>
              <div onClick={() => setCurOpen((v) => !v)} style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '999px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${COLORS.border}`, fontSize: '11.5px', fontWeight: 700, color: COLORS.text,
              }}>
                <span style={{ fontSize: '12px' }}>{activeCur?.flag}</span> {currency}
                <Icon name="chevronDown" size={12} color={COLORS.text} />
              </div>
              {curOpen && (
                <div style={{ position: 'absolute', right: 0, top: '30px', zIndex: 20, background: '#0C2418', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '4px', minWidth: '110px', boxShadow: '0 10px 24px rgba(0,0,0,0.5)' }}>
                  {currencies.map((c: { code: string; flag?: string }) => (
                    <div key={c.code} onClick={() => { setCurrency(c.code as Currency); setCurOpen(false) }} style={{
                      padding: '7px 9px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '7px',
                      color: c.code === currency ? COLORS.greenLight : COLORS.text, background: c.code === currency ? 'rgba(34,197,94,0.12)' : 'transparent',
                    }}>
                      <span>{c.flag}</span> {c.code}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <p style={{ fontSize: '26px', fontWeight: 800, color: COLORS.text, letterSpacing: hidden ? '2px' : '-0.3px', lineHeight: 1.1 }}>
              {loading || !wallet ? '...' : show(wallet.available)}
            </p>
            <div onClick={toggleHidden} style={{ cursor: 'pointer', display: 'flex', padding: '3px' }}>
              <Icon name={hidden ? 'eyeOff' : 'eye'} size={16} color={COLORS.textMuted} />
            </div>
          </div>
          <p style={{ fontSize: '10.5px', fontWeight: 600, color: COLORS.greenLight, marginTop: '3px', minHeight: '13px' }}>
            {loading || !wallet ? ' ' : hidden ? '≈ ••••' : `≈ ${money.formatNgn(wallet.available)}`}
          </p>

          <div style={{ display: 'flex', marginTop: '9px', background: 'rgba(0,0,0,0.22)', border: `1px solid ${COLORS.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <Stat icon="arrowUp" label="Pending (in escrow)" value={loading || !wallet ? '...' : show(wallet.held)} />
            <div style={{ width: '1px', background: COLORS.border }} />
            <Stat icon="arrowDown" label="Incoming sales" value={loading ? '...' : show(incoming)} />
          </div>

          {money.isForeign && (
            <p style={{ fontSize: '9.5px', color: COLORS.textMuted, marginTop: '7px', lineHeight: 1.35 }}>
              Shown in {currency} for reference{money.live ? '' : ' (approximate rate)'}. Your money is held and paid in NGN.
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px', marginTop: '10px' }}>
          <Action icon="send" label="Top Up" sub="Add funds" onClick={() => setSheet('topup')} />
          <Action icon="qr" label="Receive" sub="Enter code" onClick={() => setSheet('verify')} />
          <Action icon="arrowUp" label="Withdraw" sub="To bank" onClick={() => setSheet('withdraw')} />
          <Action icon="fileText" label="Orders" sub="View all" onClick={() => navigate('/orders')} />
        </div>

        {/* Withdrawals */}
        {withdrawals.length > 0 && (
          <>
            <SectionTitle title="Withdrawals" />
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', overflow: 'hidden' }}>
              {withdrawals.slice(0, 3).map((w, i) => {
                const st = WITHDRAWAL_STATUS[w.status]
                const tone = chipTone(w.status)
                return (
                  <div key={w.id} style={{ padding: '9px 11px', borderTop: i === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <IconBubble icon="arrowUp" bg="rgba(248,113,113,0.16)" color={COLORS.red} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>Withdrawal</p>
                        <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '1px' }}>
                          {w.bank_name} ••••{w.account_number.slice(-4)} · {new Date(w.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.text }}>- {hidden ? '••••' : money.formatNgn(w.amount)}</p>
                        <span style={{ display: 'inline-block', marginTop: '3px', fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', background: tone.bg, color: tone.color }}>{st.label}</span>
                      </div>
                    </div>
                    {w.status === 'rejected' && w.admin_note && (
                      <p style={{ fontSize: '10px', color: COLORS.red, marginTop: '5px' }}>Reason: {w.admin_note}</p>
                    )}
                    {w.status === 'pending' && (
                      <p
                        onClick={async () => {
                          try { await cancelWithdrawal(w.id); setBanner({ type: 'ok', text: 'Withdrawal cancelled. The money is back in your wallet.' }); load() }
                          catch (e) { setBanner({ type: 'error', text: (e as Error).message }) }
                        }}
                        style={{ fontSize: '10.5px', fontWeight: 700, color: COLORS.red, marginTop: '6px', cursor: 'pointer' }}>
                        Cancel withdrawal
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Recent transactions */}
        <SectionTitle
          title="Recent Transactions"
          action={txs.length > 4 ? (showAll ? 'Show less' : 'View All') : undefined}
          onAction={() => setShowAll((v) => !v)}
        />
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: '12px', fontSize: '11.5px', color: COLORS.textMuted }}>Loading...</p>
          ) : txs.length === 0 ? (
            <p style={{ padding: '12px', fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.5 }}>No activity yet. Top up your wallet to start buying with escrow.</p>
          ) : (
            visibleTxs.map((t, i) => (
              <TxRow key={t.id} tx={t} first={i === 0} hidden={hidden} money={money} onClick={t.order_id ? () => navigate(`/orders/${t.order_id}`) : undefined} />
            ))
          )}
        </div>
      </div>

      {sheet === 'pay' && payId && (
        <PayFarmDeskSheet
          paymentId={payId}
          available={wallet ? wallet.available : null}
          onClose={() => { setSheet(null); setPayId(null); setSearchParams({}, { replace: true }); load() }}
          onTopUp={() => { setSheet('topup'); setPayId(null); setSearchParams({}, { replace: true }) }}
        />
      )}
      {sheet === 'topup' && <TopUpSheet onClose={() => setSheet(null)} />}
      {sheet === 'withdraw' && (
        <WithdrawSheet
          available={wallet ? wallet.available : 0}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null)
            setBanner({ type: 'ok', text: 'Withdrawal requested. Farmxie will review and send it to your bank.' })
            load()
          }}
        />
      )}
      {sheet === 'verify' && (
        <VerifySheet
          onClose={() => setSheet(null)}
          onDone={(amount) => {
            setSheet(null)
            setBanner({ type: 'ok', text: `Code verified. ${money.formatNgn(amount)} has been added to your wallet.` })
            load()
          }}
        />
      )}
    </Page>
  )
}

function PayFarmDeskSheet({ paymentId, available, onClose, onTopUp }: {
  paymentId: string
  available: number | null
  onClose: () => void
  onTopUp: () => void
}) {
  const navigate = useNavigate()
  const money = useMoney()
  const [info, setInfo] = useState<{ request_id: string; amount: number; currency: string; status: string; code: string; title: string } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: p, error: pe } = await supabase
        .from('farm_desk_payments').select('id, request_id, amount, currency, status').eq('id', paymentId).maybeSingle()
      if (pe || !p) { setLoadError('This payment could not be found.'); return }
      const { data: r } = await supabase
        .from('farm_desk_requests').select('request_code, title').eq('id', (p as any).request_id).maybeSingle()
      setInfo({
        request_id: (p as any).request_id, amount: Number((p as any).amount), currency: (p as any).currency || 'NGN', status: (p as any).status,
        code: (r as any)?.request_code || '', title: (r as any)?.title || 'Farm Desk request',
      })
    })()
  }, [paymentId])

  const pay = async () => {
    setBusy(true)
    setError('')
    try {
      await payFarmDeskFromWallet(paymentId)
      setPaid(true)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const enough = info && available != null ? available >= info.amount : false
  const alreadyPaid = info?.status === 'paid'

  return (
    <Sheet title="Farm Desk payment" onClose={onClose}>
      {loadError ? (
        <p style={{ fontSize: '12.5px', color: COLORS.red }}>{loadError}</p>
      ) : !info ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
      ) : paid || alreadyPaid ? (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 14px' }}>
            <Icon name="checkCircle" size={38} color={COLORS.green} />
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginTop: '10px' }}>You have paid</p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: '4px' }}>{money.formatNgn(info.amount)} · {info.code}</p>
          </div>
          <PrimaryButton label="Back to my request" onClick={() => navigate(`/farm-desk/${info.request_id}`, { replace: true })} />
        </>
      ) : info.status !== 'pending' ? (
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>This payment is no longer awaiting payment.</p>
      ) : (
        <>
          <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{info.title}</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>{info.code}</p>
          <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '12px', margin: '14px 0', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Amount due</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{money.formatNgn(info.amount)}</span>
            </div>
            {money.isForeign && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>In {money.currency}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>≈ {money.format(info.amount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Your wallet</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text }}>{available == null ? '...' : money.formatNgn(available)}</span>
            </div>
          </div>
          {error && <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{error}</p>}
          {available != null && !enough ? (
            <>
              <p style={{ fontSize: '12px', color: COLORS.amber, fontWeight: 600, marginBottom: '10px' }}>
                You need {money.formatNgn(info.amount - available)} more in your wallet.
              </p>
              <PrimaryButton label="Top up wallet" onClick={onTopUp} />
            </>
          ) : (
            <PrimaryButton label={busy ? 'Paying...' : `Pay ${money.formatNgn(info.amount)} from wallet`} onClick={pay} disabled={busy || available == null} />
          )}
        </>
      )}
    </Sheet>
  )
}

function WithdrawSheet({ available, onClose, onDone }: { available: number; onClose: () => void; onDone: () => void }) {
  const money = useMoney()
  const [banks, setBanks] = useState<Bank[]>([])
  const [banksError, setBanksError] = useState('')
  const [amount, setAmount] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [verified, setVerified] = useState(false)
  const [manualName, setManualName] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBanks().then(setBanks).catch((e) => setBanksError((e as Error).message))
  }, [])

  // As soon as the account number is complete and a bank is chosen, look up the account name
  useEffect(() => {
    setAccountName('')
    setVerified(false)
    setManualName(false)
    setError('')
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) return
    let cancelled = false
    setResolving(true)
    resolveAccount(accountNumber, bankCode)
      .then((r) => {
        if (cancelled) return
        if (r.name) { setAccountName(r.name); setVerified(true) }
        else if (r.testMode) setManualName(true)
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message) })
      .finally(() => { if (!cancelled) setResolving(false) })
    return () => { cancelled = true }
  }, [accountNumber, bankCode])

  const submit = async () => {
    const n = Number(amount)
    const bank = banks.find((b) => b.code === bankCode)
    if (!Number.isFinite(n) || n < 1000) { setError('Minimum withdrawal is NGN 1,000.'); return }
    if (n > available) { setError('This is more than your available balance.'); return }
    if (!bank) { setError('Choose your bank.'); return }
    if (!/^\d{10}$/.test(accountNumber)) { setError('Account number must be 10 digits.'); return }
    if (!accountName.trim()) { setError('Account name is required.'); return }
    setBusy(true)
    setError('')
    try {
      await requestWithdrawal(n, bank, accountNumber, accountName.trim())
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title="Withdraw to bank" onClose={onClose}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '10px' }}>
        Available: {money.formatNgn(available)}. The amount leaves your wallet now and is sent to your bank after Farmxie approves it.
      </p>
      <input type="number" inputMode="numeric" placeholder="Amount (NGN, minimum 1,000)" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />

      {banksError ? (
        <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{banksError}</p>
      ) : (
        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} style={inputStyle}>
          <option value="">{banks.length ? 'Choose bank' : 'Loading banks...'}</option>
          {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      )}

      <input inputMode="numeric" maxLength={10} placeholder="Account number (10 digits)" value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} style={inputStyle} />

      {resolving && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '10px' }}>Checking account...</p>}
      {verified && (
        <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.greenLight, marginBottom: '10px' }}>{accountName}</p>
      )}
      {manualName && (
        <>
          <p style={{ fontSize: '11px', color: COLORS.amber, marginBottom: '6px' }}>Test mode cannot verify accounts. Type the account name.</p>
          <input placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} style={inputStyle} />
        </>
      )}

      {error && <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{error}</p>}
      <PrimaryButton label={busy ? 'Sending request...' : 'Request withdrawal'} onClick={submit} disabled={busy || resolving || !accountName} />
    </Sheet>
  )
}

function TopUpSheet({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n < 100) { setError('Minimum top-up is NGN 100.'); return }
    if (n > 1000000) { setError('Maximum top-up is NGN 1,000,000.'); return }
    setBusy(true)
    setError('')
    try {
      const { authorization_url, reference } = await startTopup(n)
      try { sessionStorage.setItem(PENDING_REF_KEY, reference) } catch { /* ignore */ }
      window.location.href = authorization_url
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title="Top up wallet" onClose={onClose}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '10px' }}>Enter an amount in NGN. You will pay securely with Paystack.</p>
      <input
        type="number" inputMode="numeric" placeholder="Amount (NGN)" value={amount}
        onChange={(e) => setAmount(e.target.value)} style={inputStyle}
      />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {QUICK_AMOUNTS.map((a) => (
          <div key={a} onClick={() => setAmount(String(a))} style={{
            padding: '7px 12px', borderRadius: '999px', border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 700,
            color: COLORS.text, cursor: 'pointer', background: Number(amount) === a ? 'rgba(34,197,94,0.16)' : COLORS.card,
          }}>
            {a.toLocaleString()}
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{error}</p>}
      <PrimaryButton label={busy ? 'Opening Paystack...' : 'Continue to payment'} onClick={submit} disabled={busy} />
    </Sheet>
  )
}

function VerifySheet({ onClose, onDone }: { onClose: () => void; onDone: (amount: number) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!code.trim()) { setError('Enter the code from the buyer.'); return }
    setBusy(true)
    setError('')
    try {
      const res = await verifyOrderCode(code)
      if (res.ok) onDone(Number(res.amount || 0))
      else { setError(verifyErrorMessage(res.error)); setBusy(false) }
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title="Verify QR code" onClose={onClose}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '10px' }}>
        After you deliver the goods, ask the buyer for their order code (for example QR-36282527). Enter it here to receive your payment.
      </p>
      <input
        placeholder="QR-00000000" value={code} autoCapitalize="characters"
        onChange={(e) => setCode(e.target.value)} style={{ ...inputStyle, letterSpacing: '1px', fontWeight: 700 }}
      />
      {error && <p style={{ fontSize: '12px', color: COLORS.red, marginBottom: '10px' }}>{error}</p>}
      <PrimaryButton label={busy ? 'Verifying...' : 'Verify and receive payment'} onClick={submit} disabled={busy} />
    </Sheet>
  )
}

function chipTone(status: string): { bg: string; color: string } {
  if (status === 'paid' || status === 'completed') return { bg: 'rgba(34,197,94,0.16)', color: COLORS.greenLight }
  if (status === 'rejected' || status === 'failed') return { bg: 'rgba(248,113,113,0.16)', color: COLORS.red }
  if (status === 'cancelled') return { bg: 'rgba(143,176,156,0.16)', color: COLORS.textMuted }
  return { bg: 'rgba(96,165,250,0.16)', color: COLORS.blue } // pending / processing
}

function IconBubble({ icon, bg, color }: { icon: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'flex', width: '30px', height: '30px', borderRadius: '50%', background: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={14} color={color} />
    </span>
  )
}

function TxRow({ tx, first, hidden, money, onClick }: { tx: WalletTx; first: boolean; hidden: boolean; money: ReturnType<typeof useMoney>; onClick?: () => void }) {
  // Net effect on the person's total money: available + held. Escrow hold only moves money between the two, so show the held amount.
  const isHold = tx.type === 'escrow_hold'
  const value = isHold ? -tx.held_delta : tx.available_delta + tx.held_delta
  const positive = value > 0
  const label = TX_LABELS[tx.type] || tx.type
  const tone = isHold ? chipTone('processing') : chipTone('completed')
  const bubble = isHold
    ? { icon: 'building', bg: 'rgba(96,165,250,0.18)', color: COLORS.blue }
    : positive
      ? { icon: 'arrowDown', bg: 'rgba(34,197,94,0.18)', color: COLORS.greenLight }
      : { icon: 'arrowUp', bg: 'rgba(248,113,113,0.16)', color: COLORS.red }

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px', borderTop: first ? 'none' : `1px solid ${COLORS.border}`,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <IconBubble icon={bubble.icon} bg={bubble.bg} color={bubble.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        <p style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '1px' }}>
          {new Date(tx.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: 800, color: isHold ? COLORS.text : positive ? COLORS.greenLight : COLORS.text }}>
          {hidden ? '••••' : `${isHold ? '- ' : positive ? '+ ' : '- '}${money.format(Math.abs(value))}`}
        </p>
        <span style={{ display: 'inline-block', marginTop: '3px', fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px', background: tone.bg, color: tone.color }}>
          {isHold ? 'In escrow' : 'Completed'}
        </span>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', minWidth: 0 }}>
      <span style={{ display: 'flex', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(34,197,94,0.22)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={13} color={COLORS.greenLight} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '9.5px', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>{label}</p>
        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, marginTop: '1px' }}>{value}</p>
      </div>
    </div>
  )
}

function Action({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '9px 2px 8px', borderRadius: '14px', cursor: 'pointer',
      background: COLORS.card, border: `1px solid ${COLORS.border}`,
    }}>
      <span style={{ display: 'flex', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={14} color={COLORS.greenLight} />
      </span>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, lineHeight: 1.1 }}>{label}</p>
      <p style={{ fontSize: '9.5px', color: COLORS.textMuted, lineHeight: 1 }}>{sub}</p>
    </div>
  )
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 2px 7px' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{title}</p>
      {action && (
        <span onClick={onAction} style={{ fontSize: '11.5px', fontWeight: 600, color: COLORS.textMuted, cursor: 'pointer' }}>{action} ›</span>
      )}
    </div>
  )
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      textAlign: 'center', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #22C55E, #15803D)', color: 'white',
      fontSize: '13px', fontWeight: 800, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
      boxShadow: '0 8px 18px rgba(34,197,94,0.22)',
    }}>
      {label}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#0B2116', border: `1px solid ${COLORS.border}`, borderBottom: 'none', width: '100%', maxWidth: '480px',
        borderRadius: '20px 20px 0 0', padding: '14px 14px 20px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{title}</p>
          <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={16} color={COLORS.textMuted} />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <div style={{
        position: 'relative', minHeight: '100vh', maxWidth: '480px', margin: '0 auto', paddingBottom: '24px', overflow: 'hidden',
        background: 'radial-gradient(120% 50% at 85% 0%, rgba(34,197,94,0.16) 0%, rgba(4,19,12,0) 60%), #04130C',
      }}>
        <div style={{ position: 'absolute', top: '56px', right: '-18px', opacity: 0.10, transform: 'rotate(18deg)', pointerEvents: 'none' }}>
          <Icon name="leaf" size={110} color="#4ADE80" strokeWidth={1.2} />
        </div>
        <div style={{ position: 'relative' }}>{children}</div>
      </div>
    </div>
  )
}

function Header({ onBack, onBell, onAvatar }: { onBack: () => void; onBell: () => void; onAvatar: () => void }) {
  const circle: CSSProperties = {
    cursor: 'pointer', display: 'flex', width: '32px', height: '32px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.07)', border: `1px solid ${COLORS.border}`, flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 14px 10px' }}>
      <div onClick={onBack} style={{ ...circle, width: '28px', height: '28px' }}><Icon name="arrowLeft" size={15} color={COLORS.text} /></div>
      <FarmLiteLogo size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>Farmxie</p>
        <p style={{ fontSize: '9.5px', color: COLORS.textMuted, marginTop: '1px' }}>Connect &nbsp;•&nbsp; Grow &nbsp;•&nbsp; Prosper</p>
      </div>
      <div onClick={onBell} style={circle}><Icon name="bell" size={15} color={COLORS.text} /></div>
      <div onClick={onAvatar} style={{ ...circle, background: COLORS.green, border: 'none' }}><Icon name="user" size={15} color="#FFFFFF" /></div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: '12px', border: `1px solid ${COLORS.border}`,
  marginBottom: '9px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg, color: COLORS.text, outline: 'none', colorScheme: 'dark',
}
