import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

type Status = {
  maintenance?: boolean
  maintenance_message?: string
  platform_name?: string
  support_email?: string
  support_phone?: string
}

// Shows a maintenance screen when an admin turns on Maintenance Mode in Admin > Settings.
// Sign-in, staff invites and the whole admin area stay reachable so staff can switch it off.
// If the status cannot be loaded, the app is shown as normal.
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      supabase.rpc('get_platform_status').then(({ data, error }: { data: unknown; error: unknown }) => {
        if (alive && !error && data) setStatus(data as Status)
      })
    }
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const exempt = pathname === '/login' || pathname.startsWith('/staff-invite') || pathname.startsWith('/admin')
  if (!status?.maintenance || exempt) return <>{children}</>

  const name = status.platform_name || 'FarmLite'
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F7F8F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 9000 }}>
      <div style={{ background: 'white', border: '1px solid #E3E7E3', borderRadius: '16px', padding: '32px 24px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ECF7EF', color: '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z" />
          </svg>
        </div>
        <p style={{ fontSize: '18px', fontWeight: 800, color: '#0F1A0F', marginBottom: '8px' }}>{name} is under maintenance</p>
        <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
          {status.maintenance_message?.trim() || 'We are making improvements and will be back shortly. Thank you for your patience.'}
        </p>
        <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: '#16A34A', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
          Try again
        </button>
        {(status.support_email || status.support_phone) && (
          <p style={{ fontSize: '12.5px', color: '#6B7280', marginTop: '16px', lineHeight: 1.6 }}>
            Need help? {status.support_email && <a href={`mailto:${status.support_email}`} style={{ color: '#16A34A', fontWeight: 700 }}>{status.support_email}</a>}
            {status.support_email && status.support_phone ? ' · ' : ''}
            {status.support_phone}
          </p>
        )}
      </div>
    </div>
  )
}
