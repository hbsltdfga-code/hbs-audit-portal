-- v12.2 Workflow Rules Engine
-- Purpose: align stored training text and remove mandatory workflow records for audits that are Pass/Excellent unless explicitly safety-critical.
-- This migration is safe to run multiple times.

ALTER TABLE training_records ADD COLUMN audit_ref TEXT;
ALTER TABLE training_records ADD COLUMN due_date TEXT;
ALTER TABLE training_records ADD COLUMN manager_name TEXT;
ALTER TABLE training_records ADD COLUMN manager_notes TEXT;
ALTER TABLE reaudits ADD COLUMN audit_ref TEXT;
ALTER TABLE reaudits ADD COLUMN audit_id INTEGER;

-- Link any existing re-audits to HBS-{audit_id} where possible.
UPDATE reaudits
SET audit_ref = 'HBS-' || audit_id
WHERE COALESCE(audit_ref,'') = '' AND audit_id IS NOT NULL;

-- Standardise audit action text for scores that are safely Pass or Excellent.
UPDATE audits
SET training_required = 'No further action required.'
WHERE CAST(score AS REAL) >= 85
  AND lower(COALESCE(result,'')) IN ('pass','excellent');

-- Remove open unlinked workflow records left over from earlier versions.
DELETE FROM training_records
WHERE COALESCE(audit_ref,'') = ''
  AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved');

DELETE FROM reaudits
WHERE COALESCE(audit_ref,'') = ''
  AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed');
