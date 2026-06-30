-- HBS Compliance Manager v12.1.3
-- D1 schema alignment for audit-linked training workflow.
-- If any ALTER statement reports a duplicate column, it is safe to ignore because the column already exists.

ALTER TABLE training_records ADD COLUMN audit_ref TEXT;
ALTER TABLE training_records ADD COLUMN due_date TEXT;
ALTER TABLE training_records ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE reaudits ADD COLUMN audit_ref TEXT;
ALTER TABLE reaudits ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Backfill missing audit references where possible.
UPDATE training_records
SET audit_ref = 'HBS-' || id
WHERE audit_ref IS NULL OR audit_ref = '';

UPDATE reaudits
SET audit_ref = 'HBS-' || audit_id
WHERE (audit_ref IS NULL OR audit_ref = '') AND audit_id IS NOT NULL;
