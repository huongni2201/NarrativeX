# Plan: Sản xuất video đồng nhất, giọng cố định và tạo lại từng Beat/Shot

**Ngày:** 2026-10-17

**Trạng thái:** PARTIAL — phần lớn đợt A và lõi đợt B đã triển khai; đợt B còn acceptance, đợt C–E còn TARGET.

### Tiến độ implement

- Đã triển khai: CharacterVersion/appearance/outfit của nhân vật tham gia VisualBeat được khóa vào prompt và snapshot của Shot; preview dùng cùng compiler; Shot mặc định nhận visual direction; Native AV chặn cue không phải `DIALOGUE` và Beat nhiều Shot chưa phân bổ cue; admission ước lượng thời lượng thoại; Desktop hiển thị từng Shot, Take drawer và pending request theo `shotId`.
- Đã thêm local recovery cho request Take: sau timeout Desktop giữ nguyên input và idempotency key để đối soát lại; Take đang chọn vẫn là nguồn preview khi Shot có attempt mới.
- F04 PARTIAL: V19 lưu mapping một AudioCue đầy đủ tới đúng một Shot, kiểm tra cue/Shot thuộc cùng sequence và pin cue row version; cue bị chia đoạn hoặc đã thuộc sequence khác bị chặn. Desktop có editor phân bổ và generation dùng đúng subset. Native AV vẫn yêu cầu câu nằm trọn trong một Shot.
- F06 PARTIAL: selection yêu cầu đủ checklist nội dung; backend lưu checklist và fingerprint gắn Take input + trim, dùng row version để phát hiện chọn trùng cửa sổ. F07 PARTIAL: có preview quanh In/Out và preview Take đã chọn ở Shot trước/sau trong cùng sequence; chưa có word-level alignment nên cảnh báo yêu cầu nghe/kiểm tra thủ công.
- Đợt B PARTIAL: POST tạo image attempt cho một VisualBeat dùng media plan đã lọc còn đúng một beat; GET trả lịch sử qua các job; review/selection kiểm tra Project, revision, READY/approved và chọn ảnh là thao tác riêng. Desktop có tạo/tạo lại, lịch sử, duyệt, từ chối và chọn ảnh. Chưa kiểm chứng worker thật hoặc project có Shot/Scene dùng được.
- Còn thiếu: PostgreSQL verification cho V17/V19, kiểm thử UI bằng sequence có Shot thật và acceptance F06–F09. Đợt B còn kiểm chứng worker thật, lỗi/replay/restart bằng runtime; đợt C–E chưa triển khai.
- Kiểm tra: 94 backend unit/API tests liên quan pass. `FlywayBaselineStructureTest` hiện fail ở assertion `supportsSpeakingRate` trong V7 seed (V7 và test này đã có thay đổi từ trước lượt implement). Desktop type-check và build pass. 2 PostgreSQL integration tests bị skip vì Docker named pipe không truy cập được. Electron mở được, nhưng chapter đang xem chưa có Scene/Shot để chạy Take flow. Mình không nhấn nút phân tích; sau reload, UI báo agy đang chạy 32% (nguồn chưa xác định) và mình để nguyên. UI completion gate còn blocked. V17/V19 chưa được áp dụng lên DB thật.

**Phạm vi:** backend, generation-service, Desktop và render cục bộ.

**Plan sửa lỗi:** [Production flow bug fixes](20261017-production-flow-bug-fixes.md).

## 1. Kết quả người dùng nhận được

- Mỗi nhân vật sử dụng một phiên bản giọng cụ thể qua các cảnh; nghe và duyệt audio trước khi sinh video theo audio.
- Mỗi VisualBeat có thể tạo ảnh, tạo lại ảnh, xem lịch sử và chọn ảnh đã duyệt làm reference/keyframe. Ảnh là đầu vào hỗ trợ sản xuất video, không thay video thành ảnh pan/zoom.
- Mỗi Shot có nút **Tạo video**, **Tạo lại video**, danh sách Take, xem/nghe, trim và **Chọn take này**.
- Beat có nhiều Shot hiển thị đầy đủ từng Shot. Nút cấp Beat mở danh sách Shot cần tạo/tạo lại; chỉ những Shot được chọn mới chạy.
- Tạo lại ảnh/video giữ bản đang dùng. Kết quả mới là ứng viên; chỉ thao tác chọn rõ ràng mới thay selection.
- Duyệt hình, câu thoại, khẩu hình và điểm nối trước khi xuất MP4; kiểm tra kỹ thuật được hiển thị riêng với duyệt nội dung.

## 2. Hiện trạng và bằng chứng

| Thành phần | Trạng thái đã đối chiếu | Phần cần làm |
|---|---|---|
| Shot/Take | IMPLEMENTED foundation: `POST /api/v1/projects/{projectId}/shots/{shotId}/takes`, `retryFromTakeId`, chọn take và trim | Hoàn thiện action/recovery, mọi Shot và lựa chọn tường minh |
| Desktop video | PARTIAL: hiển thị mọi Shot có toolbar/drawer theo `shotId`; preview lấy SelectedTake độc lập trạng thái Shot; timeline map theo cut identity | Action chọn subset ở cấp Beat, runtime failure/reload flow và keyboard/UI acceptance |
| Ảnh Beat | PARTIAL: per-Beat attempt, lịch sử, review và chọn ảnh đã có; worker conditioning và runtime chưa kiểm chứng | Keyframe conditioning, generation thật và acceptance lỗi/replay |
| Giọng Character | PARTIAL: profile mô tả bằng chữ; preset/custom voice thuộc catalog | Gắn preset/reference thực sự vào profile bất biến và tổng hợp thoại nhiều nhân vật |
| Video worker | IMPLEMENTED foundation: pinned T2V/native AV; chặn input reference và AUDIO_FIRST | Profile mới cho image/audio conditioning, preflight và benchmark thực |
| Location | PARTIAL: đặc tả chuẩn và continuity bằng chữ đã vào video prompt | Tích hợp [plan Location](location-continuity.md), reference conditioning và kiểm chứng hình |
| Render | IMPLEMENTED foundation: native cuts, trim hình/tiếng cùng nhau, snapshot schema 4 | Clock audio đã duyệt, mix/selection/review phiên bản mới |

Lượt audit trước trong cuộc hội thoại: 54 test backend và 13 test Desktop liên quan pass, có FFmpeg thật. Probe bước chuẩn bị input xác nhận mất character canon trong prompt, NARRATOR thành dialogue và 4.999 ký tự được nhận cho Shot 4 giây. Đây không phải bằng chứng GPU, khẩu hình hoặc full gate hiện tại.

`docs/current-status.md` được hướng dẫn tham chiếu nhưng đang thiếu; `docs/README.md` còn liên kết tới một số domain document không có trên đĩa. Khi bắt đầu mỗi đợt, dùng code/migrations/tests và ADR làm nguồn thực tế, ghi drift; không suy ra năng lực production từ các link này. Workspace có thay đổi của công việc khác: khảo sát lại và bảo toàn trước khi sửa.

## 3. Luồng đích và quyền quyết định thời gian

```text
Truyện đã lưu → phân tích văn bản, canon, Scene/Beat/AudioCue
                  ├→ nhân vật + giọng cụ thể → script/các lượt nói có ngữ cảnh
                  │                          → audio đã duyệt + alignment
                  └→ bối cảnh + nhân vật chuẩn → ảnh Beat/Shot đã duyệt
                                      ↓
                    bố trí Shot theo audio và hành động
                                      ↓
              ảnh chuẩn + đúng đoạn thoại → video ứng viên của Shot
                                      ↓
                 duyệt → SelectedTake → xem điểm nối → render
```

Phân tích truyện qua `agy` vẫn nhận văn bản và trả cấu trúc. Audio được tạo/chọn sau đó; bước phân bổ Shot nhận timings đo từ audio. Việc phân tích nghe audio bằng model đa phương thức là DEFERRED, không cần để thực hiện luồng này.

Hai mode tường minh:

- **LTX_NATIVE_AV hiện có:** hình/tiếng đi cùng Take; giữ cách trim và snapshot cũ. Sau các bug fix vẫn phải duyệt thủ công, chưa hứa giữ giọng bằng preset/reference.
- **AUDIO_FIRST đề xuất:** audio đã duyệt là clock; model sinh hình theo đúng speech input. Chỉ mở khi profile worker, backend admission, Desktop và render đều hỗ trợ. Không tự fallback giữa hai mode, không đoán mode từ việc có `shotId`.

Audio nguồn giữ identity/checksum, time ranges và provenance. Encoding AAC trong MP4 có thể đổi bytes; kiểm tra audio ở mức timeline/decoded signal với sai số codec, không yêu cầu checksum container đầu ra bằng WAV nguồn.

## 4. Các quy tắc tạo lại

| Tình huống | Hành vi bắt buộc |
|---|---|
| Chưa có ảnh | **Tạo ảnh** → job một Beat → ứng viên mới → duyệt/chọn |
| Không ưng ảnh | **Tạo lại ảnh** → tùy chọn ghi điều muốn sửa → ứng viên mới; ảnh đang dùng giữ nguyên |
| Một Beat có nhiều góc máy | Ảnh Beat là mặc định; Shot cần góc khác có keyframe riêng. Không áp cùng một ảnh toàn cảnh cho mọi cận cảnh |
| Shot lỗi hoặc không ưng | **Tạo lại video** → chọn Take nguồn và lý do → tạo Take mới trên đúng Shot |
| Beat có nhiều Shot | Hiện N Shot; action cấp Beat cho chọn Shot, mặc định Shot failed/rejected/chưa có take; không chọn lại Shot đã duyệt |
| Đang chạy hoặc UNKNOWN | Hiện job và trạng thái thật. Chặn tạo trùng; UNKNOWN phải reconcile trước khi có attempt mới |
| Mất response sau submit | Giữ idempotency key của thao tác và tìm lại job. Chỉ thao tác tạo lại mới sau khi biết kết quả mới dùng key mới |
| Có SelectedTake rồi tạo lại | Preview vẫn phát SelectedTake cũ ngay cả khi trạng thái Shot chuyển sang generating; ứng viên mới xuất hiện riêng |
| Chọn ảnh/audio/giọng mới | Take/render cũ giữ snapshot cũ. So sánh dependency của bản mới, hiển thị cần xem lại; không xóa/sinh lại dây chuyền |
| Hai cửa sổ chọn khác nhau | Dùng expected row version cho selection; trả conflict và cho tải lại, không ghi đè âm thầm |

Reason presets là tùy chọn: sai nhân vật, sai bối cảnh, chuyển động, thoại/khẩu hình, kỹ thuật, muốn phương án khác. Backend kiểm tra reason/input như dữ liệu không tin cậy. **Tạo lại video** tạo Take mới; không gắn nhãn này với strategy `VIDEO_RETAKE` chưa được worker hỗ trợ.

## 5. Đợt A — sửa lỗi và nút video từng Shot, ưu tiên đầu tiên

**Phụ thuộc:** không cần profile GPU mới. Thực hiện [F01–F09](20261017-production-flow-bug-fixes.md#3-danh-sách-công-việc) trước khi quảng bá luồng chất lượng mới.

- [ ] Sửa mất character canon, visual direction, loại cue, phân bổ cue và duration admission; mỗi lỗi có regression test.
- [ ] Hiển thị toàn bộ Shot trong Beat; action và drawer nhận `shotId` chính xác, không còn lấy Shot đầu mặc định.
- [ ] Hoàn thiện retry terminal/UNKNOWN, chống submit trùng, giữ selection cũ và optimistic concurrency.
- [ ] Tách nhãn đạt kỹ thuật/đã duyệt; preview và retry trạng thái lỗi có thể dùng bằng bàn phím.
- [ ] Chạy API/PostgreSQL tests và runtime Electron flow theo gate ở mục 10.

**Cổng:** Beat ba Shot có thể tạo lại riêng Shot thứ hai; hai Shot còn lại, selection cũ và snapshot render cũ không đổi. Video vẫn ở native mode hiện tại cho tới các đợt sau.

## 6. Đợt B — tạo/tạo lại ảnh từng Beat và chọn keyframe

**Điểm sửa:** `feature/generation/{api/controller/MediaGenerationController.java,application/usecase/CreateMediaJobUseCase.java,application/usecase/ReviewMediaGenerationItemUseCase.java}`, `MediaGenerationItemRepository`, image finalizer/lineage; Desktop `features/generation`, `features/storyboard`, `ChapterProductionStage`. Tên class/file mới chốt khi implement.

- [x] Thêm admission scope một VisualBeat cho image job; tái dùng durable outbox, media plan snapshot và capacity hiện có. Một Beat tạo đúng một item; lệnh không đổi cấu hình Project.
- [x] Thêm API POST/GET image attempts theo Beat, POST review candidate và `PUT .../visual-beats/{beatId}/selected-image` với `itemId` trong body. Kiểm tra Project/chapter/revision, idempotency và READY/approved trước khi chọn. Route gồm chapterId để backend kiểm tra current source.
- [ ] Dùng `media_generation_items` và `media_asset_lineage` để lưu ứng viên xuyên job; khảo sát finalizer để ngăn auto-attach kết quả mới. Chọn ảnh là transaction riêng có row version; rejected/failed ứng viên không thay preview hiện tại. Không tạo thêm bảng ImageTake nếu các bảng hiện có đủ.
- [ ] Snapshot mục đích ảnh là reference/keyframe, prompt, canon phiên bản, seed và input assets. Ảnh preview chưa có conditioning phải ghi rõ giới hạn; chỉ gắn `START_FRAME` cho video khi capability hỗ trợ.
- [ ] UI **Tạo ảnh/Tạo lại ảnh/Lịch sử ảnh/Chọn ảnh này** và import; còn thiếu note/prompt edit có kiểm soát và verification bằng project có dữ liệu.
- [ ] Tests: scope một Beat, retry/replay/conflict/UNKNOWN, old-image giữ nguyên khi success/failure, stale revision, asset khác Project, candidate review; Electron tạo lại rồi chọn ảnh bằng API thật.

**Cổng:** tạo lại ba lần có ba ứng viên độc lập; chỉ chọn lần thứ ba mới đổi ảnh đang dùng. Lỗi lần thứ tư không làm mất lần thứ ba.

## 7. Đợt C — giọng nhân vật cố định và audio được duyệt

**Điểm sửa:** `feature/character` (voice profile/SpeakerVoiceAccess), `feature/catalog`, narration use cases/adapters; `app/generation-service/src/narrativex_gpu_worker/adapters/executors`; Desktop `features/voices`; owning migrations V1/V3/V4/V5/V6 khi thực sự cần.

- [ ] Cập nhật đề xuất trong ADR-0006/0007/0008 trước khi đổi timing/execution contract; ADR-0005 cho render master ở đợt E. Giữ trạng thái TARGET/Proposed tới khi quyết định được chốt; không đánh dấu đã triển khai.
- [ ] Bổ sung voice binding có version: preset ID hoặc reference asset ID+checksum+scope; pin model revision và voice profile version. Tái dùng cột reference hiện có, chỉ thêm discriminator/catalog binding còn thiếu. Character tái dùng xuyên Project phải hiện rõ tác động; reference PROJECT không được dùng ở Project khác.
- [ ] Nối form Giọng nhân vật với preset/custom voice thực tế, nghe thử và duyệt; kiểm tra preset trên server/model được pin. Voice bị vô hiệu hóa hoặc reference mất phải báo blocker, không đổi sang default. Reference người thật cần consent/retention theo quy tắc repo.
- [ ] Tạo một script được duyệt có AudioCue offsets. Tổng hợp theo chương/lượt nói có ngữ cảnh và ghép thành audio master; không tổng hợp riêng mỗi VisualBeat. Cache đơn vị synth theo text+voice/model/reference+delivery; retry hình dùng lại audio đã duyệt.
- [ ] Narrator, DIALOGUE, INNER_MONOLOGUE, SYSTEM giữ loại và voice riêng. Giữ speech stems theo speaker/segment để điều khiển đúng miệng; giữ VO ngoài hình tách khỏi input điều khiển khẩu hình. Các part ở chung logical clock.
- [ ] Đo WAV thực và forced alignment chính bytes/text đã duyệt; snapshot audio asset, script hash, timings và voice versions. Tạo lại audio sinh revision ứng viên; chọn revision mới đánh dấu footage phụ thuộc cần xem lại, giữ bản cũ.
- [ ] Tests profile/preset/reference/scope/replay; fixtures multi-speaker để kiểm tra clock; benchmark VieNeu thật trước khi tuyên bố giữ giọng. Xác minh upload/finalize custom voice và endpoint synth hiện đang được tài liệu đánh dấu unverified.

**Cổng:** cùng một Character nói qua ba cảnh vẫn pin cùng giọng; thay outfit không thay giọng; sinh lại hình không synth lại tiếng. Nghe duyệt mẫu bình thường/cảm xúc, ghi giới hạn thay vì bảo đảm giống 100%.

## 8. Đợt D — image/audio conditioning có capability và benchmark

**Điểm sửa:** `contracts/compute/v1/schemas`, examples, Java/Python task models, backend preflight/catalog/dispatch, LTX/ComfyUI executor/workflow và capability; Desktop runtime/readiness.

- [ ] Tích hợp phần reference conditioning của [Location plan](location-continuity.md), dùng chung Character/Location canon và asset đã duyệt; không triển khai trùng bộ quản lý Location ở plan này.
- [ ] Làm spike trên workflow LTX Audio-to-Video + first image; pin model/workflow/adapter revision, kiểm tra VRAM, độ dài, FPS và rounding theo frame. Workflow chính thức tồn tại không có nghĩa profile INT8 hiện tại chạy được.
- [ ] Thêm task schema/profile mới, giữ schema 1.1 native AV; không đổi nghĩa trường cũ. Đánh giá quy tắc major compatibility trong Compute Protocol; mọi thay đổi breaking phải có version/window tương ứng. Backend admit chính xác khả năng được quảng bá và test thực, không fallback T2V.
- [ ] Input dùng artifact ID/checksum/role và capability URL, không absolute path. Pin đúng ảnh Shot hoặc ảnh Beat được chọn và speech segment/time range; chủ động thay reference phải tạo request mới.
- [ ] Chỉ speech DIALOGUE của người xuất hiện trong shot điều khiển miệng. Narration/inner monologue không được làm mặt trong hình nói theo. Với reaction/B-roll, giữ VO cho final mix; nếu profile không tách được loại audio này thì chặn trường hợp đó hoặc yêu cầu chọn cách dựng được hỗ trợ.
- [ ] Hai người đối thoại cần speaker-to-visible-character mapping. Nếu profile chưa chứng minh được, yêu cầu tách thành Shot một người nói; không gán một primary voice cho toàn đoạn nhiều người.
- [ ] Tests contract/capability/missing reference/hash/duration/replay/UNKNOWN và regression native profile. Chạy pilot một Scene × ba góc × ba Take, có dialogue và reaction, rồi ghi kết quả dưới `docs/operations/benchmarks/`.

**Cổng:** audio đầu vào được giữ, video sinh theo timing thật; mặt/trang phục/bối cảnh và khẩu hình được người duyệt chấp nhận. Có số đo runtime/VRAM và failure cases. Fail cổng thì AUDIO_FIRST vẫn bị chặn; đợt A/B vẫn có thể dùng độc lập.

Tài liệu tham chiếu cần xác minh lại khi implement: [VieNeu voice reuse](https://github.com/pnnbao97/VieNeu-TTS#save--reuse-a-cloned-voice), [LTX open-source Audio-to-Video](https://docs.ltx.io/open-source-model/usage-guides/audio-to-video). Không tự nâng model/package đang pin theo tài liệu nhánh main.

## 9. Đợt E — timeline, duyệt điểm nối và export

**Điểm sửa:** `GetProductionTimelineUseCase`, render admission/snapshot, Desktop `features/production`, `src/main/rendering/{render-profile,render-manifest,segment-renderer,project-renderer,render-sync-validation}.ts` và cache/journal.

- [ ] Snapshot version mới cho AUDIO_FIRST, clock và ordered cuts tường minh; giữ render schema 3/4 đọc/khôi phục được. Backend không suy mode từ sự hiện diện Shot.
- [ ] Bố trí cuts trên audio master đã duyệt. Nhiều Shot chia sẻ một lượt thoại vẫn chỉ phát lượt thoại đó một lần. Render AUDIO_FIRST lấy audio master/stems làm nguồn, không phát thêm native speech của mỗi clip.
- [ ] Duyệt câu thoại/khẩu hình/nhân vật/bối cảnh/chuyển động và duyệt cặp Shot kế nhau. Persist review gắn input/selection fingerprints; đổi selection hoặc trim liên quan làm review cần xem lại, không sửa snapshot lịch sử.
- [ ] Cảnh báo điểm cắt nằm trong từ/câu từ alignment; phát thử đoạn trước/sau cut với khoảng ngữ cảnh. Cho người dùng điều chỉnh; không tự dời cut hoặc đổi nhịp.
- [ ] Giữ hard cut khi hợp lý; cho audio continuity/ambient mix có cấu hình và preview, mọi fade/overlap tham gia duration/clock/cache. Thêm J/L cut hoặc dissolve nâng cao chỉ khi đã có contract/acceptance cụ thể; không coi đó là điều kiện để sửa bug cơ bản.
- [ ] Quy định render readiness khi draft mới lệch ảnh/audio/voice đã pin: hiện blocker và cho chọn lại candidate phù hợp hoặc xác nhận giữ phiên bản cũ rõ ràng. Selection cũ hợp lệ vẫn xem/render theo phiên bản cũ; không bị xóa bởi việc tạo ứng viên.
- [ ] Tests full timeline cue coverage, không lặp/mất chữ, frame rounding, mixed VO/dialogue, audio drift, subtitles từ timings đo thật, selection/version conflicts, cache/recovery. Electron xuất MP4 và xem/nghe artifact thực.

**Cổng:** một chương thật xuất được video với giọng ổn định, câu không lặp/thiếu, narration không khiến nhân vật mở miệng, các Shot đã chọn giữ continuity và không cắt cụt thoại ngoài chủ ý người dựng.

## 10. Thứ tự giao hàng, schema và nghiệm thu

| Mốc | Phụ thuộc | Giá trị có thể nghiệm thu |
|---|---|---|
| A | Bug plan | Prompt đúng hơn, mọi Shot có retry an toàn |
| B | A phần retry/selection | Tạo lại ảnh một Beat, lịch sử và chọn ảnh |
| C | A phần cue/clock, quyết định ADR | Giọng cụ thể, audio master được duyệt |
| D | B+C và reference work trong Location plan | Pilot image/audio-conditioned video |
| E | C+D | Dựng theo audio, duyệt nối cảnh, export hoàn chỉnh |

Schema trước release tuân theo [database policy](../architecture/database.md): fold vào migration sở hữu, index ở V6, guard ở V5; xác minh freeze/applied history của DB thật trước khi chọn baseline rewrite hay forward migration. Không reset DB hiện có như một bước mặc định. Cập nhật inventory khi schema thay đổi.

Mỗi task hành vi đi kèm regression/contract/integration tests phù hợp. Theo [CONTRIBUTING](../../CONTRIBUTING.md), chạy full checks cho các module thay đổi trước merge. Trong môi trường Windows đã gặp lỗi Mockito self-attach, có thể nạp agent ở JVM startup theo setup test hiện hành; không đổi code sản phẩm để né lỗi môi trường.

UI gate cho A/B/C/E: Electron/Vite thật → Source/Canon/Audio/Production/Take drawer/Editor/Export bị ảnh hưởng → thực hiện create/regenerate/failure/reconcile/select/reload → kiểm tra console/network, dữ liệu giả, empty/loading/error, keyboard, overflow, dark/light → chụp screenshot. Fixture pass không thay thế runtime; nếu automation không có thì báo runtime-verification blocked.

Kịch bản bắt buộc: 2 nhân vật, 1 narrator, 1 Location, ít nhất 3 góc máy, một Beat có 3 Shot; tạo lại một ảnh, retry riêng Shot giữa do lỗi, tạo thêm Take vì chưa ưng, response submit bị mất, UNKNOWN, đổi selection và restart. Kiểm tra asset đang dùng trước/sau và snapshot export cũ đều truy nguyên được.

**DEFERRED:** automatic semantic QA/retry loop, tự chọn Take, tự dựng lại cả chương, voice LoRA, nâng cấp model hàng loạt và retention engine. Automated transcript/lip/identity scoring chỉ bổ sung sau quyết định ADR và benchmark; giai đoạn đầu dùng review của người dựng, không coi forced alignment là kiểm chứng câu được nói đúng hoặc khẩu hình.

## 11. Cập nhật tài liệu khi triển khai

- ADR-0005/0006/0007/0008: các refinement về clock, voice, review và profile trước thay đổi tương ứng; ADR-0010 tiếp tục sở hữu prompt snapshot.
- [Compute Protocol](../architecture/compute-protocol.md), [generation routing](../architecture/generation-routing.md), [editing pipeline](../architecture/editing-pipeline.md), [audio workspace](../architecture/desktop-audio-workspace.md), [database](../architecture/database.md), product capability matrix và kế hoạch Location tại đúng phần đã làm.
- Phục hồi status document từ dữ liệu đã xác minh nếu cập nhật trạng thái tổng thể; ghi IMPLEMENTED/PARTIAL/TARGET rõ. Không đánh dấu D/E hoàn tất bằng unit test hay fake provider.
