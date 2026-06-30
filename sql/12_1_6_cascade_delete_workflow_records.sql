-- v12.1.6 Cascade delete / orphan cleanup for audit workflow records
-- Safe to run more than once.

-- Remove training records linked to deleted audits by generated HBS reference.
DELETE FROM training_records
WHERE COALESCE(audit_ref, '') <> ''
AND NOT EXISTS (
  SELECT 1 FROM audits a
  WHERE ('HBS-' || a.id) = training_records.audit_ref
);

-- Remove re-audits linked to deleted audits by audit_id or generated HBS reference.
DELETE FROM reaudits
WHERE (
  audit_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM audits a WHERE a.id = reaudits.audit_id)
)
OR (
  COALESCE(audit_ref, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM audits a WHERE ('HBS-' || a.id) = reaudits.audit_ref)
);

-- Remove audit photos where the parent audit no longer exists.
DELETE FROM audit_photos
WHERE NOT EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_photos.audit_id);

-- Remove toolbox/test results that reference deleted HBS audits in answers_json.
DELETE FROM toolbox_results
WHERE COALESCE(answers_json, '') LIKE '%HBS-%'
AND NOT EXISTS (
  SELECT 1 FROM audits a
  WHERE toolbox_results.answers_json LIKE ('%HBS-' || a.id || '%')
);
