import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#DC2626' }

type Overview = { wallets: number; available: number; held: number; pending_withdrawals: number; pending_withdrawals_count: number; total_owed: number }
type Balance = { currency: string; balance: number }

const ngn = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n)

// Route: /admin/finance-check  (needs wallet.view)
// Compares the money Farmxie holds at Paystack with what it owes to users (wallets, escrow and withdrawals in progress).
export default function FinanceCheckPage() {
  const staff = useStaff()
  const allowed = staff.permissions.has('wallet.view')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [balances, setBalances] = useState<Balance[] | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [overviewError, setOverviewError] = useState(false)
  const [balanceError, setBalanceError] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const load = async () => {
    setLoading(true)
    setOverviewError(false)
    setBalanceError('')
    const [ov, bal] = await Promise.all([
      supabase.rpc('wallet_overview'),
      supabase.functions.invoke('paystack-balance', { body: {} }),
    ])
    if (ov.error || !ov.data) setOverviewError(true)
    else {
      const d = ov.data as any
      setOverview({
        wallets: Number(d.wallets), available: Number(d.available), held: Number(d.held),
        pending_withdrawals: Number(d.pending_withdrawals), pending_withdrawals_count: Number(d.pending_withdrawals_count), total_owed: Number(d.total_owed),
      })
    }
    const b = bal.data as any
    if (bal.error || !b || b.error) {
      setBalances(null)
      setBalanceError(b?.error || 'Could not read the Paystack balance.')
    } else {
      setBalances((b.balances || []) as Balance[])
      setTestMode(!!b.test_mode)
    }
    setCheckedAt(new Date())
    setLoading(false)
  }

  useEffect(() => { if (allowed) load() }, [allowed])

  const paystackNgn = balances ? (balances.find((b) => b.currency === 'NGN')?.balance ?? 0) : null
  const gap = paystackNgn != null && overview ? paystackNgn - overview.total_owed : null

  return (
    <AdminLayout title="Finance Check">
      {!allowed && <p style={{ fontSize: '13px', color: A.textMuted }}>You do not have permission to view this page.</p>}

      {allowed && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <span role="button" onClick={loading ? undefined : load} style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, fontSize: '12.5px', fontWeight: 700, background: loading ? '#C9E9D2' : A.green, color: 'white', cursor: loading ? 'default' : 'pointer' }}>{loading ? 'Checking...' : 'Refresh'}</span>
            {checkedAt && <span style={{ fontSize: '12px', color: A.textMuted }}>Checked at {checkedAt.toLocaleTimeString()}</span>}
            {testMode && <span style={{ fontSize: '11px', fontWeight: 800, background: '#FEF3C7', color: '#92400E', padding: '3px 9px', borderRadius: 999 }}>Paystack TEST mode</span>}
          </div>

          {gap != null && (
            <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: gap >= 0 ? '#DCFCE7' : '#FEE2E2', color: gap >= 0 ? '#166534' : '#991B1B' }}>
              <p style={{ fontSize: '14px', fontWeight: 800 }}>{gap >= 0 ? `Covered: ${ngn(gap)} more than you owe` : `Shortfall: ${ngn(Math.abs(gap))} less than you owe`}</p>
              <p style={{ fontSize: '12px', marginTop: 4, lineHeight: 1.5 }}>
                {gap >= 0
                  ? 'The money at Paystack covers every wallet, escrow and withdrawal in progress. The extra is yours (fees and margin).'
                  : 'Paystack holds less than users are owed. Top up your Paystack balance before approving more withdrawals, and check whether settlement moved money to your bank.'}
              </p>
            </div>
          )}

          <Card title="Money at Paystack">
            {loading && !balances ? <p style={{ fontSize: '13px', color: A.textMuted }}>Loading...</p>
              : balanceError ? <p style={{ fontSize: '13px', color: A.red }}>{balanceError}</p>
              : balances && balances.length === 0 ? <p style={{ fontSize: '13px', color: A.textMuted }}>No balance reported.</p>
              : balances && balances.map((b) => <Line key={b.currency} label={b.currency} value={new Intl.NumberFormat(undefined, { style: 'currency', currency: b.currency }).format(b.balance)} strong={b.currency === 'NGN'} />)}
            <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: 10, lineHeight: 1.5 }}>Only NGN is compared, because wallets are held in NGN. Money that Paystack already sent to your bank is not in this balance.</p>
          </Card>

          <Card title="Owed to users (NGN)">
            {overviewError ? <p style={{ fontSize: '13px', color: A.red }}>Could not load wallet totals.</p> : !overview ? <p style={{ fontSize: '13px', color: A.textMuted }}>Loading...</p> : (
              <>
                <Line label={`Available in ${overview.wallets} wallet${overview.wallets === 1 ? '' : 's'}`} value={ngn(overview.available)} />
                <Line label="Held in escrow" value={ngn(overview.held)} />
                <Line label={`Withdrawals in progress (${overview.pending_withdrawals_count})`} value={ngn(overview.pending_withdrawals)} />
                <Line label="Total owed" value={ngn(overview.total_owed)} strong />
              </>
            )}
          </Card>
        </>
      )}
    </AdminLayout>
  )
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 16, maxWidth: 640 }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: A.text, marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderTop: '1px solid #F1F5EF', fontSize: strong ? '14px' : '13px' }}>
      <span style={{ color: A.textMuted }}>{label}</span>
      <span style={{ color: A.text, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
