-- NarrativeX pre-release baseline: query/access-path indexes and index-backed invariants.
-- All referenced tables are created by V1-V5 and finalized by V6.

-- Local execution devices and desktop session runtime
CREATE INDEX idx_local_device_pairing_codes_user
    ON local_device_pairing_codes (user_id, created_at DESC);
CREATE INDEX idx_local_devices_user
    ON local_devices (user_id, created_at DESC);
CREATE INDEX idx_local_devices_last_seen
    ON local_devices (last_seen_at DESC)
    WHERE revoked_at IS NULL;
CREATE INDEX idx_desktop_guest_installations_last_seen
    ON desktop_guest_installations (last_seen_at DESC);
CREATE INDEX idx_desktop_auth_handoffs_expires_at
    ON desktop_auth_handoffs (expires_at);
CREATE UNIQUE INDEX SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);
CREATE INDEX SPRING_SESSION_ATTRIBUTES_IX1
    ON SPRING_SESSION_ATTRIBUTES (SESSION_PRIMARY_ID);

-- Projects and story structure
CREATE INDEX idx_projects_owner_status ON projects (owner_id, status);
CREATE INDEX idx_projects_owner_updated_id ON projects (owner_id, updated_at DESC, id DESC);
CREATE INDEX idx_projects_active_owner_updated_id
    ON projects (owner_id, updated_at DESC, id DESC)
    WHERE archived_at IS NULL;
CREATE INDEX idx_projects_owner_status_updated_active
    ON projects (owner_id, status, updated_at DESC, id DESC)
    WHERE archived_at IS NULL;
CREATE INDEX idx_projects_owner_created_active
    ON projects (owner_id, created_at ASC, id ASC)
    WHERE archived_at IS NULL;
CREATE INDEX idx_projects_owner_lower_name_active
    ON projects (owner_id, LOWER(name), id)
    WHERE archived_at IS NULL;
CREATE INDEX idx_project_favorites_project_user
    ON project_favorites (project_id, user_id);
CREATE UNIQUE INDEX uq_story_versions_one_active_per_project
    ON story_versions (project_id)
    WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_chapters_story_order_active
    ON chapters (story_version_id, order_index)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_chapters_deleted_at
    ON chapters (deleted_at)
    WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_chapter_creation_idempotency_chapter
    ON chapter_creation_idempotency (chapter_id)
    WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_storyboard_revisions_chapter_created
    ON storyboard_revisions (chapter_id, revision_number DESC);

-- Character, location and continuity models
CREATE INDEX idx_characters_owner_status ON characters (owner_id, status);
CREATE INDEX idx_character_versions_character_status
    ON character_versions (character_id, status);
CREATE INDEX idx_character_appearances_character_timeline
    ON character_appearances (character_id, timeline_key);
CREATE INDEX idx_project_characters_project_status ON project_characters (project_id, status);
CREATE INDEX idx_project_characters_character ON project_characters (character_id);
CREATE INDEX idx_project_locations_project_updated
    ON project_locations (project_id, updated_at DESC, id DESC);
CREATE INDEX idx_project_locations_active_project
    ON project_locations (project_id, id)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_project_assets_project_updated
    ON project_assets (project_id, updated_at DESC, id DESC);
CREATE INDEX idx_project_assets_active_project
    ON project_assets (project_id, id)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_project_character_ai_identity_entity
    ON project_character_ai_identities (project_id, project_character_id);
CREATE INDEX idx_project_location_ai_identity_entity
    ON project_location_ai_identities (project_id, project_location_id);
CREATE INDEX idx_scenes_chapter_status ON scenes (chapter_id, status);
CREATE INDEX idx_scenes_revision_status ON scenes (storyboard_revision_id, status);
CREATE INDEX idx_scenes_project_location
    ON scenes (project_location_id)
    WHERE project_location_id IS NOT NULL;
CREATE INDEX idx_scene_characters_project_character
    ON scene_characters (project_character_id);
CREATE INDEX idx_visual_beats_scene_review_order
    ON visual_beats (scene_id, review_status, order_index, id);
CREATE INDEX idx_visual_beats_preview_media_asset
    ON visual_beats (preview_media_asset_id)
    WHERE preview_media_asset_id IS NOT NULL;
CREATE INDEX idx_visual_beat_characters_project_character
    ON visual_beat_characters (project_character_id, visual_beat_id);

-- Media planning and reuse
CREATE INDEX idx_media_plans_chapter_created
    ON media_plans (chapter_id, created_at DESC);
CREATE INDEX idx_media_beat_plans_reuse_source
    ON media_beat_plans (media_plan_id, reuse_source_visual_beat_id)
    WHERE reuse_source_visual_beat_id IS NOT NULL;

-- Durable generation execution
CREATE UNIQUE INDEX uq_generation_jobs_owner_idempotency_key
    ON generation_jobs (requested_by_user_id, idempotency_key)
    WHERE requested_by_user_id IS NOT NULL AND idempotency_key IS NOT NULL;
CREATE INDEX idx_generation_jobs_chapter_created
    ON generation_jobs (chapter_id, created_at DESC)
    WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_generation_jobs_project_status
    ON generation_jobs (project_id, status);
CREATE INDEX idx_generation_jobs_media_plan_id
    ON generation_jobs (media_plan_id)
    WHERE media_plan_id IS NOT NULL;
CREATE INDEX idx_generation_jobs_requester_created_id
    ON generation_jobs (requested_by_user_id, created_at DESC, id DESC);
CREATE INDEX idx_generation_jobs_chapter_workspace_lookup
    ON generation_jobs (
        chapter_id,
        chapter_row_version,
        storyboard_revision_id,
        source_hash,
        job_type,
        status
    )
    INCLUDE (media_plan_id, media_plan_revision)
    WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_stage_attempts_claimable
    ON stage_attempts (status, created_at, id)
    WHERE status IN ('QUEUED', 'STALLED');
CREATE INDEX idx_stage_attempts_running_heartbeat
    ON stage_attempts (heartbeat_at, created_at, id)
    WHERE status = 'RUNNING';
CREATE INDEX idx_stage_attempts_running_lease
    ON stage_attempts (id, worker_id, lease_token)
    WHERE status = 'RUNNING';
CREATE UNIQUE INDEX uq_provider_operation_fingerprint
    ON provider_operations (provider_key, request_fingerprint);
CREATE INDEX idx_provider_operations_completed_replay
    ON provider_operations (stage_attempt_id, id)
    WHERE status = 'COMPLETED' AND normalized_result_json IS NOT NULL;
CREATE INDEX idx_provider_operations_result_fingerprint
    ON provider_operations (result_fingerprint)
    WHERE result_fingerprint IS NOT NULL;
CREATE INDEX idx_provider_operations_reconcile_due
    ON provider_operations (next_reconcile_at, id)
    WHERE status IN ('UNKNOWN', 'SUBMITTED', 'RUNNING')
      AND next_reconcile_at IS NOT NULL;
CREATE INDEX idx_operation_plans_generation_job
    ON operation_plans (generation_job_id);

-- Quota and billing
CREATE INDEX idx_quota_reservations_user_status
    ON quota_reservations (user_id, status);
CREATE INDEX idx_quota_reservations_user_period_status
    ON quota_reservations (user_id, period_key, status);
CREATE INDEX idx_quota_reservations_active_user
    ON quota_reservations (user_id, id)
    WHERE status = 'RESERVED';

-- Media assets, validation and narration
CREATE INDEX idx_media_assets_account_status
    ON media_assets (account_id, status, created_at DESC);
CREATE INDEX idx_media_assets_account_created_visible
    ON media_assets (account_id, created_at DESC, id DESC)
    WHERE status <> 'DELETED' AND deleted_at IS NULL;
CREATE INDEX idx_media_assets_project_ready
    ON media_assets (project_id, asset_type, status, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_production_beat_media_selection_asset
    ON production_beat_media_selections (media_asset_id);
CREATE INDEX idx_character_version_reference_asset
    ON character_version_reference_assets (media_asset_id);
CREATE INDEX idx_media_validation_jobs_claimable
    ON media_validation_jobs (status, next_attempt_at, created_at, id);
CREATE INDEX idx_media_validation_jobs_expired_leases
    ON media_validation_jobs (lease_until, id)
    WHERE status = 'RUNNING';
CREATE INDEX idx_narration_requests_chapter_created
    ON narration_requests (chapter_id, created_at DESC);
CREATE INDEX idx_narration_requests_project_voice_reference
    ON narration_requests (project_voice_reference_asset_id)
    WHERE project_voice_reference_asset_id IS NOT NULL;
CREATE INDEX idx_narration_requests_account_voice_reference
    ON narration_requests (account_voice_reference_asset_id)
    WHERE account_voice_reference_asset_id IS NOT NULL;
CREATE INDEX idx_narration_sets_story_created
    ON narration_sets (story_id, created_at DESC);

-- Notifications and durable outbox
CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, read_at, created_at DESC);
CREATE INDEX idx_notifications_user_created_id
    ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX idx_outbox_pending ON outbox_events (status, available_at);

-- Render manifests and final artifacts
CREATE INDEX idx_render_manifests_chapter_created
    ON render_manifests (chapter_id, created_at DESC, id DESC);
CREATE INDEX idx_render_manifests_project_created
    ON render_manifests (project_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX uq_final_artifacts_chapter_render_fingerprint
    ON final_artifacts (chapter_id, render_fingerprint)
    WHERE chapter_id IS NOT NULL AND status <> 'ARCHIVED';
CREATE INDEX idx_final_artifacts_project_created
    ON final_artifacts (project_id, created_at DESC, id DESC);
CREATE INDEX idx_final_artifacts_chapter_created
    ON final_artifacts (chapter_id, created_at DESC, id DESC)
    WHERE chapter_id IS NOT NULL;

-- Catalogs and upload lifecycle
CREATE INDEX idx_style_presets_active_category_name
    ON style_presets (category, LOWER(name), id)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_voice_catalog_enabled_language_name
    ON voice_catalog (language, LOWER(name), id)
    WHERE enabled = TRUE;
CREATE INDEX idx_media_upload_sessions_account_status
    ON media_upload_sessions (account_id, status, created_at DESC);
CREATE INDEX idx_media_upload_sessions_expired_pending
    ON media_upload_sessions (expires_at, id)
    WHERE status = 'PENDING_UPLOAD';
CREATE UNIQUE INDEX uq_media_storage_cleanup_active_key
    ON media_storage_cleanup_tasks (storage_key)
    WHERE status IN ('PENDING', 'RUNNING');
CREATE INDEX idx_media_storage_cleanup_due
    ON media_storage_cleanup_tasks (status, next_attempt_at, id)
    WHERE status IN ('PENDING', 'RUNNING');

-- Media generation execution and lineage
CREATE UNIQUE INDEX uq_media_generation_items_active
    ON media_generation_items (generation_job_id, item_key)
    WHERE execution_status IN ('QUEUED', 'RUNNING', 'VALIDATING', 'READY', 'UNKNOWN');
CREATE INDEX idx_media_generation_items_job_status
    ON media_generation_items (generation_job_id, execution_status, item_key);
CREATE INDEX idx_media_generation_items_beat_newest
    ON media_generation_items (visual_beat_id, attempt_number DESC, created_at DESC);
CREATE INDEX idx_media_generation_items_review_queue
    ON media_generation_items (generation_job_id, review_status, item_key)
    WHERE review_status = 'NEEDS_REVIEW';
CREATE INDEX idx_media_generation_items_provider_operation
    ON media_generation_items (provider_operation_id)
    WHERE provider_operation_id IS NOT NULL;
CREATE INDEX idx_media_asset_lineage_asset
    ON media_asset_lineage (media_asset_id, created_at DESC);
CREATE INDEX idx_media_asset_lineage_project_chapter
    ON media_asset_lineage (project_id, chapter_id, created_at DESC);
CREATE INDEX idx_media_asset_lineage_beat
    ON media_asset_lineage (visual_beat_id, created_at DESC);

-- Current media-job recovery pointer
CREATE INDEX idx_chapter_media_heads_updated
    ON chapter_media_heads (updated_at DESC, chapter_id);

-- Project render snapshots and desktop execution
CREATE INDEX idx_project_render_input_chapters_order
    ON project_render_input_chapters (generation_job_id, chapter_order_index);
CREATE INDEX idx_project_render_input_beats_order
    ON project_render_input_beats (generation_job_id, global_start_ms, scene_index, beat_index);
CREATE UNIQUE INDEX uq_final_artifacts_project_render_job
    ON final_artifacts (generation_job_id)
    WHERE artifact_type = 'PROJECT_VIDEO'
      AND generation_job_id IS NOT NULL
      AND status <> 'ARCHIVED';
CREATE INDEX idx_final_artifacts_project_video_fingerprint
    ON final_artifacts (project_id, render_fingerprint)
    WHERE artifact_type = 'PROJECT_VIDEO';
CREATE INDEX idx_project_render_input_local_claim
    ON project_render_input_snapshots (assigned_local_device_id, created_at, generation_job_id);
