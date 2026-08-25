import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { DesktopAsset, DesktopChapterDetails, DesktopVoice } from "@narrativex/client-contracts";
import {
  ArrowDownAZ,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileAudio,
  FolderPlus,
  Grid2X2,
  List,
  Mic2,
  MoreVertical,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "../../workspace/components/FeaturePage";
import { useGenerateBatchNarration, useGenerateNarration } from "../../generation/queries/narration.queries";
import { assetsApi } from "../../assets/api/assets.api";
import { filterVoices, playableSampleUrl, uniqueVoiceValues } from "../voice-filters";

type SortMode = "name-asc" | "name-desc";

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
  const [chapterId, setChapterId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speakingRate, setSpeakingRate] = useState("1");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [gender, setGender] = useState("all");
  const [provider, setProvider] = useState("all");
  const [tag, setTag] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [assetBusy, setAssetBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id);
    if (!voiceId && voices[0]) setVoiceId(voices[0].id);
  }, [chapterId, chapters, voiceId, voices]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const audioAssets = useMemo(() => assets.filter((asset) => asset.type === "AUDIO"), [assets]);
  const languageOptions = useMemo(() => uniqueVoiceValues(voices.map((voice) => voice.language)), [voices]);
  const genderOptions = useMemo(() => uniqueVoiceValues(voices.map((voice) => voice.gender).filter(Boolean) as string[]), [voices]);
  const providerOptions = useMemo(() => uniqueVoiceValues(voices.map((voice) => voice.provider)), [voices]);
  const tagOptions = useMemo(() => uniqueVoiceValues([...languageOptions, ...genderOptions, ...providerOptions]), [genderOptions, languageOptions, providerOptions]);
  const tagCounts = useMemo(() => tagOptions.map((option) => ({ label: option, count: voices.filter((voice) => [voice.language, voice.gender, voice.provider].includes(option)).length })), [tagOptions, voices]);
  const filteredVoices = useMemo(
    () => filterVoices(voices, { query, language, gender, provider, tag, sortMode }),
    [gender, language, provider, query, sortMode, tag, voices],
  );

  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? null;
  const totalDurationMs = audioAssets.reduce((sum, asset) => sum + (asset.durationMs ?? 0), 0);
  const totalSizeBytes = audioAssets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  const rate = Number.parseFloat(speakingRate);
  const busy = assetBusy || generate.isPending || generateBatch.isPending;

  async function runSingle() {
    if (!chapterId || !voiceId) return;
    setNotice(null);
    try {
      const job = await generate.mutateAsync({ projectId, request: { chapterId, voiceId, speakingRate: Number.isFinite(rate) ? rate : 1 } });
      setNotice(`Narration job ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function runBatch() {
    if (!voiceId || !chapters.length) return;
    setNotice(null);
    try {
      const jobs = await generateBatch.mutateAsync({ projectId, chapterIds: chapters.map((chapter) => chapter.id), voiceId, speakingRate: Number.isFinite(rate) ? rate : 1 });
      setNotice(`${jobs.length} narration job đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
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
    audioRef.current = player;
    void player.play().then(() => setPlayingVoiceId(voice.id)).catch(() => setNotice("Không thể phát sample audio."));
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]);
  }

  async function importAudioAsset() {
    if (assetBusy) return;
    setAssetBusy(true);
    setNotice(null);
    try {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return;
      if (selection.kind !== "AUDIO") throw new Error("Chỉ hỗ trợ file audio trong Voice & TTS.");
      if (selection.sizeBytes > 50 * 1024 * 1024) throw new Error("File audio vượt quá giới hạn 50MB.");
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
      setNotice(error instanceof Error ? error.message : "Không thể import audio.");
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
    <div className="grid h-full min-h-0 grid-cols-[minmax(180px,.9fr)_minmax(0,4fr)_minmax(238px,1.38fr)] bg-[radial-gradient(circle_at_50%_0%,var(--voice-glow),transparent_44%)]">
      <LibraryRail />

      <main className="min-w-0 overflow-hidden border-x border-border">
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
          <header className="border-b border-border bg-[var(--voice-header)] px-5 py-4">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[.2em] text-text-muted">Library / Voice &amp; TTS</span>
                <h1 className="mt-1 text-[22px] font-semibold tracking-[-.02em]">Voice &amp; TTS</h1>
                <p className="mt-1 text-[11px] text-text-secondary">Quản lý và phát thử các file audio mẫu (TTS) trong workspace của bạn.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-text-secondary">{voices.length} voices</span>
                <Button onClick={() => void importAudioAsset()} disabled={assetBusy} className="h-9 bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover"><Upload size={13} /> {assetBusy ? "Đang import…" : "Import audio"}</Button>
                <Button variant="outline" size="icon" aria-label="Đặt lại bộ lọc" onClick={resetFilters} className="size-9 border-border bg-surface-input"><MoreVertical size={15} /></Button>
              </div>
            </div>
          </header>

          <div className="flex flex-wrap items-end gap-2 border-b border-border bg-[var(--voice-filter-bar)] px-5 py-3">
            <label className="min-w-[220px] flex-1 text-[9px] text-text-muted"><span className="sr-only">Tìm voice</span><span className="flex h-9 items-center gap-2 rounded-md border border-input bg-surface-input px-2.5"><Search size={14} /><Input className="h-7 border-0 bg-transparent px-0 text-[10px] focus-visible:ring-1 focus-visible:ring-primary/70" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm tên, giọng đọc, ngôn ngữ…" /></span></label>
            <FilterSelect label="Ngôn ngữ" value={language} onChange={setLanguage} options={languageOptions} />
            <FilterSelect label="Giới tính" value={gender} onChange={setGender} options={genderOptions} />
            <FilterSelect label="Giọng đọc" value={provider} onChange={setProvider} options={providerOptions} />
            <FilterSelect label="Thẻ" value={tag} onChange={setTag} options={tagOptions} />
            <label className="grid gap-1 text-[9px] text-text-muted"><span>Sắp xếp</span><span className="flex h-9 items-center gap-1 rounded-md border border-border bg-surface-input px-2"><select className="h-7 bg-transparent text-[10px] text-foreground outline-none" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="name-asc">Tên A–Z</option><option value="name-desc">Tên Z–A</option></select><ArrowDownAZ size={13} /></span></label>
            <div className="ml-auto flex h-9 items-center gap-1 rounded-md border border-border bg-surface-input p-1"><Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" aria-label="Grid view" onClick={() => setViewMode("grid")} className="size-7"><Grid2X2 size={14} /></Button><Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" aria-label="List view" onClick={() => setViewMode("list")} className="size-7"><List size={14} /></Button></div>
          </div>

          <div className="min-h-0 overflow-auto px-5 py-3">
            <div className="mb-2 flex items-center justify-between text-[10px] text-text-muted"><span>{filteredVoices.length} voice hiển thị</span><span className="inline-flex items-center gap-1"><SlidersHorizontal size={12} /> Bộ lọc đang áp dụng</span></div>
            {filteredVoices.length ? <div className={viewMode === "grid" ? "grid grid-cols-1 gap-2.5 xl:grid-cols-3" : "grid grid-cols-1 gap-2.5"}>{filteredVoices.map((voice, index) => <VoiceCard key={voice.id} voice={voice} index={index} selected={voice.id === voiceId} playing={voice.id === playingVoiceId} onSelect={() => setVoiceId(voice.id)} onPreview={() => togglePreview(voice)} />)}</div> : <EmptyState title="Không tìm thấy voice" description="Thử đổi từ khóa hoặc bỏ bớt bộ lọc." />}
            {notice && <p className="mt-3 text-[10px] text-text-secondary" role="status">{notice}</p>}
            <div className="flex items-center justify-center gap-2 py-6 text-[10px] text-text-secondary"><span>{filteredVoices.length} voice trong thư viện</span><span className="text-text-dim">·</span><span>Danh sách được tải từ backend</span></div>
          </div>
        </div>
      </main>

      <WorkspaceContext selectedVoice={selectedVoice} chapters={chapters} chapterId={chapterId} speakingRate={speakingRate} selectedAssetIds={selectedAssetIds} audioAssets={audioAssets} tagCounts={tagCounts} totalDurationMs={totalDurationMs} totalSizeBytes={totalSizeBytes} busy={busy} onToggleAsset={toggleAsset} onCreateTake={() => void runSingle()} onResetFilters={resetFilters} onSelectFiles={() => void importAudioAsset()} onBatch={() => void runBatch()} onChapterChange={setChapterId} onSpeakingRateChange={setSpeakingRate} onTagFilter={(value) => setTag(value)} onOpenAssets={() => navigate(`/projects/${projectId}/assets`)} />
    </div>
  );
}

function LibraryRail() {
  return <aside className="flex min-h-0 flex-col border-r border-border bg-[var(--voice-rail)] px-4 py-4"><div className="flex items-center justify-between border-b border-border pb-4"><div><span className="text-[9px] font-bold uppercase tracking-[.18em] text-text-muted">Library</span><h2 className="mt-1 text-sm font-semibold">Voice &amp; TTS</h2></div><span aria-hidden="true" className="grid size-7 place-items-center text-text-muted"><X size={14} /></span></div><div className="grid gap-1 py-3"><RailItem icon={<AudioLines size={15} />} label="Narration" /><RailItem icon={<Mic2 size={15} />} label="Voice catalog" active /><RailItem icon={<Volume2 size={15} />} label="Voice takes" /></div><div className="mt-3 rounded-md border border-primary/20 bg-primary-muted/60 p-3 text-[10px] leading-5 text-text-secondary"><Sparkles className="mb-2 text-primary-hover" size={15} /><p>Library content dùng ở phạm vi toàn workspace. Bạn có thể lọc, nghe thử và sử dụng cho dự án.</p></div><div className="mt-auto border-t border-border pt-3 text-[10px] text-text-muted"><span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" /> Local workspace <span className="float-right">v1.0.0</span></div></aside>;
}

function RailItem({ icon, label, active = false }: Readonly<{ icon: React.ReactNode; label: string; active?: boolean }>) {
  return <div className={`flex h-9 items-center gap-2 rounded-md px-2.5 text-left text-[10px] ${active ? "bg-primary-muted text-foreground" : "text-text-secondary"}`}>{icon}{label}</div>;
}

function FilterSelect({ label, value, onChange, options }: Readonly<{ label: string; value: string; onChange: (value: string) => void; options: string[] }>) {
  return <label className="grid gap-1 text-[9px] text-text-muted"><span>{label}</span><span className="flex h-9 items-center gap-1 rounded-md border border-border bg-surface-input px-2"><select className="min-w-[76px] flex-1 bg-transparent text-[10px] text-foreground outline-none" value={value} onChange={(event) => onChange(event.target.value)}><option value="all">Tất cả</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={13} /></span></label>;
}

function VoiceCard({ voice, index, selected, playing, onSelect, onPreview }: Readonly<{ voice: DesktopVoice; index: number; selected: boolean; playing: boolean; onSelect: () => void; onPreview: () => void }>) {
  return <article className={`group grid min-h-[94px] grid-cols-[66px_minmax(0,1fr)] gap-3 rounded-lg border p-2 transition-colors ${selected ? "border-primary/65 bg-[var(--voice-card-selected)] shadow-[var(--shadow-card)]" : "border-border bg-[var(--voice-card)] hover:border-border-dark"}`}><button type="button" onClick={(event) => { event.stopPropagation(); onPreview(); }} className="relative grid h-[78px] place-items-center overflow-hidden rounded-md border border-cyan/20 bg-[var(--voice-preview)] text-white" aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}>{playing ? <Pause size={21} /> : <Play className="ml-0.5" size={21} />}<span className="absolute inset-x-2 bottom-2 flex h-5 items-end justify-center gap-[2px] opacity-70" aria-hidden="true">{Array.from({ length: 21 }, (_, bar) => <span key={bar} className="w-[2px] rounded-full bg-white/70" style={{ height: `${25 + ((bar * 17 + index * 9) % 65)}%` }} />)}</span></button><div className="min-w-0"><div className="flex items-start justify-between gap-2"><button type="button" className="min-w-0 truncate text-left text-[11px] font-semibold text-foreground" onClick={onSelect}>{voice.name}</button><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-text-muted opacity-70"><MoreVertical size={13} /></span></div><div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-secondary"><span>{voice.gender ?? "Neutral"}</span><span>•</span><span className="truncate">{voice.language}</span><span className="rounded bg-primary-muted px-1.5 py-0.5 text-[8px] text-primary-hover">{languageShort(voice.language)}</span></div><div className="mt-3 flex items-center gap-2"><Button variant={playing ? "default" : "ghost"} size="icon" aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`} onClick={(event) => { event.stopPropagation(); onPreview(); }} className="size-6 rounded-full bg-surface-3"><span className="sr-only">{playing ? "Tạm dừng" : "Phát thử"}</span>{playing ? <Pause size={11} /> : <Play size={11} />}</Button><span className="flex min-w-0 flex-1 items-center gap-[2px] opacity-60" aria-label={voice.sampleUrl ? "Sample audio waveform" : "Chưa có sample audio"}>{Array.from({ length: 28 }, (_, bar) => <span key={bar} className="h-4 w-[2px] rounded-full bg-text-muted" style={{ transform: `scaleY(${0.2 + ((bar * 13 + index * 5) % 70) / 100})` }} />)}</span><span className="shrink-0 text-[9px] text-text-secondary">{voice.sampleUrl ? "Sample" : "—"}</span></div></div></article>;
}

function WorkspaceContext({ selectedVoice, chapters, chapterId, speakingRate, selectedAssetIds, audioAssets, tagCounts, totalDurationMs, totalSizeBytes, busy, onToggleAsset, onCreateTake, onResetFilters, onSelectFiles, onBatch, onChapterChange, onSpeakingRateChange, onTagFilter, onOpenAssets }: Readonly<{ selectedVoice: DesktopVoice | null; chapters: DesktopChapterDetails[]; chapterId: string; speakingRate: string; selectedAssetIds: string[]; audioAssets: DesktopAsset[]; tagCounts: Array<{ label: string; count: number }>; totalDurationMs: number; totalSizeBytes: number; busy: boolean; onToggleAsset: (assetId: string) => void; onCreateTake: () => void; onResetFilters: () => void; onSelectFiles: () => void; onBatch: () => void; onChapterChange: (chapterId: string) => void; onSpeakingRateChange: (value: string) => void; onTagFilter: (value: string) => void; onOpenAssets: () => void }>) {
  return <aside className="min-h-0 overflow-auto bg-[var(--voice-context)] p-4"><div className="border-b border-border pb-4"><span className="text-[9px] font-bold uppercase tracking-[.18em] text-text-muted">Workspace Context</span><div className="mt-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Voice</h2><span className="text-[10px] text-text-muted">{selectedAssetIds.length} file đã chọn</span></div><div className="mt-4 grid gap-3 text-[10px]"><ContextStat label="Voice đang chọn" value={selectedVoice?.name ?? "Chưa chọn"} /><ContextStat label="Tổng thời lượng" value={formatDuration(totalDurationMs)} /><ContextStat label="Tổng dung lượng" value={formatBytes(totalSizeBytes)} /></div></div><div className="mt-4 grid gap-2 rounded-md border border-border bg-surface-input p-3"><span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-muted">Narration setup</span><label className="grid gap-1 text-[10px] text-text-secondary"><span>Chapter</span><select className="h-8 rounded-md border border-border bg-surface-2 px-2 text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70" value={chapterId} onChange={(event) => onChapterChange(event.target.value)}><option value="">Chọn chapter</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label><label className="grid gap-1 text-[10px] text-text-secondary"><span>Speaking rate</span><Input type="number" min="0.5" max="2" step="0.1" value={speakingRate} onChange={(event) => onSpeakingRateChange(event.target.value)} className="h-8 border-border bg-surface-2 text-[10px]" /></label></div><button type="button" onClick={onSelectFiles} disabled={busy} className="mt-4 grid min-h-[164px] w-full place-items-center rounded-md border border-dashed border-border-dark bg-surface-input p-4 text-center text-[10px] text-text-secondary transition-colors hover:border-primary/50 hover:bg-primary-muted/30 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="mb-2 text-text-muted" size={20} /><span>Chọn file audio từ máy</span><span className="mt-2 text-[9px] text-text-muted">MP3, WAV, M4A · tối đa 50MB / file</span></button><Button variant="outline" onClick={onOpenAssets} className="mt-4 h-9 w-full border-primary/35 bg-primary-muted text-[10px] text-primary-hover hover:bg-primary-light"><FolderPlus size={13} /> Mở Asset Browser</Button><div className="mt-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-medium text-text-secondary">Thẻ phổ biến</h3><button type="button" onClick={onResetFilters} className="text-[9px] text-primary-hover">Đặt lại</button></div><div className="grid gap-1">{tagCounts.slice(0, 5).map(({ label, count }) => <button key={label} type="button" onClick={() => onTagFilter(label)} className="flex h-8 items-center justify-between rounded-md bg-surface-input px-2.5 text-[10px] text-text-secondary hover:bg-surface-3"><span>{label}</span><span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-muted">{count}</span></button>)}</div></div>{audioAssets.length > 0 && <div className="mt-5 border-t border-border pt-4"><h3 className="mb-2 text-[10px] font-medium text-text-secondary">Audio assets</h3><div className="grid gap-1">{audioAssets.slice(0, 4).map((asset) => <button key={asset.id} type="button" onClick={() => onToggleAsset(asset.id)} className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] ${selectedAssetIds.includes(asset.id) ? "bg-primary-muted text-primary-hover" : "bg-surface-input text-text-secondary"}`}><FileAudio size={13} /><span className="min-w-0 flex-1 truncate">{asset.originalFilename}</span>{selectedAssetIds.includes(asset.id) && <Check size={12} />}</button>)}</div></div>}<div className="mt-5 border-t border-border pt-4"><span className="text-[9px] font-bold uppercase tracking-[.17em] text-text-muted">Quick actions</span><button type="button" onClick={onResetFilters} className="mt-3 flex w-full items-center justify-between text-[10px] text-primary-hover"><span className="inline-flex items-center gap-2"><Mic2 size={13} /> Reset voice filters</span><ArrowUpRight size={13} /></button><button type="button" onClick={onCreateTake} disabled={!selectedVoice || !chapterId || busy} className="mt-4 flex w-full items-center justify-between text-[10px] text-text-secondary disabled:opacity-40"><span className="inline-flex items-center gap-2"><Sparkles size={13} /> Tạo voice take</span><ArrowUpRight size={13} /></button><button type="button" onClick={onBatch} disabled={!selectedVoice || !chapters.length || busy} className="mt-4 flex w-full items-center justify-between text-[10px] text-text-secondary disabled:opacity-40"><span className="inline-flex items-center gap-2"><AudioLines size={13} /> Tạo batch narration</span><ArrowUpRight size={13} /></button></div></aside>;
}

function ContextStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex items-center justify-between border-b border-border-subtle pb-2"><span className="text-text-muted">{label}</span><strong className="text-text-secondary">{value}</strong></div>;
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function languageShort(language: string) {
  return language
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Narration request thất bại.";
}
