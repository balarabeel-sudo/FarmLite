// Shows a price in the currency it was listed in (NGN, USD, GHS, KES...).
export function formatMoney(amount: number, currency: string | null | undefined): string {
  const code = (currency || 'NGN').toUpperCase()
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${code} ${Number(amount).toLocaleString()}`
  }
}
