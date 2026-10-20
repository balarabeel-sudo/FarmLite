// Everything the Equipment module needs to know: types, option lists, validation and price/label helpers.
// One place to add a category, a field or an option.
import { cleanPhone, validatePhone } from './phoneUtils'
import { formatMoney } from './moneyUtils'

export type Kind = 'sale' | 'rent' | 'service'
export type DbType = 'buy' | 'rent' | 'service'
export type DbStatus = 'draft' | 'available' | 'unavailable' | 'sold'

export const KIND_TO_TYPE: Record<Kind, DbType> = { sale: 'buy', rent: 'rent', service: 'service' }
export const TYPE_TO_KIND: Record<DbType, Kind> = { buy: 'sale', rent: 'rent', service: 'service' }

export const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES']
export const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'Niger', 'Cameroon', 'Benin', 'Togo', 'Senegal', 'Mali', 'Chad', 'Tanzania', 'Uganda', 'South Africa', 'United States', 'United Kingdom', 'Other']

export const EQUIPMENT_CATEGORIES = [
  'Tractors', 'Harvesters', 'Planters and Seeders', 'Irrigation Equipment', 'Sprayers', 'Tillers and Cultivators',
  'Ploughs and Harrows', 'Processing Equipment', 'Milling Equipment', 'Storage Equipment', 'Poultry Equipment',
  'Fish Farming Equipment', 'Livestock Equipment', 'Transport and Haulage Equipment', 'Farm Hand Tools', 'Spare Parts',
  'Other Agricultural Equipment',
]

export const SERVICE_CATEGORIES = [
  'Machinery Repair', 'Equipment Maintenance', 'Tractor Servicing', 'Irrigation Installation and Repair',
  'Spare Parts Supply', 'Equipment Installation', 'Other Agricultural Equipment Services',
]

// One choice in the form maps to the two database columns condition + condition_grade
export const CONDITION_OPTIONS: { key: string; label: string; condition: 'new' | 'used' | 'refurbished'; grade: 'excellent' | 'good' | 'fair' | null }[] = [
  { key: 'new', label: 'Brand New', condition: 'new', grade: null },
  { key: 'used_excellent', label: 'Used — Excellent Condition', condition: 'used', grade: 'excellent' },
  { key: 'used_good', label: 'Used — Good Condition', condition: 'used', grade: 'good' },
  { key: 'used_fair', label: 'Used — Fair Condition', condition: 'used', grade: 'fair' },
  { key: 'refurbished', label: 'Refurbished', condition: 'refurbished', grade: null },
]

export function conditionKeyOf(condition: string | null, grade: string | null): string {
  if (condition === 'new') return 'new'
  if (condition === 'refurbished') return 'refurbished'
  if (condition === 'used') return grade ? `used_${grade}` : 'used_good'
  return ''
}
export function conditionLabel(condition: string | null, grade: string | null): string {
  if (!condition) return ''
  const hit = CONDITION_OPTIONS.find((o) => o.key === conditionKeyOf(condition, grade))
  if (condition === 'used' && !grade) return 'Used'
  return hit ? hit.label : condition
}

export type Option = [value: string, label: string]

export const SELLER_TYPES: Record<Kind, Option[]> = {
  sale: [['individual', 'Individual'], ['dealer', 'Equipment Dealer'], ['agri_business', 'Agricultural Business'], ['manufacturer', 'Manufacturer'], ['distributor', 'Distributor']],
  rent: [['individual', 'Individual'], ['rental_company', 'Equipment Rental Company'], ['agri_business', 'Agricultural Business'], ['dealer', 'Equipment Dealer']],
  service: [['individual', 'Individual Technician'], ['workshop', 'Workshop'], ['agri_business', 'Agricultural Business'], ['dealer', 'Equipment Dealer']],
}
export function sellerTypeLabel(v: string | null): string {
  const all = [...SELLER_TYPES.sale, ...SELLER_TYPES.rent, ...SELLER_TYPES.service]
  return all.find((o) => o[0] === v)?.[1] || ''
}

export const RENT_UNITS: Option[] = [['hour', 'Per Hour'], ['day', 'Per Day'], ['week', 'Per Week'], ['month', 'Per Month'], ['season', 'Per Season (custom period)']]
export const PRICE_MODES: Option[] = [['fixed', 'Fixed Price'], ['starting', 'Starting Price'], ['hourly', 'Hourly Rate'], ['quote', 'Request a Quote']]
export const WEEKDAYS: Option[] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
export const FUEL_TYPES = ['Diesel', 'Petrol', 'Electric', 'Solar', 'Manual', 'Other']

// Optional structured specifications (stored together in one JSON column)
export const SPEC_FIELDS: { key: string; label: string; placeholder: string; select?: string[] }[] = [
  { key: 'power', label: 'Power / capacity', placeholder: 'e.g. 75 HP, 2000 L' },
  { key: 'fuel_type', label: 'Fuel type', placeholder: '', select: FUEL_TYPES },
  { key: 'usage_hours', label: 'Usage hours', placeholder: 'e.g. 1200' },
  { key: 'dimensions', label: 'Dimensions', placeholder: 'e.g. 4.2 m x 2.1 m' },
  { key: 'weight', label: 'Weight', placeholder: 'e.g. 3200 kg' },
  { key: 'other', label: 'Other specifications', placeholder: 'Anything else buyers should know' },
]
export const SPEC_LABELS: Record<string, string> = Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, f.label]))

export const STATUS_LABEL: Record<DbStatus, string> = { draft: 'Draft', available: 'Live', unavailable: 'Unavailable', sold: 'Sold' }

// ---------------------------------------------------------------------------------------------
// Database row as the app reads it

export type EquipmentRow = {
  id: string
  seller_id: string
  company_id: string | null
  name: string
  category: string | null
  description: string | null
  listing_type: DbType
  price: number
  currency: string
  unit: string | null
  location: string | null
  images: string[] | null
  status: DbStatus
  created_at: string
  whatsapp: string | null
  negotiable: boolean
  condition: 'new' | 'used' | 'refurbished' | null
  condition_grade: 'excellent' | 'good' | 'fair' | null
  is_hidden_by_admin: boolean
  brand: string | null
  model: string | null
  year_made: number | null
  features: string | null
  specs: Record<string, string> | null
  documents: string[] | null
  quantity: number | null
  min_order_qty: number | null
  delivery_available: boolean
  delivery_details: string | null
  warranty: string | null
  pickup_available: boolean
  country: string | null
  state: string | null
  city: string | null
  address: string | null
  seller_name: string | null
  seller_type: string | null
  business_email: string | null
  business_description: string | null
  security_deposit: number | null
  min_rental_period: number | null
  max_rental_period: number | null
  operator_included: boolean | null
  fuel_included: boolean | null
  transport_fee: number | null
  maintenance_terms: string | null
  available_from: string | null
  available_until: string | null
  available_days: string[] | null
  operating_hours: string | null
  booking_notice: string | null
  service_area: string | null
  pickup_location: string | null
  experience: string | null
  operator_qualifications: string | null
  extra_info: string | null
  service_category: string | null
  brands_supported: string | null
  price_mode: 'fixed' | 'starting' | 'hourly' | 'quote' | null
  seller: { full_name: string | null; username: string | null; profile_image: string | null; is_verified: boolean | null; is_premium: boolean | null } | null
  company: { id: string; name: string; status: string | null } | null
}

export const EQUIP_SELECT =
  '*, seller:profiles!equipment_seller_id_fkey(full_name, username, profile_image, is_verified, is_premium), company:companies!equipment_company_id_fkey(id, name, status)'

export function kindLabel(t: DbType): string {
  return t === 'buy' ? 'For Sale' : t === 'rent' ? 'For Rent' : 'Service'
}

export function displayName(it: EquipmentRow): string {
  return it.seller_name || it.company?.name || it.seller?.full_name || it.seller?.username || 'Farmxie member'
}

// Only genuine verification: a verified Farmxie profile, or a verified company the listing is under
export function isGenuinelyVerified(it: EquipmentRow): boolean {
  return !!it.seller?.is_verified || it.company?.status === 'verified'
}

export function placeText(it: Pick<EquipmentRow, 'city' | 'state' | 'country' | 'location'>): string {
  const parts = [it.city, it.state].filter(Boolean) as string[]
  if (parts.length) return parts.join(', ')
  return it.location || it.country || ''
}

const UNIT_WORD: Record<string, string> = { hour: 'hour', day: 'day', week: 'week', month: 'month', season: 'season' }

// Sale price, rental rate and service price are never mixed: each is worded for its own type.
export function priceText(it: Pick<EquipmentRow, 'listing_type' | 'price' | 'currency' | 'unit' | 'price_mode'>): string {
  const money = formatMoney(Number(it.price), it.currency)
  if (it.listing_type === 'rent') return `${money} per ${UNIT_WORD[it.unit || ''] || 'day'}`
  if (it.listing_type === 'service') {
    if (it.price_mode === 'quote') return 'Request a quote'
    if (it.price_mode === 'starting') return `From ${money}`
    if (it.price_mode === 'hourly') return `${money} per hour`
    return money
  }
  return money
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function prettyDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(`${s}T00:00:00`)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Availability is only shown from fields the owner really filled in (no fake real-time availability)
export function availabilityText(it: EquipmentRow): { text: string; tone: 'good' | 'warn' | 'bad' } {
  if (it.status === 'sold') return { text: 'Sold', tone: 'bad' }
  if (it.status === 'draft') return { text: 'Draft', tone: 'warn' }
  if (it.status === 'unavailable') return { text: 'Unavailable', tone: 'bad' }
  if (it.listing_type === 'rent') {
    const t = todayStr()
    if (it.available_from && it.available_from > t) return { text: `Available from ${prettyDate(it.available_from)}`, tone: 'warn' }
    if (it.available_until && it.available_until < t) return { text: 'Rental window ended', tone: 'bad' }
  }
  return { text: 'Available', tone: 'good' }
}

export function pageTitleFor(kind: Kind): string {
  return kind === 'sale' ? 'Sell Equipment' : kind === 'rent' ? 'Rent Out Equipment' : 'Offer Equipment Services'
}

// ---------------------------------------------------------------------------------------------
// Form state

export type Form = {
  kind: Kind
  status: DbStatus
  name: string
  category: string
  brand: string
  model: string
  year: string
  conditionKey: string
  description: string
  features: string
  specs: Record<string, string>
  images: string[]
  documents: string[]
  price: string
  currency: string
  negotiable: boolean
  quantity: string
  minOrder: string
  deliveryAvailable: boolean
  deliveryDetails: string
  warranty: string
  pickupAvailable: boolean
  country: string
  state: string
  city: string
  address: string
  sellerName: string
  sellerType: string
  whatsapp: string
  businessEmail: string
  businessDescription: string
  companyId: string
  // rental
  unit: string
  deposit: string
  minPeriod: string
  maxPeriod: string
  operatorIncluded: boolean | null
  fuelIncluded: boolean | null
  transportFee: string
  maintenance: string
  availableForRent: boolean
  availableFrom: string
  availableUntil: string
  availableDays: string[]
  operatingHours: string
  bookingNotice: string
  serviceArea: string
  pickupLocation: string
  experience: string
  operatorQualifications: string
  extraInfo: string
  // service
  serviceCategory: string
  brandsSupported: string
  priceMode: string
}

export function emptyForm(kind: Kind): Form {
  return {
    kind, status: 'draft', name: '', category: '', brand: '', model: '', year: '', conditionKey: '', description: '', features: '',
    specs: {}, images: [], documents: [], price: '', currency: 'NGN', negotiable: false, quantity: '1', minOrder: '',
    deliveryAvailable: false, deliveryDetails: '', warranty: '', pickupAvailable: false,
    country: 'Nigeria', state: '', city: '', address: '', sellerName: '', sellerType: '', whatsapp: '', businessEmail: '', businessDescription: '',
    companyId: '',
    unit: 'day', deposit: '', minPeriod: '', maxPeriod: '', operatorIncluded: null, fuelIncluded: null, transportFee: '', maintenance: '',
    availableForRent: true, availableFrom: '', availableUntil: '', availableDays: [], operatingHours: '', bookingNotice: '',
    serviceArea: '', pickupLocation: '', experience: '', operatorQualifications: '', extraInfo: '',
    serviceCategory: '', brandsSupported: '', priceMode: 'fixed',
  }
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export function formFromRow(r: EquipmentRow): Form {
  const kind = TYPE_TO_KIND[r.listing_type]
  const f = emptyForm(kind)
  return {
    ...f,
    status: r.status,
    name: r.name,
    category: str(r.category),
    brand: str(r.brand),
    model: str(r.model),
    year: str(r.year_made),
    conditionKey: conditionKeyOf(r.condition, r.condition_grade),
    description: str(r.description),
    features: str(r.features),
    specs: { ...(r.specs || {}) },
    images: r.images || [],
    documents: r.documents || [],
    price: kind === 'service' && r.price_mode === 'quote' ? '' : str(r.price),
    currency: r.currency || 'NGN',
    negotiable: !!r.negotiable,
    quantity: str(r.quantity),
    minOrder: str(r.min_order_qty),
    deliveryAvailable: !!r.delivery_available,
    deliveryDetails: str(r.delivery_details),
    warranty: str(r.warranty),
    pickupAvailable: !!r.pickup_available,
    country: str(r.country) || 'Nigeria',
    state: str(r.state),
    city: str(r.city),
    address: str(r.address),
    sellerName: str(r.seller_name),
    sellerType: str(r.seller_type),
    whatsapp: str(r.whatsapp),
    businessEmail: str(r.business_email),
    businessDescription: str(r.business_description),
    companyId: str(r.company_id),
    unit: r.unit && kind === 'rent' ? r.unit : 'day',
    deposit: str(r.security_deposit),
    minPeriod: str(r.min_rental_period),
    maxPeriod: str(r.max_rental_period),
    operatorIncluded: r.operator_included,
    fuelIncluded: r.fuel_included,
    transportFee: str(r.transport_fee),
    maintenance: str(r.maintenance_terms),
    availableForRent: r.status !== 'unavailable',
    availableFrom: str(r.available_from),
    availableUntil: str(r.available_until),
    availableDays: r.available_days || [],
    operatingHours: str(r.operating_hours),
    bookingNotice: str(r.booking_notice),
    serviceArea: str(r.service_area),
    pickupLocation: str(r.pickup_location),
    experience: str(r.experience),
    operatorQualifications: str(r.operator_qualifications),
    extraInfo: str(r.extra_info),
    serviceCategory: str(r.service_category),
    brandsSupported: str(r.brands_supported),
    priceMode: r.price_mode || 'fixed',
  }
}

const nz = (s: string): string | null => (s.trim() === '' ? null : s.trim())
const num = (s: string): number | null => (s.trim() === '' ? null : Number(s))

// The row to save. Fields that do not belong to the chosen listing type are always saved empty,
// so a sale listing never carries rental terms and the other way round.
export function toPayload(f: Form, status: DbStatus): Record<string, unknown> {
  const isSale = f.kind === 'sale'
  const isRent = f.kind === 'rent'
  const isService = f.kind === 'service'
  const cond = CONDITION_OPTIONS.find((o) => o.key === f.conditionKey)
  const specs: Record<string, string> = {}
  for (const k of Object.keys(f.specs)) if (f.specs[k] && f.specs[k].trim()) specs[k] = f.specs[k].trim()

  const priceIsQuote = isService && f.priceMode === 'quote'
  return {
    listing_type: KIND_TO_TYPE[f.kind],
    status,
    name: f.name.trim(),
    category: isService ? null : nz(f.category),
    service_category: isService ? nz(f.serviceCategory) : null,
    brand: isService ? null : nz(f.brand),
    model: isService ? null : nz(f.model),
    year_made: isService ? null : num(f.year),
    condition: isService ? null : cond?.condition ?? null,
    condition_grade: isService ? null : cond?.grade ?? null,
    description: nz(f.description),
    features: isService ? null : nz(f.features),
    specs: isService || Object.keys(specs).length === 0 ? null : specs,
    images: f.images,
    documents: isSale && f.documents.length ? f.documents : null,
    price: priceIsQuote ? 0 : num(f.price) ?? 0,
    currency: f.currency,
    price_mode: isService ? f.priceMode : null,
    unit: isRent ? f.unit : null,
    negotiable: isSale ? f.negotiable : false,
    quantity: isSale ? num(f.quantity) : null,
    min_order_qty: isSale ? num(f.minOrder) : null,
    delivery_available: isService ? false : f.deliveryAvailable,
    delivery_details: !isService && f.deliveryAvailable ? nz(f.deliveryDetails) : null,
    warranty: isSale ? nz(f.warranty) : null,
    pickup_available: isSale ? f.pickupAvailable : false,
    country: nz(f.country),
    state: nz(f.state),
    city: nz(f.city),
    address: nz(f.address),
    location: [f.city.trim(), f.state.trim()].filter(Boolean).join(', ') || null,
    seller_name: nz(f.sellerName),
    seller_type: nz(f.sellerType),
    whatsapp: nz(cleanPhone(f.whatsapp)),
    business_email: nz(f.businessEmail),
    business_description: isSale ? nz(f.businessDescription) : null,
    company_id: nz(f.companyId),
    // rental
    security_deposit: isRent ? num(f.deposit) : null,
    min_rental_period: isRent ? num(f.minPeriod) : null,
    max_rental_period: isRent ? num(f.maxPeriod) : null,
    operator_included: isRent ? f.operatorIncluded : null,
    fuel_included: isRent ? f.fuelIncluded : null,
    transport_fee: isRent && f.deliveryAvailable ? num(f.transportFee) : null,
    maintenance_terms: isRent ? nz(f.maintenance) : null,
    available_from: isRent ? nz(f.availableFrom) : null,
    available_until: isRent ? nz(f.availableUntil) : null,
    available_days: isRent && f.availableDays.length ? f.availableDays : null,
    operating_hours: isRent ? nz(f.operatingHours) : null,
    booking_notice: isRent ? nz(f.bookingNotice) : null,
    pickup_location: isRent ? nz(f.pickupLocation) : null,
    operator_qualifications: isRent ? nz(f.operatorQualifications) : null,
    // rental + service
    service_area: isSale ? null : nz(f.serviceArea),
    experience: isSale ? null : nz(f.experience),
    extra_info: isSale ? null : nz(f.extraInfo),
    brands_supported: isService ? nz(f.brandsSupported) : null,
  }
}

// ---------------------------------------------------------------------------------------------
// Validation. Messages are shown inline under each field. The database repeats the important checks.

export type Errors = Record<string, string>

function isInt(s: string): boolean {
  return /^\d+$/.test(s.trim())
}

export function validateForm(f: Form, mode: 'draft' | 'publish'): Errors {
  const e: Errors = {}
  const isSale = f.kind === 'sale'
  const isRent = f.kind === 'rent'
  const isService = f.kind === 'service'
  const publish = mode === 'publish'
  const thisYear = new Date().getFullYear()

  const name = f.name.trim()
  if (name.length < 3) e.name = isService ? 'Enter the service name (at least 3 characters).' : 'Enter the equipment name (at least 3 characters).'
  else if (name.length > 100) e.name = 'Keep the name under 100 characters.'

  // numbers that are filled in must always make sense, even for a draft
  if (f.price.trim() !== '') {
    const p = Number(f.price)
    if (Number.isNaN(p) || p < 0 || p > 1e12) e.price = 'Enter a valid price.'
  }
  if (!CURRENCIES.includes(f.currency)) e.currency = 'Choose a supported currency.'
  if (f.year.trim() !== '' && (!isInt(f.year) || Number(f.year) < 1900 || Number(f.year) > thisYear + 1)) e.year = `Enter a year between 1900 and ${thisYear + 1}.`
  if (isSale) {
    if (f.quantity.trim() !== '' && (!isInt(f.quantity) || Number(f.quantity) < 1 || Number(f.quantity) > 100000)) e.quantity = 'Quantity must be a whole number of 1 or more.'
    if (f.minOrder.trim() !== '') {
      if (!isInt(f.minOrder) || Number(f.minOrder) < 1) e.minOrder = 'Minimum order must be a whole number of 1 or more.'
      else if (!e.quantity && f.quantity.trim() !== '' && Number(f.minOrder) > Number(f.quantity)) e.minOrder = 'Minimum order cannot be more than the quantity available.'
    }
  }
  if (isRent) {
    for (const [key, val, msg] of [['deposit', f.deposit, 'security deposit'], ['transportFee', f.transportFee, 'transportation fee']] as const) {
      if (val.trim() !== '' && (Number.isNaN(Number(val)) || Number(val) < 0)) e[key] = `Enter a valid ${msg}.`
    }
    if (f.minPeriod.trim() !== '' && (!isInt(f.minPeriod) || Number(f.minPeriod) < 1)) e.minPeriod = 'Enter a whole number of 1 or more.'
    if (f.maxPeriod.trim() !== '') {
      if (!isInt(f.maxPeriod) || Number(f.maxPeriod) < 1) e.maxPeriod = 'Enter a whole number of 1 or more.'
      else if (!e.minPeriod && f.minPeriod.trim() !== '' && Number(f.maxPeriod) < Number(f.minPeriod)) e.maxPeriod = 'Maximum cannot be shorter than the minimum.'
    }
    if (f.availableFrom && f.availableUntil && f.availableUntil < f.availableFrom) e.availableUntil = 'This date cannot be before “Available from”.'
  }
  if (f.whatsapp.trim() !== '') {
    const pe = validatePhone(f.whatsapp)
    if (pe) e.whatsapp = pe
  }
  if (f.businessEmail.trim() !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.businessEmail.trim())) e.businessEmail = 'Enter a valid email address.'
  if (f.description.length > 2000) e.description = 'Keep the description under 2000 characters.'

  if (!publish) return e

  // required to publish
  if (isService) {
    if (!f.serviceCategory) e.serviceCategory = 'Choose a service category.'
    if (!f.serviceArea.trim()) e.serviceArea = 'Tell buyers which areas you serve.'
    if (!f.priceMode) e.priceMode = 'Choose a pricing method.'
    if (f.priceMode && f.priceMode !== 'quote' && !(Number(f.price) > 0)) e.price = 'Enter a price greater than zero.'
  } else {
    if (!f.category) e.category = 'Choose a category.'
    if (!f.conditionKey) e.conditionKey = 'Choose the condition.'
    if (!(Number(f.price) > 0)) e.price = isRent ? 'Enter the rental rate.' : 'Enter the selling price.'
    if (f.images.length < 1) e.images = 'Add at least one photo.'
  }
  if (isSale && !e.quantity && f.quantity.trim() === '') e.quantity = 'Enter the quantity available.'
  if (isRent && !f.unit) e.unit = 'Choose how the rate is charged.'
  if (f.description.trim().length < 10) e.description = 'Add a description of at least 10 characters.'
  if (!f.country.trim()) e.country = 'Choose the country.'
  if (!f.state.trim()) e.state = 'Enter the state or region.'
  if (!f.city.trim()) e.city = 'Enter the city or town.'
  if (!f.sellerName.trim()) e.sellerName = isService ? 'Enter your business or provider name.' : isRent ? 'Enter the provider or business name.' : 'Enter the seller or business name.'
  if (!f.whatsapp.trim()) e.whatsapp = 'Add a phone number buyers can reach you on.'
  return e
}

export type StepDef = { key: string; title: string; fields: string[] }

export const STEPS: Record<Kind, StepDef[]> = {
  sale: [
    { key: 'info', title: 'Equipment information', fields: ['name', 'category', 'brand', 'model', 'year', 'conditionKey', 'description', 'features', 'specs'] },
    { key: 'media', title: 'Images and documents', fields: ['images', 'documents'] },
    { key: 'price', title: 'Price and sale details', fields: ['price', 'currency', 'quantity', 'minOrder', 'deliveryDetails', 'warranty'] },
    { key: 'place', title: 'Location', fields: ['country', 'state', 'city', 'address'] },
    { key: 'seller', title: 'Seller information', fields: ['sellerName', 'sellerType', 'whatsapp', 'businessEmail', 'businessDescription'] },
    { key: 'review', title: 'Review and submit', fields: [] },
  ],
  rent: [
    { key: 'info', title: 'Equipment details', fields: ['name', 'category', 'brand', 'model', 'conditionKey', 'description', 'images', 'specs'] },
    { key: 'price', title: 'Rental pricing', fields: ['price', 'currency', 'unit', 'deposit', 'minPeriod', 'maxPeriod', 'transportFee', 'deliveryDetails', 'maintenance'] },
    { key: 'avail', title: 'Availability', fields: ['availableFrom', 'availableUntil', 'operatingHours', 'bookingNotice'] },
    { key: 'place', title: 'Rental location', fields: ['country', 'state', 'city', 'serviceArea', 'pickupLocation'] },
    { key: 'seller', title: 'Provider details', fields: ['sellerName', 'sellerType', 'whatsapp', 'businessEmail', 'experience', 'operatorQualifications', 'extraInfo'] },
    { key: 'review', title: 'Review and submit', fields: [] },
  ],
  service: [
    { key: 'info', title: 'Service details', fields: ['name', 'serviceCategory', 'description', 'brandsSupported', 'experience'] },
    { key: 'price', title: 'Pricing', fields: ['priceMode', 'price', 'currency'] },
    { key: 'place', title: 'Areas and location', fields: ['serviceArea', 'country', 'state', 'city', 'address'] },
    { key: 'media', title: 'Photos and contact', fields: ['images', 'sellerName', 'sellerType', 'whatsapp', 'businessEmail'] },
    { key: 'review', title: 'Review and submit', fields: [] },
  ],
}

export function stepOfField(kind: Kind, field: string): number {
  const i = STEPS[kind].findIndex((s) => s.fields.includes(field))
  return i < 0 ? 0 : i
}

export function stepErrors(kind: Kind, step: number, all: Errors): Errors {
  const fields = STEPS[kind][step]?.fields || []
  const out: Errors = {}
  for (const k of Object.keys(all)) if (fields.includes(k)) out[k] = all[k]
  return out
}

// Allowed file types and size for supporting documents (images are checked and shrunk by the uploader)
export const DOC_MAX_MB = 8
export const DOC_MAX_COUNT = 5
