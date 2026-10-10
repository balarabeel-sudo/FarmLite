import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'

const A = {
  bg: '#F7F8F7', surface: '#FFFFFF', border: '#E3E7E3', borderSoft: '#EEF1EE',
  green: '#16A34A', greenDark: '#14532D', greenTint: '#ECF7EF',
  text: '#0F1A0F', textMuted: '#6B7280', textSoft: '#9AA39B',
  amber: '#92400E', amberBg: '#FFFBEB', amberChip: '#FEF3C7', amberLine: '#D9A441', red: '#B91C1C',
}

type Values = Record<string, string | boolean>
type Security = { tables_total: number; tables_rls: number; audit_24h: number; audit_30d: number; last_audit_at: string | null }
type SectionKey = 'general' | 'platform' | 'notifications' | 'security' | 'system'

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'general', label: 'General', hint: 'Platform information' },
  { key: 'platform', label: 'Platform', hint: 'Registration and modules' },
  { key: 'notifications', label: 'Notifications', hint: 'Staff alert preferences' },
  { key: 'security', label: 'Security', hint: 'Protection status' },
  { key: 'system', label: 'System Controls', hint: 'Maintenance mode' },
]

const MODULES: { key: string; label: string; desc: string }[] = [
  { key: 'platform.registration', label: 'User registration', desc: 'Lets new people create a Farmxie account. Invited staff can still finish joining.' },
  { key: 'platform.marketplace', label: 'Marketplace', desc: 'Allows new listings and new orders. Browsing and existing orders keep working.' },
  { key: 'platform.community', label: 'Community', desc: 'Allows new posts and comments. Existing posts stay visible.' },
  { key: 'platform.groups', label: 'Groups', desc: 'Allows creating and joining groups. Existing groups stay visible.' },
  { key: 'platform.farmbot', label: 'FarmBot', desc: 'Lets FarmBot answer questions. While off, it replies that it is paused.' },
]
const NOTIFS: { key: string; label: string; desc: string }[] = [
  { key: 'notifications.report_alerts', label: 'Report notifications', desc: 'Tell staff who manage reports when a user submits a new report.' },
  { key: 'notifications.marketplace_alerts', label: 'Marketplace and wallet alerts', desc: 'Tell wallet managers about marketplace and wallet events that need attention.' },
]

const fmtFull = (iso: string) => `${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
const labelOf = (k: string) => MODULES.find((m) => m.key === k)?.label || k

const ICONS: Record<string, string> = {
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  refresh: 'M20 12a8 8 0 11-2.3-5.7L20 8M20 3v5h-5',
  lock: 'M6 11V8a6 6 0 0112 0v3M5 11h14v10H5z',
  wrench: 'M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z',
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 42, height: 24, borderRadius: 999, border: 'none', background: on ? A.green : '#CBD2CC', position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, flexShrink: 0, transition: 'background .15s' }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function Row({ title, desc, right }: { title: string; desc: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: `1px solid ${A.borderSoft}` }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: A.text }}>{title}</p>
        <p style={{ fontSize: 12.5, color: A.textMuted, lineHeight: 1.5, marginTop: 2 }}>{desc}</p>
      </div>
      {right}
    </div>
  )
}

const CSS = `
.st-head { margin-bottom:18px; }
.st-sub { font-size:13px; color:${A.textMuted}; line-height:1.5; }
.st-layout { display:grid; grid-template-columns:220px minmax(0,1fr); gap:18px; align-items:start; }
.st-nav { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:6px; position:sticky; top:12px; }
.st-nav button { width:100%; text-align:left; font-family:inherit; border:none; background:transparent; padding:10px 12px; border-radius:8px; cursor:pointer; display:block; }
.st-nav button:hover { background:${A.bg}; }
.st-nav button.on { background:${A.greenTint}; }
.st-nav button.on .t { color:${A.greenDark}; }
.st-nav .t { font-size:13px; font-weight:700; color:${A.text}; display:block; }
.st-nav .h { font-size:11.5px; color:${A.textMuted}; display:block; margin-top:1px; }
.st-panel { background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:18px 20px; min-width:0; }
.st-title { font-size:15px; font-weight:800; color:${A.text}; }
.st-hint { font-size:12.5px; color:${A.textMuted}; margin-top:2px; line-height:1.5; }
.st-label { font-size:12px; font-weight:700; color:${A.textMuted}; margin-bottom:6px; display:block; }
.st-input { padding:9px 12px; border-radius:8px; border:1px solid ${A.border}; font-size:13px; background:${A.surface}; color:${A.text}; font-family:inherit; box-sizing:border-box; width:100%; }
.st-input:disabled { background:${A.bg}; color:${A.textMuted}; }
.st-btn { font-family:inherit; cursor:pointer; border-radius:8px; font-size:12.5px; font-weight:700; padding:9px 16px; border:1px solid ${A.border}; background:${A.surface}; color:${A.text}; display:inline-flex; align-items:center; gap:7px; }
.st-btn:hover:not(:disabled) { background:${A.bg}; }
.st-btn:disabled { opacity:.55; cursor:default; }
.st-btn.primary { background:${A.green}; border-color:${A.green}; color:#fff; }
.st-btn.primary:hover:not(:disabled) { background:#15803D; }
.st-btn.solid-danger { background:${A.red}; border-color:${A.red}; color:#fff; }
.st-btn.solid-danger:hover:not(:disabled) { background:#991B1B; }
.st-savebar { position:sticky; bottom:12px; margin-top:16px; background:${A.surface}; border:1px solid ${A.border}; border-radius:10px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; box-shadow:0 8px 24px rgba(15,26,18,0.12); z-index:5; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline:2px solid ${A.green}; outline-offset:1px; }
@media (max-width:860px) {
  .st-layout { grid-template-columns:minmax(0,1fr); }
  .st-nav { position:static; display:flex; overflow-x:auto; gap:4px; }
  .st-nav button { width:auto; white-space:nowrap; flex-shrink:0; }
  .st-nav .h { display:none; }
}
`

export default function SettingsPage() {
  const staff = useStaff()
  const canManage = staff.permissions.has('settings.manage')

  const [section, setSection] = useState<SectionKey>('general')
  const [saved, setSaved] = useState<Values | null>(null)
  const [draft, setDraft] = useState<Values>({})
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [security, setSecurity] = useState<Security | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.err ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [toast])

  const load = useCallback(async () => {
    setLoadError(false)
    const { data, error } = await supabase.rpc('admin_settings_get')
    if (error || !data) { setLoadError(true); return }
    const d = data as { values: Values; updated_at: string | null }
    setSaved(d.values)
    setDraft(d.values)
    setUpdatedAt(d.updated_at)
    const sec = await supabase.rpc('admin_security_overview')
    if (sec.data) setSecurity(sec.data as Security)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) setConfirmOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving])

  const set = (k: string, v: string | boolean) => { setDraft((d) => ({ ...d, [k]: v })); setFormError('') }
  const changedKeys = saved ? Object.keys(draft).filter((k) => draft[k] !== saved[k]) : []
  const dirty = changedKeys.length > 0

  // Changes that can disrupt users ask for confirmation first
  const risky = saved ? changedKeys.flatMap((k) => {
    if (k === 'system.maintenance' && draft[k] === true) return ['Turn on maintenance mode. Everyone except staff will see a maintenance screen.']
    if (k === 'platform.registration' && draft[k] === false) return ['Close registration. New people will not be able to sign up.']
    if (k.startsWith('platform.') && draft[k] === false) return [`Turn off ${labelOf(k)}.`]
    return []
  }) : []

  const validate = () => {
    const name = String(draft['general.platform_name'] || '').trim()
    const email = String(draft['general.support_email'] || '').trim()
    if (name.length < 2) return 'Platform name must be at least 2 characters.'
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid support email.'
    return ''
  }

  const onSave = () => {
    const err = validate()
    setFormError(err)
    if (err) { setSection('general'); return }
    if (risky.length > 0) setConfirmOpen(true)
    else void apply()
  }

  const apply = async () => {
    setSaving(true)
    const changes: Values = {}
    changedKeys.forEach((k) => { changes[k] = typeof draft[k] === 'string' ? String(draft[k]).trim() : draft[k] })
    const { error } = await supabase.rpc('admin_settings_update', { p_changes: changes })
    setSaving(false)
    setConfirmOpen(false)
    if (error) { setToast({ text: error.message || 'Could not save settings.', err: true }); return }
    setToast({ text: 'Settings saved', err: false })
    await load()
  }

  const text = (k: string) => String(draft[k] ?? '')
  const flag = (k: string) => draft[k] === true
  const maintenanceOn = saved?.['system.maintenance'] === true

  return (
    <AdminLayout title="Settings">
      <style>{CSS}</style>
      <div className="st-head">
        <p className="st-sub">Manage Farmxie platform configuration, preferences, security, and system controls.</p>
      </div>

      {loadError ? (
        <div className="st-panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Unable to load settings.</p>
          <button className="st-btn" onClick={load}><Icon name="refresh" size={14} /> Try again</button>
        </div>
      ) : !saved ? (
        <div className="st-panel" style={{ textAlign: 'center', padding: '48px 20px', fontSize: 13, color: A.textMuted }}>Loading settings...</div>
      ) : (
        <>
          {maintenanceOn && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: A.amberBg, border: '1px solid #F3E2B8', borderRadius: 8, padding: '10px 12px', marginBottom: 14, color: A.amber, fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ marginTop: 1 }}><Icon name="wrench" size={15} /></span>
              <span>Maintenance mode is on. Everyone except staff currently sees the maintenance screen.</span>
            </div>
          )}
          {!canManage && (
            <div style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 14, color: A.textMuted, fontSize: 12.5 }}>
              You can view settings but not change them.
            </div>
          )}

          <div className="st-layout">
            <nav className="st-nav" aria-label="Settings sections">
              {SECTIONS.map((s) => (
                <button key={s.key} className={section === s.key ? 'on' : ''} onClick={() => setSection(s.key)} aria-current={section === s.key ? 'page' : undefined}>
                  <span className="t">{s.label}</span><span className="h">{s.hint}</span>
                </button>
              ))}
            </nav>

            <div>
              <div className="st-panel">
                {section === 'general' && (
                  <>
                    <p className="st-title">General</p>
                    <p className="st-hint">Basic information about the platform. The logo and branding are not changed here.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                      <div>
                        <label className="st-label" htmlFor="st-name">Platform name</label>
                        <input id="st-name" className="st-input" maxLength={60} disabled={!canManage} value={text('general.platform_name')} onChange={(e) => set('general.platform_name', e.target.value)} />
                      </div>
                      <div>
                        <label className="st-label" htmlFor="st-desc">Platform description</label>
                        <textarea id="st-desc" className="st-input" rows={3} maxLength={300} disabled={!canManage} style={{ resize: 'vertical' }} value={text('general.description')} onChange={(e) => set('general.description', e.target.value)} placeholder="A short description of Farmxie" />
                        <p style={{ fontSize: 11.5, color: A.textSoft, textAlign: 'right', marginTop: 2 }}>{text('general.description').length}/300</p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <div>
                          <label className="st-label" htmlFor="st-email">Support email</label>
                          <input id="st-email" className="st-input" type="email" maxLength={120} disabled={!canManage} value={text('general.support_email')} onChange={(e) => set('general.support_email', e.target.value)} placeholder="support@example.com" />
                        </div>
                        <div>
                          <label className="st-label" htmlFor="st-phone">Support phone</label>
                          <input id="st-phone" className="st-input" maxLength={30} disabled={!canManage} value={text('general.support_phone')} onChange={(e) => set('general.support_phone', e.target.value)} placeholder="+234..." />
                        </div>
                      </div>
                      <div>
                        <label className="st-label" htmlFor="st-info">Support information</label>
                        <textarea id="st-info" className="st-input" rows={3} maxLength={500} disabled={!canManage} style={{ resize: 'vertical' }} value={text('general.support_info')} onChange={(e) => set('general.support_info', e.target.value)} placeholder="Support hours, how to reach the team, and so on" />
                        <p style={{ fontSize: 11.5, color: A.textSoft, textAlign: 'right', marginTop: 2 }}>{text('general.support_info').length}/500</p>
                      </div>
                      <p style={{ fontSize: 12, color: A.textMuted, lineHeight: 1.5 }}>
                        The support email and phone appear on the maintenance screen. The other details are stored for the team and are not shown inside the app yet.
                      </p>
                    </div>
                  </>
                )}

                {section === 'platform' && (
                  <>
                    <p className="st-title">Platform</p>
                    <p className="st-hint">Turn parts of Farmxie on or off for everyone. Staff are never blocked by these switches. Turning something off asks for confirmation.</p>
                    <div style={{ marginTop: 6 }}>
                      {MODULES.map((m) => (
                        <Row key={m.key} title={m.label} desc={m.desc} right={
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: flag(m.key) ? A.greenDark : A.amber, minWidth: 30, textAlign: 'right' }}>{flag(m.key) ? 'On' : 'Off'}</span>
                            <Switch on={flag(m.key)} onChange={(v) => set(m.key, v)} disabled={!canManage} label={m.label} />
                          </span>
                        } />
                      ))}
                    </div>
                  </>
                )}

                {section === 'notifications' && (
                  <>
                    <p className="st-title">Notifications</p>
                    <p className="st-hint">Choose which alerts Farmxie sends to staff. Sending notifications to users is done on the Notifications page.</p>
                    <div style={{ marginTop: 6 }}>
                      {NOTIFS.map((n) => (
                        <Row key={n.key} title={n.label} desc={n.desc} right={
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: flag(n.key) ? A.greenDark : A.textMuted, minWidth: 30, textAlign: 'right' }}>{flag(n.key) ? 'On' : 'Off'}</span>
                            <Switch on={flag(n.key)} onChange={(v) => set(n.key, v)} disabled={!canManage} label={n.label} />
                          </span>
                        } />
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: A.textMuted, lineHeight: 1.5, marginTop: 14 }}>
                      System notifications, security alerts, FarmBot system alerts and platform announcements are not listed because nothing in Farmxie sends them yet.
                    </p>
                  </>
                )}

                {section === 'security' && (
                  <>
                    <p className="st-title">Security</p>
                    <p className="st-hint">The protection Farmxie has today. These are read-only because they are not configured from this page.</p>
                    <div style={{ marginTop: 6 }}>
                      {([
                        ['Data access rules', security ? `${security.tables_rls} of ${security.tables_total} database tables have row-level security turned on, so each person only reaches the data they are allowed to.` : 'Loading...', security ? (security.tables_rls === security.tables_total ? 'Active' : 'Check') : '-'],
                        ['Role-based admin access', 'Every admin page and action is limited by the permissions of the staff role.', 'Active'],
                        ['Admin activity log', security ? `${security.audit_24h} admin actions in the last 24 hours and ${security.audit_30d} in the last 30 days are recorded.${security.last_audit_at ? ` Latest: ${fmtFull(security.last_audit_at)}.` : ''}` : 'Loading...', 'Active'],
                        ['Sign-in, passwords and sessions', 'Handled by the sign-in service. Password rules and session lifetime are not changed from Farmxie.', 'Managed elsewhere'],
                        ['Two-factor authentication', 'Not available in Farmxie yet.', 'Not available'],
                        ['Active session management', 'Not available in Farmxie yet.', 'Not available'],
                      ] as [string, string, string][]).map(([t, d, s]) => (
                        <Row key={t} title={t} desc={d} right={
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', background: s === 'Active' ? '#DCFCE7' : s === 'Check' ? A.amberChip : '#F1F3F1', color: s === 'Active' ? '#166534' : s === 'Check' ? A.amber : '#4B5563' }}>{s}</span>
                        } />
                      ))}
                    </div>
                  </>
                )}

                {section === 'system' && (
                  <>
                    <p className="st-title">System Controls</p>
                    <p className="st-hint">High-impact controls for the whole platform. Turning maintenance mode on asks for confirmation.</p>
                    <div style={{ marginTop: 6 }}>
                      <Row title="Maintenance mode" desc="Everyone except staff sees a maintenance screen, and registration, posting, listing, ordering, groups and FarmBot are paused. Admin pages and sign-in keep working so you can turn it off." right={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: flag('system.maintenance') ? A.amber : A.textMuted, minWidth: 30, textAlign: 'right' }}>{flag('system.maintenance') ? 'On' : 'Off'}</span>
                          <Switch on={flag('system.maintenance')} onChange={(v) => set('system.maintenance', v)} disabled={!canManage} label="Maintenance mode" />
                        </span>
                      } />
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <label className="st-label" htmlFor="st-mm">Maintenance message</label>
                      <textarea id="st-mm" className="st-input" rows={3} maxLength={300} disabled={!canManage} style={{ resize: 'vertical' }} value={text('system.maintenance_message')} onChange={(e) => set('system.maintenance_message', e.target.value)} placeholder="We are making improvements and will be back shortly." />
                      <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 2 }}>Shown on the maintenance screen. Leave empty to use the default message.</p>
                    </div>
                    <p style={{ fontSize: 12, color: A.textMuted, lineHeight: 1.5, marginTop: 14 }}>The switches for registration, Marketplace, Community, Groups and FarmBot are in the Platform section.</p>
                  </>
                )}
              </div>

              {formError && <p style={{ fontSize: 12.5, color: A.red, marginTop: 10 }}>{formError}</p>}

              {canManage && dirty && (
                <div className="st-savebar">
                  <span style={{ fontSize: 12.5, color: A.textMuted }}>You have {changedKeys.length} unsaved {changedKeys.length === 1 ? 'change' : 'changes'}.</span>
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    <button className="st-btn" disabled={saving} onClick={() => { setDraft(saved); setFormError('') }}>Discard</button>
                    <button className="st-btn primary" disabled={saving} onClick={onSave}>{saving ? 'Saving...' : 'Save Changes'}</button>
                  </span>
                </div>
              )}
              {updatedAt && <p style={{ fontSize: 11.5, color: A.textSoft, marginTop: 10 }}>Last changed {fmtFull(updatedAt)}</p>}
            </div>
          </div>
        </>
      )}

      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,18,0.45)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { if (!saving) setConfirmOpen(false) }}>
          <div role="alertdialog" aria-label="Confirm changes" onClick={(e) => e.stopPropagation()} style={{ background: A.surface, borderRadius: 12, padding: 22, width: 440, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: A.text, marginBottom: 8 }}>Are you sure you want to continue?</p>
            <p style={{ fontSize: 13, color: A.textMuted, lineHeight: 1.55, marginBottom: 10 }}>These changes affect everyone using Farmxie:</p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: A.text, lineHeight: 1.6 }}>
              {risky.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="st-btn" disabled={saving} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="st-btn solid-danger" disabled={saving} onClick={() => void apply()}>{saving ? 'Saving...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#7F1D1D' : A.greenDark, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '10px 16px', borderRadius: 8, zIndex: 80, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: 'calc(100vw - 32px)' }}>
          <Icon name={toast.err ? 'alert' : 'check'} size={14} /> {toast.text}
        </div>
      )}
    </AdminLayout>
  )
}
