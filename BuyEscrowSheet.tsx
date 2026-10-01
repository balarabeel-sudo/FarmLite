import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'
import { COLORS } from './shared'
import { getMyWallet, placeOrder, useMoney } from './walletShared'
import type { Wallet } from './walletShared'

export type BuyListing = {
  id: string
  title: string
  price: number
  currency: string
  unit: string | null
  quantity: number | null
}

export default function BuyEscrowSheet({ listing, onClose }: { listing: BuyListing; onClose: () => void }) {
  const navigate = useNavigate()
  const money = useMoney()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyWallet().then(setWallet).catch(() => setError('Could not load your wallet. Check your connection.'))
  }, [])

  const isNgn = (listing.currency || 'NGN') === 'NGN'
  const q = Number(qty)
  const qtyValid = Number.isFinite(q) && q > 0 && (listing.quantity == null || q <= Number(listing.quantity))
  const total = qtyValid ? Math.round(Number(listing.price) * q * 100) / 100 : 0
  const enough = !!wallet && wallet.available >= total
  const shortfall = wallet ? Math.max(0, total - wallet.available) : 0

  const pay = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await placeOrder(listing.id, q)
      navigate(`/orders/${res.order_id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '18px 16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Buy with Escrow</p>
          <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="close" size={20} color={COLORS.textMuted} /></div>
        </div>

        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{listing.title}</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>
          {money.formatNgn(Number(listing.price))}{listing.unit ? ` / ${listing.unit}` : ''}
        </p>

        {!isNgn ? (
          <p style={{ fontSize: '12.5px', color: '#B91C1C', marginTop: '14px', lineHeight: 1.5 }}>
            Escrow is available for listings priced in NGN only. Please contact the seller directly for this item.
          </p>
        ) : (
          <>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: '14px 0 6px' }}>
              Quantity{listing.unit ? ` (${listing.unit})` : ''}
            </p>
            <input
              type="number" inputMode="decimal" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '14px', boxSizing: 'border-box', background: COLORS.bg }}
            />
            {listing.quantity != null && (
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>{Number(listing.quantity).toLocaleString()} available</p>
            )}

            <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '12px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <Row label="Total to pay" value={qtyValid ? money.formatNgn(total) : '-'} bold />
              {money.isForeign && qtyValid && <Row label={`In ${money.currency}`} value={`≈ ${money.format(total)}`} />}
              <Row label="Your wallet" value={wallet ? money.formatNgn(wallet.available) : '...'} />
            </div>

            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '12px', lineHeight: 1.5 }}>
              Your money is held in escrow. You get a code. Give it to the seller only after you receive your goods, then the payment is released.
            </p>

            {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '10px' }}>{error}</p>}

            {wallet && qtyValid && !enough ? (
              <>
                <p style={{ fontSize: '12px', color: '#B45309', marginTop: '10px', fontWeight: 600 }}>
                  You need {money.formatNgn(shortfall)} more in your wallet.
                </p>
                <div onClick={() => navigate('/wallet')} style={{ marginTop: '10px', textAlign: 'center', padding: '13px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  Top up wallet
                </div>
              </>
            ) : (
              <div
                onClick={busy || !qtyValid || !wallet ? undefined : pay}
                style={{ marginTop: '14px', textAlign: 'center', padding: '13px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 800, cursor: busy || !qtyValid || !wallet ? 'default' : 'pointer', opacity: busy || !qtyValid || !wallet ? 0.6 : 1 }}>
                {busy ? 'Placing order...' : 'Pay with Escrow'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: bold ? '14px' : '12px', fontWeight: bold ? 800 : 700, color: COLORS.text }}>{value}</p>
    </div>
  )
}
