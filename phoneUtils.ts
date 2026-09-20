// Phone helpers shared by ProfilePage and MarketplacePage.

export function cleanPhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '')
}

// Returns an error message, or null when the number is empty or valid.
export function validatePhone(raw: string): string | null {
  const v = cleanPhone(raw)
  if (!v) return null
  if (!/^\+?\d{8,15}$/.test(v)) return 'Enter a valid number, e.g. +2348012345678.'
  if (v.startsWith('0')) return 'Start with the country code, e.g. +234 instead of 0.'
  return null
}

export function whatsappLink(raw: string): string {
  return `https://wa.me/${cleanPhone(raw).replace('+', '')}`
}
