/**
 * tax.ts — tax rates and rounding helpers.
 *
 * Deliberately small and stable: the demo scenario does not touch it, which
 * makes it a good "quiet neighbour" in the worksite map.
 */

/** VAT rate per billing country, as a fraction. */
export const TAX_RATES: Readonly<Record<string, number>> = Object.freeze({
  FR: 0.2,
  DE: 0.19,
  ES: 0.21,
  GB: 0.2,
  US: 0.0725,
  CA: 0.05,
});

export const DEFAULT_COUNTRY = "FR";

/** Rate for a country; 0 when the country is unknown (exempt / out of scope). */
export function taxRateFor(country: string): number {
  const key = country.trim().toUpperCase();
  const rate = TAX_RATES[key];
  return typeof rate === "number" ? rate : 0;
}

export function isSupportedCountry(country: string): boolean {
  return Object.prototype.hasOwnProperty.call(TAX_RATES, country.trim().toUpperCase());
}

/** Tax amount in cents for a net amount in cents. */
export function taxCents(netCents: number, country: string): number {
  if (!Number.isFinite(netCents) || netCents <= 0) return 0;
  return Math.round(netCents * taxRateFor(country));
}

/** Gross amount (net + tax) in cents. */
export function grossCents(netCents: number, country: string): number {
  return netCents + taxCents(netCents, country);
}

/** Split a gross amount back into net and tax, in cents. */
export function splitGross(grossCentsTotal: number, country: string): { netCents: number; taxCents: number } {
  const rate = taxRateFor(country);
  const net = rate > 0 ? Math.round(grossCentsTotal / (1 + rate)) : grossCentsTotal;
  return { netCents: net, taxCents: grossCentsTotal - net };
}

/** Human label used on the invoice footer, e.g. "VAT 20 % (FR)". */
export function taxLabel(country: string): string {
  const rate = taxRateFor(country);
  const percent = Math.round(rate * 1000) / 10;
  return `VAT ${percent} % (${country.toUpperCase()})`;
}
