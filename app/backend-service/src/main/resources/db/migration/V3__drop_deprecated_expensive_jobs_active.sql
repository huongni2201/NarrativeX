-- Remove the obsolete usage_windows projection.
-- Active expensive jobs are derived from quota_reservations.status = 'RESERVED'.
ALTER TABLE usage_windows
    DROP COLUMN expensive_jobs_active;
