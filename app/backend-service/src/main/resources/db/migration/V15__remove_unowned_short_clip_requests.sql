-- No backend, worker or Desktop runtime owns short_clip_requests. The table was a planned
-- execution queue whose producer/consumer never shipped; durable render output is represented by
-- generation jobs and final_artifacts instead.
DROP TABLE IF EXISTS short_clip_requests;
