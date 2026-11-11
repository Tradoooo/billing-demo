-- 0003_index_invoices.sql — read-path indexes for the invoice list and totals.
--
-- Third migration of the fixture: with 0002 open on another ticket, declaring
-- this file from a second agent lands in the same exclusive zone
-- (db/migrations/) and must produce `wait` / D4, not a silent merge.

CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_issued_at ON invoices(issued_at);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
