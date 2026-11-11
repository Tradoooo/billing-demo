/**
 * invoice.ts — the invoice domain of the acme-billing demo fixture.
 *
 * This file is one of the deliberate HOTSPOTS of the "Chantiers en collision"
 * demo: in the scripted scenario, one agent renames the `total` field of the
 * `Invoice` shape to `total_cents` while a second agent edits the same file on
 * another ticket. The app then answers `caution` / D2 and names the neighbour.
 *
 * All money amounts are integers, in minor units (cents). Never floats.
 */

export type Currency = "EUR" | "USD" | "GBP";

export interface LineItem {
  /** Stock keeping unit, e.g. "SUB-PRO-1M". */
  sku: string;
  /** Human readable label shown on the printed invoice. */
  label: string;
  /** Number of units; may be fractional for metered lines. */
  quantity: number;
  /** Price of one unit, in cents. */
  unitPriceCents: number;
}

export interface Invoice {
  id: string;
  customer: string;
  currency: Currency;
  lines: LineItem[];
  /** Sum of the lines, before tax, in cents. */
  subtotalCents: number;
  /** Tax amount, in cents. */
  taxCents: number;
  /**
   * Amount due, in cents (subtotal + tax).
   *
   * NOTE for the demo: this field is named `total` today. The scripted collision
   * renames it to `total_cents` (see db/migrations/0002_add_total.sql) while a
   * second agent is editing this very file.
   */
  total: number;
  /** ISO-8601 timestamp. */
  issuedAt: string;
}

export interface CreateInvoiceInput {
  customer: string;
  currency?: Currency;
  lines: LineItem[];
  /** Tax rate as a fraction, e.g. 0.2 for 20 %. Defaults to 0. */
  taxRate?: number;
  /** Optional fixed timestamp, mostly for deterministic tests. */
  now?: string;
}

/** Monotonic counter so the fixture generates readable ids without randomness. */
let sequence = 0;

/** Reset the id counter (used by tests and by the demo scenario). */
export function resetInvoiceSequence(): void {
  sequence = 0;
}

export function lineTotalCents(line: LineItem): number {
  const raw = line.quantity * line.unitPriceCents;
  return Math.round(raw);
}

export function subtotalCents(lines: readonly LineItem[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

export function taxAmountCents(amountCents: number, taxRate: number): number {
  if (!Number.isFinite(taxRate) || taxRate <= 0) return 0;
  return Math.round(amountCents * taxRate);
}

/**
 * totalCents — amount due for a set of lines, tax included.
 *
 * Demo hotspot: the rename scenario changes the callers of this function and the
 * `Invoice.total` field at the same time, which is exactly the kind of edit two
 * agents must not perform concurrently without being warned.
 */
export function totalCents(lines: readonly LineItem[], taxRate = 0): number {
  const subtotal = subtotalCents(lines);
  return subtotal + taxAmountCents(subtotal, taxRate);
}

export function nextInvoiceId(now: string): string {
  sequence += 1;
  const stamp = now.slice(0, 10).replace(/-/g, "");
  const index = String(sequence).padStart(4, "0");
  return `inv_${stamp}_${index}`;
}

export function createInvoice(input: CreateInvoiceInput): Invoice {
  if (input.lines.length === 0) {
    throw new Error("createInvoice: an invoice needs at least one line");
  }
  const issuedAt = input.now ?? new Date().toISOString();
  const lines = input.lines.map((line) => ({ ...line }));
  const subtotal = subtotalCents(lines);
  const tax = taxAmountCents(subtotal, input.taxRate ?? 0);
  return {
    id: nextInvoiceId(issuedAt),
    customer: input.customer,
    currency: input.currency ?? "EUR",
    lines,
    subtotalCents: subtotal,
    taxCents: tax,
    total: subtotal + tax,
    issuedAt,
  };
}

/** Render a cent amount the way the printed invoice does. */
export function formatAmount(cents: number, currency: Currency): string {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  const value = (cents / 100).toFixed(2);
  return `${value} ${symbol}`;
}
