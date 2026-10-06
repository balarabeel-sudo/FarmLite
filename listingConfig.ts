// Everything the Create Listing form and the product page need to know about each category.
// One place to add a category, a field or an option.

export type CategoryKey = 'crop' | 'livestock' | 'equipment' | 'seed' | 'products' | 'services' | 'other'

export const CATEGORIES: { key: CategoryKey; label: string; short: string; desc: string; icon: string }[] = [
  { key: 'crop', label: 'Crops & Produce', short: 'Crops', desc: 'Fresh farm produce and harvested crops.', icon: 'leaf' },
  { key: 'livestock', label: 'Livestock', short: 'Livestock', desc: 'Animals available for sale.', icon: 'paw' },
  { key: 'equipment', label: 'Farm Equipment', short: 'Equipment', desc: 'Machines, tools and agricultural equipment.', icon: 'wrench' },
  { key: 'seed', label: 'Seeds & Inputs', short: 'Seeds & Inputs', desc: 'Seeds, fertilizers, agrochemicals and farm inputs.', icon: 'sprout' },
  { key: 'products', label: 'Agricultural Products', short: 'Products', desc: 'Processed and packaged agricultural products.', icon: 'box' },
  { key: 'services', label: 'Farm Services', short: 'Services', desc: 'Agricultural services offered by individuals or companies.', icon: 'handshake' },
  { key: 'other', label: 'Other', short: 'Other', desc: 'Other agriculture-related listings.', icon: 'grid' },
]

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label || key
}
export function categoryShort(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.short || key
}

// The "type" of the listing (stored in marketplace_listings.subcategory)
export const TYPE_FIELD: Record<CategoryKey, { label: string; options: string[] }> = {
  crop: { label: 'Crop type', options: ['Maize', 'Rice', 'Wheat', 'Beans', 'Sorghum', 'Millet', 'Tomato', 'Onion', 'Potato', 'Cassava', 'Yam', 'Vegetables', 'Fruits', 'Other'] },
  livestock: { label: 'Animal type', options: ['Cattle', 'Goat', 'Sheep', 'Chicken', 'Turkey', 'Fish', 'Rabbit', 'Pig', 'Camel', 'Other'] },
  equipment: { label: 'Equipment type', options: ['Tractor', 'Plough', 'Planter', 'Harvester', 'Irrigation Equipment', 'Water Pump', 'Sprayer', 'Generator', 'Processing Machine', 'Poultry Equipment', 'Livestock Equipment', 'Hand Tools', 'Other'] },
  seed: { label: 'Product type', options: ['Seeds', 'Fertilizer', 'Agrochemical', 'Pesticide', 'Herbicide', 'Fungicide', 'Animal Feed', 'Veterinary Product', 'Other'] },
  products: { label: 'Product type', options: ['Processed Rice', 'Packaged Maize', 'Groundnut Oil', 'Animal Feed', 'Flour', 'Processed Cassava', 'Dried Vegetables', 'Other'] },
  services: { label: 'Service type', options: ['Farm Labour', 'Tractor Services', 'Ploughing', 'Planting', 'Harvesting', 'Irrigation', 'Transportation', 'Agricultural Consulting', 'Veterinary Services', 'Farm Security', 'Processing', 'Storage', 'Other'] },
  other: { label: 'Listing type', options: [] }, // free text
}

export type FieldDef = {
  key: string
  label: string
  kind: 'select' | 'text' | 'number' | 'date' | 'textarea'
  options?: string[]
  placeholder?: string
  required?: boolean
  // only shown when this returns true
  showIf?: (d: Record<string, string>) => boolean
}

const PACKAGING = ['Bag / Sack', 'Crate', 'Basket', 'Loose / Bulk', 'Bottle / Container', 'Other']

// Only the fields that make sense for the chosen category are ever shown
export const DETAIL_FIELDS: Record<CategoryKey, FieldDef[]> = {
  crop: [
    { key: 'variety', label: 'Variety', kind: 'text', placeholder: 'e.g. White, Yellow' },
    { key: 'grade', label: 'Quality / Grade', kind: 'select', options: ['Premium Quality', 'Grade A', 'Grade B', 'Grade C', 'Standard', 'Not graded'] },
    { key: 'harvest_date', label: 'Harvest date', kind: 'date' },
    { key: 'production_method', label: 'Production method', kind: 'select', options: ['Conventional', 'Organic', 'Mixed', 'Other'] },
    { key: 'packaging', label: 'Packaging', kind: 'select', options: PACKAGING },
    { key: 'availability', label: 'Availability', kind: 'select', options: ['Available now', 'Pre-order', 'Seasonal'] },
  ],
  livestock: [
    { key: 'breed', label: 'Breed', kind: 'text', placeholder: 'e.g. Sokoto Red' },
    { key: 'age', label: 'Age', kind: 'text', placeholder: 'e.g. 8 months' },
    { key: 'gender', label: 'Gender', kind: 'select', options: ['Male', 'Female', 'Mixed'] },
    { key: 'health_status', label: 'Health status', kind: 'select', options: ['Healthy', 'Under treatment', 'Not sure'] },
    { key: 'vaccination', label: 'Vaccination status', kind: 'select', options: ['Fully vaccinated', 'Partially vaccinated', 'Not vaccinated', 'Unknown'] },
    { key: 'weight', label: 'Weight', kind: 'number', placeholder: 'e.g. 45' },
    { key: 'weight_unit', label: 'Weight unit', kind: 'select', options: ['kg', 'lb'] },
    { key: 'purpose', label: 'Production purpose', kind: 'select', options: ['Breeding', 'Meat', 'Milk', 'Eggs', 'Other'] },
  ],
  equipment: [
    { key: 'brand', label: 'Brand', kind: 'text', placeholder: 'e.g. Massey Ferguson' },
    { key: 'model', label: 'Model', kind: 'text' },
    { key: 'year', label: 'Year', kind: 'number', placeholder: 'e.g. 2019' },
    { key: 'condition', label: 'Condition', kind: 'select', options: ['New', 'Used', 'Refurbished'], required: true },
    { key: 'usage_hours', label: 'Usage hours', kind: 'number', showIf: (d) => !!d.condition && d.condition !== 'New' },
    { key: 'condition_details', label: 'Condition details', kind: 'textarea', placeholder: 'Describe wear, repairs or faults', showIf: (d) => !!d.condition && d.condition !== 'New' },
    { key: 'power', label: 'Power / capacity', kind: 'text', placeholder: 'e.g. 75 HP' },
    { key: 'fuel_type', label: 'Fuel type', kind: 'select', options: ['Diesel', 'Petrol', 'Electric', 'Solar', 'Manual', 'Other'] },
    { key: 'availability', label: 'Availability', kind: 'select', options: ['Available now', 'Reserved'] },
  ],
  seed: [
    { key: 'brand', label: 'Brand', kind: 'text' },
    { key: 'product_name', label: 'Product name', kind: 'text' },
    { key: 'crop_application', label: 'Crop / application', kind: 'text', placeholder: 'e.g. Maize, general use' },
    { key: 'packaging', label: 'Packaging', kind: 'select', options: PACKAGING },
    { key: 'expiry_date', label: 'Expiry date', kind: 'date' },
    { key: 'certification', label: 'Registration / certification (if any)', kind: 'text' },
  ],
  products: [
    { key: 'product_name', label: 'Product name', kind: 'text' },
    { key: 'brand', label: 'Brand', kind: 'text' },
    { key: 'ingredients', label: 'Ingredients (if applicable)', kind: 'textarea' },
    { key: 'packaging', label: 'Packaging', kind: 'select', options: PACKAGING },
    { key: 'production_date', label: 'Production date', kind: 'date' },
    { key: 'expiry_date', label: 'Expiry date', kind: 'date' },
    { key: 'certification', label: 'Quality / certification (if any)', kind: 'text' },
  ],
  services: [
    { key: 'service_area', label: 'Service area', kind: 'text', placeholder: 'e.g. Kaduna and nearby towns', required: true },
    { key: 'availability', label: 'Availability', kind: 'select', options: ['Every day', 'Weekdays', 'Weekends', 'By appointment'] },
    { key: 'experience', label: 'Experience', kind: 'select', options: ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', 'More than 10 years'] },
    { key: 'equipment_available', label: 'Equipment available', kind: 'text', placeholder: 'e.g. Tractor, sprayer' },
    { key: 'contact_method', label: 'How should buyers contact you?', kind: 'select', options: ['Message me on FarmLite', 'Call me'] },
  ],
  other: [
    { key: 'extra', label: 'More details', kind: 'textarea', placeholder: 'Anything buyers should know' },
  ],
}

// Quantity-based categories show quantity and minimum order
export const USES_QUANTITY: Record<CategoryKey, boolean> = {
  crop: true, livestock: true, seed: true, products: true, equipment: false, services: false, other: false,
}

const WEIGHT_UNITS = ['kg', 'ton', 'bag', 'sack', 'crate', 'basket', 'litre', 'piece']

// Units used for price and quantity ('' = no unit). Services use a pricing model instead.
export const UNITS: Record<CategoryKey, string[]> = {
  crop: WEIGHT_UNITS,
  livestock: ['head', 'kg', 'piece'],
  seed: WEIGHT_UNITS,
  products: WEIGHT_UNITS,
  equipment: [],
  services: ['hour', 'day', 'acre', 'hectare', 'job'],
  other: [],
}

export const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES']

export const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'Niger', 'Cameroon', 'Benin', 'Togo', 'Senegal', 'Mali', 'Chad', 'Tanzania', 'Uganda', 'South Africa', 'United States', 'United Kingdom', 'Other']

export function unitText(unit: string | null | undefined): string {
  return unit ? `per ${unit}` : ''
}

export type ListingLike = {
  price: number | string
  currency: string
  unit: string | null
  contact_for_price?: boolean | null
}

// "NGN 350,000 / per ton", or "Contact seller"
export function priceText(l: ListingLike): string {
  if (l.contact_for_price) return 'Contact seller'
  const base = `${l.currency} ${Number(l.price).toLocaleString()}`
  return l.unit ? `${base} / ${unitText(l.unit)}` : base
}

// Label / value rows for the product page and review step (only filled-in values)
export function detailRows(category: string, details: Record<string, unknown> | null | undefined, condition?: string | null): { label: string; value: string }[] {
  const d = (details || {}) as Record<string, string>
  const fields = DETAIL_FIELDS[category as CategoryKey] || []
  const rows: { label: string; value: string }[] = []
  for (const f of fields) {
    let v = d[f.key]
    if (f.key === 'condition' && !v && condition) v = condition
    if (!v || (f.showIf && !f.showIf(d))) continue
    if (f.key === 'weight' && d.weight_unit) v = `${v} ${d.weight_unit}`
    if (f.key === 'weight_unit') continue
    if (f.kind === 'date') {
      const dt = new Date(v)
      if (!Number.isNaN(dt.getTime())) v = dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric', day: f.key === 'harvest_date' ? undefined : 'numeric' })
    }
    rows.push({ label: f.label.replace(' (if any)', '').replace(' (if applicable)', ''), value: v })
  }
  return rows
}
