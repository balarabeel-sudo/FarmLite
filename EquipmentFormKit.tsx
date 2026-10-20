// Small building blocks shared by the Equipment pages: form fields, chips, section cards, confirm sheet.
import type { ReactNode } from 'react'
import Icon from './Icons'
import { COLORS, inputStyle } from './shared'
import type { Option } from './equipmentConfig'

const labelRow = { fontSize: '12px', fontWeight: 700 as const, color: COLORS.text, marginBottom: '6px', display: 'block' }

export function FieldShell({ id, label, required, hint, error, children }: { id?: string; label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label htmlFor={id} style={labelRow}>
        {label}{required && <span style={{ color: COLORS.red }}> *</span>}
      </label>
      {children}
      {hint && !error && <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px', lineHeight: 1.4 }}>{hint}</p>}
      {error && <p id={id ? `${id}-err` : undefined} role="alert" style={{ fontSize: '11.5px', color: COLORS.red, marginTop: '4px', fontWeight: 600 }}>{error}</p>}
    </div>
  )
}

const control = (error?: string) => ({ ...inputStyle, marginBottom: 0, border: `1px solid ${error ? COLORS.red : COLORS.border}`, background: COLORS.card, fontSize: '14px', padding: '11px 12px' })

export function TextField({ id, label, value, onChange, error, hint, required, placeholder, maxLength, inputMode, type = 'text', rows, prefix }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; required?: boolean
  placeholder?: string; maxLength?: number; inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'; type?: string; rows?: number; prefix?: string
}) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      {rows ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={rows}
          aria-invalid={!!error} style={{ ...control(error), resize: 'vertical' }} />
      ) : (
        <div style={{ position: 'relative' }}>
          {prefix && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: COLORS.textMuted, fontWeight: 700 }}>{prefix}</span>}
          <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
            aria-invalid={!!error} style={{ ...control(error), paddingLeft: prefix ? '46px' : '12px' }} />
        </div>
      )}
    </FieldShell>
  )
}

export function SelectField({ id, label, value, onChange, options, error, hint, required, placeholder = 'Choose…' }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: (Option | string)[]; error?: string; hint?: string; required?: boolean; placeholder?: string
}) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} style={control(error)}>
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const [v, l] = typeof o === 'string' ? [o, o] : o
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </FieldShell>
  )
}

export function Chip({ active, onClick, label, small }: { active: boolean; onClick: () => void; label: string; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{
        padding: small ? '6px 12px' : '8px 16px', minHeight: small ? '32px' : '38px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        background: active ? COLORS.green : COLORS.card, color: active ? 'white' : COLORS.textMuted, border: `1px solid ${active ? COLORS.green : COLORS.border}`, fontFamily: 'inherit',
      }}>
      {label}
    </button>
  )
}

export function YesNoField({ label, value, onChange, hint, error, required }: { label: string; value: boolean | null; onChange: (v: boolean) => void; hint?: string; error?: string; required?: boolean }) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      <div role="group" aria-label={label} style={{ display: 'flex', gap: '8px' }}>
        <Chip active={value === true} onClick={() => onChange(true)} label="Yes" />
        <Chip active={value === false} onClick={() => onChange(false)} label="No" />
      </div>
    </FieldShell>
  )
}

export function MultiChips({ label, options, value, onChange, hint }: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])
  return (
    <FieldShell label={label} hint={hint}>
      <div role="group" aria-label={label} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {options.map(([k, l]) => <Chip key={k} small active={value.includes(k)} onClick={() => toggle(k)} label={l} />)}
      </div>
    </FieldShell>
  )
}

export function SectionCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', padding: '16px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      {title && <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{title}</p>}
      {subtitle && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', lineHeight: 1.4 }}>{subtitle}</p>}
      <div style={{ marginTop: title || subtitle ? '14px' : 0 }}>{children}</div>
    </div>
  )
}

export function Stepper({ titles, current, reached, onJump }: { titles: string[]; current: number; reached: number; onJump: (i: number) => void }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {titles.map((t, i) => (
          <button key={t} type="button" aria-label={`Go to step ${i + 1}: ${t}`} disabled={i > reached} onClick={() => onJump(i)}
            style={{ flex: 1, height: '6px', borderRadius: '3px', border: 'none', padding: 0, cursor: i <= reached ? 'pointer' : 'default', background: i <= current ? COLORS.green : i <= reached ? '#A7D7B5' : COLORS.border }} />
        ))}
      </div>
      <p style={{ fontSize: '11.5px', color: COLORS.textMuted, fontWeight: 700 }}>Step {current + 1} of {titles.length}</p>
      <p style={{ fontSize: '17px', fontWeight: 800, color: COLORS.text, marginTop: '2px' }}>{titles[current]}</p>
    </div>
  )
}

export function Pill({ text, tone = 'green' }: { text: string; tone?: 'green' | 'orange' | 'red' | 'gray' | 'blue' }) {
  const map = {
    green: { bg: '#DCFCE7', fg: COLORS.greenDark },
    orange: { bg: '#FEF3C7', fg: '#92400E' },
    red: { bg: '#FEE2E2', fg: '#991B1B' },
    gray: { bg: '#EEF2EE', fg: COLORS.textMuted },
    blue: { bg: '#DBEAFE', fg: '#1E40AF' },
  }[tone]
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px', background: map.bg, color: map.fg, fontSize: '10.5px', fontWeight: 800, whiteSpace: 'nowrap' }}>{text}</span>
}

export function PrimaryButton({ onClick, children, disabled, icon, tone = 'green', full = true }: { onClick: () => void; children: ReactNode; disabled?: boolean; icon?: string; tone?: 'green' | 'ghost' | 'danger'; full?: boolean }) {
  const styles = {
    green: { background: COLORS.green, color: 'white', border: `1px solid ${COLORS.green}` },
    ghost: { background: COLORS.card, color: COLORS.green, border: `1px solid ${COLORS.green}` },
    danger: { background: COLORS.card, color: COLORS.red, border: '1px solid #FECACA' },
  }[tone]
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...styles, width: full ? '100%' : undefined, minHeight: '46px', padding: '0 18px', borderRadius: '12px', fontWeight: 800, fontSize: '13.5px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: 'inherit' }}>
      {icon && <Icon name={icon} size={16} color={styles.color} />}
      {children}
    </button>
  )
}

// A confirmation dialog for destructive actions (delete, mark as sold...)
export function ConfirmSheet({ open, title, body, confirmLabel, danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div onClick={busy ? undefined : onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '20px 18px 24px' }}>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{title}</p>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5, margin: '8px 0 16px' }}>{body}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <PrimaryButton tone="ghost" onClick={onCancel} disabled={busy}>Cancel</PrimaryButton>
          <PrimaryButton tone={danger ? 'danger' : 'green'} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button type="button" aria-label="Go back" onClick={onBack} style={{ cursor: 'pointer', display: 'flex', background: 'none', border: 'none', padding: '4px' }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </button>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
      </div>
      {right}
    </div>
  )
}
