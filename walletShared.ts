import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useLocale } from './LocaleContext'

// ---------- Types ----------
export type Wallet = { user_id: string; available: number; held: number; currency: string }

export type OrderStatus = 'escrow_held' | 'completed' | 'disputed' | 'refunded' | 'cancelled'

export type Order = {
  id: string
  code: string
  listing_id: string | null
  listing_title: string | null
  buyer_id: string
  seller_id: string
  quantity: number
  unit_price: number
  amount: number
  currency: string
  status: OrderStatus
  dispute_reason: string | null
  resolution_note: string | null
  created_at: string
  completed_at: string | null
}

export type WalletTx = {
  id: string
  type: string
  available_delta: number
  held_delta: number
  order_id: string | null
  reference: string | null
  note: string | null
  created_at: string
}

export const ORDER_COLUMNS =
  'id, code, listing_id, listing_title, buyer_id, seller_id, quantity, unit_price, amount, currency, status, dispute_reason, resolution_note, created_at, completed_at'

export const STATUS_INFO: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  escrow_held: { label: 'In escrow', color: '#B45309', bg: '#FEF3C7' },
  completed: { label: 'Completed', color: '#166534', bg: '#DCFCE7' },
  disputed: { label: 'Dispute', color: '#B91C1C', bg: '#FEE2E2' },
  refunded: { label: 'Refunded', color: '#1D4ED8', bg: '#DBEAFE' },
  cancelled: { label: 'Cancelled', color: '#5B6B5B', bg: '#E5EFE5' },
}

export const TX_LABELS: Record<string, string> = {
  topup: 'Wallet top-up',
  escrow_hold: 'Payment held in escrow',
  escrow_release: 'Escrow released to seller',
  escrow_received: 'Payment received',
  escrow_refund: 'Escrow refunded',
  adjustment: 'Adjustment',
}

// ---------- Display currency conversion ----------
// Money is always stored and paid in NGN. Other currencies are for display only.
// Rates come from a free public API and are cached for 6 hours; the fallback is approximate.
const FALLBACK_RATES: Record<string, number> = { NGN: 1, USD: 0.00067, GHS: 0.0072, KES: 0.086 }
const RATES_KEY = 'fl_fx_rates_v1'
const RATES_TTL = 6 * 60 * 60 * 1000

function readCachedRates(): { rates: Record<string, number>; at: number } | null {
  try {
    const raw = localStorage.getItem(RATES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.rates && typeof parsed.at === 'number') return parsed
  } catch { /* storage unavailable */ }
  return null
}

export function useMoney() {
  const { currency } = useLocale()
  const [rates, setRates] = useState<Record<string, number>>(() => readCachedRates()?.rates || FALLBACK_RATES)
  const [live, setLive] = useState<boolean>(() => !!readCachedRates())

  useEffect(() => {
    const cached = readCachedRates()
    if (cached && Date.now() - cached.at < RATES_TTL) return
    let cancelled = false
    fetch('https://open.er-api.com/v6/latest/NGN')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d || d.result !== 'success' || !d.rates) return
        const next: Record<string, number> = { NGN: 1 }
        for (const code of Object.keys(FALLBACK_RATES)) if (typeof d.rates[code] === 'number') next[code] = d.rates[code]
        setRates(next)
        setLive(true)
        try { localStorage.setItem(RATES_KEY, JSON.stringify({ rates: next, at: Date.now() })) } catch { /* ignore */ }
      })
      .catch(() => { /* keep cached or fallback rates */ })
    return () => { cancelled = true }
  }, [])

  const code = String(currency || 'NGN')
  const rate = rates[code] ?? 1

  const fmtIn = (value: number, cur: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(value)
    } catch {
      return `${cur} ${value.toLocaleString()}`
    }
  }

  return {
    currency: code,
    live,
    // NGN amount shown in the person's chosen currency
    format: (ngn: number) => fmtIn(Number(ngn || 0) * rate, code),
    // NGN amount shown as NGN (the real payment amount)
    formatNgn: (ngn: number) => fmtIn(Number(ngn || 0), 'NGN'),
    isForeign: code !== 'NGN',
  }
}

// ---------- API calls ----------
export async function getMyWallet(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('my_wallet')
  if (error) throw new Error(error.message)
  const w = data as any
  return { user_id: w.user_id, available: Number(w.available), held: Number(w.held), currency: w.currency }
}

export async function placeOrder(listingId: string, quantity: number): Promise<{ order_id: string; code: string; amount: number }> {
  const { data, error } = await supabase.rpc('place_order', { p_listing_id: listingId, p_quantity: quantity })
  if (error) throw new Error(error.message)
  return data as any
}

export async function verifyOrderCode(rawCode: string): Promise<{ ok: boolean; error?: string; amount?: number; order_id?: string }> {
  const { data, error } = await supabase.rpc('verify_order_code', { p_code: normalizeCode(rawCode) })
  if (error) throw new Error(error.message)
  return data as any
}

export async function openOrderDispute(orderId: string, reason: string) {
  const { error } = await supabase.rpc('open_order_dispute', { p_order_id: orderId, p_reason: reason })
  if (error) throw new Error(error.message)
}

export async function startTopup(amount: number): Promise<{ authorization_url: string; reference: string }> {
  const { data, error } = await supabase.functions.invoke('paystack-init', { body: { amount } })
  if (error) throw new Error(error.message)
  if (!data || data.error) throw new Error(data?.error || 'Could not start payment')
  return data
}

export async function verifyTopup(reference: string): Promise<{ credited: boolean; already_credited?: boolean; amount?: number; status?: string }> {
  const { data, error } = await supabase.functions.invoke('paystack-verify', { body: { reference } })
  if (error) throw new Error(error.message)
  if (!data || data.error) throw new Error(data?.error || 'Could not verify payment')
  return data
}

// Accepts "QR-36282527", "qr 36282527" or just "36282527"
export function normalizeCode(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits ? `QR-${digits}` : raw.trim().toUpperCase()
}

export function verifyErrorMessage(code?: string): string {
  if (code === 'too_many_attempts') return 'Too many wrong attempts. Please try again in 15 minutes.'
  return 'This code was not found for your orders, or it was already used.'
}
