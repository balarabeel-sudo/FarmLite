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
  disputed_by: string | null
  resolution_note: string | null
  created_at: string
  completed_at: string | null
  expected_delivery_at: string | null
  cancelled_at: string | null
  // Set only when the listing was priced in another currency: the original price and the rate locked at purchase.
  orig_currency?: string | null
  orig_unit_price?: number | null
  orig_amount?: number | null
  fx_rate?: number | null
}

export type DisputeEvidence = {
  id: string
  user_id: string
  note: string | null
  images: string[]
  created_at: string
}

export const EVIDENCE_COLUMNS = 'id, user_id, note, images, created_at'
export const MAX_EVIDENCE_PHOTOS = 4

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

export type WithdrawalStatus = 'pending' | 'processing' | 'paid' | 'rejected' | 'failed' | 'cancelled'

export type Withdrawal = {
  id: string
  user_id: string
  amount: number
  bank_name: string
  account_number: string
  account_name: string
  status: WithdrawalStatus
  admin_note: string | null
  created_at: string
  processed_at: string | null
}

export const WITHDRAWAL_COLUMNS =
  'id, user_id, amount, bank_name, account_number, account_name, status, admin_note, created_at, processed_at'

export const WITHDRAWAL_STATUS: Record<WithdrawalStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Awaiting approval', color: '#B45309', bg: '#FEF3C7' },
  processing: { label: 'Sending', color: '#1D4ED8', bg: '#DBEAFE' },
  paid: { label: 'Sent', color: '#166534', bg: '#DCFCE7' },
  rejected: { label: 'Rejected', color: '#B91C1C', bg: '#FEE2E2' },
  failed: { label: 'Failed', color: '#B91C1C', bg: '#FEE2E2' },
  cancelled: { label: 'Cancelled', color: '#5B6B5B', bg: '#E5EFE5' },
}

export const ORDER_COLUMNS =
  'id, code, listing_id, listing_title, buyer_id, seller_id, quantity, unit_price, amount, currency, status, dispute_reason, disputed_by, resolution_note, created_at, completed_at, expected_delivery_at, cancelled_at, orig_currency, orig_unit_price, orig_amount, fx_rate'

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
  farm_desk_payment: 'Farm Desk payment',
  farm_desk_refund: 'Farm Desk refund',
  withdrawal: 'Withdrawal',
  withdrawal_refund: 'Withdrawal returned',
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

// Price of an order in NGN. For a listing priced in another currency the NGN amount uses the current Farmxie rate.
export type FxQuote = { currency: string; orig_unit_price: number; orig_amount: number; rate: number; amount_ngn: number }

export async function getFxQuote(listingId: string, quantity: number): Promise<FxQuote> {
  const { data, error } = await supabase.rpc('fx_quote', { p_listing: listingId, p_quantity: quantity })
  if (error) throw new Error(error.message)
  const d = data as any
  if (d?.error === 'rate_unavailable') throw new Error(`Escrow is not available for ${d.currency} prices right now. Please contact the seller directly or try again later.`)
  if (d?.error) throw new Error('This listing is not available.')
  return { currency: d.currency, orig_unit_price: Number(d.orig_unit_price), orig_amount: Number(d.orig_amount), rate: Number(d.rate), amount_ngn: Number(d.amount_ngn) }
}

// expectedNgn is the total the buyer saw; if the rate changed in the meantime the order is refused so nobody pays a different price.
export async function placeOrder(listingId: string, quantity: number, expectedDeliveryAt: Date, expectedNgn?: number): Promise<{ order_id: string; code: string; amount: number }> {
  const { data, error } = await supabase.rpc('place_order_v2', {
    p_listing_id: listingId,
    p_quantity: quantity,
    p_expected_delivery_at: expectedDeliveryAt.toISOString(),
    p_expected_ngn: expectedNgn ?? null,
  })
  if (error) {
    if (error.message.includes('rate_changed')) throw new Error('The exchange rate changed. Please check the new total and try again.')
    if (error.message.includes('rate_unavailable')) throw new Error('Escrow is not available for this currency right now. Please contact the seller directly or try again later.')
    throw new Error(error.message)
  }
  return data as any
}

// The buyer can cancel only after the expected delivery time has passed. The money returns to their wallet.
export async function cancelOrder(orderId: string): Promise<{ ok: boolean; amount?: number }> {
  const { data, error } = await supabase.rpc('buyer_cancel_order', { p_order_id: orderId })
  if (error) {
    if (error.message.includes('too_early')) throw new Error('You can cancel only after the expected delivery time has passed.')
    if (error.message.includes('order_not_cancellable')) throw new Error('This order can no longer be cancelled.')
    throw new Error(error.message)
  }
  return data as any
}

// ---------- Expected delivery ----------
export type DeliveryUnit = 'hours' | 'days' | 'weeks' | 'months'
export const DELIVERY_UNITS: { value: DeliveryUnit; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
]
export const MIN_DELIVERY_MS = 60 * 60 * 1000
export const MAX_DELIVERY_MS = 90 * 24 * 60 * 60 * 1000

export function addDuration(from: Date, amount: number, unit: DeliveryUnit): Date {
  const d = new Date(from.getTime())
  if (unit === 'hours') d.setTime(d.getTime() + amount * 3600_000)
  else if (unit === 'days') d.setTime(d.getTime() + amount * 86_400_000)
  else if (unit === 'weeks') d.setTime(d.getTime() + amount * 7 * 86_400_000)
  else d.setMonth(d.getMonth() + Math.round(amount))
  return d
}

export function deliveryProblem(at: Date | null, now: number = Date.now()): string {
  if (!at || Number.isNaN(at.getTime())) return 'Choose when you expect the goods to arrive.'
  if (at.getTime() - now < MIN_DELIVERY_MS) return 'Expected delivery must be at least 1 hour from now.'
  if (at.getTime() - now > MAX_DELIVERY_MS) return 'Expected delivery cannot be more than 3 months away.'
  return ''
}

export function formatDeliveryDate(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeLeftLabel(target: Date, now: number = Date.now()): string {
  const ms = target.getTime() - now
  if (ms <= 0) return 'now'
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} h ${mins % 60} min`
  return `${Math.floor(hours / 24)} days ${hours % 24} h`
}

export async function verifyOrderCode(rawCode: string): Promise<{ ok: boolean; error?: string; amount?: number; order_id?: string }> {
  const { data, error } = await supabase.rpc('verify_order_code', { p_code: normalizeCode(rawCode) })
  if (error) throw new Error(error.message)
  return data as any
}

export async function openOrderDispute(orderId: string, reason: string, images: string[] = []) {
  const { error } = await supabase.rpc('open_order_dispute', { p_order_id: orderId, p_reason: reason, p_images: images })
  if (error) throw new Error(error.message)
}

export async function addDisputeEvidence(orderId: string, note: string, images: string[] = []) {
  const { error } = await supabase.rpc('add_dispute_evidence', { p_order_id: orderId, p_note: note, p_images: images })
  if (error) throw new Error(error.message)
}

export async function payFarmDeskFromWallet(paymentId: string): Promise<{ ok: boolean; amount: number; request_id: string }> {
  const { data, error } = await supabase.rpc('farm_desk_pay_from_wallet', { p_payment_id: paymentId })
  if (error) throw new Error(error.message)
  return data as any
}

export type Bank = { name: string; code: string }

export async function fetchBanks(): Promise<Bank[]> {
  const { data, error } = await supabase.functions.invoke('paystack-bank', { body: { action: 'banks' } })
  if (error) throw new Error(error.message)
  if (!data || data.error) throw new Error(data?.error || 'Could not load banks')
  return data.banks as Bank[]
}

// Returns the verified account name, or { testMode: true } when Paystack test mode cannot verify the account
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<{ name?: string; testMode?: boolean }> {
  const { data, error } = await supabase.functions.invoke('paystack-bank', { body: { action: 'resolve', account_number: accountNumber, bank_code: bankCode } })
  if (data?.account_name) return { name: data.account_name }
  if (data?.test_mode) return { testMode: true }
  throw new Error(data?.error || error?.message || 'Could not verify this account')
}

export async function requestWithdrawal(amount: number, bank: Bank, accountNumber: string, accountName: string) {
  const { error } = await supabase.rpc('request_withdrawal', {
    p_amount: amount, p_bank_code: bank.code, p_bank_name: bank.name, p_account_number: accountNumber, p_account_name: accountName,
  })
  if (error) throw new Error(error.message)
}

export async function cancelWithdrawal(id: string) {
  const { error } = await supabase.rpc('cancel_withdrawal', { p_id: id })
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
