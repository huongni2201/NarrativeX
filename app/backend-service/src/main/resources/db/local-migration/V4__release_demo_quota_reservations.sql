-- Local/demo fixture repair only. These seeded reservations represent example jobs,
-- not work submitted by the current user, and must not consume the demo account's
-- concurrent expensive-job quota when exercising the real analysis flow.
UPDATE quota_reservations
   SET status = 'RELEASED',
       actual_cost = 0,
       billing_currency = COALESCE(billing_currency, 'USD'),
       finalized_at = COALESCE(finalized_at, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP,
       row_version = row_version + 1
 WHERE id IN (6103, 6104, 6109)
   AND generation_job_id IN (6003, 6004, 6009)
   AND status = 'RESERVED';
