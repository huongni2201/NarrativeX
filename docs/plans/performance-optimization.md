# Kế hoạch tối ưu hiệu năng và độ tin cậy realtime

**Status:** TARGET — kế hoạch, chưa triển khai.
**Ngày:** 2026-10-15
**Baseline:** `HEAD d044b8608` + worktree chưa commit tại thời điểm review. Đây là review tĩnh; chưa chạy benchmark hay test.
**Phạm vi:** `app/backend-service`, `app/generation-service`, `app/desktop`.
**Ngoài phạm vi:** thêm broker/cache/microservice mới (AGENTS.md yêu cầu ADR + nhu cầu đo được), thay đổi contract Compute Protocol v1, thay đổi semantics UNKNOWN/reconciliation của ADR-0002.

Migration note (2026-10-15): the interim batch/outbox indexes are folded into the V1–V7 baseline.
Shard-progress notifications were removed with the unused shard-checkpoint subsystem. This plan's
remaining SSE work uses durable generation-job changes only.

Ràng buộc phải giữ nguyên trong mọi bước:

- PostgreSQL là nguồn sự thật; không blind-resubmit; ambiguous vẫn là UNKNOWN cho tới khi reconcile (ADR-0003).
- Persist intent trước external I/O.
- Project bytes local-first; integrity của render final không được nới lỏng.
- Không thêm Redis/broker. LISTEN/NOTIFY của PostgreSQL là hạ tầng đã có (V5).

---

## 0. Tổng quan

| ID | Vấn đề | Ưu tiên | Module | Ước lượng | Phụ thuộc |
| --- | --- | --- | --- | --- | --- |
| F1 | SSE được broadcast trước khi transaction commit | P0 | backend | 0.5 ngày | — |
| F2 | Progress RUNNING từ callback bị bỏ qua sau event đầu tiên | P0 | backend | 0.5 ngày | — |
| F3 | Ba cơ chế SSE song song, polling DB 750ms, giữ connection pool | P1 | backend + desktop | 3–4 ngày | F1 |
| F4 | Outbox dispatcher bị head-of-line blocking; batch resume mỗi 1s lấy lock toàn cục | P1 | backend | 2–3 ngày | — |
| F5 | Endpoint production status quá nặng nhưng bị poll | P1 | backend + desktop | 2 ngày | — |
| F6 | Preview asset hash full file, serialize qua project lock | P1 | desktop | 2 ngày | — |
| F7 | LTX giữ video trong RAM và copy 2–3 lần | P2 | generation-service | 1.5 ngày | — |
| F8 | SQLite journal: connection không đóng, thiếu PRAGMA, `recoverable()` parse JSON để đếm | P2 | generation-service | 1 ngày | — |
| F9 | Preflight LTX hash lại checkpoint mỗi lần khởi động | P2 | generation-service | 0.5 ngày | — |
| F10 | Bảng outbox/receipt phình vô hạn (backend + SQLite) | P2 | backend + generation-service | 1 ngày | F8 |
| F11 | Hikari pool không cấu hình khi bật virtual threads | P2 | backend | 0.25 ngày | F3 |
| F12 | Build tool nằm trong `dependencies` của Desktop | P3 | desktop | 0.25 ngày | — |
| F13 | Dọn code legacy và docs drift | P3 | backend + docs | 0.5 ngày | — |

Thứ tự đề xuất: **Milestone A** (F1, F2, F11) → **Milestone B** (F4, F5) → **Milestone C** (F3) → **Milestone D** (F6) → **Milestone E** (F7, F8, F9, F10) → **Milestone F** (F12, F13).

F1 là quick fix tạm thời. Sau F3, SSE lấy dữ liệu từ `pg_notify` (chỉ phát khi commit), nên F1 trở thành lớp bảo vệ thừa nhưng vẫn giữ cho các nơi còn gọi broadcaster trực tiếp.

---

## 1. Đo baseline trước khi sửa

Ghi số liệu vào `docs/reviews/` trước và sau mỗi milestone. Không tuyên bố cải thiện nếu không có số.

| Metric | Cách đo | Liên quan |
| --- | --- | --- |
| Độ trễ callback → UI cập nhật | Log timestamp tại `ComputeEventController` và tại renderer khi query `generation-job` refetch xong | F1, F3 |
| Query/s khi idle với N subscriber | `pg_stat_statements` (`calls` theo thời gian) với 5 job SSE mở, không có job chạy | F3 |
| Độ trễ dispatch (outbox `created_at` → handler bắt đầu) | Micrometer `Timer` mới `narrativex.outbox.dispatch.latency` | F4 |
| p50/p95 `GET .../production/status` | Micrometer `http.server.requests` với chapter lớn (≥ 60 shot) | F5 |
| Thời gian hiện đủ thumbnail shotboard 50 asset | Playwright: thời gian từ navigate đến khi tất cả `<img>/<video>` load xong | F6 |
| RSS đỉnh của worker khi generate 1 video LTX | `psutil` sampler hoặc `tracemalloc` trong test | F7 |
| Thời gian worker khởi động tới `ready` | Log `preflight` start/end | F9 |

---

## 2. Milestone A — Sửa lỗi đúng/sai nhanh

### F1. Broadcast SSE sau khi commit

**Hiện trạng**

- `ComputeEventApplicationService.processEvent` có `@Transactional` và gọi `eventBroadcaster.broadcastJobEvent(...)` bên trong transaction (các nhánh RUNNING, SUCCEEDED, FAILED, CANCELED, default).
- Desktop (`project-event-subscription.ts`) nhận event terminal → `refresh()` ngay → refetch có thể đọc trạng thái trước commit. Khi SSE đang kết nối, `productionPollInterval` trả `30_000` hoặc `false`, nên UI có thể kẹt trạng thái cũ tới 30s.
- Nếu transaction rollback sau broadcast, client đã nhận một trạng thái không tồn tại.
- `ComputeReconciliationService.reconcileOnce` không có `@Transactional` ở cấp method nên ít rủi ro hơn, nhưng vẫn đi qua cùng cơ chế mới để nhất quán.

**Thiết kế**

1. Tạo record `GenerationJobChangedEvent(GenerationJob job)` trong `feature/generation/application/event`.
2. `ComputeEventApplicationService` và `ComputeReconciliationService` đổi sang `ApplicationEventPublisher.publishEvent(new GenerationJobChangedEvent(saved))`.
3. Tạo `GenerationJobChangedListener` trong `infrastructure/sse`:

   ```java
   @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
   void on(GenerationJobChangedEvent event) { broadcaster.broadcastJobEvent(event.job()); }
   ```

   `fallbackExecution = true` để các caller không có transaction (reconciliation) vẫn phát ngay.
4. Listener bắt mọi exception và chỉ log. Lỗi SSE không được ảnh hưởng tới kết quả callback đã commit.

**File**

- `generation/application/service/ComputeEventApplicationService.java`
- `generation/infrastructure/reconciliation/ComputeReconciliationService.java`
- mới: `generation/application/event/GenerationJobChangedEvent.java`, `generation/infrastructure/sse/GenerationJobChangedListener.java`

**Test**

- Integration test (PostgreSQL Testcontainers, theo mẫu `ChapterAnalysisExecutionPostgreSqlIntegrationTest`): gọi `processEvent` trong `TransactionTemplate`, assert broadcaster mock **chưa** được gọi trước khi callback trả về và **được** gọi đúng 1 lần sau commit.
- Test rollback: ép finalizer ném exception → broadcaster không được gọi.
- Test reconciliation (không transaction) → broadcaster vẫn được gọi.

**Acceptance**

- Không còn lời gọi `broadcastJobEvent` trực tiếp trong code chạy trong transaction (`grep` trong CI hoặc ArchUnit rule: chỉ `GenerationJobChangedListener` được phụ thuộc `GenerationJobEventBroadcaster`).

### F2. Cập nhật progress cho các callback RUNNING tiếp theo

**Hiện trạng:** Trong nhánh `RUNNING` của `processEvent`, `markRunningWithCompute(...)` chỉ được gọi khi `job.getStatus() != RUNNING`. Các callback sau chỉ chạy `recordCallback`, nên progress đứng yên. Nhánh RUNNING của `ComputeReconciliationService` thì vẫn cập nhật, nên hành vi hai đường không nhất quán.

**Thiết kế**

1. Thêm vào `GenerationJob`:

   ```java
   public GenerationJob recordComputeProgress(int progress, Long sequence, String computeState)
   ```

   - Progress đơn điệu tăng: `Math.max(this.progress, clamp(progress, 0, 99))`. Không bao giờ đạt 100 khi chưa SUCCEEDED.
   - Cập nhật `computeSequence`, `computeState`.
2. Trong `processEvent`: nếu đã RUNNING thì gọi `recordComputeProgress`, ngược lại giữ `markRunningWithCompute`.
3. Trigger `notify_generation_job_change` đã lọc theo `progress`, nên chỉ phát NOTIFY khi giá trị thực sự đổi.

**Test**

- Unit test `GenerationJob`: progress tăng đơn điệu, sequence cũ không làm giảm progress, clamp 99.
- Test `ComputeEventApplicationService`: ba callback RUNNING 0.2 → 0.5 → 0.4 cho kết quả 20 → 50 → 50.

### F11. Cấu hình Hikari rõ ràng

Thêm vào `application.yml`:

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: ${NARRATIVEX_DB_POOL_SIZE:20}
      minimum-idle: 2
      connection-timeout: 5000
      leak-detection-threshold: ${NARRATIVEX_DB_LEAK_DETECTION_MS:0}
```

`application-local.yml` đặt `leak-detection-threshold: 20000`. Lý do: virtual threads cho phép số request đồng thời lớn, trong khi pool mặc định chỉ có 10 và một connection đang bị LISTEN chiếm vĩnh viễn (được gỡ ở F3).

---

## 3. Milestone B — Dispatcher và endpoint status

### F4. Gỡ head-of-line blocking trong outbox dispatcher

**Hiện trạng**

- `GenerationOutboxDispatcher.dispatchPending()` (`fixedDelay` 1s) dispatch tuần tự tối đa 50 row. Chapter Analysis inference runs in the Desktop agy CLI runner (ADR-0009); backend handlers only materialize delivered results.
- Reservation outbox chỉ 30s (`RESERVATION_MILLIS`). Hiện chưa gây double-dispatch trên một instance vì `fixedDelay` tuần tự, nhưng sẽ gây khi đổi sang chạy song song.
- Mỗi tick gọi `batches.resumePending()`. Hàm này duyệt tối đa 32 batch; mỗi batch lấy `pg_advisory_xact_lock` theo chapter và `acquireAnalysisCapacityLock()`, kể cả khi batch không còn item QUEUED.
- `findActiveChapterVideoBatches` chạy mỗi giây nhưng không có index phù hợp.

**Thiết kế**

1. **Executor theo lane**: tạo `GenerationDispatchExecutor`.
   - Virtual-thread executor, mỗi lane có `Semaphore`: `ANALYSIS` (mặc định 2), `MEDIA` (mặc định 4). Cấu hình qua `narrativex.generation.dispatch.lanes.*`.
   - `GenerationJobHandler` khai báo `lane()`.
   - Map `inFlight: ConcurrentHashMap<Long outboxId, Future>` để không reserve lại row đang chạy.
2. **Vòng đời outbox row**:
   - `reserveBatch` chỉ lấy số row bằng số permit còn trống của lane (bỏ qua row nếu lane đầy, không reserve).
   - Sau khi hand-off, gọi `mapper.extendReservation(id, leaseMillis)` với `leaseMillis` theo lane (ANALYSIS: timeout provider + 2 phút; MEDIA: 5 phút).
   - Khi handler trả về (thành công hay lỗi đã ghi vào job) → `markPublished`. Exception không mong đợi → để reservation hết hạn và retry như hiện tại.
3. **Bảo đảm idempotency khi retry**: rà soát từng handler. Mọi handler phải CAS `QUEUED → RUNNING/SUBMITTING` trong transaction riêng trước external I/O (`ChapterAnalysisJobHandler` đã có `claimForRunning`; kiểm tra `ImageGenerationJobHandler`, `NarrationGenerationJobHandler`, `VideoGenerationJobHandler`). Handler nào chưa có thì bổ sung trong cùng PR.
4. **Tách batch resume khỏi tick outbox**:
   - `ChapterVideoBatchScheduler` riêng, `fixedDelay` mặc định 5s (`narrativex.generation.batch-resume-delay-ms`).
   - Khi job lá (leaf) đổi sang trạng thái terminal → publish `GenerationJobChangedEvent` (F1) → listener `AFTER_COMMIT` gọi `batches.resume(parentJobId)` trên lane MEDIA. Như vậy batch tiến ngay khi leaf xong, tick 5s chỉ là lưới an toàn.
   - Trong `advance()`: kiểm tra `items.countQueued(parentId) == 0 && không có leaf active` **trước** khi lấy chapter lock và capacity lock; nếu đúng thì chỉ chiếu trạng thái và thoát.
5. **Index (current V6 baseline)**:

   ```sql
   CREATE INDEX idx_generation_jobs_active_video_batches
       ON generation_jobs (updated_at, id)
       WHERE job_type = 'CHAPTER_GENERATE'
         AND production_mode = 'VIDEO_FIRST'
         AND resource_class = 'BACKGROUND'
         AND media_plan_id IS NOT NULL
         AND status IN ('QUEUED','RUNNING','UNKNOWN','RECONCILING','STALLED');
   ```

6. **Metrics**: `narrativex.outbox.dispatch.latency` (Timer), `narrativex.dispatch.lane.active` (Gauge theo lane).
7. **Shutdown**: `@PreDestroy` dừng nhận việc mới, chờ tối đa `spring.lifecycle.timeout-per-shutdown-phase`; job đang chạy để reservation hết hạn và được recover theo ADR-0002.

**File**

- `generation/infrastructure/dispatch/GenerationOutboxDispatcher.java`, `ComputeExecutionDispatcher.java`, các `*JobHandler.java`
- `generation/application/service/ChapterVideoBatchService.java`
- `resources/mybatis/GenerationOutboxMapper.xml` (`extendReservation`, `reserveBatch` có tham số `eventTypes`/`limit`)
- mới: `GenerationDispatchExecutor.java`, `ChapterVideoBatchScheduler.java`

**Test**

- Fake analysis provider sleep 60s; enqueue thêm 1 job image ngay sau đó → image được dispatch < 2s.
- Lane ANALYSIS = 1 với 3 job analysis → chỉ 1 chạy, 2 còn PENDING và không bị reserve.
- Crash giả lập (không gọi `markPublished`) → sau khi lease hết hạn, job được dispatch lại và handler CAS từ chối chạy lần hai.
- Batch không còn item QUEUED → `resume` không gọi `acquireAnalysisCapacityLock` (verify mock).
- PostgreSQL test: `EXPLAIN` của `findActiveChapterVideoBatches` dùng index mới.

**Rủi ro**

- Thay đổi concurrency của dispatch. Giữ flag `narrativex.generation.dispatch.parallel-enabled` (mặc định `false` ở PR đầu, bật sau khi pass full gate và chạy thử).

### F5. Làm nhẹ endpoint production status

**Hiện trạng**

- `GetChapterProductionUseCase.getStatus()` gọi `execute()` đầy đủ (chapter, scenes, visual beats, audio cues, sequences, shots, takes, selected takes, voices) rồi gọi thêm `GetProductionTimelineUseCase.execute(projectId)`. Hàm này đọc chapters và beats của **toàn project**.
- Desktop poll đồng thời `useChapterProductionStatus` và `useChapterProduction` (3s khi mất SSE, 30s khi busy và có SSE).

**Thiết kế**

1. **Timeline theo chapter**:
   - `ProductionTimelineSourceRepository.findChapter(projectId, chapterId)` và `findBeats(projectId, chapterId)`.
   - `GetProductionTimelineUseCase.executeForChapter(projectId, chapterId)` trả `ChapterTimelineView`.
   - Cờ project-level `timeline.readyForRender()`: tách thành query nhẹ `ProductionTimelineMapper.projectRenderReadiness(projectId)` (chỉ trả boolean + lý do), không dựng toàn bộ timeline.
2. **Đếm shot bằng SQL**: thêm `ProductionStatusMapper.countShots(projectId, chapterId)` dùng `COUNT(*) FILTER (WHERE status = ...)` cho queued/generating/validating/passed/failed/manual_review và `selected_shots`.
3. **Blocked shots**: phụ thuộc `GenerationPreflightEvaluator` (voice readiness tính trong Java), nên chưa đưa hết về SQL được. Chỉ load dữ liệu cần cho preflight (audio cues có speaker + resolved voice), không load takes và selected takes.
4. **Desktop**:
   - Chỉ poll `status` (đã rẻ).
   - Status response thêm `productionSignature` (hash của `max(updated_at)` của shots/takes/selected_takes trong chapter + các counter).
   - `useChapterProduction` tắt `refetchInterval`; chỉ invalidate khi `productionSignature` đổi hoặc khi SSE báo job terminal (`refreshProduction` đã có).
5. Giữ nguyên DTO `ChapterProductionStatusView` để tương thích; chỉ thêm field mới.

**Test**

- Test so sánh: với fixture chapter lớn, `getStatus` mới trả kết quả giống hệt bản cũ (golden test chạy cả hai implementation trong giai đoạn chuyển tiếp).
- Đếm query bằng MyBatis interceptor hoặc `pg_stat_statements` trong integration test: status ≤ 6 câu query, không chạm bảng `takes`.
- Desktop node test: `productionSignature` không đổi → không refetch production.

**Acceptance:** p95 của status giảm ≥ 70% so với baseline mục 1.

---

## 4. Milestone C — Hợp nhất SSE (F3)

**Hiện trạng**

| Endpoint | Implementation | Vấn đề |
| --- | --- | --- |
| `/api/v1/generation-events` | `GenerationEventStreamService` + `GenerationDatabaseEventListener` (LISTEN) | Không client nào dùng (đã grep `app/desktop`, `packages`, `documentation`), nhưng giữ 1 connection Hikari vĩnh viễn |
| `/api/v1/generation-jobs/{id}/events` | `GenerationJobEventStreamService` | Poll DB mỗi 750ms, 2 query cho mỗi job đang được subscribe; `send` blocking chạy trên thread scheduler |
| `/api/v1/projects/{id}/generation/events` | `SseGenerationJobEventBroadcaster` (in-memory) | Timeout 2 phút, không heartbeat, không xóa key rỗng, phát trước commit (F1), không chạy được nếu nhiều instance |

**Kiến trúc đích**

```text
generation_jobs (trigger)
        │ pg_notify('narrativex_generation_events', payload)   ← chỉ phát khi COMMIT
        ▼
GenerationNotificationListener   (connection riêng, ngoài Hikari)
        ▼
GenerationEventHub   (fan-out theo projectId và jobId, gửi trên virtual thread)
   ├─► /projects/{id}/generation/events   (payload giữ nguyên contract Desktop hiện tại)
   └─► /generation-jobs/{id}/events       (khi có notify cho jobId → load snapshot 1 lần → gửi nếu khác)
```

**Các bước**

1. **Listener trên connection riêng**
   - Mở `PgConnection` bằng `DriverManager` với cùng URL/credential (`DataSourceProperties`), không lấy từ Hikari.
   - Vòng lặp `getNotifications(timeoutMs)` giữ nguyên; reconnect có backoff 1s → 30s.
   - Sau mỗi lần reconnect thành công → hub phát event `resync` tới mọi client. Notification trong lúc mất kết nối bị mất, client phải refetch.
2. **`GenerationEventHub`**
   - `Map<UUID projectId, Set<Client>>`, `Map<UUID jobId, Set<JobClient>>`; xóa key khi set rỗng.
   - Gửi qua `Executors.newVirtualThreadPerTaskExecutor()`. Mỗi client có lock riêng để giữ thứ tự event; client chậm không chặn listener.
   - Heartbeat comment mỗi 15s cho mọi client. Timeout emitter 30 phút (client tự reconnect như hiện tại).
   - Project stream: map payload DB sang đúng contract Desktop đang dùng (`jobId`, `projectId`, `type`, `status`, `step`, `progress`, `active`, `terminal`, `errorCode`) và giữ tên event `connected`, `job.updated`, `job.completed`, `job.failed`. Desktop không cần sửa logic.
   - Job stream: khi nhận notify cho `jobId` có subscriber → gọi `findByJobId` **một lần**, dùng chung cho mọi subscriber của job đó; gửi `snapshot` nếu khác snapshot trước. Giữ `eventId()` hiện có.
   - Lưới an toàn: tick 15s cho các job có subscriber nhưng không nhận notify trong 15s (phòng mất notify). Thay cho poll 750ms.
4. **Gỡ code cũ**
   - Xóa `GenerationEventStreamService`, `GenerationEventController`, `GenerationEventStream` (endpoint `/generation-events` không có client).
   - Xóa `GenerationJobEventStreamService.publishChanges()` polling; giữ class mỏng hoặc gộp vào hub.
   - `SseGenerationJobEventBroadcaster.broadcastJobEvent` thành no-op rồi xóa cùng `GenerationJobEventBroadcaster`. Listener F1 lúc này chỉ còn phục vụ batch resume (F4).
5. **Feature flag rollout**: `narrativex.generation.sse.mode = notify | legacy` (mặc định `legacy` ở PR đầu, chuyển `notify` sau khi verify runtime, xóa `legacy` ở PR sau).
6. **Docs**: cập nhật `docs/architecture/compute-protocol.md` (phần realtime) và ADR-0003 nếu mô tả cơ chế SSE; theo AGENTS.md chỉ cần sync docs, không cần ADR mới vì không thêm hạ tầng.

**File**

- `generation/infrastructure/realtime/*`, `generation/infrastructure/sse/*`, `generation/application/service/GenerationJobEventStreamService.java`
- `generation/api/controller/GenerationEventController.java`, `ProjectGenerationEventController.java`, `GenerationJobController.java`
- Desktop: không đổi logic; thêm test contract payload.

**Test**

- PostgreSQL integration: update `generation_jobs` trong transaction → client project nhận `job.updated` **sau** commit; rollback → không nhận gì.
- Kill connection listener (`pg_terminate_backend`) → listener reconnect, client nhận `resync`.
- Client chậm (emitter có `send` bị block) không làm trễ client khác > 100ms.
- Đo: với 5 job stream mở và không có job chạy, số query trong 60s gần 0 (trước đó khoảng 160 query/phút/job).
- Desktop: `node --test` cho `project-event-subscription.ts` với payload từ hub mới; runtime verify bằng Electron theo AGENTS.md (chạy một job, quan sát UI cập nhật không cần poll).

**Acceptance**

- Độ trễ callback → UI p95 < 1s khi SSE kết nối.
- Không còn `@Scheduled` nào poll `generation_jobs` cho mục đích SSE.
- Hikari active connections lúc idle = 0.

---

## 5. Milestone D — Integrity asset trên Desktop (F6)

**Hiện trạng**

- `local-asset-preview-protocol.ts` → `storage.resolveAsset()` → `ensureProject()`: lấy `withProjectLock`, chạy 8 `mkdir`, kiểm tra thư mục an toàn, đọc và parse manifest → `sha256File()` **toàn bộ file**.
- Cache path có TTL 60s; không gộp các request trùng đang chạy dở; `Map` không có giới hạn.
- Shotboard 50 asset → 50 lần lock tuần tự + 50 lần hash full; sau 60s lại hash lại.
- `resolveArtifact`, `segment-cache.ts` (`isValid`), `fileMatches` cũng hash full mỗi lần dùng.

**Thiết kế**

1. **Tách layout và manifest khỏi `ensureProject`**
   - `ensureProjectLayout(projectId)`: memo `Set<projectId>` trong process; chỉ tạo thư mục một lần.
   - `readManifestCached(projectId)`: cache trong bộ nhớ, khóa theo `projectId`, kèm `mtimeMs` của file manifest. Mọi chỗ ghi manifest trong `ProjectStorage` cập nhật cache ngay sau khi rename atomic.
   - `ensureProject` giữ API cũ nhưng dùng hai hàm trên; chỉ lấy project lock khi **ghi**.
2. **`IntegrityCache`** (mới, `main/local-storage/integrity-cache.ts`)
   - Key: absolute path. Value: `{ size, mtimeMs, ino, sha256, verifiedAt }`. LRU 5.000 entry.
   - `verifyFile(path, expectedSha, mode)`:
     - `mode: "fast"`: `stat` → nếu `size/mtimeMs/ino` khớp entry đã verify với cùng `expectedSha` → OK; nếu không → hash full một lần rồi cập nhật cache.
     - `mode: "full"`: luôn hash.
   - Gộp request trùng: `Map<path, Promise<string>>` cho các hash đang chạy.
3. **Chính sách theo đường dùng**

   | Đường dùng | Mode |
   | --- | --- |
   | Preview protocol (`nx-asset://`) | `fast` |
   | Segment cache reuse | `fast` |
   | Local render preflight (`local-render-preflight.ts`) | `full` (giữ semantics integrity của render final) |
   | Upload/finalize artifact, `project-renderer.ts` final checksum | `full` |
   | `verifyAssets` (IPC kiểm tra thủ công) | `full` |

4. **Preview protocol**
   - Bỏ TTL 60s; mỗi request chỉ `stat` (rẻ) qua `IntegrityCache`.
   - Gộp request trùng theo `projectId:assetId:revision`.
   - LRU giới hạn 1.000 entry cho map path.
5. **Lỗi**: checksum mismatch ở mode `fast` (sau khi rehash) vẫn trả 404 như hiện tại và log `warn` một lần cho mỗi asset.

**File**

- `src/main/local-storage/project-storage.ts`, `file-integrity.ts`, `local-asset-preview-protocol.ts`
- `src/main/rendering/segment-cache.ts`, `local-render-preflight.ts` (chỉ truyền mode)
- mới: `src/main/local-storage/integrity-cache.ts`

**Test (`node --test`)**

- 50 request đồng thời cho cùng asset → `sha256File` được gọi 1 lần (spy).
- Sửa nội dung file (mtime đổi) → rehash → mismatch → 404.
- Đổi file nhưng giữ nguyên size và mtime (`utimes`) ở mode `full` → vẫn phát hiện mismatch.
- `ensureProject` gọi 100 lần → `mkdir` chỉ chạy ở lần đầu.
- Manifest được ghi → cache phản ánh ngay ở lần đọc tiếp theo.

**Runtime verification (bắt buộc theo AGENTS.md):** mở Chapter có ≥ 30 shot trong Electron, đo thời gian load shotboard trước/sau, kiểm tra console và request lỗi, chụp screenshot làm bằng chứng.

---

## 6. Milestone E — generation-service

### F7. Stream video LTX qua file tạm

**Hiện trạng:** `LtxVideoExecutor.execute` gom output vào `bytearray` (giới hạn 2 GB) → `bytes(data)` cho `inspect_native_video` (hàm này lại ghi ra file tạm) → `bytes(data)` lần nữa cho `upload`. `HttpArtifactAdapter.upload` hash SHA-256 đồng bộ trong event loop. `download` gom chunk rồi `b"".join`.

**Thiết kế**

1. Mở rộng `ArtifactPort`:

   ```python
   async def upload_file(self, target: OutputArtifactTarget, path: Path, sha256: str, size: int) -> ProducedArtifact
   async def download_to_file(self, reference: InputArtifactRef, path: Path) -> None
   ```

   Giữ `upload(bytes)` và `download() -> bytes` cho artifact nhỏ (image, audio).
2. `upload_file` gửi `content=` một async generator đọc file từng 1 MiB (qua `asyncio.to_thread`) và đặt header `Content-Length`.
3. LTX:
   - Tạo file tạm trong `settings.work_directory/ltx/<prompt_id>.mp4.part`.
   - Stream từ `download_image_stream` vào file, cập nhật `hashlib.sha256` và bộ đếm byte theo từng chunk; kiểm tra `ftyp` trên chunk đầu.
   - `inspect_native_video(path: Path)`: đổi `media.py` nhận path, bỏ bước ghi lại file.
   - `upload_file(...)` với sha/size đã tính.
   - `finally`: xóa file tạm (kể cả khi cancel).
4. `upload(bytes)` hiện có: chạy `hashlib.sha256` qua `asyncio.to_thread` khi `len(content) > 1 MiB`.

**Test**

- Fake ComfyUI stream 200 MB → `tracemalloc` peak < 32 MB; sha/size đúng.
- Cancel giữa lúc download → file tạm bị xóa, ném `AmbiguousOutcomeError` như hiện tại.
- Output vượt `max_artifact_bytes` → dừng ngay, xóa file tạm.

### F8. SQLite execution journal

**Hiện trạng:** `with sqlite3.connect(...) as connection:` chỉ commit, **không đóng** connection. Mỗi thao tác mở connection mới; không bật WAL, không có `busy_timeout`. `ExecutionService.submit()` gọi `recoverable()`, hàm này `model_validate_json` mọi task ACCEPTED/RUNNING chỉ để đếm số task held.

**Thiết kế**

1. `_connect()` thành context manager dùng `contextlib.closing` và commit/rollback rõ ràng.
2. Khi `initialize`:

   ```sql
   PRAGMA journal_mode = WAL;      -- persistent
   PRAGMA synchronous = FULL;      -- giữ durability cho submission checkpoint (ADR-0003)
   ```

   Mỗi connection: `PRAGMA busy_timeout = 5000`.
3. Index: `CREATE INDEX IF NOT EXISTS idx_execution_attempts_state ON execution_attempts (state, submission_state)`.
4. Thêm `count_held_ambiguous(exclude: set[tuple[UUID, UUID]]) -> int` bằng `SELECT task_id, attempt_id FROM execution_attempts WHERE state IN ('ACCEPTED','RUNNING') AND submission_state IN (<ambiguous states>)`. Không parse `task_json`. `submit()` dùng hàm này.
5. Cân nhắc sau (chưa làm trong plan này): một connection dài hạn cho mỗi worker thread. Chỉ làm nếu benchmark cho thấy chi phí mở connection đáng kể.

**Test:** test hiện có của journal phải pass; thêm test không còn `ResourceWarning` (`-W error::ResourceWarning`); test `count_held_ambiguous` khớp với cách đếm cũ.

### F9. Cache kết quả hash model LTX

**Hiện trạng:** `verify_runtime_files` hash SHA-256 toàn bộ checkpoint mỗi lần process khởi động.

**Thiết kế**

- Sidecar `settings.state_directory/ltx-model-verification.json`: `{path, size, mtime_ns, sha256, verified_at}` cho từng model.
- Nếu `size` và `mtime_ns` khớp với sidecar và `sha256` trong sidecar khớp `MANIFEST` → bỏ qua hash.
- Biến môi trường `NARRATIVEX_LTX_FORCE_MODEL_REHASH=true` để ép hash lại.
- Vẫn luôn kiểm tra `git rev-parse` và `git status` (rẻ).
- Ghi chú bảo mật trong `app/generation-service/README.md`: ai có quyền ghi thư mục model đều có thể sửa mtime; đây là mô hình tin cậy chấp nhận được vì người đó đã kiểm soát được file.

**Test:** lần 1 hash và ghi sidecar; lần 2 không gọi `hashlib.file_digest` (monkeypatch); đổi mtime → hash lại.

### F10. Retention cho outbox và receipt

**Backend**

- `ComputeHousekeepingJob` (`@Scheduled` mỗi giờ), xóa theo lô `LIMIT 1000` lặp tới hết:
  - `outbox_events` có `status = 'PUBLISHED'` và cũ hơn 7 ngày.
  - `compute_event_receipts` cũ hơn 30 ngày. An toàn vì event trễ hơn mức đó sẽ rơi vào `ALREADY_TERMINAL` hoặc `STALE_SEQUENCE`.
- Cấu hình qua `narrativex.retention.*`.
- The current V6 baseline owns the partial `outbox_events` pending index.

**generation-service**

- `OutboxDeliveryService` cứ mỗi 3.600 vòng gọi `journal.prune_delivered_outbox(older_than=7 ngày)`.
- Không xóa `execution_attempts` trong plan này, vì replay/idempotency cần chúng. Retention cho bảng này cần quyết định riêng.

---

## 7. Milestone F — Dọn dẹp

### F12. Dependencies của Desktop

- Chuyển `electron-vite`, `@vitejs/plugin-react` sang `devDependencies`. electron-builder đóng gói mọi production dependency vào `app.asar` dù `files` chỉ liệt kê `out/**`.
- Verify: `npx asar list dist/win-unpacked/resources/app.asar | findstr node_modules` trước/sau; ghi kích thước installer vào review.
- Chạy `npm run check` và `node scripts/verify-dependency-lock.mjs`.

### F13. Code legacy và docs drift

- `ComputeExecutionDispatcher`: xóa 5 constructor legacy; tạo test builder `ComputeExecutionDispatcherFixtures` trong `src/test`.
- `ComputeObservationReconciler` (`@Deprecated(forRemoval = true)`): xóa nếu không còn caller ngoài test.
- `README.md`: sửa câu "baseline V1–V10" theo inventory hiện tại trong `docs/architecture/database.md`.
- `database.md`: keep the inventory aligned with the pre-production V1–V7 baseline.
- Chạy `git diff --check` và kiểm tra link đã sửa.

---

---

## 8. Kiểm tra cho mỗi PR

Theo `CONTRIBUTING.md`:

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test '-Dnarrativex.buildDirectory=target/verification/target'

# Generation service
cd ../generation-service
python -m pytest
python -m ruff check .
python -m mypy src
cd ../..

# Desktop
cd app/desktop
npm test
npm run type-check
npm run build

# Docs
git diff --check
```

Với F3, F5, F6 (ảnh hưởng UI Desktop): bắt buộc runtime verification bằng Electron/Playwright theo mục "Mandatory Desktop UI Verification" trong `AGENTS.md`. Nếu không chạy được thì báo "runtime-verification blocked", không đánh dấu DONE.

---

## 9. Chia PR đề xuất

| PR | Nội dung | Flag |
| --- | --- | --- |
| 1 | F1 + F2 + F11 | — |
| 2 | F5 (backend status nhẹ + `productionSignature`) | — |
| 3 | F5 (Desktop chỉ poll status) | — |
| 4 | F4 phần 1: lanes + reservation + CAS audit | `dispatch.parallel-enabled=false` |
| 5 | F4 phần 2: batch scheduler + V6 baseline index + bật flag | bật flag |
| 6 | F3 phần 1: listener riêng + hub + generation-job event trigger | `sse.mode=legacy` |
| 7 | F3 phần 2: chuyển `notify`, gỡ code cũ | `sse.mode=notify` |
| 8 | F6 | — |
| 9 | F7 + F9 | — |
| 10 | F8 + F10 | — |
| 11 | F12 + F13 | — |
