-- Preserve translation source lineage in the durable variant identity.
DROP INDEX IF EXISTS uq_chapter_content_variants_identity;

CREATE UNIQUE INDEX uq_chapter_original_variants_identity
    ON chapter_content_variants (chapter_id, language_code, content_hash)
    WHERE variant_type = 'ORIGINAL';

CREATE UNIQUE INDEX uq_chapter_translation_variants_lineage
    ON chapter_content_variants (
        chapter_id,
        source_variant_id,
        language_code,
        source_content_hash,
        content_hash
    )
    WHERE variant_type = 'TRANSLATION';
