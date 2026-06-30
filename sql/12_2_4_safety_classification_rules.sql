-- v12.2.4 Safety classification workflow correction
-- Removes open workflow records incorrectly created from Pass / Excellent audits.
-- Completed historic records are preserved.

DELETE FROM training_records
WHERE lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved')
  AND COALESCE(audit_ref,'') IN (
    SELECT 'HBS-' || id
    FROM audits
    WHERE CAST(COALESCE(score,0) AS REAL) >= 85
      AND lower(COALESCE(result,'')) IN ('pass','excellent')
  );

DELETE FROM reaudits
WHERE lower(COALESCE(status,'Open')) NOT IN ('completed','closed')
  AND COALESCE(audit_ref,'') IN (
    SELECT 'HBS-' || id
    FROM audits
    WHERE CAST(COALESCE(score,0) AS REAL) >= 85
      AND lower(COALESCE(result,'')) IN ('pass','excellent')
  );

UPDATE audits
SET training_required='No further action required.'
WHERE CAST(COALESCE(score,0) AS REAL) >= 85
  AND lower(COALESCE(result,'')) IN ('pass','excellent');
