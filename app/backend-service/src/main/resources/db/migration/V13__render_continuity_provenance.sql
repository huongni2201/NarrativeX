-- Pin continuity provenance into immutable project render input snapshots.

ALTER TABLE project_render_input_chapters
    ADD COLUMN continuity_plan_id UUID,
    ADD COLUMN continuity_report_revision INTEGER;

ALTER TABLE project_render_input_chapters
    ADD CONSTRAINT fk_project_render_input_chapter_continuity_plan
        FOREIGN KEY (continuity_plan_id)
        REFERENCES chapter_continuity_plans(id),
    ADD CONSTRAINT ck_project_render_input_chapter_continuity_report_revision
        CHECK (continuity_report_revision IS NULL OR continuity_report_revision > 0),
    ADD CONSTRAINT ck_project_render_input_chapter_continuity_pair
        CHECK (
            (continuity_plan_id IS NULL AND continuity_report_revision IS NULL)
            OR continuity_plan_id IS NOT NULL
        );

CREATE INDEX idx_project_render_input_chapters_continuity
    ON project_render_input_chapters (continuity_plan_id, continuity_report_revision)
    WHERE continuity_plan_id IS NOT NULL;
