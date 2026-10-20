// One equipment listing as a card. Used on the marketplace, in "related equipment" and in My Listings.
import type { ReactNode } from 'react'
import Icon from './Icons'
import { COLORS, PremiumBadge } from './shared'
import { Pill } from './EquipmentFormKit'
import { availabilityText, conditionLabel, displayName, isGenuinelyVerified, kindLabel, placeText, priceText, STATUS_LABEL } from './equipmentConfig'
import type { EquipmentRow } from './equipmentConfig'

const TONE = { good: COLORS.green, warn: '#B45309', bad: COLORS.red } as const

export default function EquipmentCard({ item: it, onOpen, saved, onToggleSave, footer, showStatus }: {
  item: EquipmentRow
  onOpen: () => void
  saved?: boolean
  onToggleSave?: () => void
  footer?: ReactNode
  showStatus?: boolean
}) {
  const avail = availabilityText(it)
  const cond = conditionLabel(it.condition, it.condition_grade)
  const place = placeText(it)
  const brandModel = [it.brand, it.model].filter(Boolean).join(' ')
  const category = it.listing_type === 'service' ? it.service_category : it.category
  const typeTone = it.listing_type === 'rent' ? 'orange' : it.listing_type === 'service' ? 'blue' : 'green'

  return (
    <div style={{ background: COLORS.card, borderRadius: '16px', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }} style={{ display: 'flex', gap: '12px', padding: '12px', cursor: 'pointer' }}>
        <div style={{ width: '104px', height: '104px', borderRadius: '12px', flexShrink: 0, background: '#E8F3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          {it.images?.[0]
            ? <img src={it.images[0]} alt={it.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name={it.listing_type === 'service' ? 'wrench' : 'tractor'} size={30} color={COLORS.green} />}
          {(it.images?.length || 0) > 1 && (
            <div style={{ position: 'absolute', left: '4px', bottom: '4px', display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>
              <Icon name="image" size={9} color="white" /> {it.images?.length}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <Pill text={kindLabel(it.listing_type)} tone={typeTone} />
            {showStatus && <Pill text={STATUS_LABEL[it.status]} tone={it.status === 'available' ? 'green' : it.status === 'draft' ? 'gray' : 'red'} />}
            {it.is_hidden_by_admin && <Pill text="Hidden by Farmxie" tone="red" />}
          </div>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.name}</p>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[category, brandModel].filter(Boolean).join(' · ')}
          </p>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.green, marginTop: '5px' }}>{priceText(it)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
            {cond && <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{cond}</span>}
            {place && (
              <span style={{ fontSize: '11px', color: COLORS.textMuted, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Icon name="mapPin" size={10} color={COLORS.textMuted} /> {place}
              </span>
            )}
          </div>
        </div>

        {onToggleSave && (
          <button type="button" aria-label={saved ? 'Remove from saved' : 'Save'} onClick={(e) => { e.stopPropagation(); onToggleSave() }}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex' }}>
            <Icon name="bookmark" size={18} color={saved ? COLORS.orange : COLORS.textMuted} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 12px 12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.text, display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(it)}</span>
            {isGenuinelyVerified(it) && <Icon name="checkCircle" size={13} color={COLORS.green} />}
            {it.seller?.is_premium && <PremiumBadge />}
          </p>
          <p style={{ fontSize: '11px', fontWeight: 700, color: TONE[avail.tone], marginTop: '2px' }}>{avail.text}</p>
        </div>
        <button type="button" onClick={onOpen}
          style={{ flexShrink: 0, minHeight: '36px', padding: '0 14px', borderRadius: '10px', border: `1px solid ${COLORS.green}`, background: COLORS.card, color: COLORS.green, fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          View Details
        </button>
      </div>

      {footer}
    </div>
  )
}
