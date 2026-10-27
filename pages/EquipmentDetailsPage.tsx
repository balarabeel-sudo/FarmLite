import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { addSaved, SAVED_LIMIT_MESSAGE } from '../savedShared'
import { useAuth } from '../AuthContext'
import Icon from '../Icons'
import NetworkError from '../NetworkError'
import ReportSheet from '../ReportSheet'
import EquipmentCard from '../EquipmentCard'
import { PageHeader, Pill, PrimaryButton, SectionCard } from '../EquipmentFormKit'
import { formatMoney } from '../moneyUtils'
import { cleanPhone, whatsappLink } from '../phoneUtils'
import { COLORS, PremiumBadge } from '../shared'
import {
  EQUIP_SELECT, SPEC_LABELS, STATUS_LABEL, WEEKDAYS, availabilityText, conditionLabel, displayName, isGenuinelyVerified, kindLabel,
  placeText, prettyDate, priceText, sellerTypeLabel,
} from '../equipmentConfig'
import type { EquipmentRow } from '../equipmentConfig'

const TONE = { good: COLORS.green, warn: 'var(--fx-amber-text2)', bad: COLORS.red } as const

export default function EquipmentDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [item, setItem] = useState<EquipmentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [missing, setMissing] = useState(false)
  const [related, setRelated] = useState<EquipmentRow[]>([])
  const [saved, setSaved] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [photo, setPhoto] = useState(0)
  const galleryRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!id) return
    setLoading(true)
    setNetError(false)
    setMissing(false)
    const { data, error } = await supabase.from('equipment').select(EQUIP_SELECT).eq('id', id).maybeSingle()
    if (error) { setNetError(true); setLoading(false); return }
    if (!data) { setMissing(true); setLoading(false); return }
    const row = data as unknown as EquipmentRow
    setItem(row)
    setPhoto(0)
    setLoading(false)

    // related: same type and category, still live
    let rq = supabase.from('equipment').select(EQUIP_SELECT).eq('status', 'available').eq('is_hidden_by_admin', false).neq('id', row.id).eq('listing_type', row.listing_type)
    const cat = row.listing_type === 'service' ? row.service_category : row.category
    if (cat) rq = rq.eq(row.listing_type === 'service' ? 'service_category' : 'category', cat)
    const rel = await rq.order('created_at', { ascending: false }).limit(4)
    setRelated((rel.data || []) as unknown as EquipmentRow[])

    if (user) {
      const s = await supabase.from('saved_items').select('id').eq('user_id', user.id).eq('equipment_id', row.id).maybeSingle()
      setSaved(!!s.data)
    }
  }
  useEffect(() => { load(); window.scrollTo({ top: 0 }) }, [id, user?.id])

  const toggleSave = async () => {
    if (!user || !item) return
    if (saved) {
      setSaved(false)
      const { error } = await supabase.from('saved_items').delete().eq('user_id', user.id).eq('equipment_id', item.id)
      if (error) setSaved(true)
    } else {
      setSaved(true)
      const r = await addSaved(user.id, 'equipment_id', item.id)
      if (r !== 'ok') {
        setSaved(false)
        window.alert(r === 'limit' ? SAVED_LIMIT_MESSAGE : 'Could not save. Please try again.')
      }
    }
  }

  const share = async () => {
    if (!item) return
    const url = `${window.location.origin}/equipment/${item.id}`
    try {
      if (navigator.share) await navigator.share({ title: item.name, url })
      else { await navigator.clipboard.writeText(url) }
    } catch { /* cancelled */ }
  }

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/equipment'))

  if (loading) return <Frame onBack={back} title="Equipment"><p style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '13px', padding: '60px 0' }}>Loading…</p></Frame>
  if (netError) return <Frame onBack={back} title="Equipment"><NetworkError onRetry={load} /></Frame>
  if (missing || !item) {
    return (
      <Frame onBack={back} title="Equipment">
        <div style={{ background: COLORS.card, borderRadius: '16px', padding: '34px 20px', textAlign: 'center' }}>
          <Icon name="alertTriangle" size={30} color={COLORS.textMuted} />
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginTop: '10px' }}>This listing is not available</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '6px 0 16px', lineHeight: 1.5 }}>It may have been removed, paused or sold.</p>
          <PrimaryButton onClick={() => navigate('/equipment')}>Browse Equipment</PrimaryButton>
        </div>
      </Frame>
    )
  }

  const it = item
  const isMine = it.seller_id === user?.id
  const avail = availabilityText(it)
  const images = it.images || []
  const place = placeText(it)
  const cond = conditionLabel(it.condition, it.condition_grade)
  const phone = it.whatsapp ? cleanPhone(it.whatsapp) : ''
  const category = it.listing_type === 'service' ? it.service_category : it.category
  const title = [it.brand, it.model].filter(Boolean).join(' ')
  const specs = Object.entries(it.specs || {}).filter(([, v]) => v)
  const isRent = it.listing_type === 'rent'
  const isSale = it.listing_type === 'buy'
  const isService = it.listing_type === 'service'
  const typeTone = isRent ? 'orange' : isService ? 'blue' : 'green'
  const unitS = it.unit || 'day'
  const dayNames = (it.available_days || []).map((d) => WEEKDAYS.find((w) => w[0] === d)?.[1] || d).join(', ')

  return (
    <Frame onBack={back} title={kindLabel(it.listing_type)}
      right={<div style={{ display: 'flex', gap: '4px' }}>
        <IconBtn label="Share" icon="share" onClick={share} />
        {user && <IconBtn label={saved ? 'Remove from saved' : 'Save'} icon="bookmark" color={saved ? COLORS.orange : COLORS.textMuted} onClick={toggleSave} />}
      </div>}>
      {(it.status !== 'available' || it.is_hidden_by_admin) && isMine && (
        <div style={{ background: 'var(--fx-tint-amber2)', border: '1px solid var(--fx-bd-amber)', borderRadius: '12px', padding: '10px 12px', marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fx-amber-text)', lineHeight: 1.45 }}>
            {it.is_hidden_by_admin ? 'This listing was hidden by Farmxie and buyers cannot see it.' : `Only you can see this listing right now (${STATUS_LABEL[it.status]}).`}
          </p>
        </div>
      )}

      {/* gallery */}
      <div style={{ borderRadius: '16px', overflow: 'hidden', background: 'var(--fx-grey2)', marginBottom: '12px', position: 'relative' }}>
        {images.length > 0 ? (
          <>
            <div ref={galleryRef} onScroll={(e) => { const el = e.currentTarget; setPhoto(Math.round(el.scrollLeft / el.clientWidth)) }}
              style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
              {images.map((u, i) => <img key={u} src={u} alt={`${it.name} photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} style={{ width: '100%', height: '260px', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />)}
            </div>
            {images.length > 1 && <div style={{ position: 'absolute', right: '10px', bottom: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px' }}>{photo + 1} / {images.length}</div>}
          </>
        ) : (
          <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={isService ? 'wrench' : 'tractor'} size={44} color={COLORS.green} /></div>
        )}
      </div>
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px' }}>
          {images.map((u, i) => (
            <button key={u} type="button" aria-label={`Show photo ${i + 1}`} onClick={() => galleryRef.current?.scrollTo({ left: i * (galleryRef.current?.clientWidth || 0), behavior: 'smooth' })}
              style={{ width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden', padding: 0, flexShrink: 0, cursor: 'pointer', border: `2px solid ${i === photo ? COLORS.green : 'transparent'}`, background: 'none' }}>
              <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}

      {/* headline */}
      <SectionCard>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <Pill text={kindLabel(it.listing_type)} tone={typeTone} />
          {category && <Pill text={category} tone="gray" />}
          {cond && <Pill text={cond} tone="gray" />}
        </div>
        <p style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, lineHeight: 1.25 }}>{it.name}</p>
        {title && <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '3px' }}>{title}{it.year_made ? ` · ${it.year_made}` : ''}</p>}
        <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.green, marginTop: '10px' }}>
          {priceText(it)}
          {isSale && it.negotiable && <span style={{ fontSize: '11.5px', fontWeight: 800, color: COLORS.orange, marginLeft: '8px' }}>Negotiable</span>}
        </p>
        {isRent && it.security_deposit != null && it.security_deposit > 0 && (
          <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px' }}>Security deposit: {formatMoney(Number(it.security_deposit), it.currency)} <span style={{ fontStyle: 'italic' }}>(separate from the rental rate; arranged directly with the owner)</span></p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
          {place && <Row icon="mapPin" text={[place, it.country].filter(Boolean).join(', ')} />}
          <Row icon="check" text={avail.text} color={TONE[avail.tone]} />
          {isSale && it.quantity != null && <Row icon="package" text={`${it.quantity} available${it.min_order_qty ? ` · minimum order ${it.min_order_qty}` : ''}`} />}
        </div>
      </SectionCard>

      {it.description && (
        <SectionCard title={isService ? 'About this service' : 'Description'}>
          <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.description}</p>
          {!isService && it.features && (
            <>
              <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text, margin: '14px 0 4px' }}>Main features</p>
              <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.features}</p>
            </>
          )}
        </SectionCard>
      )}

      {specs.length > 0 && (
        <SectionCard title="Technical specifications">
          <Table rows={specs.map(([k, v]) => [SPEC_LABELS[k] || k, v])} />
        </SectionCard>
      )}

      {/* type-specific blocks: never show rental terms on a sale, or the other way round */}
      {isSale && (
        <SectionCard title="Sale details">
          <Table rows={[
            ['Price', priceText(it)],
            ['Negotiable', it.negotiable ? 'Yes' : 'No'],
            ['Quantity available', it.quantity != null ? String(it.quantity) : ''],
            ['Minimum order', it.min_order_qty ? String(it.min_order_qty) : ''],
            ['Delivery', it.delivery_available ? (it.delivery_details || 'Available') : 'Not offered'],
            ['Pickup', it.pickup_available ? 'Buyers can collect' : ''],
            ['Warranty', it.warranty || ''],
          ]} />
          {(it.documents || []).length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.text, marginBottom: '6px' }}>Documents</p>
              {(it.documents || []).map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: COLORS.green, fontWeight: 700, padding: '6px 0', textDecoration: 'none' }}>
                  <Icon name="fileText" size={15} color={COLORS.green} /> Document {i + 1}
                </a>
              ))}
            </div>
          )}
        </SectionCard>
      )}
      {isRent && (
        <>
          <SectionCard title="Rental terms">
            <Table rows={[
              ['Rental rate', priceText(it)],
              ['Minimum period', it.min_rental_period ? `${it.min_rental_period} ${unitS}${it.min_rental_period > 1 ? 's' : ''}` : ''],
              ['Maximum period', it.max_rental_period ? `${it.max_rental_period} ${unitS}${it.max_rental_period > 1 ? 's' : ''}` : ''],
              ['Operator', it.operator_included === null ? '' : it.operator_included ? 'Included' : 'Not included'],
              ['Fuel', it.fuel_included === null ? '' : it.fuel_included ? 'Included' : 'Not included'],
              ['Delivery', it.delivery_available ? (it.delivery_details || 'Available') : 'Not offered'],
              ['Transportation fee', it.transport_fee ? formatMoney(Number(it.transport_fee), it.currency) : ''],
              ['Maintenance', it.maintenance_terms || ''],
              ['Service area', it.service_area || ''],
              ['Pickup location', it.pickup_location || ''],
            ]} />
          </SectionCard>
          <SectionCard title="Availability" subtitle="Based on what the owner entered. There is no live booking calendar — contact the owner to confirm.">
            <Table rows={[
              ['From', prettyDate(it.available_from)],
              ['Until', prettyDate(it.available_until)],
              ['Days', dayNames],
              ['Hours', it.operating_hours || ''],
              ['Booking notice', it.booking_notice || ''],
            ]} empty="No specific dates given. Ask the owner." />
          </SectionCard>
        </>
      )}
      {isService && (
        <SectionCard title="Service details">
          <Table rows={[
            ['Pricing', priceText(it)],
            ['Service areas', it.service_area || ''],
            ['Brands supported', it.brands_supported || ''],
            ['Experience', it.experience || ''],
            ['Workshop location', it.address || ''],
          ]} />
        </SectionCard>
      )}
      {(isRent && (it.experience || it.operator_qualifications || it.extra_info)) && (
        <SectionCard title="More from the provider">
          <Table rows={[['Experience', it.experience || ''], ['Operator qualifications', it.operator_qualifications || ''], ['More information', it.extra_info || '']]} />
        </SectionCard>
      )}
      {isSale && it.address && <SectionCard title="Location"><Table rows={[['Address', it.address]]} /></SectionCard>}

      {/* seller */}
      <SectionCard title={isSale ? 'Seller' : 'Provider'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--fx-tint-green)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {it.seller?.profile_image ? <img src={it.seller.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={22} color={COLORS.green} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {displayName(it)}
              {isGenuinelyVerified(it) && <Icon name="checkCircle" size={15} color={COLORS.green} />}
              {it.seller?.is_premium && <PremiumBadge />}
            </p>
            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px' }}>
              {[sellerTypeLabel(it.seller_type), it.seller?.username ? `@${it.seller.username}` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {isSale && it.business_description && <p style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.55, marginTop: '12px', whiteSpace: 'pre-wrap' }}>{it.business_description}</p>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {it.company && <PrimaryButton tone="ghost" full={false} onClick={() => navigate(`/companies/${it.company!.id}`)}>View company</PrimaryButton>}
          {it.seller?.username && <PrimaryButton tone="ghost" full={false} onClick={() => navigate(`/u/${it.seller!.username}`)}>View profile</PrimaryButton>}
        </div>
      </SectionCard>

      {/* contact */}
      {isMine ? (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <PrimaryButton icon="edit" onClick={() => navigate(`/equipment/${it.id}/edit`)}>Edit Listing</PrimaryButton>
          <PrimaryButton tone="ghost" onClick={() => navigate('/equipment/mine')}>My Listings</PrimaryButton>
        </div>
      ) : (
        <div style={{ marginBottom: '14px' }}>
          {it.status === 'available' ? (
            <>
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, lineHeight: 1.45, marginBottom: '8px' }}>
                {isSale ? 'Contact the seller to ask questions, agree a price and arrange payment or delivery.' : isRent ? 'Contact the owner to confirm dates, rate and delivery. Farmxie does not take bookings or deposits.' : 'Contact the provider for details or a quote.'}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {phone && <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" style={linkBtn(true)}><Icon name="message" size={16} color="white" /> {isService ? 'Request a Quote' : 'Contact on WhatsApp'}</a>}
                {phone && <a href={`tel:${phone}`} style={linkBtn(false)}><Icon name="phone" size={16} color={COLORS.green} /> Call</a>}
                {!phone && <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>The owner has not added a phone number.</p>}
              </div>
              {it.seller?.username && <div style={{ marginTop: '10px' }}><PrimaryButton tone="ghost" icon="comment" onClick={() => navigate(`/u/${it.seller!.username}`)}>Message on Farmxie</PrimaryButton></div>}
            </>
          ) : (
            <p style={{ fontSize: '13px', color: COLORS.red, fontWeight: 700 }}>This listing is not available right now.</p>
          )}
        </div>
      )}

      {!isMine && user && (
        <button type="button" onClick={() => setReportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto 18px', background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Icon name="alertTriangle" size={14} color={COLORS.textMuted} /> Report this listing
        </button>
      )}

      {related.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text, margin: '0 2px 10px' }}>Related equipment</p>
          {related.map((r) => <EquipmentCard key={r.id} item={r} onOpen={() => navigate(`/equipment/${r.id}`)} />)}
        </div>
      )}

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} type="marketplace" contentId={it.id} contentTable="equipment" userId={it.seller_id} targetLabel={it.name} />
    </Frame>
  )
}

function linkBtn(primary: boolean): React.CSSProperties {
  return {
    flex: primary ? 2 : 1, minWidth: '120px', minHeight: '46px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', borderRadius: '12px', fontWeight: 800, fontSize: '13.5px', textDecoration: 'none',
    background: primary ? COLORS.green : COLORS.card, color: primary ? 'white' : COLORS.green, border: `1px solid ${COLORS.green}`,
  }
}

function Frame({ title, onBack, right, children }: { title: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <PageHeader title={title} onBack={onBack} right={right} />
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

function IconBtn({ label, icon, onClick, color = COLORS.textMuted }: { label: string; icon: string; onClick: () => void; color?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', display: 'flex' }}>
      <Icon name={icon} size={20} color={color} />
    </button>
  )
}

function Row({ icon, text, color = COLORS.textMuted }: { icon: string; text: string; color?: string }) {
  return <p style={{ fontSize: '12.5px', color, display: 'flex', alignItems: 'center', gap: '7px', fontWeight: color === COLORS.textMuted ? 500 : 700 }}><Icon name={icon} size={14} color={color} /> {text}</p>
}

function Table({ rows, empty }: { rows: [string, string][]; empty?: string }) {
  const shown = rows.filter((r) => r[1])
  if (shown.length === 0) return <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>{empty || 'Nothing added.'}</p>
  return (
    <div>
      {shown.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderTop: i ? `1px solid ${COLORS.border}` : 'none' }}>
          <p style={{ width: '38%', flexShrink: 0, fontSize: '12px', color: COLORS.textMuted }}>{k}</p>
          <p style={{ flex: 1, fontSize: '12.5px', color: COLORS.text, fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</p>
        </div>
      ))}
    </div>
  )
}
