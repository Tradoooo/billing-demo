-- 0002_add_total.sql — denormalised amount due on invoices.
--
-- DEMO SCENARIO: this migration adds `total`. A second ticket renames that very
-- column to `total_cents` (src/billing/invoice.ts: Invoice.total -> total_cents)
-- while the first one is still open. That is the collision the app is supposed
-- to announce before either agent pushes.

ALTER TABLE invoices ADD COLUMN total INTEGER NOT NULL DEFAULT 0;

-- Backfill from the existing columns so the denormalised value is correct.
UPDATE invoices
   SET total = subtotal + tax
 WHERE total = 0;
