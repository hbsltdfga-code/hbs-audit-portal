-- HBS Compliance Manager v12.1.5
-- Remove legacy unlinked open training actions and duplicate workflow rows.
-- Completed/closed records are preserved.

UPDATE reaudits
SET audit_ref = 'HBS-' || audit_id
WHERE (audit_ref IS NULL OR audit_ref = '')
  AND audit_id IS NOT NULL;

DELETE FROM training_records
WHERE (audit_ref IS NULL OR audit_ref = '')
  AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved');

DELETE FROM reaudits
WHERE (audit_ref IS NULL OR audit_ref = '')
  AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed');

-- Keep only the newest open training record per engineer + audit + test type.
DELETE FROM training_records
WHERE id IN (
  SELECT t.id
  FROM training_records t
  JOIN training_records newer
    ON lower(COALESCE(t.engineer_name,'')) = lower(COALESCE(newer.engineer_name,''))
   AND COALESCE(t.audit_ref,'') = COALESCE(newer.audit_ref,'')
   AND COALESCE(t.training_type,'') = COALESCE(newer.training_type,'')
   AND newer.id > t.id
  WHERE COALESCE(t.audit_ref,'') <> ''
    AND lower(COALESCE(t.status,'Open')) NOT IN ('completed','closed','signed off','approved')
    AND lower(COALESCE(newer.status,'Open')) NOT IN ('completed','closed','signed off','approved')
);

-- Keep only the newest open re-audit per engineer + audit.
DELETE FROM reaudits
WHERE id IN (
  SELECT r.id
  FROM reaudits r
  JOIN reaudits newer
    ON lower(COALESCE(r.engineer_name,'')) = lower(COALESCE(newer.engineer_name,''))
   AND COALESCE(r.audit_ref,'') = COALESCE(newer.audit_ref,'')
   AND newer.id > r.id
  WHERE COALESCE(r.audit_ref,'') <> ''
    AND lower(COALESCE(r.status,'Open')) NOT IN ('completed','closed')
    AND lower(COALESCE(newer.status,'Open')) NOT IN ('completed','closed')
);
