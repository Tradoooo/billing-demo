/**
 * index.ts — entry point of the acme-billing demo fixture.
 *
 * It wires the three zones of the repository together:
 *   src/billing/  the invoicing domain (hotspots: invoice.ts, routes.ts)
 *   src/auth/     the fake login (a quiet zone, for `free` verdicts)
 *   src/i18n/     the fr/en catalogue (a translation hotspot)
 *
 * There is no HTTP server and no npm dependency: `npm run build` only
 * typechecks and emits to dist/. Run `node dist/index.js` to see the fixture
 * print a short demo trace.
 */

import { can, login, logout, sessionFor } from "./auth/login";
import { describeRoutes, findRoute } from "./billing/routes";
import { BillingService } from "./billing/service";
import messages from "./i18n/messages.json";

export type Locale = "en" | "fr";

const DEMO_LINES = [
  { sku: "SUB-PRO-1M", label: "Pro subscription (1 month)", quantity: 2, unitPriceCents: 2900 },
  { sku: "SUP-EMAIL", label: "Extra mailbox", quantity: 5, unitPriceCents: 150 },
];

/** Look up a message; falls back to the key itself when it is missing. */
export function t(locale: Locale, key: string): string {
  const catalog = messages as Record<Locale, Record<string, string>>;
  return catalog[locale]?.[key] ?? key;
}

export function createApp(): BillingService {
  return new BillingService();
}

function trace(locale: Locale): string[] {
  const service = createApp();
  const session = login("lea@acme.test", "demo-admin");
  const lines: string[] = [];

  lines.push(`${t(locale, "app.name")} — ${t(locale, "app.tagline")}`);
  if (session) {
    lines.push(`${t(locale, "auth.welcome")} ${session.name} (${session.role})`);
    lines.push(`admin rights: ${can(session, "admin") ? "yes" : "no"}`);
    sessionFor(session.token);
    logout(session.token);
  } else {
    lines.push(t(locale, "auth.loginFailed"));
  }

  service.setCustomerCountry("acme-sarl", "FR");
  const invoice = service.createInvoice({ customer: "acme-sarl", lines: DEMO_LINES });
  lines.push(`${t(locale, "invoice.subtotal")}: ${invoice.subtotalCents} cents`);
  lines.push(`${t(locale, "invoice.tax")}: ${invoice.taxCents} cents`);
  lines.push(`${t(locale, "invoice.total")}: ${invoice.total} cents`);

  const totalRoute = findRoute("GET", "/invoices/:id/total");
  lines.push(`route for the amount due: ${totalRoute ? totalRoute.path : "missing"}`);
  lines.push(t(locale, "routes.title") + ":");
  for (const line of describeRoutes()) lines.push(`  ${line}`);
  return lines;
}

export function main(locale: Locale = "en"): string {
  return trace(locale).join("\n");
}

declare const console: { log(message?: unknown): void };

console.log(main("en"));
console.log("");
console.log(main("fr"));
