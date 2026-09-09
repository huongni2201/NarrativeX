# Kiểm chứng source ngày 2026-09-08

Review tại HEAD `fb028d9d7`. Không sửa implementation/database. Giữ nguyên báo cáo AUDIT_2026_09_08.md có sẵn; báo cáo đó dùng HEAD cũ nên không dùng kết quả cũ làm bằng chứng cho lần chạy này. Đây là audit có trọng tâm, không chứng nhận mọi file đều sạch.

## Findings ưu tiên

1. **P1 — Shared contract chưa export đầy đủ, Desktop type-check fail.** `packages/client-contracts/src/index.ts:23` không export `StoryboardGenerationBatch`, `PrepareStoryboardGenerationBatchInput`, `StoryboardGenerationBeatSnapshot`, `StoryboardGenerationReference` dù đã khai báo trong `generation.ts`. Renderer import chúng qua package root, dẫn tới TS2305 và nhiều TS7006 dây chuyền. Bổ sung public exports, chạy lại compiler. JSX cũ đã sửa; build hiện PASS, không còn kết luận build fail như audit trước.

2. **P1 — Entitlement export chưa nối đầy đủ.** `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCase.java:85` kiểm tra quality; dòng 109 reserve cost/concurrency, không reserve quota export tháng. `application/render/ProjectRenderProfileFactory.java:9` không đưa watermark policy vào render profile. `UserQuotaAccess` và QuotaMapper vẫn có các field tương ứng, nhưng không thấy enforcement trong luồng này. Rủi ro export vượt gói và thiếu watermark bắt buộc. Cần admission/settlement idempotent và snapshot policy server. Đây là kết luận control-flow, chưa dùng tài khoản thật để export.

3. **P1 — LocalMediaStorage không publish file atomically.** `app/ai-worker/src/narrativex_worker/narration/storage.py:207` ghi trực tiếp file cuối; `find()` tính checksum từ bytes đang tồn tại và trả metadata rỗng. Crash giữa ghi có thể để lại file dở; retry cùng key báo conflict, hoặc reader coi file tồn tại là đã hoàn tất. Cần temporary file + atomic publication + metadata integrity bền vững; không dùng checksum tính lại từ file dở làm bằng chứng hoàn tất. Lần này xác nhận source, chưa chạy crash-injection.

4. **P2 — Favorite không đồng bộ local snapshot.** `app/desktop/src/renderer/features/projects/queries/projects.queries.ts:61` chỉ mutate backend và invalidate cache. Dòng 113 đọc lại local catalog, không lấy metadata backend hoặc ghi trạng thái favorite vào catalog. Click sao có thể vẫn hiển thị trạng thái cũ và lần click sau tiếp tục add. Cần cập nhật snapshot/cache của project đã đăng ký local, giữ discovery device-local.

5. **P2 — Race thay reference sau khi CharacterVersion LOCKED.** `SetCharacterVersionReferencesUseCase.java:38` đọc trạng thái trước `replace` dòng 100. `CharacterMapper.xml:32` SELECT không khóa; `CharacterVersionReferenceMapper.xml:20` DELETE không guard parent status. Luồng lock có thể commit giữa hai bước đó. Optimistic version trên update parent không bảo vệ thao tác replace child không update parent. Cần serialize lock/replace trên cùng parent. Chưa kiểm chứng interleaving bằng PostgreSQL thật.

6. **P2 — Replay ảnh mất MIME.** `narration/storage.py:202` trả `find()` khi key tồn tại; `_mime_for_path` suy MIME từ đuôi file. Image provider dùng key không extension nên lần đầu `image/png`, replay `application/octet-stream`. Đã tái hiện bằng implementation thật và temporary directory, cùng bytes/checksum/key. Cần persist MIME/metadata và phục hồi chúng khi replay.

7. **P2 — Retry idempotent bị validation hiện tại chặn.** `CreateRegenerationJobUseCase.java:75` kiểm tra expiry/source trước lookup accepted job ở dòng 86. Response bị mất rồi retry sau TTL sẽ trả stale thay vì job đã nhận. `CreateProjectRenderUseCase.java:67` cũng validate device/timeline trước replay. Cần lookup replay và xác minh ownership/request scope trước admission mới; giữ kiểm tra key khác payload.

8. **P2 — Gate Windows resolve sai Maven wrapper.** `scripts/verify-local.py:24` chỉ resolve theo cwd nếu executable bắt đầu `./`, trong khi Windows dùng `mvnw.cmd`. Gate root thực tế fail `missing executable: mvnw.cmd`; gọi wrapper trực tiếp khởi chạy được Maven. Sửa resolution theo Step.cwd.

## Migration, field/file thừa và clean code

- Schema narration cũ (`narration_sets`, `narration_documents`, alignment/document tables) còn trong V4 và có FK trong MediaPlanMapper. Chưa thấy runtime producer qua search source. Đây là ứng viên tính năng chưa nối/di sản; chưa đủ bằng chứng xóa DB an toàn.
- `app/ai-worker/src/narrativex_worker/config.py:50`: `backend_url` không thấy runtime reader qua search source, ứng viên config dư sau polling PostgreSQL.
- `app/desktop/src/preload/types.ts:84`: `workspacePath` xuất qua DTO nhưng renderer không thấy consumer. Nên giữ path nội bộ main và thu hẹp public DTO; không có bằng chứng path bị gửi backend.
- `app/desktop/src/renderer/styles.css:74`: `--voice-card` bị override tại dòng 97; các token voice-card chỉ được tìm thấy trong stylesheet, ứng viên dọn.
- API response còn phụ thuộc outbound persistence contract: `ChapterContinuityResponse.java:3` import `ChapterContinuityRepository.CurrentContinuity`. Nên map từ application query/view để API không bị kéo theo repository shape.
- README dòng 119 và flyway-baseline-policy chỉ mô tả V1–V8 trong khi migration directory đã vượt V8. Docs-drift PASS không bắt được sai lệch này. Không dùng việc migration files tồn tại để khẳng định DB đang chạy đã migrate xong; chưa kiểm tra flyway_schema_history.
- UI/logic **đã tách một phần**: có api/queries/model/components/screens, preload riêng và semantic tokens. `StoryboardScreen.tsx:349` vẫn chứa dispatch/reconciliation/concurrency/attempt orchestration của Gemini queue. Nên tách controller/hook và test state transitions; độ dài file tự nó không phải bug.
- Không thấy mock/demo/fixture selector trong renderer runtime qua search. Worker có fake provider modes và guard production bắt buộc real adapter theo enabled role (`config.py:251`). Không nên xóa fake test adapters mặc định hay tuyên bố toàn repo không có fake.

## Verification lần này

| Check | Kết quả |
|---|---|
| Desktop tests | 376 pass, 4 skipped |
| Desktop type-check | FAIL: missing public exports + implicit-any dây chuyền |
| Desktop build | PASS |
| Desktop dev/runtime UI | BLOCKED: Electron uninstall; chưa có screenshot hay flow verification |
| Worker pytest | 322 pass, 32 skipped |
| Worker Ruff | FAIL: 14 errors |
| Worker mypy src | FAIL: unused ignore trong providers/tts/vieneu.py:49; 108 files checked |
| MIME replay reproduction | Xác nhận image/png đổi thành application/octet-stream |
| Secret scan / docs drift | PASS / PASS |
| Root quality gate | FAIL: không resolve mvnw.cmd; Docker không có, Compose không thực sự được kiểm tra |
| Backend wrapper gọi trực tiếp: verify | FAIL: 453 tests, 5 failures, 13 errors, 68 skipped |

Backend có errors ở cleanup JUnit extension context của các test local media và unnecessary Mockito stubbing. Không quy tất cả failures/errors thành runtime bug; cần đọc từng surefire report và chạy lại các test môi trường sau khi khắc phục. Kết quả này khác số errors trong audit cũ.

Logs mới: `.tmp/recheck-desktop-tests.log`, `.tmp/recheck-desktop-build.log`, `.tmp/recheck-worker-tests.log`, `.tmp/recheck-worker-lint.log`, `.tmp/recheck-backend.log`. Không diễn giải skipped tests là pass integration.

FE chưa đủ cơ sở xác nhận ổn: compiler còn đỏ và runtime bị chặn. Đối chiếu source với ADR-0017 và Web Interface Guidelines (https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) chỉ là kiểm tra tĩnh; không xác nhận keyboard, loading/error states hoặc overflow trên màn hình thật.

Ưu tiên: public contracts/gate → export policy và storage integrity → race/replay/favorite → dọn boundary/schema/docs → chạy đầy đủ PostgreSQL và Desktop flows trước phát hành.
