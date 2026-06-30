-- v13.0 Compliance Decision Engine
-- NCS is removed from workflow decisions.
-- AR no longer triggers automatic Level 2.
-- Level 2 is retained only for score below 75% or explicit ID / Gas Escape / Unsafe Situation classification.

-- Remove incorrect open Level 2 actions for audits scoring 75% or above where there is no explicit critical classification in the stored audit JSON.
DELETE FROM training_records
WHERE training_type = 'Level 2 - Advanced Commercial Gas Safety Competency Assessment'
  AND lower(COALESCE(status,'Open')) NOT IN ('completed','closed','signed off','approved')
  AND audit_ref IN (
    SELECT 'HBS-' || id
    FROM audits
    WHERE COALESCE(score,0) >= 75
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%IMMEDIATE DANGER%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%IMMEDIATELY DANGEROUS%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%GAS ESCAPE%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%UNSAFE SITUATION%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%"CLASSIFICATION":"ID"%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%"SAFETY_CLASSIFICATION":"ID"%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%"DEFECT_CLASSIFICATION":"ID"%'
  );

-- Remove open re-audits created only because of the old over-sensitive safety question logic, where audit is Pass/Excellent and not explicitly critical.
DELETE FROM reaudits
WHERE lower(COALESCE(status,'Open')) NOT IN ('completed','closed')
  AND audit_ref IN (
    SELECT 'HBS-' || id
    FROM audits
    WHERE COALESCE(score,0) >= 85
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%IMMEDIATE DANGER%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%IMMEDIATELY DANGEROUS%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%GAS ESCAPE%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%UNSAFE SITUATION%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%"CLASSIFICATION":"ID"%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%"SAFETY_CLASSIFICATION":"ID"%'
      AND upper(COALESCE(audit_json,'')) NOT LIKE '%"DEFECT_CLASSIFICATION":"ID"%'
  );
