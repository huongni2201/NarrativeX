-- No backend, worker or Desktop runtime owns short_clip_requests. The table was a planned
-- execution queue whose producer/consumer never shipped; durable render output is represented by
-- generation jobs and final_artifacts instead.
--
-- Do not silently discard historical/shared-development rows. A non-empty table requires an
-- explicit archive/delete decision before this migration may proceed.
DO $$
DECLARE
    has_rows BOOLEAN := FALSE;
BEGIN
    IF to_regclass('public.short_clip_requests') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM short_clip_requests)' INTO has_rows;
        IF has_rows THEN
            RAISE EXCEPTION
                'V16 refuses to drop non-empty short_clip_requests; archive or delete rows explicitly first';
        END IF;
    END IF;
END
$$;

DROP TABLE IF EXISTS short_clip_requests;
