const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function formatPeso(amount: number): string {
  return PESO.format(amount);
}
