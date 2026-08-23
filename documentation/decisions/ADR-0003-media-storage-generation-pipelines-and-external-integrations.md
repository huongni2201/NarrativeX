# ADR-0003: Media storage, generation pipelines and external provider integrations

- Status: Accepted
- Date: 2026-08-20 (consolidated and updated: 2026-08-22)
- Scope: Cloudflare R2 media storage, Google Drive final video storage, narration audio pipeline, VieNeu local TTS, and Vertex Gemini image batch inference.
- Consolidated from: former ADR-0011, ADR-0012, ADR-0015, and ADR-0016.

## Context

NarrativeX produces substantial quantities of intermediate and final media assets: generated keyframe images, character references, narration audio files, alignment manifests, motion video clips, and final long-form MP4 videos.

Worker container disks are ephemeral; storing media files on local container filesystems leads to data loss during worker restarts or auto-scaling. Conversely, storing large binary blobs in PostgreSQL causes severe database bloat. Furthermore, final rendered MP4 exports are significantly larger than intermediate keyframes, making long-term retention in standard cloud object storage costly when Google Drive capacity is available.

In addition, AI inference for images and speech must maintain high reliability, bounded worker memory usage, and predictable cost across third-party providers (Google Vertex AI) and self-hosted local engines (VieNeu TTS, Wan2.2 I2V).

---

## Decision

### Server-owned visual style profiles

Media generation accepts an allow-listed visual style code and resolves it on the backend to a
versioned prompt suffix and negative prompt. The resolved style is merged into every beat's
immutable prompt snapshot before the provider request is persisted. Clients never submit raw
provider prompt fragments. This gives a chapter a repeatable visual policy while preserving the
existing immutable plan and idempotency boundaries.

### 1. Two-Tier Storage Architecture: Cloudflare R2 & Google Drive

NarrativeX partitions durable media storage by lifecycle and asset type:

1. **Cloudflare R2 (Pipeline Media):**
   - Authoritative durable object store for all source, generated, and reusable pipeline media across environments (development, staging, production).
   - Covers: generated keyframe images, narration audio segments, character reference images, uploaded audio parts, thumbnails, and subtitle/alignment manifests.
   - Buckets are private; clients access media via authenticated backend endpoints or short-lived presigned URLs.
2. **Google Drive (Final Rendered MP4 Exports):**
   - Authoritative durable target for completed long-form (`CHAPTER_VIDEO`, `PROJECT_VIDEO`) and short-form (`SHORT_VIDEO`) MP4 exports via the provider-neutral `FinalVideoStorage` boundary.
   - Render workers assemble the final video locally in a scratch workspace, validate the file, upload to Google Drive via resumable chunked upload sessions, verify remote size/file ID, commit metadata to PostgreSQL `final_artifacts`, and delete local scratch.
   - Final MP4 exports are not retained in R2 by default.
3. **PostgreSQL as Metadata Authority:**
   - PostgreSQL stores object keys, checksums (SHA-256), MIME types, dimensions, duration, manifests, and external file IDs (`storage_provider = 'GOOGLE_DRIVE'`, `external_file_id`, `web_view_link`).
4. **Ephemeral Worker Scratch Space:**
   - Worker container filesystems are strictly temporary scratch spaces. Scratch files are deleted immediately after durable upload and verification.

### 2. Client Presigned Uploads & Asset Validation Pipeline

- **Upload Intent Lifecycle:** Clients initiate an upload intent (`/api/v1/assets/upload-intents`). The backend registers a `media_upload_sessions` record and returns an expiring presigned R2 upload URL.
- **Direct Storage Validation:** Finalization validates object size, MIME type, and SHA-256 directly against R2 metadata (or streams the object if HEAD metadata is missing).
- **Asynchronous Content Validation:** An idempotent `media_validation_jobs` row is created. Workers claim jobs with tokened leases (`lease_token`), download bytes into isolated workspaces, sniff/decode formats with FFmpeg/ffprobe, and transition valid assets to `READY`.

### 3. Narration Pipeline, Multi-Part Alignment & VieNeu Local TTS

- **Full-Chapter Narration:** Binds to `chapter_id`, `chapter_row_version`, `source_hash`, and voice settings. Full chapter audio is assembled as a single `NarrationAsset`.
- **Multi-Part Uploaded Audio:** Users can upload multiple audio segments (`narration_parts`). A unified `NarrationTimeline` maps all parts onto a single global continuous clock without requiring physical file concatenation.
- **VieNeu Local TTS Engine:**
  - Integrated via the worker's `TtsProvider` port.
  - Supports 48 kHz high-quality voice synthesis with zero external-provider cost.
  - Supports custom voice cloning via an optional user-provided audio reference (`voice_reference_asset_id`) with automated FFmpeg clipping (3–8s) and mono WAV normalization.
- **Worker Concurrency & Bounded Memory:**
  - Workers run bounded concurrent chapter tasks controlled by `WORKER_CONCURRENCY` using `FOR UPDATE SKIP LOCKED`.
  - Audio segments are streamed and concatenated in chunks; workers never hold entire chapter PCM/MP3 bytes in memory.

### 4. Vertex Gemini Image Batch Inference

- **100% Batch Inference:** All Gemini 2.5 Flash image generation uses Vertex BatchPredictionJob with JSONL input/output, including single-image requests. Online/PayGo generation is disabled to guarantee discounted batch pricing.
- **GCS Staging Lifecycle:** A dedicated Google Cloud Storage bucket is used strictly as temporary staging for batch input/output JSONL files under deterministic batch prefixes. Reconciled images are uploaded to Cloudflare R2 as canonical `MediaAsset` records.
- **Asynchronous Batch Reconciliation:** `ImageGenerationRunner` persists pending batch job metadata before releasing worker leases. Workers reconcile batches asynchronously, preventing in-memory polling and surviving worker restarts.

---

## Invariants

1. Local filesystem paths are never stored as authoritative asset references; worker disks are scratch only.
2. An R2-backed media stage attempt is marked `COMPLETED` only after both R2 upload and PostgreSQL metadata persistence commit.
3. Final rendered MP4 videos are uploaded directly to Google Drive and are not duplicated into R2 by default.
4. Narration timeline duration strictly drives visual beat timing; visual beats never use arbitrary hardcoded lengths.
5. All Gemini image generation routes through Vertex Batch; GCS is temporary staging only, never a permanent media store.
6. Ambiguous provider network outcomes remain `UNKNOWN` and undergo scheduled reconciliation rather than triggering blind re-generation.

---

## Consequences

- Media storage costs are heavily optimized: intermediate media lives in high-performance Cloudflare R2, while large final videos utilize Google Drive storage.
- Worker restarts and rescheduling do not lose work or cause duplicate charges.
- Image generation benefits from Vertex Batch volume discounts while maintaining predictable budgeting.
- Text-to-speech audio scales horizontally with support for both cloud and local zero-cost neural voice cloning.
