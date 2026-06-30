-- v12.1.1 Workflow Backfill
-- Normalises historic training names. New API code backfills missing training and re-audits from audit outcomes.
UPDATE training_records
SET training_type = 'Level 1 - Commercial Gas Safety Refresher'
WHERE training_type LIKE '%Post-audit refresher%'
   OR training_type LIKE '%Toolbox%'
   OR training_type LIKE '%Level 1 Commercial%'
   OR training_type = 'Post-Audit Refresher Test';

UPDATE training_records
SET training_type = 'Level 2 - Advanced Commercial Gas Safety Competency Assessment'
WHERE training_type LIKE '%Level 2%'
   OR training_type LIKE '%Unsafe%'
   OR training_type LIKE '%Advanced%';
