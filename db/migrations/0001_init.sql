-- 0001_init.sql — base schema of the acme-billing demo fixture (SQLite dialect).
--
-- db/migrations/ is an EXCLUSIVE zone in the "Chantiers en collision" demo:
-- two agents adding two migrations at the same time get `wait` / D4, because a
-- migration that lands after another one silently changes what the first one
-- assumed. The reservation is released by its owner (or by its ETA).

CREATE TABLE customers (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    country     TEXT NOT NULL DEFAULT 'FR',
    currency    TEXT NOT NULL DEFAULT 'EUR',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
    id          TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    currency    TEXT NOT NULL DEFAULT 'EUR',
    subtotal    INTEGER NOT NULL DEFAULT 0,  -- cents, before tax
    tax         INTEGER NOT NULL DEFAULT 0,  -- cents
    status      TEXT NOT NULL DEFAULT 'draft',
    issued_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invoice_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id       TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    sku              TEXT NOT NULL,
    label            TEXT NOT NULL,
    quantity         REAL NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0
);
