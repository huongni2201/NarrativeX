-- Complete the persisted Chapter source contract used by the Chapter-first workflow.
ALTER TABLE chapters
    ADD COLUMN source_hash VARCHAR(64);

UPDATE chapters
SET source_text = ''
WHERE source_text IS NULL;

UPDATE chapters
SET source_hash = encode(sha256(convert_to(source_text, 'UTF8')), 'hex')
WHERE source_hash IS NULL;

ALTER TABLE chapters
    ALTER COLUMN source_text SET NOT NULL,
    ALTER COLUMN source_hash SET NOT NULL;

ALTER TABLE chapters
    ADD CONSTRAINT ck_chapters_source_hash_sha256
        CHECK (source_hash ~ '^[0-9a-f]{64}$');
