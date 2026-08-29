import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopVoice,
  VoiceReferenceInput,
} from "@narrativex/client-contracts";
import { MoreVertical, SlidersHorizontal, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
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
import { VoiceLibraryRail } from "../components/VoiceLibraryRail";
import { VoiceWorkspaceContext } from "../components/VoiceWorkspaceContext";
import {
  filterVoices,
  playableSampleUrl,
  uniqueVoiceValues,
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

const DEFAULT_VOICE_ID = "vieneu-ngoc-huyen-v2";
const DEFAULT_PREVIEW_TEXT =
  "Xin chào, đây là giọng đọc mẫu được tạo từ đoạn giọng tham chiếu bạn vừa tải lên.";

export function VoiceScreen({
  projectId,
  chapters,
  voices,
  assets,
}: Readonly<{
  projectId: string;
  chapters: DesktopChapterDetails[];
  voices: DesktopVoice[];
  assets: DesktopAsset[];
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

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id);
    if (!voiceId && voices.length) {
      setVoiceId(voices.find((voice) => voice.id === DEFAULT_VOICE_ID)?.id ?? voices[0].id);
    }
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
  const parsedRate = Number.parseFloat(speakingRate);
  const normalizedRate = Number.isFinite(parsedRate) ? parsedRate : 1;

  const accountVoiceReferenceId =
    voiceReference?.scope === "ACCOUNT" ? voiceReference.assetId : null;
  const voiceReferenceQuery = useVoiceReferenceAsset(accountVoiceReferenceId);
  const voiceReferenceReady =
    voiceReference?.scope === "PROJECT"
      ? selectedProjectVoiceAsset?.status === "READY"
      : voiceReference?.scope === "ACCOUNT"
        ? voiceReferenceQuery.data?.status === "READY"
        : false;
  const referencePending = Boolean(voiceReference && !voiceReferenceReady);

  useEffect(() => {
    if (voiceReference?.scope !== "ACCOUNT") return;
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
    assetBusy ||
    voiceReferenceBusy ||
    referencePending ||
    generate.isPending ||
    generateBatch.isPending ||
    generatePreview.isPending ||
    previewActive;

  async function runSingle() {
    if (!chapterId || !voiceId || busy) return;
    setNotice(null);
    try {
      const job = await generate.mutateAsync({
        projectId,
        request: {
          chapterId,
          voiceId,
          speakingRate: normalizedRate,
          voiceReference,
        },
      });
      setNotice(`Narration job ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setNotice(toErrorMessage(error, "Narration request thất bại."));
    }
  }

  async function runBatch() {
    if (!voiceId || !chapters.length || busy) return;
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
      setVoiceReference({ scope: "ACCOUNT", assetId: uploaded.assetId });
      setSelectedAssetIds([]);
      setVoiceReferenceName(uploaded.originalFilename);
      setPreviewJobId(null);
      setNotice(
        uploaded.status === "READY"
          ? `${uploaded.originalFilename} đã sẵn sàng để clone giọng cho account.`
          : `${uploaded.originalFilename} đã upload. Đang kiểm tra audio…`,
      );
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể upload giọng tham chiếu."));
    }
  }

  function selectAccountVoice(assetId: string, originalFilename: string) {
    if (voiceReferenceBusy) return;
    setVoiceReference({ scope: "ACCOUNT", assetId });
    setVoiceReferenceName(originalFilename);
    setSelectedAssetIds([]);
    setPreviewJobId(null);
    setNotice(`${originalFilename} đang được dùng làm account voice reference từ R2.`);
  }

  function clearVoiceReference() {
    if (voiceReferenceBusy) return;
    setVoiceReference(null);
    setVoiceReferenceName(null);
    setSelectedAssetIds([]);
    setPreviewJobId(null);
    setNotice("Đã bỏ giọng tham chiếu. Narration sẽ dùng voice preset đang chọn.");
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
    <div className="grid h-full min-h-0 grid-cols-[minmax(176px,.85fr)_minmax(0,4fr)_minmax(250px,1.45fr)] bg-[radial-gradient(circle_at_50%_0%,var(--voice-glow),transparent_44%)]">
      <VoiceLibraryRail />

      <main className="min-w-0 overflow-hidden border-x border-border">
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
          <header className="border-b border-border bg-[var(--voice-header)] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[.2em] text-text-muted">
                  Library / Voice &amp; TTS
                </span>
                <h1 className="mt-1 text-[22px] font-semibold tracking-[-.02em]">Voice &amp; TTS</h1>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Project voice lưu local; account voice upload lên R2 và dùng lại giữa các project.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-text-secondary">{voices.length} voices</span>
                <Button
                  onClick={() => void importAudioAsset()}
                  disabled={assetBusy}
                  className="h-9 bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover"
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

          <VoiceFiltersBar
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
          />

          <div className="min-h-0 overflow-auto px-5 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-text-muted">
              <span>{filteredVoices.length} voice hiển thị</span>
              <span className="inline-flex items-center gap-1">
                <SlidersHorizontal size={12} />
                Bộ lọc đang áp dụng
              </span>
            </div>

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
                    onSelect={() => setVoiceId(voice.id)}
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

            {notice && (
              <p className="mt-3 rounded-md border border-border bg-surface-input px-3 py-2 text-[10px] text-text-secondary" role="status">
                {notice}
              </p>
            )}

            <div className="flex items-center justify-center gap-2 py-6 text-[10px] text-text-secondary">
              <span>{filteredVoices.length} voice trong thư viện</span>
              <span className="text-text-dim">·</span>
              <span>Danh sách được tải từ backend</span>
            </div>
          </div>
        </div>
      </main>

      <VoiceWorkspaceContext
        selectedVoice={selectedVoice}
        chapters={chapters}
        chapterId={chapterId}
        speakingRate={speakingRate}
        selectedAssetIds={selectedAssetIds}
        audioAssets={audioAssets}
        tagCounts={tagCounts}
        totalDurationMs={totalDurationMs}
        totalSizeBytes={totalSizeBytes}
        busy={busy}
        voiceReferenceName={voiceReferenceName}
        voiceReferenceScope={voiceReference?.scope ?? null}
        previewText={previewText}
        previewStatus={voiceReferenceReady ? previewStatus : voiceReference?.scope === "ACCOUNT" ? voiceReferenceQuery.data?.status ?? null : selectedProjectVoiceAsset?.status ?? null}
        previewUrl={previewResultQuery.data?.url ?? null}
        previewBusy={previewBusy}
        onToggleAsset={toggleAsset}
        onSelectAccountVoice={selectAccountVoice}
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
