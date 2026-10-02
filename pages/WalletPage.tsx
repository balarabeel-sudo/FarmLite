import { useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useLocale } from '../LocaleContext'
import type { Currency } from '../LocaleContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import { COLORS } from '../shared'
import {
  getMyWallet, startTopup, verifyTopup, verifyOrderCode, verifyErrorMessage, useMoney, payFarmDeskFromWallet,
  fetchBanks, resolveAccount, requestWithdrawal, cancelWithdrawal, WITHDRAWAL_STATUS, WITHDRAWAL_COLUMNS,
  TX_LABELS,
} from '../walletShared'
import type { Wallet, WalletTx, Withdrawal, Bank } from '../walletShared'

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
      <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto' }}>
        <Header onBack={() => navigate(-1)} />
        <NetworkError onRetry={load} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '30px' }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px' }}>
        {banner && (
          <div onClick={() => setBanner(null)} style={{
            padding: '11px 13px', borderRadius: '10px', marginBottom: '12px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            background: banner.type === 'ok' ? '#DCFCE7' : '#FEE2E2', color: banner.type === 'ok' ? '#166534' : '#B91C1C',
          }}>
            {banner.text}
          </div>
        )}

        {/* Balance card */}
        <div style={{ background: COLORS.green, borderRadius: '18px', padding: '18px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.9 }}>Available balance</p>
            <div onClick={toggleHidden} style={{ cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <Icon name={hidden ? 'eyeOff' : 'eye'} size={19} color="white" />
            </div>
          </div>

          <p style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px', letterSpacing: hidden ? '2px' : 0 }}>
            {loading || !wallet ? '...' : show(wallet.available)}
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <MiniStat label="Pending (in escrow)" value={loading || !wallet ? '...' : show(wallet.held)} />
            <MiniStat label="Incoming sales" value={loading ? '...' : show(incoming)} />
          </div>

          {/* Currency switch (display only) */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '14px', flexWrap: 'wrap' }}>
            {currencies.map((c: { code: string; flag?: string }) => {
              const active = c.code === currency
              return (
                <div key={c.code} onClick={() => setCurrency(c.code as Currency)} style={{
                  padding: '5px 11px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer',
                  background: active ? 'white' : 'rgba(255,255,255,0.18)', color: active ? COLORS.green : 'white',
                }}>
                  {c.flag ? `${c.flag} ` : ''}{c.code}
                </div>
              )
            })}
          </div>
          {money.isForeign && (
            <p style={{ fontSize: '10.5px', opacity: 0.85, marginTop: '8px' }}>
              Shown in {currency} for reference{money.live ? '' : ' (approximate rate)'}. Your money is held and paid in NGN.
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <ActionButton icon="plus" label="Top up" onClick={() => setSheet('topup')} primary />
          <ActionButton icon="qr" label="Verify QR" onClick={() => setSheet('verify')} />
          <ActionButton icon="arrowUp" label="Withdraw" onClick={() => setSheet('withdraw')} />
        </div>
        <div onClick={() => navigate('/orders')} style={{
          marginTop: '10px', background: COLORS.card, borderRadius: '12px', padding: '13px 14px',
          display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
        }}>
          <Icon name="fileText" size={17} color={COLORS.textMuted} />
          <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: COLORS.text }}>My Orders</p>
          <Icon name="chevronRight" size={15} color={COLORS.textMuted} />
        </div>

        {/* Withdrawals */}
        {withdrawals.length > 0 && (
          <>
            <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '20px 0 8px' }}>
              Withdrawals
            </p>
            <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden' }}>
              {withdrawals.map((w) => {
                const st = WITHDRAWAL_STATUS[w.status]
                return (
                  <div key={w.id} style={{ padding: '12px 14px', borderBottom: `1px solid ${COLORS.bg}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text }}>{hidden ? '••••' : money.formatNgn(w.amount)}</p>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '3px' }}>
                      {w.bank_name} ••••{w.account_number.slice(-4)} · {new Date(w.created_at).toLocaleDateString()}
                    </p>
                    {w.status === 'rejected' && w.admin_note && (
                      <p style={{ fontSize: '11px', color: '#B91C1C', marginTop: '4px' }}>Reason: {w.admin_note}</p>
                    )}
                    {w.status === 'pending' && (
                      <p
                        onClick={async () => {
                          try { await cancelWithdrawal(w.id); setBanner({ type: 'ok', text: 'Withdrawal cancelled. The money is back in your wallet.' }); load() }
                          catch (e) { setBanner({ type: 'error', text: (e as Error).message }) }
                        }}
                        style={{ fontSize: '11.5px', fontWeight: 700, color: '#B91C1C', marginTop: '6px', cursor: 'pointer' }}>
                        Cancel withdrawal
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Activity */}
        <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '20px 0 8px' }}>
          Recent activity
        </p>
        <div style={{ background: COLORS.card, borderRadius: '14px', overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: '16px', fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
          ) : txs.length === 0 ? (
            <p style={{ padding: '16px', fontSize: '12.5px', color: COLORS.textMuted }}>No activity yet. Top up your wallet to start buying with escrow.</p>
          ) : (
            txs.map((t) => <TxRow key={t.id} tx={t} hidden={hidden} money={money} onClick={t.order_id ? () => navigate(`/orders/${t.order_id}`) : undefined} />)
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
            setBanner({ type: 'ok', text: 'Withdrawal requested. FarmLite will review and send it to your bank.' })
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
    </div>
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
        <p style={{ fontSize: '12.5px', color: '#B91C1C' }}>{loadError}</p>
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
          {error && <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{error}</p>}
          {available != null && !enough ? (
            <>
              <p style={{ fontSize: '12px', color: '#B45309', fontWeight: 600, marginBottom: '10px' }}>
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
        Available: {money.formatNgn(available)}. The amount leaves your wallet now and is sent to your bank after FarmLite approves it.
      </p>
      <input type="number" inputMode="numeric" placeholder="Amount (NGN, minimum 1,000)" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />

      {banksError ? (
        <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{banksError}</p>
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
        <p style={{ fontSize: '12.5px', fontWeight: 800, color: '#166534', marginBottom: '10px' }}>{accountName}</p>
      )}
      {manualName && (
        <>
          <p style={{ fontSize: '11px', color: '#B45309', marginBottom: '6px' }}>Test mode cannot verify accounts. Type the account name.</p>
          <input placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} style={inputStyle} />
        </>
      )}

      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{error}</p>}
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
            color: COLORS.text, cursor: 'pointer', background: Number(amount) === a ? '#DCFCE7' : COLORS.card,
          }}>
            {a.toLocaleString()}
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{error}</p>}
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
      {error && <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{error}</p>}
      <PrimaryButton label={busy ? 'Verifying...' : 'Verify and receive payment'} onClick={submit} disabled={busy} />
    </Sheet>
  )
}

function TxRow({ tx, hidden, money, onClick }: { tx: WalletTx; hidden: boolean; money: ReturnType<typeof useMoney>; onClick?: () => void }) {
  // Net effect on the person's total money: available + held. Escrow hold only moves money between the two, so show the held amount.
  const isHold = tx.type === 'escrow_hold'
  const value = isHold ? -tx.held_delta : tx.available_delta + tx.held_delta
  const positive = value > 0
  const color = isHold ? COLORS.textMuted : positive ? '#166534' : '#B91C1C'
  const label = TX_LABELS[tx.type] || tx.type

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderBottom: `1px solid ${COLORS.bg}`,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F1F8F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={isHold ? 'clock' : positive ? 'arrowDown' : 'arrowUp'} size={15} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.text }}>{label}</p>
        <p style={{ fontSize: '10.5px', color: COLORS.textMuted, marginTop: '2px' }}>
          {new Date(tx.created_at).toLocaleString()}{tx.type !== 'topup' && tx.reference ? ` · ${tx.reference}` : ''}
        </p>
      </div>
      <p style={{ fontSize: '12.5px', fontWeight: 800, color }}>
        {hidden ? '••••' : `${isHold ? '' : positive ? '+' : '-'}${money.format(Math.abs(value))}`}
      </p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.16)', borderRadius: '12px', padding: '10px' }}>
      <p style={{ fontSize: '10.5px', opacity: 0.9 }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 800, marginTop: '3px' }}>{value}</p>
    </div>
  )
}

function ActionButton({ icon, label, onClick, primary }: { icon: string; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '12px', cursor: 'pointer',
      background: primary ? COLORS.card : COLORS.card, border: `1px solid ${primary ? COLORS.green : COLORS.border}`,
      fontSize: '13px', fontWeight: 800, color: primary ? COLORS.green : COLORS.text,
    }}>
      <Icon name={icon} size={17} color={primary ? COLORS.green : COLORS.text} /> {label}
    </div>
  )
}

function PrimaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      textAlign: 'center', padding: '13px', borderRadius: '10px', background: COLORS.green, color: 'white',
      fontSize: '13px', fontWeight: 800, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
    }}>
      {label}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '18px 16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{title}</p>
          <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="close" size={20} color={COLORS.textMuted} /></div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex' }}>
        <Icon name="arrowLeft" size={22} color={COLORS.text} />
      </div>
      <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Wallet</p>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box', background: COLORS.bg,
}
