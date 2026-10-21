# Plan: Luồng sản xuất video chất lượng cao sau phân tích chương

**Ngày:** 2026-10-20 · **Cập nhật:** 2026-10-21 (đối chiếu code ở `4ea50b686`; thêm mục 0 trạng thái thực tế, task sửa lỗi P1.F, task hoàn thiện P1.1b)

**Trạng thái:** TARGET, triển khai một phần. Mới có lõi QC nấc 1 (P1.1–P1.4); P0, P1.5, P1.6 chưa đạt nghiệm thu; P2–P14 chưa bắt đầu. Mọi checkbox chỉ được đánh dấu khi có bằng chứng (test thật, runtime Electron, GPU thật cho phần GPU). Kết quả từ fake provider không phải năng lực production.

**Quan hệ với plan khác:** thay thế thứ tự và giải pháp của đợt C–E trong [Video production and regeneration](20261017-video-production-and-regeneration.md) và giai đoạn 3–5 của [Location continuity](location-continuity.md). Mốc A của [Story-to-video remediation](20261020-story-to-video-remediation.md) vẫn là điều kiện nền (P0). Các ADR chỉ dùng làm tham chiếu; điểm đi khác ADR nằm ở [mục 12](#12-cập-nhật-adr-và-tài-liệu).

**Quy ước đường dẫn:** **BE** = `app/backend-service/src/main/java/com/narrativex/backend/` · **BR** = `app/backend-service/src/main/resources/` · **BT** = `app/backend-service/src/test/java/com/narrativex/backend/` · **GS** = `app/generation-service/src/narrativex_gpu_worker/` · **GT** = `app/generation-service/tests/` · **CT** = `contracts/compute/v1/` · **DE** = `app/desktop/src/` · **DT** = `app/desktop/test/`. Tên file mới là đề xuất; khảo sát seam tương đương trước khi tạo.

---

## 0. Trạng thái thực tế (đối chiếu code ở `4ea50b686`, 2026-10-21)

| Phần | Kết quả | Việc còn lại |
|---|---|---|
| P0 | Một phần; chưa đạt cổng “3 SelectedTake native → MP4 qua Electron thật” | Hoàn tất Mốc A + chạy cổng |
| P1.1 | Scorer V2 có khung trắng, đứng hình cuối clip, độ lệch màu/dải sáng (P1.1b, 2026-10-21) | Hiệu chỉnh ở P1.6 |
| P1.2 | Contract `qualityMetrics` V2 có và có test | — |
| P1.3 | Finalizer + evaluator V2; yêu cầu thoại theo snapshot từng Take (P1.F2, 2026-10-21) | Hiệu chỉnh ở P1.6 |
| P1.4 | Read model trả thêm `speechExpectation` (`EXPECTED`/`NOT_EXPECTED`/`UNKNOWN`) | — |
| P1.5 | UI có gợi ý In **và Out**; lỗi mất In/Out đã sửa (P1.F1); **chưa qua runtime Electron với API thật** | Cổng runtime P1.5 |
| P1.6 | Chưa hiệu chỉnh trên ≥ 30 Take thật | P1.6 (cần GPU thật + người gắn nhãn) |
| P2–P14 | Chưa triển khai | Theo mục 6 |

Đường sinh hiện tại vẫn là T2V + native AV (`LTX_NATIVE_AV`), render snapshot schema 3/4. Chưa có audio-first, keyframe conditioning, mix nhiều track.

**Bằng chứng kiểm tra sau P1.F/P1.1b (2026-10-21):** worker 199 test (FFmpeg thật) + `ruff check` + `mypy` sạch; Desktop 522 test pass (15 skipped có sẵn) + `type-check` sạch; backend: toàn bộ suite 984 test, 0 lỗi (`./mvnw.cmd test`). **Chưa** có Electron + API thật (DB cục bộ không có Take nào) và **chưa** có GPU thật; xem ghi chú ở P1.F1.

**Thứ tự ưu tiên để đóng nền tảng:** ~~P1.F1 + P1.F2~~ (xong) → ~~P1.1b~~ (xong) → P0 cổng → cổng runtime P1.5 → P1.6. Chỉ sau đó mới coi M1 xong và mở P13.

---

## 1. Quyết định đã chốt

| # | Quyết định | Lý do ngắn |
|---|---|---|
| D1 | **Audio thoại đi trước hình**; thời gian thoại là clock của chương | Khớp môi và thời lượng phải theo tiếng thật; sinh lại hình không sinh lại tiếng |
| D2 | Audio đọc **kịch bản đã chuyển thể**, không đọc nguyên văn truyện | Câu mô tả nhân vật/bối cảnh chuyển thành hình (`VISUAL_PRIMARY`) |
| D3 | TTS **theo câu/lượt nói**, ghép thành audio master chương; Shot chỉ cắt lấy đoạn của mình | Giọng và ngữ điệu liền mạch; sửa/chia Shot không phải synth lại |
| D4 | **Nhiều giọng**: mỗi nhân vật một giọng khóa, narrator một giọng, nhân vật phụ lấy từ pool | Nhận diện nhân vật bằng tai |
| D5 | Mỗi Shot sinh video từ **đúng 1 ảnh khung đầu**; không First/Last frame | Đơn giản, tránh morph; continuity bằng khung cuối Take trước |
| D6 | Đoạn **không thoại (combat, khoảng lặng)**: hình trước → âm thanh sau (foley sinh từ video) | Không có tiếng để làm clock; foley phải khớp cú va chạm trên hình |
| D7 | **Nhạc nền do AI sinh**, instrumental, sau khi chốt hình | Vừa khít độ dài, cao trào trùng hành động |
| D8 | **QC tự động hai nấc**: nấc 1 đo + hiển thị; nấc 2 tự tạo lại có ngân sách sau khi hiệu chỉnh ngưỡng | Giảm thời gian xem Take hỏng mà không đốt GPU vì ngưỡng sai |
| D9 | Ranh giới hệ thống giữ nguyên: backend là nguồn sự thật/admission; worker chỉ chạy task; bytes ở Desktop; render cuối ở Electron; snapshot bất biến; intent ghi trước I/O | Không đổi kiến trúc nền |

## 2. Chẩn đoán luồng hiện tại

| Người xem thấy | Nguyên nhân gốc |
|---|---|
| Cùng nhân vật mỗi Shot một giọng | `LTX_NATIVE_AV` sinh tiếng trong từng Take; mô tả giọng bằng chữ |
| Mặt/trang phục/bối cảnh trôi | Chỉ T2V, không có ảnh tham chiếu vào model |
| Nối Beat bị khựng | Clip AI đứng hình 0,2–0,5 s đầu và chậm dần cuối; ghép hard cut nguyên clip |
| Chuyển cảnh nhảy màu | Mỗi Take tự chọn màu, không có grade chung |
| Không có nhạc, combat không có tiếng | Track Music là placeholder; không có lớp SFX/ambience |
| Thời lượng sai | Thời lượng Shot ước lượng theo ký tự |

## 3. Luồng đích

```text
Phân tích chương (contract 1.4): canon · Scene · kịch bản chuyển thể · sound design · music cue
   │
   ▼
[A] Khóa tài sản (một lần/Project, tái dùng các chương sau)
    Character sheet · Location plates · Voice casting · Style bible
   │
   ▼
[B] Duyệt kịch bản chương (chỉ là chữ — điểm sửa rẻ nhất)
   │
   ├──────────────────────────────────────┐ song song
   ▼                                      ▼
[C] Audio master chương                 [D] Keyframe: 1 ảnh/Shot
    TTS theo câu (giọng khóa) + EFFORT      character sheet + location plate + style
    + ô thời gian cho đoạn hình (VISUAL)
    → QC giọng → align từng từ
   │                                      │
   ▼                                      │
[E] Timeline plan: thời lượng Shot trên clock, continuity, transition
   │                                      │
   └──────────────────┬───────────────────┘
                      ▼
[F] Video mỗi Shot (từ 1 ảnh)
    TALKING: ảnh + stem thoại người nói → khớp môi
    ACTION/REACTION/BROLL: ảnh → I2V (miệng đóng)
    CONTINUOUS: khung cuối Take trước làm ảnh đầu
    → QC tự động → người chọn Take → In/Out
                      ▼
[G] Hậu kỳ Shot: cắt phần chết · nội suy khung · match màu Scene + LUT · upscale
                      ▼  (chốt hình)
[H] Âm thanh không thoại: foley từ video · ambience theo Location · nhạc AI · stinger
                      ▼
[I] Mix + dựng: thoại > effort > SFX > ambience > nhạc, ducking, −14 LUFS
    transition (cut on action, J/L cut, dissolve, fade) · phụ đề từ alignment · render Electron
```

Hai chiều đồng bộ:

- **Đoạn thoại/lời kể:** tiếng → hình. Thời lượng cố định theo audio.
- **Đoạn hành động/khoảng lặng:** hình → tiếng. Ô thời gian có ước lượng ban đầu, co giãn theo In/Out đã chốt; các câu thoại sau tự dời theo, không cắt vào câu.

## 4. Mô hình dữ liệu đích

Theo [database policy](../architecture/database.md): xác minh freeze/applied history trước; nếu baseline đã freeze thì dùng forward migration **V20+**, nếu chưa thì cân nhắc fold vào migration sở hữu. Index ở V6-tương đương, trigger/guard ở V5-tương đương. Cập nhật inventory mỗi lần đổi schema.

| Bảng/cột | Mục đích | Ghi chú |
|---|---|---|
| `character_voice_profiles` + cột `binding_kind` (`CATALOG_PRESET`/`REFERENCE_CLONE`), `voice_catalog_id`, `reference_sha256`, `tts_model_revision`, `speaker_embedding_ref`, `approved_at` | Voice binding bất biến | Tái dùng bảng có `reference_asset_id`, `locked_at` |
| `project_audio_settings` | Narrator voice binding, pool giọng nhân vật phụ, loudness target | Một hàng/Project, row_version |
| `chapter_scripts`, `chapter_script_lines` | Kịch bản chuyển thể có revision; dòng = cue hoặc ô `VISUAL`/`SILENCE` có `planned_duration_ms`, `pause_after_ms` | Khảo sát `narration_scripts`/`narration_spans` trước; tái dùng nếu đủ |
| `speech_synth_units` | Cache synth theo `hash(text+binding+model+delivery+seed)` → asset, metrics (similarity, WER, LUFS) | Sửa một câu chỉ synth câu đó |
| `audio_master_revisions`, `audio_master_segments` | Master WAV + stem theo speaker, timing từng dòng, alignment run | Revision bất biến; chọn revision mới đánh dấu footage phụ thuộc cần xem lại |
| `character_version_reference_assets` | Character sheet | **Đã có** với slot FACE/BODY; thêm slot `EXPRESSION_*` nếu cần |
| `project_location_reference_assets` | Location plates (`ESTABLISHING_WIDE`, `REVERSE_ANGLE`, `SIDE_ANGLE`, `DETAIL`, biến thể ngày/đêm) | Theo mẫu bảng nhân vật |
| `project_style_bibles` | Style, negative chung, LUT asset, lens set, tham số sinh theo loại Shot | Versioned, đóng băng vào snapshot |
| `shots` + `shot_kind`, `continuity_link` (`CONTINUOUS`/`MATCH`/`NEW_SCENE`), `master_start_ms`, `master_end_ms`, `handle_ms`, `keyframe_asset_id`, `transition_in` | Timeline plan | `master_*` thay ước lượng ký tự |
| `takes.metrics_json` | Điểm QC | **Đã có**, chưa dùng |
| `chapter_sound_events` | Lớp âm thanh không thoại: `FOLEY`/`AMBIENCE`/`MUSIC`/`STINGER`, vị trí trên timeline, asset, gain, nguồn Shot/Location | Ứng viên + lựa chọn tường minh như Take |
| `chapter_music_cues` | Cue nhạc: mood, energy, khoảng Scene, climax marker, asset đã chọn | |
| Render snapshot schema 5 | Nhiều track (dialogue/effort/sfx/ambience/music), transitions, color/LUT, loudness | Giữ đọc/khôi phục schema 3/4 |

## 5. Compute Protocol đích

| Task | Trạng thái | Thay đổi |
|---|---|---|
| `audio.synthesize` | Có (VieNeu) | Thêm `deliveryHint`, `seed`, binding preset/reference; output kèm metrics similarity/WER/LUFS |
| `audio.align` | Có (WhisperX) | Chạy trên master WAV |
| `image.generate` | Có (text-to-image) | Profile mới có **reference conditioning** (model edit / face-ID) |
| `video.generate` | Có (1.1 native AV, T2V) | Profile mới `I2V` (1 ảnh) và `TALKING` (ảnh + audio stem); 1.1 giữ nguyên cho Project cũ |
| `audio.foley` | Mới | Video → SFX (MMAudio / HunyuanVideo-Foley / ThinkSound — chốt bằng benchmark) |
| `audio.sfx` | Mới | Text → ambience/stinger (Stable Audio Open) |
| `music.generate` | Mới | Mood, energy, BPM, độ dài chính xác, instrumental (ACE-Step ưu tiên; **kiểm license thương mại**) |
| `video.enhance` | Mới | Nội suy khung (RIFE), upscale (SeedVR2 / Real-ESRGAN) |
| QC metrics | Mới, trong task | `qualityMetrics` tùy chọn trong technical metadata output |

Mỗi profile/task mới: schema JSON trong `CT/schemas`, ví dụ trong `CT/examples`, model Pydantic (`extra="forbid"` → cập nhật đồng bộ), DTO Java, capability advertise, preflight fail-closed, không fallback âm thầm. Cập nhật [compute protocol](../architecture/compute-protocol.md) và [GPU worker runtime](../operations/gpu-worker-runtime.md).

---

## 6. Lộ trình và phụ thuộc

```text
P0 Nền (remediation Mốc A)
 ├─ P1 QC nấc 1 ─────────────────────────────────────────────┐
 ├─ P2 Benchmark model (song song) ──┐                        │
 ├─ P3 Contract 1.4 + duyệt kịch bản │                        │
 │    └─ P4 Voice casting            │                        │
 │         └─ P5 Audio master        │                        │
 │              └─ P6 Timeline plan  │                        │
 ├─ P7 Tài sản hình ◄────────────────┤                        │
 │    └─ P8 Keyframe                 │                        │
 │         └─ P9 Video có điều kiện ◄┘ (cần P6, P8)            │
 │              └─ P10 Hậu kỳ Shot                             │
 │                   └─ P11 Âm thanh không thoại               │
 │                        └─ P12 Mix + render schema 5         │
 └──────────────────────────── P13 QC nấc 2 ◄─────────────────┘ (cần dữ liệu P1 + P9)
P14 Tối ưu vận hành (sau P9)
```

Song song được: P1 ‖ P2 ‖ P3; P7 ‖ P4–P6 (khác file/module). Nhạc nền đơn giản (P11.3) có thể làm sớm trên timeline hiện tại để có giá trị ngay.

| Mốc giá trị | Gồm | Người dùng nhận được |
|---|---|---|
| M1 | P0 cổng + P1 (gồm P1.F, P1.1b, P1.6) | Biết Take nào hỏng mà không xem hết. *Chưa đạt: lõi đã có nhưng còn lỗi P1.F, thiếu số đo P1.1b, chưa có runtime/hiệu chỉnh* |
| M2 | P3–P6 + P11.3 + P12 (một phần) | Giọng nhân vật nhất quán, nhạc nền, nhịp đúng — kể cả khi hình vẫn T2V |
| M3 | P7–P9 | Nhân vật/bối cảnh đồng nhất, khớp môi |
| M4 | P10–P12 | Liền mạch, combat có tiếng, mix chuẩn — chương hoàn chỉnh |
| M5 | P13–P14 | Ít thao tác tay, nhanh hơn |

---

## 7. Task triển khai chi tiết

Mỗi task: viết test tái hiện/đặc tả trước, rồi code; task SQL có PostgreSQL integration test; task UI qua gate runtime ở mục 9.

### P0 — Nền

- [ ] Hoàn tất Mốc A (A1–A8) của [Story-to-video remediation](20261020-story-to-video-remediation.md).
- [ ] Phục hồi `docs/current-status.md` chỉ với facts đã kiểm chứng.

**Cổng (chưa đạt):** ba SelectedTake native → MP4 qua Electron thật. Bằng chứng cần có: ba Take từ GPU thật được chọn qua UI, render admission thành công, MP4 ffprobe đúng stream/thời lượng, log không lỗi. Chưa có thì mọi “M1 xong” chỉ là đo trên fixture.

### P1 — QC tự động nấc 1 (đo + hiển thị)

Không đổi `PASSED/FAILED`, không tự tạo job, không chặn chọn Take.

| Chỉ số (FFmpeg, CPU vài giây/Take) | Cảnh báo khởi điểm | Nhóm `VideoQAFailureCategory` |
|---|---|---|
| Đứng hình đầu clip (`freezedetect`) | > 0,5 s | `MOTION` |
| Đứng hình cuối clip (`freezedetect`, khoảng chạm cuối clip; V2) | > 0,5 s | `MOTION` |
| Tổng đứng hình | > 25% thời lượng | `MOTION` |
| Chuyển động thấp (`signalstats` YDIF trung bình) | dưới ngưỡng | `MOTION` |
| Cắt cứng trong clip (`scdet`) | có | `TEMPORAL_ARTIFACT` |
| Nhấp nháy (độ lệch YAVG) | vượt ngưỡng | `TEMPORAL_ARTIFACT` |
| Khung đen (`blackdetect`) và khung trắng (YAVG ≥ 230 từng khung, V2) | > 0,2 s | `TECHNICAL_OUTPUT` |
| Im lặng khi **Take** có thoại, theo snapshot của Take (`silencedetect`) | > 60% | `DURATION` |
| Loudness/clipping (`ebur128`, `astats`) | clipping hoặc < −35 LUFS | `TECHNICAL_OUTPUT` |
| Chữ ký màu: trung bình YUV so trong Scene ở backend (có cảnh báo); độ lệch YUV trong clip và dải sáng 10%–90% (V2) mới chỉ đo và hiển thị, chưa có cảnh báo cho tới P1.6 | so trong Scene ở backend | `CONTINUITY` |

Chưa đo ở nấc 1 (hiển thị “chưa đo”): giống mặt (cần P7), khớp môi SyncNet (P9), biến dạng tay/mặt.

**P1.1 — Worker chấm điểm** · GS `adapters/executors/ltx/media.py` (cạnh `inspect_native_video`), mới `adapters/executors/ltx/quality.py`; GT `executors/test_ltx_quality.py`
- [x] `score_video_quality(data, ffmpeg)` chạy một lần ffmpeg với các filter, parse log → số đo thô + `scorerVersion` (V1 khi viết; nay `FFMPEG_TAKE_QC_V2`, xem P1.1b).
- [x] Timeout riêng; lỗi/timeout → `status = UNAVAILABLE` + lý do; **không** làm fail task video.
- [x] Gọi sau `inspect_native_video` trong executor LTX.
- [x] Fixture sinh bằng FFmpeg: đứng 1 s đầu, cắt cứng giữa, nhấp nháy, đen, im lặng, clipping, clip tốt.
  - Bằng chứng (2026-10-20): `tests/executors/test_ltx_quality.py` 11 test với FFmpeg thật trên CPU; toàn bộ worker 184 test, `ruff`, `mypy` sạch. Nhấp nháy đo bằng độ lệch chuẩn của ΔYAVG có dấu (|Δ| không phân biệt được dao động đều). Đứng hình ở cuối clip chỉ tính vào tổng, chưa có chỉ số riêng.
  - **Lệch so với bảng chỉ số (đối chiếu 2026-10-21):** bản V1 của `quality.py` chưa đo khung trắng, độ lệch màu/histogram, đứng hình cuối clip. Đã bổ sung ở P1.1b bên dưới (scorer V2).

**P1.1b — Hoàn thiện số đo còn thiếu** · GS `adapters/executors/ltx/quality.py`; GT `executors/test_ltx_quality.py`; CT `schemas/produced-artifact.json`; GS `contracts/artifact.py`; BE `ProducedArtifactDto.java`, `VideoQualityMetricsDto.java`, `TakeQualityEvaluator.java`
- [x] **Đứng hình cuối clip** (`freezeTailMs`): khoảng freeze chạm cuối clip (dung sai như `_HEAD_TOLERANCE_S`). Là điều kiện để gợi ý Out ở P1.5/P10.1.
- [x] **Khung trắng** (`whiteTotalMs`): ffmpeg không có `whitedetect`; dùng YAVG từng khung ≥ ngưỡng (khởi điểm 235, dải limited) nhân thời lượng khung. Đọc `pts_time` từ metadata để tính thời lượng, không giả định FPS cố định.
- [x] **Độ lệch màu / histogram thô**: thêm số đo trong clip (ví dụ độ lệch chuẩn Y qua khung, `YLOW`/`YHIGH`, `SATAVG` của `signalstats`). **Xác minh tên khóa bằng FFmpeg thật** trước khi chốt trường contract.
- [x] Quy tắc tương thích: trường mới là tùy chọn trong contract (Take cũ không có → “chưa đo”, không phải 0). `scorerVersion` tăng lên `FFMPEG_TAKE_QC_V2`; evaluator xử lý `null` của từng trường mới độc lập, không suy ra lỗi từ thiếu số đo.
- [x] Cảnh báo mới ở evaluator (khung trắng → `TECHNICAL_OUTPUT`, đứng hình cuối → `MOTION`, lệch màu mở rộng → `CONTINUITY`) kèm tăng `thresholdsVersion` lên `TAKE_QC_THRESHOLDS_V2`. Giữ nguyên ngưỡng V1 cho số đo đã có; ngưỡng mới ghi là “chưa hiệu chỉnh” cho tới P1.6.
- [x] Test: fixture khung trắng, fixture freeze cuối clip, clip tốt không báo nhầm; contract test Pydantic ↔ schema ↔ ví dụ ↔ Jackson (trường lạ vẫn bị từ chối); evaluator với Take V1 (không có trường mới) vẫn cho kết quả như cũ.
- [x] Cập nhật bảng chỉ số (cột “Nhóm”) và danh sách “Chưa đo ở nấc 1” khi xong.
  - Bằng chứng (2026-10-21): khóa `signalstats` kiểm bằng FFmpeg đóng gói trong Desktop (`YLOW`, `YHIGH`, `YAVG`, `UAVG`, `VAVG`; dòng `frame:… pts_time:…` đi trước khóa). Trường mới: `freezeTailMs`, `whiteTotalMs`, `stddevY/U/V` (độ lệch chuẩn của trung bình từng khung), `lowY`/`highY` (trung bình YLOW/YHIGH từng khung). `test_ltx_quality.py` 18 test (7 test mới, FFmpeg thật: clip tốt, freeze cuối ≠ freeze đầu, clip trắng, clip đen không bị tính trắng, tia chớp trắng 0,5 s đo ≈ 0,5 s, độ lệch màu tăng khi đổi màu); toàn worker 199 test, `ruff check`, `mypy` sạch; contract test Pydantic ↔ schema ↔ ví dụ và Jackson (backend) pass; evaluator V2 có test biên và test Take V1 không bị cảnh báo vì thiếu trường.
  - **Lệch có chủ đích so với mô tả ở trên:** (1) `WHITE_FRAMES` và `FREEZE_TAIL` là mức `REVIEW`, không phải `DEFECT` (tia chớp trắng có thể là chủ ý, ngưỡng chưa hiệu chỉnh); (2) độ lệch màu trong clip và dải sáng **chỉ đo và hiển thị, chưa có cảnh báo** (không có căn cứ ngưỡng trước P1.6) nên không có cảnh báo `CONTINUITY` mới; (3) khung trắng dùng YAVG ≥ 230 (không phải 235) để chịu được nén; mọi ngưỡng mới chờ P1.6.

**P1.2 — Contract** · CT `schemas/produced-artifact.json`, `examples/`; GS `contracts/artifact.py`; BE `feature/generation/application/model/compute/ProducedArtifactDto.java`
- [x] Thêm `qualityMetrics` tùy chọn vào technical metadata video (status, scorerVersion, metrics).
- [x] Test: có/không có trường đều hợp lệ; trường lạ vẫn bị từ chối.
  - Bằng chứng: `succeeded-video-observation.json` là ví dụ chung; `test_quality_metrics_contract.py` (Pydantic ↔ schema ↔ ví dụ) và `ProducedArtifactQualityMetricsContractTest` (Jackson 3, `FAIL_ON_UNKNOWN_PROPERTIES`).

**P1.3 — Backend ghi và đánh giá** · BE `feature/generation/infrastructure/finalizer/VideoGenerationResultFinalizer.java`, mới `feature/generation/application/service/TakeQualityEvaluator.java`; BT tương ứng
- [x] Finalizer ghi `takes.metrics_json = {version, status, metrics}`; không đổi `validation_status`.
  - Lệch plan có chủ đích: ghi dưới khóa `metrics_json.qualityControl` bằng `jsonb_set` để không đè khóa `whisperx` có sẵn. Có test PostgreSQL thật (`TakeQualityControlPostgreSqlIntegrationTest`).
- [x] `TakeQualityEvaluator` thuần, ngưỡng có version (V1 khi viết; nay `TAKE_QC_THRESHOLDS_V2`) → `warnings[]` + mức tổng (`GOOD`/`REVIEW`/`DEFECT`/`UNMEASURED`). Tính khi đọc, đổi ngưỡng không cần sinh lại.
- [x] Cảnh báo màu: so chữ ký màu với trung vị SelectedTake khác cùng Scene.
- [x] Test biên ngưỡng; Take cũ `{}` → `UNMEASURED`; Scene 0/1/nhiều SelectedTake.
  - Ngưỡng chưa nêu trong plan (chuyển động 0,5 YDIF; nhấp nháy 8; lệch màu Y 25 / UV 10) là giá trị khởi điểm **chưa hiệu chỉnh**, chờ P1.6. Với Scene chỉ có 2 Take khác đo được, trung vị là trung bình nên một Take lệch nặng kéo tham chiếu của Take còn lại.

**P1.4 — Read model** · BE `GetChapterProductionUseCase`, Take list query, `ChapterProductionView`
- [x] Trả metrics, warnings, mức tổng trong Take list và production view.
  - Bằng chứng: `ProductionTakeItem.quality`; backend 975 test, 0 lỗi (2026-10-20). `TakeResponse` (kết quả tạo Take) không mang QC vì chưa có số đo lúc đó.
  - **Lỗi đã biết:** `expectsSpeech` được tính một lần cho cả StoryBeat rồi áp cho mọi Shot/Take của Beat (xem P1.F2).

**P1.F — Sửa lỗi trong phần đã triển khai** (làm trước mọi việc khác của P1; mỗi lỗi bắt đầu bằng test đỏ tái hiện)

**P1.F1 — Mở “Chỉ số đã đo” làm mất In/Out và checklist** · DE `renderer/features/storyboard/components/TakeSelectorDrawer.tsx`, `TakeQualityPanel.tsx`; DT test component
- Nguyên nhân: nội dung `TakeQualityPanel` nằm trong thẻ Take có `onClick={() => handleSelectTake(take)}`; click vào “Chỉ số đã đo” nổi lên thẻ, `handleSelectTake` luôn đặt In = 0, Out = toàn clip, xóa checklist, kể cả khi đó đã là Take đang chọn.
- [x] Test đỏ trước: chỉnh In/Out và tick checklist ở Take đang active → bấm/mở “Chỉ số đã đo” → In/Out và checklist không đổi. Thêm test: bấm thẻ chính Take đang active cũng không reset.
- [x] Sửa gốc: `handleSelectTake` thoát sớm (chỉ dọn lỗi hiển thị, không reset trim/checklist) khi `take.id === activeTakeId`. Đổi sang Take khác vẫn reset như hiện tại.
- [x] Sửa lớp UI: vùng chi tiết QC (và nút “Áp dụng In gợi ý”) chặn nổi sự kiện click/keydown, hoặc tách khỏi phần tử tương tác chọn Take. Bàn phím: Enter/Space trong vùng chi tiết không kích hoạt chọn Take.
- [x] Giữ hành vi: nút áp dụng In gợi ý vẫn hoạt động và chỉ áp In, không đụng checklist.
- [ ] Qua gate runtime UI (mục 9): Electron thật, mở/đóng chỉ số khi đã chỉnh In/Out, kiểm console, screenshot.
  - **Trạng thái (2026-10-21): chưa đạt, bị chặn bởi dữ liệu.** DB cục bộ không có Take nào và backend Docker đang chạy là bản build cũ nên chưa chạy được luồng thật. Đã kiểm chứng hành vi trong **trình duyệt thật bằng trang harness tạm với dữ liệu giả** (đã xóa, không commit): áp In 900 / Out 3200 → mở “Chỉ số đã đo” → In/Out vẫn 900/3200; bấm thẻ Take đang active → không reset; đổi sang Take khác → reset về 0/4000 như cũ; gợi ý biến mất sau khi áp; console không lỗi. Harness **không** chứng minh tích hợp API thật, Electron, dark/light, hay overflow ở viền; viewport thử 800×600 cho thấy danh sách Take rất thấp (hành vi layout có sẵn của drawer, chưa sửa).
  - Cần để đóng mục này: backend build mới + ít nhất 2 Take có `qualityControl` (từ GPU thật hoặc seed qua API) + Electron dev, chạy lại các luồng ở mục P1.5.
  - Bằng chứng code: `takeSelectionStartsFreshTrim` (test model), thoát sớm trong `handleSelectTake`, vùng QC bọc `stopPropagation`. Test đỏ trên code cũ **chưa** chạy (hành vi nổi sự kiện được xác nhận qua harness, không qua bản cũ).

**P1.F2 — QC báo “thiếu thoại” nhầm cho Shot không có thoại** · BE `GetChapterProductionUseCase`, `TakeQualityReadModel`, `TakeQualityEvaluator`; BT test tương ứng (+ PostgreSQL integration cho đọc snapshot)
- Nguyên nhân: `expectsSpeech = cues.anyMatch(DIALOGUE)` tính từ cue hiện tại của StoryBeat rồi dùng cho mọi Shot. Beat có Shot A nói và Shot B chỉ phản ứng: Take B im lặng > 60% bị `SILENT_DIALOGUE` → `DEFECT`. Sửa cue sau này còn đổi đánh giá của Take đã sinh.
- Nguyên tắc: yêu cầu thoại là thuộc tính **của Take** tại thời điểm sinh, lấy từ snapshot bất biến; không đọc cue hiện tại.
- [x] Test đỏ trước: Beat có hai Shot (A có `inputs.dialogue` khác rỗng, B rỗng), Take B im lặng 100% → không có cảnh báo `SILENT_DIALOGUE`; Take A im lặng → có. Test thứ hai: đổi/xóa cue của Beat sau khi Take sinh → đánh giá của Take không đổi.
- [x] Nguồn: `TakeRecord.inputSnapshotJson` → `inputs.dialogue` (`GenerateShotTakeUseCase` đã ghi cùng `inputs.audioMode`). `expectsSpeech = dialogue không rỗng` và `audioMode` là native AV.
- [x] Quy tắc dữ liệu cũ (tường minh, có test): snapshot thiếu khóa `dialogue` hoặc `schemaVersion` cũ hơn lúc bắt đầu ghi khóa này, hoặc JSON không đọc được → trạng thái **“không rõ yêu cầu thoại”**: bỏ qua riêng cảnh báo im lặng và **không** quy kết lỗi, ghi chú trong panel “Không xác định có thoại hay không”. Không fallback về cue hiện tại.
- [x] Tách khỏi vòng lặp theo Beat: tính theo từng Take trong `toTakeItem` (không còn biến `expectsSpeech` dùng chung); `TakeQualityReadModel.assess` nhận tham số yêu cầu thoại ba trạng thái (`YES`/`NO`/`UNKNOWN`) thay cho `boolean`.
- [ ] Khi pipeline audio-first (P5+) thay native AV, nguồn thoại của Take đổi thành `speech_stem`/ô master của Shot; ghi chú ở đây để P9.2 cập nhật cùng snapshot.
- [x] Test hồi quy: Take cũ (không có `dialogue`) không đổi mức tổng ngoài việc mất cảnh báo im lặng; mọi test QC cũ vẫn pass.
  - Bằng chứng (2026-10-21): `TakeQualityEvaluator.SpeechExpectation` + `Context(speech, sceneColor)`; `TakeQualityReadModel.speechExpectation(inputSnapshotJson)`; `ProductionTakeQualityItem.speechExpectation`; `GetChapterProductionUseCase` không còn biến theo Beat. `GetChapterProductionUseCaseTest.speechIsJudgedFromEachTakesOwnSnapshotNotTheBeatsCues` (cùng một Beat có cue thoại: Take nói im lặng → `SILENT_DIALOGUE`; Take phản ứng im lặng → sạch; Take snapshot cũ → `UNKNOWN`, không cảnh báo); `TakeQualityReadModelTest` (có/không thoại, audioMode khác `NATIVE_AV`, snapshot thiếu/hỏng → `UNKNOWN`); `findByShotIds` xác nhận có nạp `input_snapshot_json`. Đây là test mới, chưa chạy bản đỏ trên code cũ.
  - Hệ quả hiển thị: panel QC ghi “Không xác định Take này có thoại hay không nên chưa kiểm tra im lặng” khi `UNKNOWN`.

**P1.5 — Desktop** (đã code + test model + type-check; **chưa qua cổng runtime Electron**, chưa đánh dấu xong) · DE `renderer/features/storyboard/components/` (`TakeSelectorDrawer`, `TakeQualityPanel`), `renderer/features/production/model/take-quality`, API types `shared/api-types/`
- [ ] Huy hiệu **Tốt / Cần xem / Có lỗi / Chưa đo**; danh sách chỉ số có giá trị, ngưỡng, giải thích tiếng Việt. *Đã code; chờ runtime.*
- [ ] Gợi ý In/Out từ đứng hình đầu/cuối (người bấm áp dụng). *Code + test model + harness: có gợi ý In và Out (`suggestedSourceOutMs`), gợi ý tôn trọng In/Out hiện tại (còn ≥ 100 ms) và ẩn sau khi đã áp; chưa qua runtime thật.* Gợi ý không bao giờ tự áp.
- [ ] Shotboard: chấm màu Take đang chọn, số Take lỗi, bộ lọc “Shot có cảnh báo”.
- [ ] Ba lớp nhãn tách bạch: Kỹ thuật · QC tự động · Người duyệt. Design tokens hiện có.
- [ ] Sau P1.F1: cổng runtime Electron thật qua các luồng: mở/đóng chỉ số khi đã chỉnh In/Out + checklist; áp In/Out gợi ý; đổi Take rồi quay lại; Take `UNMEASURED`/`UNAVAILABLE`/không có thoại; lỗi API; loading/empty; dark/light; screenshot. Không có automation → ghi “runtime-verification blocked”, không đánh dấu xong.

**P1.6 — Hiệu chỉnh ngưỡng**
- [ ] Thu ≥ 30 Take thật (GPU thật, ≥ 10 nhãn xấu trong đó, trải ít nhất đứng/giật/đen/im lặng/lệch màu); người dựng gắn nhãn Tốt/Cần xem/Hỏng **trước khi** xem điểm QC để tránh thiên lệch.
- [ ] Công cụ xuất bảng nhãn ↔ `metrics_json` (script trong `scripts/`, không thêm vào luồng chạy) để chạy lại sau mỗi lần đổi ngưỡng.
- [ ] Chỉ số báo cáo: tỷ lệ bắt đúng (recall) trên Take hỏng, tỷ lệ báo nhầm (false positive) trên Take tốt, riêng từng quy tắc. Ghi vào `docs/operations/benchmarks/`.
- [ ] Mục tiêu khởi điểm *(đề xuất, người sở hữu sản phẩm chốt)*: recall ≥ 80% trên Take hỏng, Take tốt bị đánh `DEFECT` ≤ 10% (bị đánh `REVIEW` chấp nhận cao hơn). Quy tắc nào không đạt thì hạ mức hoặc tắt, tăng `thresholdsVersion`.
- [ ] Ngưỡng chưa hiệu chỉnh (chuyển động 0,5 YDIF; nhấp nháy 8; lệch màu Y 25 / UV 10; ngưỡng mới của P1.1b) được thay bằng giá trị đã đo, ghi lý do trong benchmark.

**Cổng P1:** (1) P1.F1 và P1.F2 đã đóng với test hồi quy; (2) P1.1b xong; (3) P1.5 qua runtime Electron; (4) P1.6 đạt mục tiêu: cảnh báo bắt phần lớn Take hỏng vì đứng/giật/đen/trắng/im lặng với tỷ lệ báo nhầm người dựng chấp nhận được. Thiếu (3) hoặc (4) → M1 chưa xong và **P13 không được bắt đầu**.

### P2 — Benchmark model (spike, không code production)

Máy: RTX 5090 32 GB. Mỗi spike ghi model/revision, VRAM, thời gian, chất lượng (chấm 1–5 + metric) vào `docs/operations/benchmarks/`.

- [ ] **S1 TTS:** VieNeu preset vs clone; độ ổn định speaker similarity qua 30 câu/nhân vật, 3 cảm xúc; có hỗ trợ ngữ cảnh câu trước không; tốc độ.
- [ ] **S2 Character sheet:** model edit (họ Flux Kontext / Qwen-Image-Edit) vs face-ID adapter (PuLID/InstantID) vs LoRA; face similarity giữa các góc.
- [ ] **S3 I2V:** LTX-2 vs Wan 2.2 I2V; 6 Shot × 3 Take; chuyển động, giữ nhân vật, thời gian/VRAM.
- [ ] **S4 Talking:** LTX-2 audio-to-video vs Wan 2.2 S2V vs InfiniteTalk/MultiTalk vs I2V + LatentSync/MuseTalk; LSE-C/D + chấm người; cảnh 2 người.
- [ ] **S5 Âm thanh:** foley (MMAudio/HunyuanVideo-Foley/ThinkSound) trên 5 Shot combat; music (ACE-Step/Stable Audio Open/MusicGen) 5 mood; **license thương mại**.
- [ ] **S6 Hậu kỳ:** RIFE, SeedVR2/Real-ESRGAN; thời gian/phút video.

**Cổng P2:** chọn một model chính + một dự phòng cho mỗi năng lực; có lý do bằng số đo.

### P3 — Contract phân tích 1.4 và duyệt kịch bản

**P3.1 — Contract** · BR `analysis/chapter-analysis/1.4/` (sao từ 1.3), `ChapterAnalysisContractResources`
- [ ] `cue_type` thêm `EFFORT` (hét, rên, thở dốc, hô xung trận) có speaker.
- [ ] Mỗi visual beat thêm `sound_design { kind: DIALOGUE|ACTION|ATMOSPHERE|SILENCE, action_intensity 1–5, key_events[], ambience }`.
- [ ] Beat không thoại có `planned_visual_duration_ms` (khoảng hợp lệ theo kind); combat chia thành `action_beats[]` (đánh/đỡ/phản/ngã) để cắt nhịp nhanh 1,5–4 s/Shot.
- [ ] Scene/cụm Scene có `music { mood, energy 1–5, climax_hint }`.
- [ ] Prompt: câu mô tả → `VISUAL_PRIMARY`; narration `COMPRESS`; quy tắc đổi nơi/nhảy thời gian thì tách Scene; `location_ai_name` bắt buộc khi có nơi chốn (gộp T06–T10 của Location plan).
- [ ] Contract test fixture; hash/version contract mới; 1.3 vẫn materialize được.

**P3.2 — Materialize kịch bản** · BE `feature/generation/infrastructure/dispatch/ChapterAnalysisArtifactMaterializer.java`, mới `feature/storyboard/.../ChapterScript*`; BR migration
- [ ] Tạo `chapter_scripts` revision + `chapter_script_lines` từ AudioCue + ô `VISUAL`/`SILENCE`, theo thứ tự nguồn.
- [ ] Lưu `sound_design`, `music` vào bảng/JSON sở hữu; diagnostic khi không resolve được speaker/location.

**P3.3 — API + UI duyệt kịch bản** · BE controller mới dưới `feature/storyboard/api`; DE `renderer/features/chapters/` (stage mới “Kịch bản”)
- [ ] Xem kịch bản theo Scene: speaker, loại, text, delivery, ô hình (thời lượng); sửa text/speaker/delivery/thời lượng ô; row version, conflict 409.
- [ ] Cảnh báo: dòng thiếu speaker → mặc định narrator; câu quá dài cho một Shot.
- [ ] Duyệt → đóng băng revision; sửa sau duyệt tạo revision mới.

**Cổng P3:** chương thật → kịch bản có thoại/lời kể/EFFORT/ô hình đúng thứ tự, người dựng sửa và duyệt được.

### P4 — Voice casting

**P4.1 — Voice binding** · BR migration (cột mới `character_voice_profiles`, `project_audio_settings`); BE `feature/character` (voice profile, `SpeakerVoiceAccess`)
- [ ] Binding = preset catalog **hoặc** reference clone (asset + sha256 + scope) + model revision; bất biến sau duyệt.
- [ ] Reference `PROJECT` không dùng ở Project khác; reference người thật cần consent/retention.
- [ ] Narrator binding + pool nhân vật phụ (theo giới tính/độ tuổi) ở `project_audio_settings`; nhân vật phụ được gán giọng một lần rồi giữ.
- [ ] Voice bị vô hiệu/reference mất → blocker, không đổi về default.

**P4.2 — Mẫu và speaker embedding** · GS `adapters/executors/vieneu/`, mới `adapters/executors/speaker/` (ECAPA/WavLM-SV)
- [ ] Synth 3 câu mẫu (thường/giận/thì thầm) khi casting; tính embedding chuẩn lưu cùng binding.
- [ ] Cảnh báo hai nhân vật có embedding quá gần.

**P4.3 — UI casting** · DE `renderer/features/voices/` (tab Giọng nhân vật đã có)
- [ ] Chọn preset/clone, nghe mẫu, duyệt; hiển thị Character dùng chung xuyên Project; danh sách nhân vật chương chưa có giọng.

**Cổng P4:** mọi speaker trong kịch bản đã duyệt có binding đã duyệt.

### P5 — Audio master chương

**P5.1 — Synth theo câu** · BE use case mới `GenerateChapterAudioMasterUseCase` (OperationPlan, idempotency, capacity như narration hiện có); GS `vieneu` executor
- [ ] Synth theo dòng (ưu tiên theo lượt nói nếu S1 cho thấy ngữ cảnh giúp ngữ điệu); cache `speech_synth_units`.
- [ ] `delivery_hint` → tham số tốc độ/cao độ/cường độ; không đổi binding.
- [ ] `EFFORT` synth bằng giọng nhân vật.

**P5.2 — QC giọng mỗi câu**
- [ ] Speaker similarity ≥ ngưỡng (khởi điểm 0,75, hiệu chỉnh ở S1); ASR ngược WER ≤ ngưỡng; LUFS stem chuẩn hóa (ví dụ −20).
- [ ] Fail → synth lại seed mới tối đa 3 lần (đây là QC rẻ, bật tự động ngay) → còn fail thì đánh dấu cho người nghe.

**P5.3 — Ghép master + align** · GS mới `adapters/executors/audio_master/` hoặc BE+GS theo seam narration hiện có
- [ ] Pause: cùng người 150–250 ms; đổi người 300–500 ms; đổi Scene 800–1500 ms; ô `VISUAL`/`SILENCE` = `planned_duration_ms` (im lặng trong master, lấp ở P11).
- [ ] Xuất master WAV 48 kHz + stem theo speaker + stem narrator/effort.
- [ ] `audio.align` trên master → timing từng từ/dòng → `audio_master_segments`.

**P5.4 — UI nghe/duyệt** · DE `renderer/features/voices/` hoặc stage chương
- [ ] Nghe theo Scene/dòng, waveform, điểm QC từng câu, synth lại một câu, sửa pause; duyệt → revision bất biến.

**Cổng P5:** cùng một nhân vật qua 3 Scene có similarity ổn định; không thiếu/lặp câu; master duyệt được.

### P6 — Timeline plan trên clock audio

**P6.1 — Planner** · BE mới `feature/storyboard/application/service/ShotTimelinePlanner.java` (thuần, deterministic, có version)
- [ ] Shot thoại: `master_start/end` = khoảng dòng nó sở hữu + handle 0,5 s; quá giới hạn model → chia tại pause gần nhất, không cắt giữa từ.
- [ ] Shot không thoại: phủ ô `VISUAL`; combat chia theo `action_beats`.
- [ ] `shot_kind`: `TALKING`, `TALKING_2P`, `REACTION`, `ACTION`, `ESTABLISHING`, `BROLL`, `INSERT`. Narration/inner monologue không bao giờ gán `TALKING`.
- [ ] `continuity_link`: `CONTINUOUS` (cùng Scene, hành động nối, cùng trục), `MATCH` (đổi góc → neo về sheet/plate), `NEW_SCENE`.
- [ ] `transition_in` theo bảng ở P12.3; quy tắc nhịp (không 3 Shot liền cùng size, trục 180°).
- [ ] Thay `NativeDialogueDurationEstimator` bằng timing đo thật cho Project audio-first; giữ estimator cho native AV.

**P6.2 — Persist + migration** · BR migration cột `shots`; ShotMapper
- [ ] Ghi plan vào Shot draft; Shot đã có SelectedTake không bị ghi đè — báo “cần xem lại” khi master revision đổi.

**P6.3 — UI storyboard có waveform** · DE `renderer/features/storyboard/`
- [ ] Shot trên trục thời gian master, loại Shot, link continuity, transition; sửa được.

**Cổng P6:** tổng thời lượng plan = master; mỗi dòng thoại có đúng một Shot sở hữu.

### P7 — Tài sản hình

**P7.1 — Character sheet** · BE `feature/character` + `character_version_reference_assets`; GS `adapters/executors/comfyui/` profile mới theo S2
- [ ] Sinh `FACE_FRONT` → duyệt → sinh các slot còn lại từ chính ảnh đó (model edit) → duyệt từng slot; cho import.
- [ ] Face embedding chuẩn từ `FACE_FRONT`; QC giống mặt giữa các slot.
- [ ] (Tùy chọn, nhân vật chính) LoRA từ sheet đã duyệt; pin asset LoRA vào snapshot.
- [ ] Đổi trang phục = CharacterVersion mới, cùng Character, cùng voice.

**P7.2 — Location plates** · BR migration `project_location_reference_assets`; BE `feature/storyboard` (Location API/T11)
- [ ] Sinh `ESTABLISHING_WIDE` → duyệt → sinh góc khác **từ ảnh wide**; biến thể ngày/đêm; import.
- [ ] Màn thư viện Location + gộp Location trùng (T11–T13 của Location plan).

**P7.3 — Style bible** · BR migration `project_style_bibles`; BE `feature/projects` hoặc `presets`; DE `renderer/features/settings` hoặc `projects`
- [ ] Phong cách, negative chung, LUT (`.cube` asset), lens set, tham số theo loại Shot; versioned.

**P7.4 — Blocker** · BE `GenerationPreflightEvaluator`, `GetChapterProductionUseCase`
- [ ] `MISSING_CHARACTER_SHEET`, `MISSING_LOCATION_PLATE`, `MISSING_STYLE_BIBLE` trước P8–P9.

**Cổng P7:** mọi nhân vật/Location trong chương có tài sản đã duyệt.

### P8 — Keyframe (1 ảnh/Shot)

**P8.1 — Sinh keyframe** · BE `CreateMediaJobUseCase` (mở rộng scope theo Shot), `VisualPromptComposer`, `ReferencePlanner`; GS comfyui
- [ ] Input: slot character sheet theo góc, location plate theo `camera_angle`, style bible, visual direction (size, lens, bố cục, ánh sáng), biểu cảm theo `delivery_hint`.
- [ ] Ngân sách reference: 1 Location + tối đa 2 nhân vật (hoặc theo năng lực model ở S2).
- [ ] `CONTINUOUS`: không sinh; lấy khung cuối Take đã chọn của Shot trước (Shot chain chạy tuần tự, còn lại song song).
- [ ] Shot cùng góc trong một Beat dùng chung ảnh.

**P8.2 — QC keyframe (tự tạo lại ngay vì rẻ)**
- [ ] Face similarity từng nhân vật, đếm người, độ gần màu với plate; fail → sinh lại tối đa 3 lần → người duyệt.

**P8.3 — UI contact sheet** · DE `renderer/features/storyboard/`
- [ ] Lưới keyframe theo Scene, điểm QC, tạo lại/chọn/import; chọn là thao tác tường minh có row version.

**Cổng P8:** mọi Shot cần keyframe có ảnh đã duyệt.

### P9 — Video có điều kiện

**P9.1 — Profile worker** · GS `adapters/executors/ltx/` (và/hoặc executor Wan theo S3/S4), `catalog.py`, `registry.py`; CT `schemas/task-video-generate-2.0.json`
- [ ] Profile `I2V`: input `start_frame` artifact (ID+sha256), prompt chuyển động, duration, seed.
- [ ] Profile `TALKING`: + `speech_stem` artifact + khoảng thời gian; profile `TALKING_2P` chỉ khi S4 đạt, kèm mapping speaker→vị trí.
- [ ] Không sinh tiếng thoại trong video (tắt hoặc bỏ track); native AV 1.1 giữ cho Project cũ.
- [ ] Advertise capability chính xác; preflight fail-closed.

**P9.2 — Admission** · BE `GenerateShotTakeUseCase`, `GenerationPreflightEvaluator`, `VideoPromptCompiler`, `TakeInputSnapshot`
- [ ] Chọn profile theo `shot_kind`; snapshot keyframe/stem/master revision/style bible vào fingerprint.
- [ ] Prompt video chỉ mô tả chuyển động + camera + biểu cảm; REACTION/BROLL/ACTION thêm negative “talking, mouth moving”.
- [ ] Độ dài sinh = thời lượng Shot + 2 handle, làm tròn theo khung.
- [ ] Shot `importance` cao → profile chất lượng cao + 2 Take; còn lại 1 Take.
- [ ] Narration/inner monologue không bao giờ vào `speech_stem`.

**P9.3 — Batch theo chain** · BE `ChapterVideoBatchService`
- [ ] Shot `CONTINUOUS` chờ SelectedTake của Shot trước; còn lại song song theo capacity.

**P9.4 — QC bổ sung** · GS quality scorer
- [ ] Face similarity theo thời gian (dùng embedding P7); SyncNet LSE cho TALKING; vào cùng `qualityMetrics`.

**Cổng P9:** pilot 1 Scene × 3 góc × 3 Take có thoại + reaction: chấm người về nhân vật/bối cảnh/khẩu hình đạt ngưỡng đặt ở P2.

### P10 — Hậu kỳ Shot

**P10.1 — Auto In/Out** · BE `TakeQualityEvaluator` (dùng số đo freeze), DE Take drawer
- [ ] Gợi ý In = khung chuyển động thật đầu tiên, Out = trước đoạn chậm dần; tôn trọng khoảng audio của Shot.

**P10.2 — Enhance** · GS mới `adapters/executors/enhance/`; CT `task-video-enhance.json`; BE job mới
- [ ] RIFE (đưa về 24 FPS mượt; kéo dài tối đa ~10% khi Take hơi ngắn), upscale lên 1080p cho bản xuất; preview dùng bản gốc.

**P10.3 — Màu** · DE `main/rendering/segment-renderer.ts`, `render-manifest.ts`, `segment-cache-key.ts`
- [ ] Match màu theo Shot tham chiếu của Scene (thống kê màu từ P1) → filter cân màu; áp LUT style bible (`lut3d`); film grain nhẹ đồng đều.
- [ ] Mọi tham số vào cache key và render snapshot.

**Cổng P10:** người xem không thấy đứng hình ở điểm nối; màu trong Scene đồng đều.

### P11 — Âm thanh không thoại

**P11.1 — Foley** · GS mới `adapters/executors/foley/`; CT `task-audio-foley.json`; BE job + `chapter_sound_events`
- [ ] Input: video SelectedTake đã trim + prompt từ `key_events`; chạy sau khi chốt Take; tạo lại foley không tạo lại hình.
- [ ] Kiểm: không có giọng nói (VAD), độ dài khớp clip.

**P11.2 — Ambience + stinger** · GS mới `adapters/executors/sfx/`; CT `task-audio-sfx.json`
- [ ] Ambience theo Location (loop liền mạch, crossfade), cache theo Location; stinger/whoosh tại marker transition và cú đánh mạnh.
- [ ] Khoảng lặng có chủ đích: tắt nhạc, giữ ambience nhẹ; không có đoạn 0 dB tuyệt đối.

**P11.3 — Nhạc AI** · GS mới `adapters/executors/music/`; CT `task-music-generate.json`; BE `chapter_music_cues`
- [ ] Cue theo Scene/cụm Scene, không theo Beat; sinh **sau khi chốt hình** với độ dài chính xác; 2–3 phương án/cue.
- [ ] Cue dài → intro/loop/outro + crossfade; climax marker trùng cú đánh/khoảnh khắc chính.
- [ ] Kiểm: độ dài, loudness, không có giọng hát, không clipping.
- [ ] Leitmotif: tái dùng prompt/seed cho nhân vật chính/series (sau).

**P11.4 — UI âm thanh** · DE `renderer/features/editor/components/EditorMultiTrackTimeline.tsx` (track Music đang placeholder)
- [ ] Track Effort/SFX/Ambience/Music; nghe ứng viên, chọn, chỉnh gain/vị trí; tạo lại từng lớp.

**Cổng P11:** đoạn combat có tiếng khớp cú va chạm; không còn đoạn im lặng chết.

### P12 — Mix và render schema 5

**P12.1 — Snapshot schema 5** · BE render admission/snapshot (`CreateProjectRenderUseCase`, `project_render_input_*`); DE `main/rendering/render-profile.ts`, `render-manifest.ts`
- [ ] Track: dialogue master, effort, sfx, ambience, music; ordered cuts với In/Out, transition, màu/LUT; loudness target. Giữ schema 3/4 đọc/khôi phục được.
- [ ] Render admission: tổng hình = master (sau co giãn ô hình); mỗi dòng thoại phủ đúng một lần; asset/revision đều đã duyệt.

**P12.2 — Mix** · DE `main/rendering/audio-muxer.ts`, `audio-concat.ts`
- [ ] Ưu tiên: thoại > effort > SFX > ambience > nhạc; ducking nhạc 8–12 dB khi có thoại (sidechain theo timing align, attack/release mềm).
- [ ] Master `loudnorm` −14 LUFS integrated, true peak −1 dBTP.
- [ ] Clip video không mang giọng; chỉ master là nguồn thoại.

**P12.3 — Transitions** · DE `main/rendering/transition-planner.ts`, `segment-renderer.ts`, `video-concat.ts`

| Điểm nối | Hình | Tiếng |
|---|---|---|
| Trong Scene, `CONTINUOUS` | Cut on action | Liền |
| Trong Scene, đổi góc đối thoại | Hard cut + J/L cut 200–600 ms | Thoại, ambience liền |
| Đổi Scene cùng mạch | Dissolve 12–18 khung | Crossfade ambience |
| Nhảy thời gian/địa điểm lớn | Dip to black 0,5–1 s hoặc match cut | Đổi cue nhạc |
| Mở/đóng chương | Fade | Nhạc vào/ra |

- [ ] Dùng handle đã sinh dư; không làm lệch clock thoại. Cut ưu tiên rơi vào pause; cảnh báo cắt giữa từ.

**P12.4 — Phụ đề** · DE `subtitle-planner.ts`, `subtitle-ass.ts`
- [ ] Từ alignment master (thời gian đo thật), không từ ước lượng.

**P12.5 — Kiểm sau render**
- [ ] ffprobe streams/duration/FPS; lệch A/V tại điểm cắt; LUFS đo lại; nghe/xem thật.

**Cổng P12:** chương hoàn chỉnh xuất MP4 qua Electron thật đạt kịch bản nghiệm thu mục 9.

### P13 — QC nấc 2 (tự tạo lại)

Chỉ bắt đầu khi **cổng P1 đạt đầy đủ** (gồm P1.F, runtime P1.5, hiệu chỉnh P1.6) và có dữ liệu từ P9. Tự tạo lại dựa trên ngưỡng chưa hiệu chỉnh hoặc yêu cầu thoại sai (P1.F2) sẽ đốt GPU vì báo nhầm.

- [ ] BE: sau finalize, Take `DEFECT` → tự admit Take mới (seed mới) qua đúng đường admission/idempotency như thao tác tay; ngân sách 1–2 lần/Shot; ghi lý do.
- [ ] Không tự chọn Take; không retry khi UNKNOWN; tôn trọng capacity/execution slot.
- [ ] Desktop: hiển thị “đã tự tạo lại N lần”, nút tắt tự tạo lại theo Project.
- [ ] Đo tổng GPU tăng thêm và số Take hỏng người phải xem giảm đi.

### P14 — Tối ưu vận hành

- [ ] Lập lịch theo họ model để giảm nạp/xả VRAM: toàn bộ TTS → ảnh → video → foley/nhạc của chương (`GpuResidencyManager`).
- [ ] Song song Shot không chain; preview độ phân giải thấp trước khi enhance/render cao.
- [ ] Cache: synth unit, ambience theo Location, keyframe theo input hash.
- [ ] Đo phút GPU / phút video thành phẩm trước và sau.

---

## 8. Ma trận rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Model talking chưa đủ tốt cho tiếng Việt | S4 so nhiều phương án; dự phòng I2V + LatentSync; giảm Shot TALKING cận mặt |
| Cảnh 2 người nói | Chỉ bật `TALKING_2P` khi S4 đạt; mặc định tách shot/reverse-shot |
| VRAM/thời gian quá lớn | P14 lập lịch; profile nhanh cho Shot phụ; đo trước ở P2 |
| License model nhạc/foley | Kiểm ở S5 trước khi chốt; ghi license vào benchmark |
| Ngưỡng QC sai | Nấc 1 chỉ hiển thị; ngưỡng versioned, tính lại không cần sinh lại; P13 chặn bởi P1.6 |
| QC đánh giá theo dữ liệu có thể đổi (cue hiện tại) | Mọi đầu vào của đánh giá lấy từ snapshot bất biến của Take; dữ liệu cũ thiếu → “không rõ”, không suy đoán (P1.F2) |
| Tính năng UI “xong” chỉ vì test model/type-check | Cổng runtime Electron bắt buộc; thiếu automation thì báo blocked (AGENTS.md) |
| Phân tích lại chương tốn chi phí và đổi Beat | Chỉ chạy khi người dùng yêu cầu; revision kịch bản giữ lịch sử |
| Schema lớn | Chia migration theo phase; xác minh policy baseline trước mỗi phase |

## 9. Kiểm thử và nghiệm thu

**Mỗi task:** unit test cho logic thuần; PostgreSQL integration cho SQL/CAS; contract test cho schema; worker test với fixture FFmpeg/fake model ở biên provider; Desktop component test. Chạy lệnh theo [CONTRIBUTING](../../CONTRIBUTING.md) và mục 7 của [remediation plan](20261020-story-to-video-remediation.md). `git diff --check` trước merge.

**Gate UI:** Electron/Vite thật + API thật → đi qua màn bị ảnh hưởng → kiểm console/network, dữ liệu giả, loading/error/empty, keyboard, overflow, dark/light → screenshot. Không có automation → báo runtime-verification blocked.

**Kịch bản nghiệm thu chương:** 2 nhân vật chính + 1 nhân vật phụ + narrator; 2 Location; ≥ 3 Scene; ≥ 15 Shot gồm TALKING, REACTION, ACTION (một đoạn combat ≥ 4 Shot), ESTABLISHING, một khoảng lặng có chủ đích. Thao tác: sửa một câu kịch bản, synth lại một câu, tạo lại một keyframe, tạo lại Shot giữa chain, đổi selection, restart backend giữa batch, xuất MP4.

| Đo | Mục tiêu |
|---|---|
| Speaker similarity mỗi nhân vật qua mọi câu | Ổn định; người nghe mù không nhận ra đổi giọng |
| Face similarity mỗi nhân vật qua mọi Shot | Trên ngưỡng P2; chấm người ≥ 4/5 |
| Khớp môi (LSE + người) | Đạt ngưỡng P2 |
| Điểm nối bị đánh dấu “khựng/nhảy” | Giảm rõ so với baseline P0 |
| Combat | Tiếng va chạm khớp hình (chấm người) |
| Loudness | −14 LUFS ± 1, TP ≤ −1 dBTP; thoại không bị nhạc che |
| Câu thoại | Không thiếu, không lặp, đúng thứ tự |
| Vận hành | Phút GPU / phút video; tỷ lệ Take bị QC loại |

## 10. Ngoài phạm vi

Tự chọn Take, tự dựng lại cả chương, Shot/Editing Director bằng AI, retention engine, voice LoRA, nâng model hàng loạt, render trên server/cloud.

## 11. Thứ tự bắt đầu đề xuất

0. **Đóng nền trước:** P1.F1 + P1.F2 (song song được, khác module) → P1.1b → cổng runtime P1.5 → P1.6. P0 cổng chạy song song khi GPU sẵn sàng.
1. P0 (đang làm) ‖ P1 ‖ P2 ‖ P3.1.
2. P3.2–P3.3 → P4 → P5 → P6, song song P7.
3. P11.3 (nhạc) + P12.2 (mix/ducking) sớm để có M2.
4. P8 → P9 → P10 → P11.1–P11.2 → P12 hoàn chỉnh.
5. P13, P14.

## 12. Cập nhật ADR và tài liệu

Cập nhật ADR **trước** khi code phần tương ứng:

| Thay đổi | ADR |
|---|---|
| Audio master là clock mặc định; native AV chỉ cho Project cũ; kịch bản chuyển thể; EFFORT | ADR-0006, ADR-0007, ADR-0008 (mục 9) |
| QC đo được + tự tạo lại có ngân sách | ADR-0008 (mục 10) |
| Planner timeline/transition xác định (không phải AI tự dựng) | ADR-0008 |
| Character sheet, location plate, LoRA, style bible | ADR-0006, ADR-0008 (mục 6) |
| Render nhiều track, màu/LUT, transitions, enhance ở worker | ADR-0005 |
| Task mới: foley, sfx, music, enhance; profile video 2.0 | ADR-0003 (nếu đổi semantics), compute protocol |

Tài liệu sở hữu: [compute protocol](../architecture/compute-protocol.md), [generation routing](../architecture/generation-routing.md), [editing pipeline](../architecture/editing-pipeline.md), [desktop audio workspace](../architecture/desktop-audio-workspace.md), [database](../architecture/database.md), [GPU worker runtime](../operations/gpu-worker-runtime.md), [product spec](../product/product-spec.md), bảng plan trong [docs README](../README.md). Khi một phase xong, chuyển kiến thức lâu dài vào tài liệu sở hữu và cập nhật trạng thái plan.
