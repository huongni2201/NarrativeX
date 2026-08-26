import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopVoice,
} from "@narrativex/client-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, SlidersHorizontal, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { assetsApi } from "../../assets/api/assets.api";
import { useGenerateBatchNarration, useGenerateNarration } from "../../generation/queries/narration.queries";
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
} from "../voice-filters";

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
  const queryClient = useQueryClient();
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
  const [assetBusy, setAssetBusy] = useState(false);

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id);
    if (!voiceId && voices[0]) setVoiceId(voices[0].id);
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
  const totalDurationMs = audioAssets.reduce((sum, asset) => sum + (asset.durationMs ?? 0), 0);
  const totalSizeBytes = audioAssets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  const parsedRate = Number.parseFloat(speakingRate);
  const normalizedRate = Number.isFinite(parsedRate) ? parsedRate : 1;
  const busy = assetBusy || generate.isPending || generateBatch.isPending;

  async function runSingle() {
    if (!chapterId || !voiceId || busy) return;
    setNotice(null);
    try {
      const job = await generate.mutateAsync({
        projectId,
        request: { chapterId, voiceId, speakingRate: normalizedRate },
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
      });
      setNotice(`${jobs.length} narration job đã được queue.`);
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể tạo batch narration."));
    }
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
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  async function importAudioAsset() {
    if (assetBusy) return;
    setAssetBusy(true);
    setNotice(null);
    try {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return;
      if (selection.kind !== "AUDIO") {
        throw new Error("Chỉ hỗ trợ file audio trong Voice & TTS.");
      }
      if (selection.sizeBytes > 50 * 1024 * 1024) {
        throw new Error("File audio vượt quá giới hạn 50MB.");
      }

      const asset = await assetsApi.registerLocal({
        projectId,
        type: "AUDIO",
        originalFilename: selection.originalFilename,
        contentType: selection.contentType,
        sizeBytes: selection.sizeBytes,
        checksumSha256: selection.checksumSha256,
      });
      await window.narrativex.localStorage.commitSelectedAsset({
        projectId,
        assetId: asset.id,
        kind: selection.kind,
        selectionToken: selection.selectionToken,
      });
      await queryClient.invalidateQueries({ queryKey: ["assets", "library"] });
      setNotice(`${selection.originalFilename} đã được import vào workspace.`);
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể import audio."));
    } finally {
      setAssetBusy(false);
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
    <div className="grid h-full min-h-0 grid-cols-[minmax(176px,.85fr)_minmax(0,4fr)_minmax(230px,1.3fr)] bg-[radial-gradient(circle_at_50%_0%,var(--voice-glow),transparent_44%)]">
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
                  Quản lý, phát thử và dùng voice cho narration trong workspace.
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
                  {assetBusy ? "Đang import…" : "Import audio"}
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
        onToggleAsset={toggleAsset}
        onCreateTake={() => void runSingle()}
        onResetFilters={resetFilters}
        onSelectFiles={() => void importAudioAsset()}
        onBatch={() => void runBatch()}
        onChapterChange={setChapterId}
        onSpeakingRateChange={setSpeakingRate}
        onTagFilter={setTag}
        onOpenAssets={() => navigate(`/projects/${projectId}/assets`)}
      />
    </div>
  );
}
