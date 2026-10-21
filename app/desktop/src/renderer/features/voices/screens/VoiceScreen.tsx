import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopVoice,
  GenerationJob,
  VoiceReferenceInput,
} from "../../../../shared/api-types";
import { AudioLines, MoreVertical, SlidersHorizontal, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toErrorMessage } from "@/lib/errors";
import { DesktopApiError } from "../../../api/client";
import { isActiveGenerationJobStatus } from "../../generation/generation-status";
import { useGenerationJob } from "../../generation/queries/generation.queries";
import {
  useGenerateBatchNarration,
  useGenerateNarration,
  useGenerateVoicePreview,
} from "../../generation/queries/narration.queries";
import { EmptyState } from "../../workspace/components/FeaturePage";
import { VoiceCard } from "../components/VoiceCard";
import { VoiceFiltersBar, type VoiceViewMode } from "../components/VoiceFiltersBar";
import { VoiceWorkspaceContext } from "../components/VoiceWorkspaceContext";
import { useVoiceSamplePlayer } from "../queries/use-voice-sample-player";
import {
  filterVoices,
  playableSampleUrl,
  resolveVoiceSelection,
  uniqueVoiceValues,
  voiceSupportsSpeakingRate,
  type VoiceSortMode,
} from "../model/voice-filters";
import {
  useImportVoiceAudioAsset,
  useUploadVoiceReference,
} from "../queries/voice-media.mutations";
import {
  useVoicePreviewResult,
  useVoiceReferenceAsset,
} from "../queries/voice-media.queries";

const DEFAULT_VOICE_ID = "vieneu-preset-minh-quan-pro";
const DEFAULT_PREVIEW_TEXT =
  "Xin chào, đây là giọng đọc mẫu được tạo từ đoạn giọng tham chiếu bạn vừa tải lên.";

export function VoiceScreen({
  projectId,
  chapters,
  voices,
  assets,
  section = "library",
  requestedVoice = null,
  active = true,
}: Readonly<{
  projectId: string;
  chapters: DesktopChapterDetails[];
  voices: DesktopVoice[];
  assets: DesktopAsset[];
  section?: "library" | "narration";
  requestedVoice?: DesktopVoice | null;
  active?: boolean;
}>) {
  const generate = useGenerateNarration();
  const generateBatch = useGenerateBatchNarration();
  const generatePreview = useGenerateVoicePreview();
  const importAudio = useImportVoiceAudioAsset(projectId);
  const uploadReference = useUploadVoiceReference();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [chapterId, setChapterId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speakingRate, setSpeakingRate] = useState("1");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [gender, setGender] = useState("all");
  const [provider, setProvider] = useState("all");
  const [tag, setTag] = useState("all");
  const [sortMode, setSortMode] = useState<VoiceSortMode>("name-asc");
  const [viewMode, setViewMode] = useState<VoiceViewMode>("grid");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceReference, setVoiceReference] = useState<VoiceReferenceInput | null>(null);
  const [voiceReferenceName, setVoiceReferenceName] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [narration, setNarration] = useState<{
    job: GenerationJob;
    chapterId: string;
    chapterTitle: string;
    voiceName: string;
    voiceId: string;
    speakingRate: number;
    voiceReference: VoiceReferenceInput | null;
  } | null>(null);
  const [narrationUncertain, setNarrationUncertain] = useState(false);
  const narrationQuery = useGenerationJob(narration?.job.jobId ?? null);
  const narrationStatus = narrationQuery.data?.status ?? narration?.job.status;
  const narrationActive = isActiveGenerationJobStatus(narrationStatus);
  const catalogSample = useVoiceSamplePlayer(projectId, chapterId || null);

  useEffect(() => {
    if (requestedVoice) selectCatalogVoice(requestedVoice.id);
  }, [requestedVoice]);

  useEffect(() => {
    catalogSample.stop();
    audioRef.current?.pause();
    setPlayingVoiceId(null);
  }, [section, active, catalogSample.stop]);

  useEffect(() => {
    if (!chapters.some((chapter) => chapter.id === chapterId)) setChapterId(chapters[0]?.id ?? "");
    const resolvedVoiceId = resolveVoiceSelection(voiceId, voices, DEFAULT_VOICE_ID);
    if (resolvedVoiceId !== voiceId) setVoiceId(resolvedVoiceId);
  }, [chapterId, chapters, voiceId, voices]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const audioAssets = useMemo(() => assets.filter((asset) => asset.type === "AUDIO"), [assets]);
  const languageOptions = useMemo(
    () => uniqueVoiceValues(voices.map((voice) => voice.language)),
    [voices],
  );
  const genderOptions = useMemo(
    () => uniqueVoiceValues(voices.map((voice) => voice.gender).filter(Boolean) as string[]),
    [voices],
  );
  const providerOptions = useMemo(
    () => uniqueVoiceValues(voices.map((voice) => voice.provider)),
    [voices],
  );
  const tagOptions = useMemo(
    () => uniqueVoiceValues([...languageOptions, ...genderOptions, ...providerOptions]),
    [genderOptions, languageOptions, providerOptions],
  );
  const tagCounts = useMemo(
    () =>
      tagOptions.map((option) => ({
        label: option,
        count: voices.filter((voice) =>
          [voice.language, voice.gender, voice.provider].includes(option),
        ).length,
      })),
    [tagOptions, voices],
  );
  const filteredVoices = useMemo(
    () => filterVoices(voices, { query, language, gender, provider, tag, sortMode }),
    [gender, language, provider, query, sortMode, tag, voices],
  );

  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? null;
  const selectedProjectVoiceAsset =
    voiceReference?.scope === "PROJECT"
      ? audioAssets.find((asset) => asset.id === voiceReference.assetId) ?? null
      : null;
  const totalDurationMs = audioAssets.reduce((sum, asset) => sum + (asset.durationMs ?? 0), 0);
  const totalSizeBytes = audioAssets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  const parsedRate = Number(speakingRate);
  const fixedRate = !voiceSupportsSpeakingRate(selectedVoice);
  const normalizedRate = fixedRate ? 1 : parsedRate;
  const rateValid = fixedRate || (speakingRate.trim() !== "" && Number.isFinite(normalizedRate) && normalizedRate >= 0.25 && normalizedRate <= 2);
  const canRegenerate = narrationStatus === "COMPLETED" &&
    narration?.chapterId === chapterId && narration.voiceId === voiceId &&
    narration.speakingRate === normalizedRate &&
    narration.voiceReference?.assetId === voiceReference?.assetId &&
    narration.voiceReference?.scope === voiceReference?.scope;

  const globalLocalVoiceReferenceId =
    voiceReference?.scope === "GLOBAL_LOCAL" ? voiceReference.assetId : null;
  const voiceReferenceQuery = useVoiceReferenceAsset(globalLocalVoiceReferenceId);
  const voiceReferenceReady =
    voiceReference?.scope === "PROJECT"
      ? selectedProjectVoiceAsset?.status === "READY"
      : voiceReference?.scope === "GLOBAL_LOCAL"
        ? voiceReferenceQuery.data?.status === "READY"
        : false;
  const referencePending = Boolean(voiceReference && !voiceReferenceReady);

  useEffect(() => {
    if (voiceReference?.scope !== "GLOBAL_LOCAL") return;
    if (voiceReferenceQuery.data?.status === "REJECTED") {
      setNotice("Giọng tham chiếu bị từ chối khi kiểm tra file. Hãy chọn MP3/WAV sạch dài ít nhất 3 giây.");
      setVoiceReference(null);
      setVoiceReferenceName(null);
      setPreviewJobId(null);
      return;
    }
    if (voiceReferenceQuery.isError) {
      setNotice("Không thể xác nhận giọng tham chiếu. Hãy upload lại file.");
      setVoiceReference(null);
      setVoiceReferenceName(null);
      setPreviewJobId(null);
    }
  }, [voiceReference?.scope, voiceReferenceQuery.data?.status, voiceReferenceQuery.isError]);

  const previewJobQuery = useGenerationJob(previewJobId);
  const previewResultQuery = useVoicePreviewResult(
    projectId,
    previewJobId,
    previewJobQuery.data?.status === "COMPLETED",
  );

  useEffect(() => {
    if (!previewJobId || !previewJobQuery.data) return;
    if (previewJobQuery.data.status === "FAILED" || previewJobQuery.data.status === "CANCELED") {
      setNotice("Không thể tạo giọng mẫu. Hãy kiểm tra file tham chiếu hoặc thử lại.");
    }
  }, [previewJobId, previewJobQuery.data]);

  const previewStatus = previewJobQuery.data?.status ?? null;
  const previewActive = isActiveGenerationJobStatus(previewStatus);
  const assetBusy = importAudio.isPending;
  const voiceReferenceBusy = uploadReference.isPending;
  const previewBusy =
    voiceReferenceBusy || referencePending || generatePreview.isPending || previewActive;
  const busy =
    narrationUncertain ||
    narrationActive ||
    assetBusy ||
    voiceReferenceBusy ||
    referencePending ||
    generate.isPending ||
    generateBatch.isPending ||
    generatePreview.isPending ||
    previewActive;

  async function runSingle() {
    if (!chapterId || !voiceId || !rateValid || busy) return;
    setNotice(null);
    try {
      const job = await generate.mutateAsync({
        projectId,
        request: {
          chapterId,
          voiceId,
          speakingRate: normalizedRate,
          voiceReference,
          forceRegenerate: canRegenerate,
        },
      });
      setNarration({ job, chapterId, voiceId, speakingRate: normalizedRate, voiceReference,
        chapterTitle: chapters.find((chapter) => chapter.id === chapterId)?.title ?? "Chương đã chọn",
        voiceName: voiceReferenceName ?? selectedVoice?.name ?? voiceId });
      setNotice("Đã gửi yêu cầu tạo lời kể. Bạn có thể theo dõi trạng thái bên dưới.");
    } catch (error) {
      const uncertain = !(error instanceof DesktopApiError && error.status < 500);
      setNarrationUncertain(uncertain);
      setNotice(uncertain
        ? "Chưa xác nhận được kết quả gửi yêu cầu. Kiểm tra Tác vụ audio trước khi tạo tiếp để tránh tạo trùng."
        : toErrorMessage(error, "Narration request thất bại."));
    }
  }

  async function runBatch() {
    if (!voiceId || !chapters.length || !rateValid || busy) return;
    setNotice(null);
    try {
      const jobs = await generateBatch.mutateAsync({
        projectId,
        chapterIds: chapters.map((chapter) => chapter.id),
        voiceId,
        speakingRate: normalizedRate,
        voiceReference,
      });
      setNotice(`${jobs.length} narration job đã được queue.`);
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể tạo batch narration."));
    }
  }

  async function runVoicePreview() {
    if (
      !chapterId ||
      !voiceId ||
      !voiceReference ||
      !voiceReferenceReady ||
      !previewText.trim() ||
      previewBusy
    ) {
      return;
    }
    setNotice(null);
    setPreviewJobId(null);
    try {
      const job = await generatePreview.mutateAsync({
        projectId,
        request: {
          chapterId,
          voiceId,
          sampleText: previewText.trim(),
          speakingRate: normalizedRate,
          voiceReference,
        },
      });
      setPreviewJobId(job.jobId);
      setNotice("Đang tạo giọng mẫu từ file tham chiếu…");
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể tạo giọng mẫu."));
    }
  }

  async function uploadVoiceReference() {
    if (voiceReferenceBusy) return;
    setNotice(null);
    try {
      const uploaded = await uploadReference.mutateAsync();
      if (!uploaded) return;
      setVoiceReference({ scope: "GLOBAL_LOCAL", assetId: uploaded.assetId });
      setSelectedAssetIds([]);
      setVoiceReferenceName(uploaded.originalFilename);
      setPreviewJobId(null);
      setNotice(
        uploaded.status === "READY"
          ? `${uploaded.originalFilename} đã sẵn sàng để làm giọng tham chiếu dùng chung.`
          : `${uploaded.originalFilename} đã upload. Đang kiểm tra audio…`,
      );
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể upload giọng tham chiếu."));
    }
  }

  function selectReusableVoice(assetId: string, originalFilename: string) {
    if (voiceReferenceBusy) return;
    setVoiceReference({ scope: "GLOBAL_LOCAL", assetId });
    setVoiceReferenceName(originalFilename);
    setSelectedAssetIds([]);
    setPreviewJobId(null);
    setNotice(`${originalFilename} đang được dùng làm giọng tham chiếu dùng chung.`);
  }

  function clearVoiceReference() {
    if (voiceReferenceBusy) return;
    setVoiceReference(null);
    setVoiceReferenceName(null);
    setSelectedAssetIds([]);
    setPreviewJobId(null);
    setNotice("Đã bỏ giọng tham chiếu. Narration sẽ dùng voice preset đang chọn.");
  }

  function selectCatalogVoice(id: string) {
    setVoiceId(id);
    setVoiceReference(null);
    setVoiceReferenceName(null);
    setSelectedAssetIds([]);
    setPreviewJobId(null);
    setNotice(null);
    catalogSample.stop();
    audioRef.current?.pause();
    setPlayingVoiceId(null);
    if (!voiceSupportsSpeakingRate(voices.find((voice) => voice.id === id) ?? null)) setSpeakingRate("1");
  }

  function togglePreview(voice: DesktopVoice) {
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }
    if (!voice.sampleUrl) {
      setNotice("Voice này chưa có sample audio.");
      return;
    }

    const sampleUrl = playableSampleUrl(voice.sampleUrl);
    if (!sampleUrl) {
      setNotice("Sample audio có URL không hợp lệ.");
      return;
    }

    audioRef.current?.pause();
    const player = new Audio(sampleUrl);
    player.onended = () => setPlayingVoiceId(null);
    player.onerror = () => setPlayingVoiceId(null);
    audioRef.current = player;
    void player
      .play()
      .then(() => setPlayingVoiceId(voice.id))
      .catch(() => setNotice("Không thể phát sample audio."));
  }

  function toggleAsset(assetId: string) {
    const asset = audioAssets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    if (voiceReference?.scope === "PROJECT" && voiceReference.assetId === assetId) {
      clearVoiceReference();
      return;
    }
    setSelectedAssetIds([assetId]);
    setVoiceReference({ scope: "PROJECT", assetId });
    setVoiceReferenceName(asset.originalFilename);
    setPreviewJobId(null);
    setNotice(`${asset.originalFilename} đang được dùng làm project-local voice reference.`);
  }

  async function importAudioAsset() {
    if (assetBusy) return;
    setNotice(null);
    try {
      const imported = await importAudio.mutateAsync();
      if (!imported) return;
      const { asset, selection } = imported;
      setSelectedAssetIds([asset.id]);
      setVoiceReference({ scope: "PROJECT", assetId: asset.id });
      setVoiceReferenceName(selection.originalFilename);
      setPreviewJobId(null);
      setNotice(
        `${selection.originalFilename} đã được import và chọn làm project-local voice${
          selection.durationMs ? ` (${formatDuration(selection.durationMs)})` : ""
        }.`,
      );
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể import audio."));
    }
  }

  function resetFilters() {
    setQuery("");
    setLanguage("all");
    setGender("all");
    setProvider("all");
    setTag("all");
    setSortMode("name-asc");
  }

  return (
    <div className="grid h-full min-h-0 overflow-y-auto grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] bg-background">
      <main className="min-w-0 overflow-hidden border-x border-border">
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
          <header className="border-b border-border bg-[var(--voice-header)] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="text-caption font-bold text-text-muted">
                  Âm thanh
                </span>
                <h1 className="mt-1 text-[20px] font-semibold">{section === "library" ? "Thư viện giọng" : "Lời kể theo chương"}</h1>
                <p className="mt-1 text-caption text-text-secondary">
                  {section === "library" ? "Lọc, nghe thử và chọn giọng. Giọng nhập theo dự án được lưu cục bộ." : "Chọn chương và giọng người kể để tạo âm thanh cho lời kể."}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-caption text-text-secondary">{voices.length} voices</span>
                <Button
                  onClick={() => void importAudioAsset()}
                  disabled={assetBusy}
                  className="h-9 bg-primary text-caption text-primary-foreground hover:bg-primary-hover"
                >
                  <Upload size={13} />
                  {assetBusy ? "Đang import…" : "Import project voice"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Đặt lại bộ lọc"
                  onClick={resetFilters}
                  className="size-9 border-border bg-surface-input"
                >
                  <MoreVertical size={15} />
                </Button>
              </div>
            </div>
          </header>

          {section === "library" ? <VoiceFiltersBar
            query={query}
            language={language}
            gender={gender}
            provider={provider}
            tag={tag}
            sortMode={sortMode}
            viewMode={viewMode}
            languageOptions={languageOptions}
            genderOptions={genderOptions}
            providerOptions={providerOptions}
            tagOptions={tagOptions}
            onQueryChange={setQuery}
            onLanguageChange={setLanguage}
            onGenderChange={setGender}
            onProviderChange={setProvider}
            onTagChange={setTag}
            onSortChange={setSortMode}
            onViewModeChange={setViewMode}
          /> : <div className="border-b border-border-subtle px-5 py-3 text-body text-text-secondary">{chapters.length} chương trong dự án</div>}

          <div className="min-h-0 overflow-auto px-5 py-3">
            {section === "narration" ? <div className="mx-auto max-w-2xl space-y-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-body text-text-secondary">Chương đọc
                  <Select value={chapterId || undefined} onValueChange={setChapterId}><SelectTrigger aria-label="Chương đọc"><SelectValue placeholder="Chọn chương" /></SelectTrigger>
                    <SelectContent>{chapters.map(chapter => <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-body text-text-secondary">Giọng người kể
                  <Select value={voiceId || undefined} onValueChange={selectCatalogVoice}><SelectTrigger aria-label="Giọng người kể"><SelectValue placeholder="Chọn giọng" /></SelectTrigger>
                    <SelectContent>{voices.map(voice => <SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              </div>
              <label className="grid max-w-xs gap-2 text-body text-text-secondary">Tốc độ đọc
                <Input aria-label="Tốc độ đọc" type="number" min="0.25" max="2" step="0.1" value={fixedRate ? "1" : speakingRate} disabled={fixedRate} onChange={event => setSpeakingRate(event.target.value)} />
                {fixedRate && <span className="text-caption text-text-muted">Giọng này hỗ trợ tốc độ đọc tự nhiên 1×.</span>}
                {!rateValid && <span role="alert" className="text-caption text-destructive">Chọn tốc độ từ 0,25 đến 2.</span>}
              </label>
              <p className="text-body text-text-muted">{voiceReferenceName ? `Đang dùng file tham chiếu ${voiceReferenceName} thay cho giọng ${selectedVoice?.name ?? "đã chọn"}. Chọn lại giọng người kể để dùng giọng trong thư viện.` : `Giọng sẽ dùng: ${selectedVoice?.name ?? "Chưa chọn"}.`}</p>
              {voiceReference && selectedVoice && <Button type="button" variant="outline" onClick={() => selectCatalogVoice(voiceId)}>Dùng giọng trong thư viện</Button>}
              {selectedVoice && !voiceReference && <Button type="button" variant="outline" disabled={!chapterId && !selectedVoice.sampleUrl}
                onClick={() => catalogSample.state.voiceId === voiceId && ["generating", "playing"].includes(catalogSample.state.phase) ? catalogSample.stop() : void catalogSample.play(voiceId, selectedVoice.sampleUrl)}>
                {catalogSample.state.voiceId === voiceId && catalogSample.state.phase === "generating" ? "Đang tạo mẫu · Dừng chờ" : catalogSample.state.voiceId === voiceId && catalogSample.state.phase === "playing" ? "Dừng nghe thử" : "Nghe thử giọng đã chọn"}
              </Button>}
              {catalogSample.state.phase === "error" && <p role="alert" className="text-body text-destructive">{catalogSample.state.message}</p>}
              {!chapters.length && <EmptyState title="Chưa có chương" description="Thêm chương và duyệt kịch bản trước khi tạo lời kể." />}
              {!voices.length && <p role="status" className="text-body text-warning">Chưa có giọng người kể trong thư viện.</p>}
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void runSingle()} disabled={!chapterId || !voiceId || !rateValid || busy}><AudioLines size={16} />{narrationActive ? "Đang tạo lời kể…" : canRegenerate ? "Tạo lại lời kể" : "Tạo lời kể"}</Button>
                <Button variant="outline" onClick={() => void runBatch()} disabled={!chapters.length || !voiceId || !rateValid || busy}>Tạo lời kể cho tất cả chương</Button>
              </div>
              {narrationUncertain && <Button type="button" variant="outline" onClick={() => navigate(`/projects/${projectId}/jobs`)}>Kiểm tra tác vụ audio</Button>}
              {narration && <div className="space-y-2 rounded-md bg-surface-panel p-3" role="status">
                <p className="text-body font-medium">{narration.chapterTitle} · {narration.voiceName}</p>
                <p className="text-body text-text-secondary">{narrationStatus === "COMPLETED" ? "Đã tạo xong lời kể." : narrationStatus === "FAILED" || narrationStatus === "CANCELED" ? "Tạo lời kể chưa thành công. Xem chi tiết tác vụ trước khi thử lại." : "Đang xử lý lời kể…"} {narrationQuery.data?.progress ?? narration.job.progress}%</p>
                {narrationQuery.isError && <p className="text-warning">Chưa tải được trạng thái mới. Yêu cầu vẫn đang được theo dõi; hãy xem ở Tác vụ.</p>}
                <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/jobs`)}>Xem tác vụ audio</Button>
                {narrationStatus === "COMPLETED" && <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/editor`)}>Mở Editor để nghe lời kể</Button>}
              </div>}
            </div> : <>
            <div className="mb-2 flex items-center justify-between gap-3 text-caption text-text-muted">
              <span>{filteredVoices.length} voice hiển thị</span>
              <span className="inline-flex items-center gap-1">
                <SlidersHorizontal size={12} />
                Bộ lọc đang áp dụng
              </span>
            </div>

            {selectedVoice && <Button type="button" variant="outline" className="mb-3" onClick={() => navigate(`/projects/${projectId}/audio?tab=narration`)}>
              Dùng {selectedVoice.name} tạo lời kể
            </Button>}

            {filteredVoices.length ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 gap-2.5 xl:grid-cols-2 2xl:grid-cols-3"
                    : "grid grid-cols-1 gap-2.5"
                }
              >
                {filteredVoices.map((voice, index) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    index={index}
                    selected={voice.id === voiceId}
                    playing={voice.id === playingVoiceId}
                    onSelect={() => selectCatalogVoice(voice.id)}
                    onPreview={() => togglePreview(voice)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Không tìm thấy voice"
                description="Thử đổi từ khóa hoặc bỏ bớt bộ lọc."
              />
            )}

            </>}
            {notice && (
              <p className="mt-3 rounded-md border border-border bg-surface-input px-3 py-2 text-caption text-text-secondary" role="status">
                {notice}
              </p>
            )}

            {section === "library" && <div className="flex items-center justify-center gap-2 py-6 text-caption text-text-secondary">
              <span>{filteredVoices.length} voice trong thư viện</span>
              <span className="text-text-dim">·</span>
              <span>Danh sách được tải từ backend</span>
            </div>}
          </div>
        </div>
      </main>

      <VoiceWorkspaceContext
        section={section}
        selectedVoice={selectedVoice}
        chapters={chapters}
        chapterId={chapterId}
        speakingRate={speakingRate}
        selectedAssetIds={selectedAssetIds}
        audioAssets={audioAssets}
        tagCounts={tagCounts}
        totalDurationMs={totalDurationMs}
        totalSizeBytes={totalSizeBytes}
        busy={busy || !rateValid}
        fixedSpeakingRate={fixedRate}
        voiceReferenceName={voiceReferenceName}
        voiceReferenceScope={voiceReference?.scope ?? null}
        previewText={previewText}
        previewStatus={voiceReferenceReady ? previewStatus : voiceReference?.scope === "GLOBAL_LOCAL" ? voiceReferenceQuery.data?.status ?? null : selectedProjectVoiceAsset?.status ?? null}
        previewUrl={active ? previewResultQuery.data?.url ?? null : null}
        previewBusy={previewBusy}
        onToggleAsset={toggleAsset}
        onSelectReusableVoice={selectReusableVoice}
        onCreateTake={() => void runSingle()}
        onResetFilters={resetFilters}
        onUploadVoiceReference={() => void uploadVoiceReference()}
        onClearVoiceReference={clearVoiceReference}
        onPreviewTextChange={(value) => {
          setPreviewText(value);
          setPreviewJobId(null);
        }}
        onGeneratePreview={() => void runVoicePreview()}
        onBatch={() => void runBatch()}
        onChapterChange={(value) => {
          setChapterId(value);
          setPreviewJobId(null);
        }}
        onSpeakingRateChange={(value) => {
          setSpeakingRate(value);
          setPreviewJobId(null);
        }}
        onTagFilter={setTag}
        onOpenAssets={() => navigate(`/projects/${projectId}/assets`)}
      />
    </div>
  );
}

function formatDuration(value: number) {
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
