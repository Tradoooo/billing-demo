/**
 * routes.ts — the HTTP route table of acme-billing.
 *
 * HOTSPOT FILE. Every endpoint of the service is declared in this single table,
 * which is exactly the shape that produces collisions: two agents adding two
 * different features both append a route here, and the diff always overlaps.
 * In the "Chantiers en collision" demo the app marks `src/billing/routes.ts` as
 * a hotspot and lowers the collision degree accordingly (advice, not blocking).
 *
 * No framework, no npm dependency: a plain array plus a tiny matcher.
 */

import type { LineItem } from "./invoice";
import type { BillingService } from "./service";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RouteContext {
  service: BillingService;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

export type RouteHandler = (ctx: RouteContext) => RouteResult;

export interface Route {
  method: HttpMethod;
  path: string;
  description: string;
  handler: RouteHandler;
}

const ok = (body: unknown): RouteResult => ({ status: 200, body });
const created = (body: unknown): RouteResult => ({ status: 201, body });
const badRequest = (message: string): RouteResult => ({ status: 400, body: { error: message } });
const notFound = (what: string): RouteResult => ({ status: 404, body: { error: `${what} not found` } });

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Parse and validate the `lines` array of a POST body. */
export function parseLines(value: unknown): LineItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const lines: LineItem[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (!record) return undefined;
    const sku = asString(record.sku);
    const label = asString(record.label);
    const quantity = asNumber(record.quantity);
    const unitPriceCents = asNumber(record.unitPriceCents);
    if (!sku || !label || quantity === undefined || unitPriceCents === undefined) return undefined;
    lines.push({ sku, label, quantity, unitPriceCents });
  }
  return lines;
}

const listInvoices: RouteHandler = ({ service }) => ok({ invoices: service.summaries() });

const getInvoice: RouteHandler = ({ service, params }) => {
  const invoice = service.getInvoice(params.id ?? "");
  return invoice ? ok({ invoice }) : notFound("invoice");
};

const createInvoiceRoute: RouteHandler = ({ service, body }) => {
  const record = asRecord(body);
  if (!record) return badRequest("body must be a JSON object");
  const customer = asString(record.customer);
  const lines = parseLines(record.lines);
  if (!customer) return badRequest("customer is required");
  if (!lines) return badRequest("lines must be a non-empty array of {sku,label,quantity,unitPriceCents}");
  const invoice = service.createInvoice({
    customer,
    country: asString(record.country),
    lines,
  });
  return created({ invoice });
};

const invoiceTotal: RouteHandler = ({ service, params }) => {
  const invoice = service.getInvoice(params.id ?? "");
  if (!invoice) return notFound("invoice");
  return ok({ id: invoice.id, totalCents: invoice.total, currency: invoice.currency });
};

const renderInvoice: RouteHandler = ({ service, params }) => {
  const invoice = service.getInvoice(params.id ?? "");
  if (!invoice) return notFound("invoice");
  return ok({ id: invoice.id, text: service.renderInvoice(invoice.id) });
};

const customerBalance: RouteHandler = ({ service, params }) => {
  const customer = params.customer ?? "";
  if (!customer) return badRequest("customer is required");
  return ok({ customer, balanceCents: service.customerBalance(customer) });
};

const setCustomerCountry: RouteHandler = ({ service, params, body }) => {
  const record = asRecord(body);
  const country = asString(record?.country);
  if (!country) return badRequest("country is required");
  const customer = params.customer ?? "";
  service.setCustomerCountry(customer, country);
  return ok({ customer, country: service.countryFor(customer) });
};

const previewCart: RouteHandler = ({ service, body }) => {
  const record = asRecord(body);
  if (!record) return badRequest("body must be a JSON object");
  const customer = asString(record.customer);
  const lines = parseLines(record.lines);
  if (!customer) return badRequest("customer is required");
  if (!lines) return badRequest("lines must be a non-empty array");
  return ok({
    subtotalCents: service.previewSubtotal(lines),
    totalCents: service.previewTotal(lines, customer),
  });
};

/** The route table itself — the hotspot. */
export const ROUTES: readonly Route[] = Object.freeze([
  { method: "GET", path: "/invoices", description: "List every invoice summary", handler: listInvoices },
  { method: "GET", path: "/invoices/:id", description: "Fetch one invoice", handler: getInvoice },
  { method: "POST", path: "/invoices", description: "Create an invoice", handler: createInvoiceRoute },
  { method: "GET", path: "/invoices/:id/total", description: "Amount due, in cents", handler: invoiceTotal },
  { method: "GET", path: "/invoices/:id/render", description: "Plain-text rendering", handler: renderInvoice },
  { method: "GET", path: "/customers/:customer/balance", description: "Outstanding balance", handler: customerBalance },
  { method: "PATCH", path: "/customers/:customer/country", description: "Set the billing country", handler: setCustomerCountry },
  { method: "POST", path: "/carts/preview", description: "Price a cart before invoicing", handler: previewCart },
] as Route[]);

/** Find a route by method and exact path (no parameter matching). */
export function findRoute(method: HttpMethod, path: string): Route | undefined {
  return ROUTES.find((route) => route.method === method && route.path === path);
}

/** Human readable index of the API, used by GET / in index.ts. */
export function describeRoutes(): string[] {
  return ROUTES.map((route) => `${route.method} ${route.path} — ${route.description}`);
}
