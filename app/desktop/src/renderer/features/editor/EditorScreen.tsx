import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines, Bell, Camera, Check, ChevronDown, ChevronRight, Cloud, Copy, Eye, Folder,
  FolderOpen, HardDrive, Image as ImageIcon, Layers3, LockKeyhole, Maximize2, Menu, Mic2,
  MoreVertical, MousePointer2, Pause, Play, Plus, Redo2, RotateCcw, Scissors,
  Search, Settings2, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Trash2, Type,
  Undo2, UserCircle, Volume2, WandSparkles, ZoomIn, ZoomOut,
} from "lucide-react";
import { DesktopApiError, apiBaseUrl } from "../../api/client";
import { workspaceApi } from "../../api/workspace";
import { assetsApi } from "../../api/assets.api";
import type { DesktopAsset, DesktopCharacter, DesktopProject, DesktopRenderJob, DesktopTimeline, DesktopVoice, LocalRenderPreflight, ProjectRenderBeatOverride } from "@narrativex/client-contracts";
import { useProjectWorkspace, type DesktopWorkspaceState } from "./queries/useProjectWorkspace";
import { useProjectSessionStore } from "../projects/store/project-session.store";
import { ProjectPicker } from "../projects/components/ProjectPicker";
import { useCreateChapter, useDeleteChapter, useUpdateChapter } from "../chapters/queries/chapters.queries";
import { resetTimelineDraft, timelineOverrides, updateTimelineDraft, type TimelineDraft } from "../production/timeline-draft";
import { commitCommand, createCommandHistory, redoCommand, undoCommand } from "../production/command-history";
import { useAnalyzeChapter, useCreateMediaJob, useEstimateMediaJob, useGenerationJob, useMediaJob, useReviewMediaItem } from "../generation/queries/generation.queries";
import { useGenerateBatchNarration, useGenerateNarration } from "../generation/queries/narration.queries";
import { useCreateCharacter } from "../characters/queries/characters.queries";

export type ActivityId = "editor" | "chapters" | "characters" | "images" | "voice" | "assets" | "render" | "settings";
type InspectorTab = "properties" | "effects" | "transitions";
type ClipStatus = "ready" | "generating";
interface VisualClip { id: string; title: string; asset: string; startMs: number; endMs: number; scene: string; motion: string; status: ClipStatus; }
type RenderState = DesktopRenderJob | null;
export type DesktopScreen = ActivityId | "projects";

function errorMessage(error: unknown) {
  if (error instanceof DesktopApiError) return `${error.message} (${error.status})`;
  return error instanceof Error ? error.message : "Không thể kết nối backend.";
}

function toVisualClips(timeline: DesktopTimeline | null, overrides: TimelineDraft = {}): VisualClip[] {
  if (!timeline) return [];
  let cursor = 0;
  return timeline.beats.map((beat) => {
    const override = overrides[beat.visualBeatId];
    const duration = override?.durationMs ?? beat.durationMs;
    const clip: VisualClip = {
    id: beat.visualBeatId,
    title: beat.title,
    asset: beat.mediaAssetId ?? (beat.assetReady ? "Approved asset" : "No asset"),
    startMs: cursor,
    endMs: cursor + duration,
    scene: `Scene ${beat.sceneIndex + 1}`,
    motion: override?.cameraMovement ?? beat.cameraMovement,
    status: beat.assetReady ? "ready" : "generating",
    };
    cursor += duration;
    return clip;
  });
}
const activities: { id: ActivityId; label: string; icon: LucideIcon }[] = [
  { id: "editor", label: "Editor", icon: Layers3 }, { id: "chapters", label: "Chapters", icon: Menu },
  { id: "characters", label: "Characters", icon: UserCircle }, { id: "images", label: "Image Generation", icon: ImageIcon },
  { id: "voice", label: "Voice & TTS", icon: Mic2 }, { id: "assets", label: "Assets", icon: Folder },
  { id: "render", label: "Render", icon: Sparkles }, { id: "settings", label: "Settings", icon: Settings2 },
];

export function EditorScreen({ initialScreen = "editor" }: Readonly<{ initialScreen?: DesktopScreen }>) {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const activeProjectId = useProjectSessionStore((state) => state.activeProjectId);
  const setActiveProject = useProjectSessionStore((state) => state.setActiveProject);
  const selectedProjectId = routeProjectId ?? activeProjectId;
  const { workspace } = useProjectWorkspace(selectedProjectId);
  const [activity, setActivity] = useState<ActivityId>(initialScreen === "projects" ? "editor" : initialScreen);
  const [screen, setScreen] = useState<DesktopScreen>(initialScreen);
  const [selectedId, setSelectedId] = useState("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saveState, setSaveState] = useState("Connecting workspace…");
  const [renderJob, setRenderJob] = useState<RenderState>(null);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [timelineHistory, setTimelineHistory] = useState(() => createCommandHistory<TimelineDraft>({}));
  const timelineDraft = timelineHistory.present;
  const [renderPreflight, setRenderPreflight] = useState<LocalRenderPreflight | null>(null);
  const clips = useMemo(() => toVisualClips(workspace.timeline, timelineDraft), [workspace.timeline, timelineDraft]);
  const selected = useMemo(() => clips.find((clip) => clip.id === selectedId) ?? null, [clips, selectedId]);
  const totalMs = clips.at(-1)?.endMs ?? workspace.timeline?.totalDurationMs ?? 0;
  const projectId = workspace.timeline?.projectId ?? selectedProjectId;
  const activeProject = workspace.projects.find((project) => project.id === selectedProjectId) ?? null;

  function changeTimelineDraft(next: TimelineDraft) {
    setTimelineHistory((history) => commitCommand(history, next));
  }

  function updateBeatOverride(visualBeatId: string, patch: Omit<ProjectRenderBeatOverride, "visualBeatId">) {
    changeTimelineDraft(updateTimelineDraft(timelineDraft, visualBeatId, patch));
  }

  function undoTimeline() {
    setTimelineHistory(undoCommand);
  }

  function redoTimeline() {
    setTimelineHistory(redoCommand);
  }

  useEffect(() => {
    if (routeProjectId && routeProjectId !== activeProjectId) setActiveProject(routeProjectId);
  }, [activeProjectId, routeProjectId, setActiveProject]);

  useEffect(() => {
    if (workspace.timeline?.beats[0] && !selectedId) setSelectedId(workspace.timeline.beats[0].visualBeatId);
    setSaveState(workspace.status === "error" ? "Backend unavailable" : workspace.status === "loading" ? "Connecting workspace…" : "Synced with backend");
  }, [selectedId, workspace.status, workspace.timeline]);

  useEffect(() => {
    void window.narrativex?.appVersion().then(setAppVersion).catch(() => undefined);
  }, []);

  async function startRender() {
    if (!projectId) {
      setRenderNotice("Chưa có project để render.");
      return;
    }
    if (!workspace.timeline?.readyForRender) {
      setRenderNotice("Timeline chưa sẵn sàng để render. Kiểm tra audio, asset và chapter state.");
      return;
    }
    if (renderJob && ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"].includes(renderJob.status)) return;
    setRenderNotice("Đang kiểm tra local render preflight…");
    try {
      const assetIds = [...workspace.timeline.beats.map((beat) => beat.mediaAssetId), ...workspace.timeline.chapters.map((chapter) => chapter.narrationAssetId ?? null)].filter((assetId): assetId is string => Boolean(assetId));
      const estimatedOutputBytes = Math.max(64 * 1024 * 1024, Math.round((workspace.timeline.totalDurationMs / 1000) * 1_500_000));
      const preflight = await workspaceApi.preflight({ projectId, assetIds, estimatedOutputBytes, requiredTemporaryBytes: estimatedOutputBytes * 2 });
      setRenderPreflight(preflight);
      if (!preflight.ready) {
        setRenderNotice(`Preflight blocked: ${preflight.blockers.map(renderBlockerMessage).join(" ")}`);
        return;
      }
      const job = await workspaceApi.startRender(projectId, timelineOverrides(timelineDraft));
      setRenderJob(job);
      setRenderNotice(`Render job ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setRenderNotice(errorMessage(error));
    }
  }

  async function openRenderOutput() {
    if (!projectId || !renderJob || renderJob.status !== "COMPLETED") {
      setRenderNotice("Render output chưa sẵn sàng.");
      return;
    }
    try {
      await window.narrativex.localStorage.revealArtifact({ projectId, jobId: renderJob.jobId });
      setRenderNotice("Đã mở video render bằng ứng dụng mặc định của hệ điều hành.");
    } catch (error) {
      setRenderNotice(errorMessage(error));
    }
  }

  useEffect(() => {
    if (!renderJob?.jobId || !["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"].includes(renderJob.status)) return;
    const timer = window.setInterval(() => {
      void workspaceApi.getRenderJob(renderJob.jobId).then((nextJob) => {
        setRenderJob(nextJob);
        if (nextJob.status === "COMPLETED") {
          setRenderNotice("Render hoàn tất. Video đã sẵn sàng trên máy này.");
        }
      }).catch((error) => setRenderNotice(errorMessage(error)));
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [renderJob?.jobId, renderJob?.status]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPlayheadMs((current) => current >= totalMs ? 0 : current + 250), 250);
    return () => window.clearInterval(timer);
  }, [playing, totalMs]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && event.target === document.body) { event.preventDefault(); setPlaying((value) => !value); }
      if (event.key === "ArrowLeft") setPlayheadMs((value) => Math.max(0, value - (event.shiftKey ? 5_000 : 500)));
      if (event.key === "ArrowRight") setPlayheadMs((value) => Math.min(totalMs, value + (event.shiftKey ? 5_000 : 500)));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [totalMs]);

  return <div className="desktop-app">
    <header className="topbar">
      <div className="brand"><img src="/branding/narrativex-icon-orange-v2.png" alt="NarrativeX" width={22} height={22} className="brand-logo-img" /><span>NarrativeX</span></div>
      <nav className="menu" aria-label="Application menu">{["File", "Edit", "Project", "Timeline", "View", "Tools", "Help"].map((item) => <button key={item} type="button">{item}</button>)}</nav>
      <ProjectPicker projects={workspace.projects} activeProjectId={activeProject?.id ?? selectedProjectId} onChange={(nextProjectId) => { setActiveProject(nextProjectId); navigate(`/projects/${nextProjectId}/editor`); }} />
      <div className="autosave"><Cloud size={14} /> {saveState}</div>
      <div className="window-actions"><button type="button" className="export-button" onClick={() => void startRender()}><Sparkles size={14} /> Export</button><span className="jobs-pill"><i /> {renderJob ? "1 job" : "0 jobs"}</span><button type="button" className="icon-button" aria-label="Cloud sync"><Cloud size={17} /></button><button type="button" className="icon-button notification" aria-label="Notifications"><Bell size={17} /><i /></button><button type="button" className="window-button" aria-label="Minimize">−</button><button type="button" className="window-button" aria-label="Maximize">□</button><button type="button" className="window-button close" aria-label="Close">×</button></div>
    </header>
    <aside className="activity-bar"><div className="activity-list">{activities.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`activity ${activity === id ? "active" : ""}`} onClick={() => { setActivity(id); setScreen(id); }} aria-label={label} aria-pressed={activity === id} title={label}><Icon size={18} /><span>{label}</span></button>)}</div></aside>
    <aside className="explorer panel-right"><PanelHeader eyebrow={activity === "editor" || activity === "chapters" ? "Workspace" : "Library"} title={activity === "editor" || activity === "chapters" ? "Project Explorer" : activities.find((item) => item.id === activity)?.label ?? "Library"} /><>{activity === "editor" || activity === "chapters" ? <ProjectTree clips={clips} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setActivity("editor"); setScreen("editor"); }} projects={workspace.projects} activeProjectId={selectedProjectId} /> : <Library activity={activity} />}</></aside>
    <main className="center-workspace">
      {screen === "editor" ? <div className="editor-surface">
      <ApiStatusBanner status={workspace.status} error={workspace.error} />
      <section className="preview"><PanelHeader eyebrow="Canvas" title="Preview" trailing={<><span className="preview-mode"><i /> FAST PREVIEW</span><button type="button" className="select-control">1080p <ChevronDown size={13} /></button><IconButton label="Snapshot"><Camera size={16} /></IconButton><IconButton label="More options"><MoreVertical size={16} /></IconButton></>} /><div className="preview-stage"><div className="preview-art" /><div className="preview-overlay" /><div className="preview-caption">{selected ? selected.title : "Chọn một VisualBeat để bắt đầu"}</div><span className="preview-label"><i /> PREVIEW / {selected?.scene ?? "No scene selected"}</span></div><div className="transport"><span className="current-time">{formatTimecode(playheadMs)}</span><span className="slash">/</span><span>{totalMs ? formatTimecode(totalMs) : "--:--:--:--"}</span><div className="transport-buttons"><IconButton label="Previous clip" onClick={() => selected && setPlayheadMs(Math.max(0, selected.startMs - 1000))}><SkipBack size={15} /></IconButton><IconButton label="Step backward" onClick={() => setPlayheadMs((value) => Math.max(0, value - 500))}><SkipBack size={18} /></IconButton><button type="button" className="play-button" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((value) => !value)} disabled={!totalMs}>{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button><IconButton label="Step forward" onClick={() => setPlayheadMs((value) => Math.min(totalMs, value + 500))}><SkipForward size={18} /></IconButton><IconButton label="Next clip" onClick={() => selected && setPlayheadMs(Math.min(totalMs, selected.endMs + 1000))}><SkipForward size={15} /></IconButton><IconButton label="Loop"><RotateCcw size={16} /></IconButton></div><div className="transport-extra"><IconButton label="Fullscreen"><Maximize2 size={16} /></IconButton><input aria-label="Preview volume" type="range" min="0" max="100" defaultValue="72" /><Volume2 size={16} /></div></div></section>
      <section className="timeline"><div className="timeline-toolbar"><div className="tool-group"><IconButton label="Select tool" active><MousePointer2 size={15} /></IconButton><IconButton label="Split clip"><Scissors size={15} /></IconButton><IconButton label="Duplicate clip"><Copy size={15} /></IconButton><IconButton label="Delete clip"><Trash2 size={15} /></IconButton><span className="rule" /><IconButton label="Undo" onClick={undoTimeline} disabled={!timelineHistory.past.length}><Undo2 size={15} /></IconButton><IconButton label="Redo" onClick={redoTimeline} disabled={!timelineHistory.future.length}><Redo2 size={15} /></IconButton></div><div className="tool-group"><span className="duration">Timeline {totalMs ? formatTimecode(totalMs) : "Not loaded"}</span><IconButton label="Zoom out" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}><ZoomOut size={15} /></IconButton><span className="zoom-label">{Math.round(zoom * 100)}%</span><IconButton label="Zoom in" onClick={() => setZoom((value) => Math.min(2, value + 0.25))}><ZoomIn size={15} /></IconButton></div></div><Timeline clips={clips} totalMs={totalMs} selectedId={selectedId} onSelect={setSelectedId} playheadMs={playheadMs} zoom={zoom} /></section>
      </div> : <WorkspacePage screen={screen} workspace={workspace} renderJob={renderJob} renderPreflight={renderPreflight} onStartRender={() => void startRender()} onOpenRenderOutput={() => void openRenderOutput()} onOpenEditor={() => { setActivity("editor"); setScreen("editor"); }} />}
    </main>
    <aside className="inspector panel-left">{screen === "editor" ? <><div className="inspector-tabs" role="tablist">{(["properties", "effects", "transitions"] as InspectorTab[]).map((tab) => <button key={tab} type="button" role="tab" aria-selected={inspectorTab === tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>{inspectorTab === "properties" ? (selected ? <Properties clip={selected} override={timelineDraft[selected.id]} onChange={(patch) => updateBeatOverride(selected.id, patch)} onReset={() => changeTimelineDraft(resetTimelineDraft(timelineDraft, selected.id))} /> : <EmptyInspector />) : <div className="placeholder"><Settings2 size={22} /><strong>{inspectorTab === "effects" ? "Effects" : "Transitions"}</strong><span>Chọn preset để áp dụng lên VisualBeat.</span><button type="button">Browse presets</button></div>}</> : <PageInspector screen={screen} workspace={workspace} onOpenEditor={() => { setActivity("editor"); setScreen("editor"); }} />}<RenderQueue job={renderJob} notice={renderNotice} onStart={() => void startRender()} onOpenOutput={() => void openRenderOutput()} /></aside>
    <footer className="statusbar"><div><span className="saved"><Check size={12} /> {saveState}</span><span className="status-separator" /><span><HardDrive size={12} /> Local workspace</span></div><div><span><i className={`online-dot ${workspace.status === "error" ? "offline" : ""}`} /> {workspace.status === "error" ? "API offline · local shell ready" : workspace.status === "loading" ? "Connecting to backend…" : "Backend session ready"}</span><span className="status-separator" /><span>{appVersion ? `Desktop v${appVersion}` : "NarrativeX Desktop"}</span></div></footer>
  </div>;
}

function PanelHeader({ eyebrow, title, trailing }: Readonly<{ eyebrow: string; title: string; trailing?: ReactNode }>) { return <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="panel-actions">{trailing ?? <><IconButton label="Search"><Search size={16} /></IconButton><IconButton label="Add"><Plus size={17} /></IconButton></>}</div></div>; }
function IconButton({ label, children, onClick, active = false, disabled = false }: Readonly<{ label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }>) { return <button type="button" className={`icon-button ${active ? "active" : ""}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>; }
function ProjectTree({ clips, projects, activeProjectId, selectedId, onSelect }: Readonly<{ clips: VisualClip[]; projects: DesktopProject[]; activeProjectId: string | null; selectedId: string; onSelect: (id: string) => void }>) { const project = projects.find((item) => item.id === activeProjectId); return <div className="tree"><TreeRow icon={<FolderOpen size={16} />} label={project?.name ?? "Chưa chọn project"} root /><div className="tree-branch"><TreeRow icon={<Folder size={16} />} label="Chapters" /><div className="leaf-list">{clips.slice(0, 8).map((clip, index) => <button type="button" className={`tree-row leaf ${selectedId === clip.id ? "selected" : ""}`} key={clip.id} onClick={() => onSelect(clip.id)}><span className="leaf-index">{index + 1}</span><span>{clip.title}</span></button>)}</div>{clips.length === 0 && <p className="tree-empty">Timeline sẽ xuất hiện sau khi API trả về dữ liệu.</p>}<TreeRow icon={<Folder size={16} />} label="Assets" /><div className="asset-branches"><TreeRow icon={<Folder size={15} />} label="Images" count="API" /><TreeRow icon={<Folder size={15} />} label="Videos" count="API" /><TreeRow icon={<Folder size={15} />} label="Audio" count="API" /></div></div></div>; }
function TreeRow({ icon, label, root = false, collapsed = false, count }: Readonly<{ icon: ReactNode; label: string; root?: boolean; collapsed?: boolean; count?: string }>) { return <div className={`tree-row ${root ? "root" : ""}`}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{icon}<span>{label}</span>{count && <small>{count}</small>}{root && <MoreVertical size={14} className="tree-more" />}</div>; }
function Library({ activity }: Readonly<{ activity: ActivityId }>) { const items: Record<ActivityId, string[]> = { editor: [], chapters: ["Chapter 01", "Chapter 02", "Chapter 03"], characters: ["Cậu bé", "Người dẫn chuyện", "The Keeper"], images: ["Visual beats", "Generated", "Approved"], voice: ["Narration", "Voice catalog", "Voice takes"], assets: ["Generated", "Imported", "Reused", "References"], render: ["Export queue", "Completed renders", "Render settings"], settings: ["General", "Storage", "Generation", "Rendering", "Account"] }; const Icon = activity === "voice" ? Mic2 : activity === "images" ? ImageIcon : activity === "render" ? Sparkles : activity === "settings" ? Settings2 : Folder; return <div className="library">{(items[activity] ?? []).map((item, index) => <button type="button" className="library-row" key={item}><Icon size={16} /><span>{item}</span>{index === 0 && <i />}</button>)}<div className="library-note"><Sparkles size={15} /><span>Library context stays in place while you edit.</span></div></div>; }
function Timeline({ clips: visualClips, totalMs, selectedId, onSelect, playheadMs, zoom }: Readonly<{ clips: VisualClip[]; totalMs: number; selectedId: string; onSelect: (id: string) => void; playheadMs: number; zoom: number }>) { const width = Math.round(1080 * zoom); const scale = Math.max(1, totalMs); return <div className="timeline-scroll"><div className="timeline-canvas" style={{ width: `${width + 94}px` }}><div className="ruler-label" /><div className="ruler" style={{ width }}>{["00:00:00", "00:01:30", "00:03:00", "00:04:30", "00:06:00", "00:07:30", "00:09:00", "00:10:30", "00:12:00"].map((label, index, all) => <span key={label} style={{ left: `${(index / (all.length - 1)) * 100}%` }}>{label}</span>)}</div><Track label="V3" name="Effects" icon={<WandSparkles size={13} />}><TrackEmpty label="Effect tracks from API" /></Track><Track label="V2" name="Video 2" icon={<Eye size={13} />}><TrackEmpty label="Additional video layer" /></Track><Track label="V1" name="Video 1" icon={<ImageIcon size={13} />} main>{visualClips.length ? visualClips.map((clip) => <Clip key={clip.id} title={clip.asset} left={(clip.startMs / scale) * 100} width={((clip.endMs - clip.startMs) / scale) * 100} tone={clip.id === selectedId ? "selected" : clip.status === "generating" ? "pending" : "image"} selected={clip.id === selectedId} onClick={() => onSelect(clip.id)} />) : <TrackEmpty label="VisualBeat clips will appear after timeline sync" />}</Track><Track label="A1" name="Narration" icon={<Mic2 size={13} />} audio><TrackEmpty label="Narration waveform from API" /></Track><Track label="A2" name="Music" icon={<AudioLines size={13} />} audio><TrackEmpty label="Music track from API" /></Track><Track label="A3" name="SFX" icon={<Volume2 size={13} />}><TrackEmpty label="SFX track from API" /></Track><Track label="T1" name="Subtitle" icon={<Type size={13} />}><TrackEmpty label="Subtitle track from API" /></Track><div className="playhead" style={{ left: `${94 + (playheadMs / scale) * width}px` }}><span>{formatTimecode(playheadMs)}</span></div></div></div>; }
function Track({ label, name, icon, children, main = false, audio = false }: Readonly<{ label: string; name: string; icon: ReactNode; children: ReactNode; main?: boolean; audio?: boolean }>) { return <div className={`track ${main ? "main" : ""} ${audio ? "audio" : ""}`}><div className="track-label"><b>{label}</b><span>{name}</span><small><Eye size={12} /><LockKeyhole size={11} /></small></div><div className="track-content"><span className="track-icon">{icon}</span>{children}</div></div>; }
function Clip({ title, left, width, tone, selected = false, onClick }: Readonly<{ title: string; left: number; width: number; tone: string; selected?: boolean; onClick?: () => void }>) { return <button type="button" className={`clip tone-${tone} ${selected ? "selected" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} onClick={onClick}><span>{title}</span></button>; }
function TrackEmpty({ label }: Readonly<{ label: string }>) { return <span className="track-empty">{label}</span>; }
function ApiStatusBanner({ status, error }: Readonly<{ status: DesktopWorkspaceState["status"]; error: string | null }>) { if (status === "ready") return null; const label = status === "loading" ? "Đang đồng bộ workspace…" : status === "empty" ? "Workspace trống" : status === "partial" ? "Workspace đồng bộ một phần" : "Không kết nối được backend"; return <div className={`api-status ${status}`} role={status === "error" ? "alert" : "status"}><span className="api-status-dot" /><strong>{label}</strong><span>{error ?? `API: ${apiBaseUrl()}`}</span></div>; }
function EmptyInspector() { return <div className="placeholder"><MousePointer2 size={22} /><strong>Chưa chọn VisualBeat</strong><span>Chọn một clip trên timeline để mở transform, crop, color và AI asset.</span></div>; }
function WorkspacePage({ screen, workspace, onOpenEditor, renderJob, renderPreflight, onStartRender, onOpenRenderOutput }: Readonly<{ screen: Exclude<DesktopScreen, "editor">; workspace: DesktopWorkspaceState; onOpenEditor: () => void; renderJob: DesktopRenderJob | null; renderPreflight: LocalRenderPreflight | null; onStartRender: () => void; onOpenRenderOutput: () => void }>) {
  const titles: Record<Exclude<DesktopScreen, "editor">, string> = { projects: "Project Hub", chapters: "Chapter Workspace", characters: "Character Library", images: "Image Generation", voice: "Voice & TTS", assets: "Asset Browser", render: "Render Workspace", settings: "Desktop Settings" };
  return <div className="workspace-page"><div className="workspace-page-header"><div><span className="eyebrow">NarrativeX Desktop</span><h1>{titles[screen]}</h1><p>{screen === "projects" ? "Mở project để đi thẳng vào editor timeline." : "Nội dung được lấy từ backend domain và hiển thị trong cùng một workspace."}</p></div><div className="workspace-page-actions"><span className="connection-pill"><i /> {workspace.status === "ready" ? "Backend connected" : "API status"}</span>{screen !== "settings" && screen !== "render" && <button type="button" className="primary-action" onClick={onOpenEditor}>Open Editor <ChevronRight size={14} /></button>}</div></div><ApiStatusBanner status={workspace.status} error={workspace.error} />{screen === "projects" && <ProjectPage projects={workspace.projects} onOpenEditor={onOpenEditor} />}{screen === "assets" && <AssetsPage projectId={workspace.timeline?.projectId ?? null} assets={workspace.assets} />}{screen === "characters" && <CharactersPage projectId={workspace.timeline?.projectId ?? null} characters={workspace.characters} />}{screen === "chapters" && <StoryPage projectId={workspace.timeline?.projectId ?? null} storyVersionId={workspace.timeline?.storyVersionId ?? null} chapters={workspace.chapters} />}{screen === "images" && <ScenesPage projectId={workspace.timeline?.projectId ?? null} chapters={workspace.chapters} timeline={workspace.timeline} />}{screen === "voice" && <VoicesPage projectId={workspace.timeline?.projectId ?? null} chapters={workspace.chapters} voices={workspace.voices} assets={workspace.assets} />}{screen === "render" && <RenderPage workspace={workspace} job={renderJob} preflight={renderPreflight} onStart={onStartRender} onOpenOutput={onOpenRenderOutput} />}{screen === "settings" && <SettingsPage projectId={workspace.timeline?.projectId ?? null} workspace={workspace} />}</div>;
}
function ProjectPage({ projects, onOpenEditor }: Readonly<{ projects: DesktopProject[]; onOpenEditor: () => void }>) { return <div className="resource-grid projects-grid">{projects.map((project) => <button type="button" className="resource-card project-card" key={project.id} onClick={onOpenEditor}><div className="card-cover" style={project.coverImageUrl ? { backgroundImage: `url(${project.coverImageUrl})` } : undefined}><FolderOpen size={22} /></div><div className="resource-card-body"><div><span className="eyebrow">{project.status}</span><h3>{project.name}</h3></div><ChevronRight size={16} /><p>{project.description || "Chưa có mô tả project."}</p><small>{project.metrics?.totalChapters ?? "—"} chapters · {project.metrics?.totalScenes ?? "—"} scenes</small></div></button>)}{projects.length === 0 && <ResourceEmpty title="Chưa có project" action="Dùng New project để bắt đầu" />}</div>; }
function AssetsPage({ projectId, assets, audioOnly = false }: Readonly<{ projectId: string | null; assets: DesktopAsset[]; audioOnly?: boolean }>) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localStates, setLocalStates] = useState<Record<string, "AVAILABLE" | "MISSING" | "CORRUPT">>({});
  useEffect(() => { if (!projectId) return; void window.narrativex.localStorage.verifyProject(projectId).then((entries) => setLocalStates(Object.fromEntries(entries.map((entry) => [entry.assetId, entry.state])))).catch(() => undefined); }, [projectId, assets.length]);
  async function importAsset(repairAssetId?: string) {
    if (!projectId) { setNotice("Mở project trước khi import asset."); return; }
    setBusy(true); setNotice(null);
    try {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return;
      if (selection.kind === "OTHER") throw new Error("Chỉ hỗ trợ image, audio hoặc video asset.");
      const asset = repairAssetId ? { id: repairAssetId } : await assetsApi.registerLocal({ projectId, type: selection.kind, originalFilename: selection.originalFilename, contentType: selection.contentType, sizeBytes: selection.sizeBytes, checksumSha256: selection.checksumSha256 });
      if (repairAssetId) await window.narrativex.localStorage.repairSelectedAsset({ projectId, assetId: repairAssetId, kind: selection.kind, selectionToken: selection.selectionToken });
      else await window.narrativex.localStorage.commitSelectedAsset({ projectId, assetId: asset.id, kind: selection.kind, selectionToken: selection.selectionToken });
      await queryClient.invalidateQueries({ queryKey: ["assets", "library"] });
      setNotice(`${selection.originalFilename} đã được ${repairAssetId ? "repair" : "đăng ký và materialize"} local.`);
      if (projectId) { const entries = await window.narrativex.localStorage.verifyProject(projectId); setLocalStates(Object.fromEntries(entries.map((entry) => [entry.assetId, entry.state]))); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể import asset."); }
    finally { setBusy(false); }
  }
  return <div className="resource-section"><div className="resource-toolbar"><span>{assets.length} assets from API</span><button type="button" className="outline-action" onClick={() => void importAsset()} disabled={busy}><Plus size={14} /> {busy ? "Importing…" : "Import asset"}</button></div>{notice && <p className="queue-notice">{notice}</p>}<div className="resource-grid">{assets.map((asset) => { const localState = localStates[asset.id]; return <div className="resource-card asset-card" key={asset.id}><div className={`asset-preview ${asset.type.toLowerCase()}`}><ImageIcon size={22} /><span>{asset.type}</span></div><div className="resource-card-body"><h3>{asset.originalFilename}</h3><p>{formatBytes(asset.sizeBytes)} · {asset.status} · {localState ?? "REMOTE"}</p><small>{new Date(asset.createdAt).toLocaleDateString("vi-VN")}</small>{localState && localState !== "AVAILABLE" && <button type="button" className="outline-action" onClick={() => void importAsset(asset.id)} disabled={busy}>Repair local file</button>}</div></div>; })}{assets.length === 0 && <ResourceEmpty title={audioOnly ? "Chưa có audio" : "Chưa có asset"} action="Import asset từ máy này" />}</div></div>;
}
function CharactersPage({ projectId, characters }: Readonly<{ projectId: string | null; characters: DesktopCharacter[] }>) { const createCharacter = useCreateCharacter(projectId ?? ""); const [name, setName] = useState(""); const [notice, setNotice] = useState<string | null>(null); async function create(event: FormEvent) { event.preventDefault(); if (!projectId || !name.trim()) return; try { await createCharacter.mutateAsync({ canonicalName: name.trim() }); setName(""); setNotice("Character đã được tạo và assign vào project."); } catch (error) { setNotice(errorMessage(error)); } } return <div className="resource-section"><form className="generation-toolbar" onSubmit={(event) => void create(event)}><label>New character<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Canonical name" /></label><button type="submit" className="primary-action" disabled={!projectId || !name.trim() || createCharacter.isPending}><Plus size={13} /> Create character</button></form>{notice && <p className="queue-notice">{notice}</p>}<div className="resource-grid">{characters.map((character) => <div className="resource-card character-card" key={character.id}><div className="character-avatar"><UserCircle size={30} /></div><div className="resource-card-body"><span className="eyebrow">{character.status ?? "ACTIVE"}</span><h3>{character.canonicalName}</h3><p>{character.role ?? "Project character"}</p><small>{character.sceneCount ?? 0} scenes · {character.pinnedCharacterVersionId ? "Version locked" : "No version locked"}</small></div></div>)}{characters.length === 0 && <ResourceEmpty title="Chưa có character" action="Tạo character đầu tiên ở trên" />}</div></div>; }
function StoryPage({ projectId, storyVersionId, chapters }: Readonly<{ projectId: string | null; storyVersionId: string | null; chapters: import("@narrativex/client-contracts").DesktopChapterDetails[] }>) {
  const createChapter = useCreateChapter(projectId ?? "");
  const updateChapter = useUpdateChapter(projectId ?? "");
  const deleteChapter = useDeleteChapter(projectId ?? "");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const selected = chapters.find((chapter) => chapter.id === editingId) ?? null;
  useEffect(() => { if (selected) { setTitle(selected.title); setSourceText(selected.sourceText); } }, [selected]);
  async function saveChapter(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !title.trim() || !sourceText.trim()) return;
    if (selected) await updateChapter.mutateAsync({ chapterId: selected.id, title: title.trim(), sourceText, rowVersion: selected.rowVersion });
    else await createChapter.mutateAsync({ storyVersionId: storyVersionId ?? undefined, orderIndex: chapters.length, title: title.trim(), sourceText });
    setTitle(""); setSourceText(""); setEditingId(null);
  }
  return <div className="story-layout"><div className="story-intro"><span className="eyebrow">Backend-backed workflow</span><h2>Story → Chapter → Scene → VisualBeat</h2><p>Create, edit, import, and delete chapters without leaving Desktop.</p><form className="chapter-editor-form" onSubmit={(event) => void saveChapter(event)}><input aria-label="Chapter title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chapter title" /><textarea aria-label="Chapter content" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste chapter text…" /><div><button type="submit" className="primary-action" disabled={!projectId || createChapter.isPending || updateChapter.isPending}>{selected ? "Save chapter" : "Create chapter"}</button>{selected && <button type="button" className="outline-action" onClick={() => { setEditingId(null); setTitle(""); setSourceText(""); }}>Cancel</button>}</div></form></div><div className="chapter-list">{chapters.map((chapter) => <div className="chapter-row" key={chapter.id}><span>{String(chapter.orderIndex + 1).padStart(2, "0")}</span><div><button type="button" className="chapter-edit" onClick={() => setEditingId(chapter.id)}><strong>{chapter.title}</strong></button><small>row {chapter.rowVersion} · {chapter.sourceText.length.toLocaleString()} characters</small></div><button type="button" className="outline-action" onClick={() => void deleteChapter.mutateAsync(chapter.id)} disabled={deleteChapter.isPending}>Delete</button></div>)}{chapters.length === 0 && <ResourceEmpty title="Chưa có chapter" action="Tạo chapter đầu tiên ở bên trái" />}</div></div>;
}
function ScenesPage({ projectId, chapters, timeline }: Readonly<{ projectId: string | null; chapters: import("@narrativex/client-contracts").DesktopChapterDetails[]; timeline: DesktopTimeline | null }>) {
  const analyze = useAnalyzeChapter();
  const estimate = useEstimateMediaJob();
  const createJob = useCreateMediaJob();
  const review = useReviewMediaItem();
  const [chapterId, setChapterId] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qualityTier, setQualityTier] = useState<"DRAFT" | "STANDARD" | "HIGH">("STANDARD");
  const [imageStyle, setImageStyle] = useState<"CINEMATIC" | "STORYBOOK_WATERCOLOR">("CINEMATIC");
  const details = useMediaJob(jobId);
  const scenes = timeline?.beats ?? [];
  useEffect(() => { if (!chapterId && chapters[0]) setChapterId(chapters[0].id); }, [chapterId, chapters]);
  const chapterBeats = scenes.filter((beat) => beat.chapterId === chapterId);
  async function runAnalysis() {
    if (!projectId || !chapterId) return;
    setNotice(null);
    try { const job = await analyze.mutateAsync({ projectId, chapterId }); setJobId(job.jobId); setNotice(`Analysis job ${job.jobId.slice(0, 8)} đã được queue.`); } catch (error) { setNotice(errorMessage(error)); }
  }
  async function estimateCost() {
    if (!projectId || !chapterId) return;
    try { const result = await estimate.mutateAsync({ projectId, chapterId, qualityTier }); setNotice(`Ước tính ${result.estimatedCost} ${result.currency} cho ${result.visualBeatCount} visual beat.`); } catch (error) { setNotice(errorMessage(error)); }
  }
  async function generateImages() {
    if (!projectId || !chapterId) return;
    try { const job = await createJob.mutateAsync({ projectId, chapterId, request: { productionMode: "IMAGE_MOTION", aspectRatio: (timeline?.aspectRatio as "16:9" | "9:16" | "1:1" | "4:3" | "3:4") ?? "16:9", qualityTier, maxAuthorizedCost: 5, imageStyle } }); setJobId(job.jobId); setNotice(`Media job ${job.jobId.slice(0, 8)} đã được queue.`); } catch (error) { setNotice(errorMessage(error)); }
  }
  async function materialize(item: import("@narrativex/client-contracts").MediaGenerationItem) {
    if (!projectId || !item.mediaAssetId) return;
    try { const asset = await assetsApi.get(item.mediaAssetId); await window.narrativex.localStorage.materializeRemoteAsset({ projectId, assetId: asset.id }); setNotice(`${asset.originalFilename} đã materialize local và checksum đã xác thực.`); } catch (error) { setNotice(errorMessage(error)); }
  }
  return <div className="resource-section"><div className="generation-toolbar"><label>Chapter<select value={chapterId} onChange={(event) => setChapterId(event.target.value)}><option value="">Chọn chapter</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.orderIndex + 1}. {chapter.title}</option>)}</select></label><label>Quality<select value={qualityTier} onChange={(event) => setQualityTier(event.target.value as typeof qualityTier)}><option value="DRAFT">Draft</option><option value="STANDARD">Standard</option><option value="HIGH">High</option></select></label><label>Style<select value={imageStyle} onChange={(event) => setImageStyle(event.target.value as typeof imageStyle)}><option value="CINEMATIC">Cinematic</option><option value="STORYBOOK_WATERCOLOR">Storybook watercolor</option></select></label><button type="button" className="outline-action" onClick={() => void runAnalysis()} disabled={!chapterId || analyze.isPending}><Sparkles size={13} /> {analyze.isPending ? "Analyzing…" : "Analyze"}</button><button type="button" className="outline-action" onClick={() => void estimateCost()} disabled={!chapterId || estimate.isPending}>Estimate</button><button type="button" className="primary-action" onClick={() => void generateImages()} disabled={!chapterId || createJob.isPending}><ImageIcon size={13} /> {createJob.isPending ? "Queueing…" : "Generate images"}</button></div>{notice && <p className="queue-notice">{notice}</p>}{jobId && <div className="generation-job"><span className="eyebrow">Generation job</span><strong>{details.data ? `${details.data.readyItems}/${details.data.totalItems} ready · ${details.data.reviewItems} needs review` : `Job ${jobId.slice(0, 8)} · loading details…`}</strong>{details.error && <small>{errorMessage(details.error)}</small>}{details.data?.items.map((item) => <div className="generation-item" key={item.id}><span>{item.itemKey ?? item.visualBeatId.slice(0, 8)}</span><span>{item.executionStatus} · {item.reviewStatus}</span><div>{item.reviewStatus === "NEEDS_REVIEW" && <><button type="button" className="outline-action" onClick={() => void review.mutateAsync({ itemId: item.id, jobId, review: { decision: "APPROVED", rowVersion: item.rowVersion } })}>Approve</button><button type="button" className="outline-action" onClick={() => void review.mutateAsync({ itemId: item.id, jobId, review: { decision: "REJECTED", rowVersion: item.rowVersion } })}>Reject</button></>}{item.mediaAssetId && item.executionStatus === "READY" && <button type="button" className="outline-action" onClick={() => void materialize(item)}>Materialize</button>}</div></div>)}</div>}<div className="resource-grid">{chapterBeats.map((beat) => <div className="resource-card scene-card" key={beat.visualBeatId}><div className="scene-index">{beat.sceneIndex + 1}<span>SCENE</span></div><div className="resource-card-body"><span className="eyebrow">Beat {beat.beatIndex + 1}</span><h3>{beat.title}</h3><p>{beat.visualIntent || "Visual intent chưa có."}</p><small>{formatTime(beat.startMs)} → {formatTime(beat.endMs)} · {beat.cameraMovement} · {beat.assetReady ? "Asset ready" : "Needs asset"}</small></div></div>)}{chapterBeats.length === 0 && <ResourceEmpty title="Chưa có scene" action="Chọn chapter hoặc chạy analysis khi backend sẵn sàng" />}</div></div>;
}
function VoicesPage({ projectId, chapters, voices, assets }: Readonly<{ projectId: string | null; chapters: import("@narrativex/client-contracts").DesktopChapterDetails[]; voices: DesktopVoice[]; assets: DesktopAsset[] }>) {
  const generate = useGenerateNarration();
  const generateBatch = useGenerateBatchNarration();
  const [chapterId, setChapterId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [referenceAssetId, setReferenceAssetId] = useState("");
  const [audioMode, setAudioMode] = useState<"TTS" | "USER_AUDIO">("TTS");
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const job = useGenerationJob(jobId);
  const audioAssets = assets.filter((asset) => asset.type === "AUDIO");
  useEffect(() => { if (!chapterId && chapters[0]) setChapterId(chapters[0].id); if (!voiceId && voices[0]) setVoiceId(voices[0].id); }, [chapterId, chapters, voiceId, voices]);
  async function generateChapter() { if (!projectId || !chapterId || !voiceId) return; if (audioMode === "USER_AUDIO") { setNotice("USER_PROVIDED_AUDIO đang bật: TTS bị vô hiệu hóa. Audio local đã được hash và materialize; cần chọn Attach audio khi backend narration-set endpoint được bật."); return; } try { const result = await generate.mutateAsync({ projectId, request: { chapterId, voiceId, voiceReferenceAssetId: referenceAssetId || undefined } }); setJobId(result.jobId); setNotice(`Narration job ${result.jobId.slice(0, 8)} đã được queue.`); } catch (error) { setNotice(errorMessage(error)); } }
  async function generateAll() { if (!projectId || !voiceId || chapters.length === 0 || audioMode === "USER_AUDIO") return; try { const result = await generateBatch.mutateAsync({ projectId, chapterIds: chapters.map((chapter) => chapter.id), voiceId, voiceReferenceAssetId: referenceAssetId || undefined }); setJobId(result[0]?.job.jobId ?? null); setNotice(`${result.length} narration job đã được queue.`); } catch (error) { setNotice(errorMessage(error)); } }
  async function importReference() { if (!projectId) { setNotice("Mở project trước khi import audio reference."); return; } try { const selection = await window.narrativex.localStorage.selectAsset(); if (!selection) return; if (selection.kind !== "AUDIO") throw new Error("Hãy chọn file audio cho voice reference."); const asset = await assetsApi.registerLocal({ projectId, type: "AUDIO", originalFilename: selection.originalFilename, contentType: selection.contentType, sizeBytes: selection.sizeBytes, checksumSha256: selection.checksumSha256 }); await window.narrativex.localStorage.commitSelectedAsset({ projectId, assetId: asset.id, kind: "AUDIO", selectionToken: selection.selectionToken }); setReferenceAssetId(asset.id); setAudioMode("USER_AUDIO"); setNotice(`${selection.originalFilename} đã sẵn sàng ở USER_PROVIDED_AUDIO; không tự enqueue TTS.`); } catch (error) { setNotice(errorMessage(error)); } }
  return <div className="resource-section"><div className="generation-toolbar"><label>Mode<select value={audioMode} onChange={(event) => setAudioMode(event.target.value as typeof audioMode)}><option value="TTS">Narration / TTS</option><option value="USER_AUDIO">Use my audio</option></select></label><label>Voice<select value={voiceId} onChange={(event) => setVoiceId(event.target.value)} disabled={audioMode === "USER_AUDIO"}><option value="">Chọn voice</option>{voices.map((voice) => <option value={voice.id} key={voice.id}>{voice.name} · {voice.language}</option>)}</select></label><label>Chapter<select value={chapterId} onChange={(event) => setChapterId(event.target.value)}><option value="">Chọn chapter</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.orderIndex + 1}. {chapter.title}</option>)}</select></label><label>Local audio<select value={referenceAssetId} onChange={(event) => setReferenceAssetId(event.target.value)}><option value="">None</option>{audioAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.originalFilename}</option>)}</select></label><button type="button" className="outline-action" onClick={() => void importReference()}><Plus size={13} /> Import user audio</button><button type="button" className="primary-action" onClick={() => void generateChapter()} disabled={!projectId || !chapterId || !voiceId || generate.isPending || audioMode === "USER_AUDIO"}><Mic2 size={13} /> Generate chapter</button><button type="button" className="outline-action" onClick={() => void generateAll()} disabled={!projectId || !voiceId || chapters.length === 0 || generateBatch.isPending || audioMode === "USER_AUDIO"}>Generate all</button></div>{notice && <p className="queue-notice">{notice}</p>}{job.data && <div className="generation-job"><span className="eyebrow">Narration job</span><strong>{job.data.type} · {job.data.status} · {job.data.progress}%</strong><small>{job.data.currentStep ?? "Waiting for worker"}</small></div>}<div className="resource-grid">{voices.map((voice) => <div className="resource-card voice-card" key={voice.id}><div className="voice-icon"><Mic2 size={22} /></div><div className="resource-card-body"><span className="eyebrow">{voice.provider} · {voice.language}</span><h3>{voice.name}</h3><p>{voice.gender ?? "Voice preset"}</p>{voice.sampleUrl ? <audio controls preload="none" src={voice.sampleUrl} /> : <small>Preview unavailable</small>}</div></div>)}{voices.length === 0 && <ResourceEmpty title="Chưa tải voice catalog" action="Kiểm tra Catalog API" />}</div></div>;
}
function RenderPage({ workspace, job, preflight, onStart, onOpenOutput }: Readonly<{ workspace: DesktopWorkspaceState; job: DesktopRenderJob | null; preflight: LocalRenderPreflight | null; onStart: () => void; onOpenOutput: () => void }>) { const active = Boolean(job && ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"].includes(job.status)); const completed = job?.status === "COMPLETED"; return <div className="render-workspace"><div className="render-preview"><span className="eyebrow">Preview</span><div className="render-preview-stage"><div className="preview-art" /><div className="preview-overlay" /><span>{workspace.timeline?.readyForRender ? "Timeline ready for export" : "Timeline needs review"}</span></div><p>Export respects the current chapter timeline and approved assets.</p></div><div className="render-settings-card"><span className="eyebrow">Export settings</span><h2>Production render</h2><div className="render-setting"><span>Resolution</span><strong>1080p</strong></div><div className="render-setting"><span>Frame rate</span><strong>30 fps</strong></div><div className="render-setting"><span>Format</span><strong>MP4 · H.264</strong></div><div className="render-setting"><span>Timeline</span><strong>{workspace.timeline ? formatTimecode(workspace.timeline.totalDurationMs) : "Not loaded"}</strong></div><div className={`preflight-summary ${preflight?.ready ? "ready" : "blocked"}`}><strong>{preflight ? (preflight.ready ? "Ready to export" : "Export blocked") : "Preflight runs before export"}</strong><span>{preflight ? `${preflight.assets.filter((asset) => asset.state === "AVAILABLE").length}/${preflight.assets.length} local assets · ${preflight.diskFreeBytes ? formatBytes(preflight.diskFreeBytes) + " free" : "disk unknown"}` : "FFmpeg · disk · checksum · local executor"}</span>{preflight?.blockers.map((blocker) => <small key={blocker}>{renderBlockerMessage(blocker)}</small>)}</div><button type="button" className="primary-action render-start" onClick={completed ? onOpenOutput : onStart} disabled={active || (!completed && !workspace.timeline?.readyForRender)}><Sparkles size={14} /> {active ? "Rendering…" : completed ? "Open output" : "Export video"}</button>{job && <p className="render-job-note">{job.currentStep || job.status} · {job.progress}%</p>}</div><div className="render-boundary"><LockKeyhole size={15} /><span>Native FFmpeg execution stays behind the desktop main-process bridge. This workspace only submits the typed render contract.</span></div></div>; }
function SettingsPage({ projectId, workspace }: Readonly<{ projectId: string | null; workspace: DesktopWorkspaceState }>) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof window.narrativex.localStorage.summary>> | null>(null);
  const [recovery, setRecovery] = useState<Awaited<ReturnType<typeof window.narrativex.render.recoveryStatus>> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { if (!projectId) return; void Promise.all([window.narrativex.localStorage.summary(projectId), window.narrativex.render.recoveryStatus()]).then(([nextSummary, nextRecovery]) => { setSummary(nextSummary); setRecovery(nextRecovery); }).catch((error) => setNotice(errorMessage(error))); }, [projectId]);
  async function refresh() { if (!projectId) return; try { const [nextSummary, nextRecovery] = await Promise.all([window.narrativex.localStorage.summary(projectId), window.narrativex.render.recoveryStatus()]); setSummary(nextSummary); setRecovery(nextRecovery); } catch (error) { setNotice(errorMessage(error)); } }
  async function cleanup() { if (!projectId) return; try { const count = await window.narrativex.localStorage.cleanupCompletedWork(projectId); setNotice(`${count} render work directory đã được dọn.`); await refresh(); } catch (error) { setNotice(errorMessage(error)); } }
  async function backup() {
    if (!projectId) return;
    try {
      const result = await window.narrativex.localStorage.createBackup(projectId);
      if (!result) return;
      setNotice(`Backup đã tạo (${formatBytes(result.sizeBytes)}).`);
    } catch (error) { setNotice(errorMessage(error)); }
  }
  async function restore() {
    try {
      if (!window.confirm("Restore sẽ thay thế project hiện tại và giữ bản cũ dưới tên .before-restore. Tiếp tục?")) return;
      const result = await window.narrativex.localStorage.restoreBackup();
      if (!result) return;
      setNotice(`Đã restore project ${result.projectId}. Bản trước được giữ lại để khôi phục thủ công nếu cần.`);
      await refresh();
    } catch (error) { setNotice(errorMessage(error)); }
  }
  async function archive() {
    if (!projectId) return;
    try {
      const result = await window.narrativex.localStorage.archiveProject(projectId);
      if (!result) return;
      setNotice("Đã tạo archive copy; workspace active không thay đổi.");
    } catch (error) { setNotice(errorMessage(error)); }
  }
  return <div className="settings-page"><div className="setting-row"><div><span className="eyebrow">API endpoint</span><strong>{apiBaseUrl()}</strong><p>Desktop calls backend bằng session credentials.</p></div><span className="connection-pill"><i /> {workspace.status}</span></div><div className="setting-row"><div><span className="eyebrow">Local workspace</span><strong>{summary ? `${formatBytes(summary.totalBytes)} used · ${summary.assetCount} assets · ${summary.artifactCount} artifacts` : "Loading storage…"}</strong><p>Project storage is managed by Electron main and created on first local import/render.</p></div><HardDrive size={18} className="setting-check" /></div><div className="setting-row"><div><span className="eyebrow">Workspace backup</span><strong>Versioned project snapshot</strong><p>Copy toàn bộ manifest, assets, artifacts và recovery journal sang thư mục bạn chọn.</p></div><div className="setting-actions"><button type="button" className="outline-action" onClick={() => void backup()} disabled={!projectId}>Create backup</button><button type="button" className="outline-action" onClick={() => void restore()}>Restore backup</button><button type="button" className="outline-action" onClick={() => void archive()} disabled={!projectId}>Archive copy</button></div></div><div className="setting-row"><div><span className="eyebrow">Render recovery</span><strong>{recovery?.unfinished.length ?? 0} unfinished render journal(s)</strong><p>{recovery?.unfinished[0] ? `${recovery.unfinished[0].stage} · ${new Date(recovery.unfinished[0].updatedAt).toLocaleString("vi-VN")}` : "No interrupted render checkpoint detected."}</p></div><button type="button" className="outline-action" onClick={() => void refresh()}>Refresh</button></div><div className="setting-row"><div><span className="eyebrow">Render work cleanup</span><strong>{summary ? `${formatBytes(summary.workBytes)} temporary work data` : "Temporary render data"}</strong><p>Only completed or failed render work directories are removed; artifacts remain.</p></div><button type="button" className="outline-action" onClick={() => void cleanup()} disabled={!projectId}>Cleanup completed</button></div><div className="setting-row"><div><span className="eyebrow">Editor clock</span><strong>Narration is master clock</strong><p>Visual clip duration luôn được suy ra từ startMs / endMs.</p></div><Check size={18} className="setting-check" /></div><div className="setting-row"><div><span className="eyebrow">Renderer boundary</span><strong>Desktop FFmpeg execution engine</strong><p>Renderer không tự render final MP4 và không truy cập Node APIs trực tiếp.</p></div><LockKeyhole size={18} className="setting-check" /></div>{notice && <p className="queue-notice">{notice}</p>}</div>;
}
function ResourceEmpty({ title, action }: Readonly<{ title: string; action: string }>) { return <div className="resource-empty"><FolderOpen size={22} /><strong>{title}</strong><span>{action}</span></div>; }
function PageInspector({ screen, workspace, onOpenEditor }: Readonly<{ screen: Exclude<DesktopScreen, "editor">; workspace: DesktopWorkspaceState; onOpenEditor: () => void }>) { return <div className="page-inspector"><span className="eyebrow">Workspace context</span><h3>{screen[0].toUpperCase() + screen.slice(1)}</h3><p>Backend status: <strong>{workspace.status}</strong></p><div className="inspector-metric"><span>Projects</span><strong>{workspace.projects.length}</strong></div><div className="inspector-metric"><span>Assets</span><strong>{workspace.assets.length}</strong></div><div className="inspector-metric"><span>Characters</span><strong>{workspace.characters.length}</strong></div><button type="button" className="outline-action" onClick={onOpenEditor}><SlidersHorizontal size={13} /> Return to editor</button></div>; }
function renderBlockerMessage(code: import("@narrativex/client-contracts").LocalRenderPreflightBlockerCode): string {
  const messages: Record<import("@narrativex/client-contracts").LocalRenderPreflightBlockerCode, string> = {
    FFMPEG_UNAVAILABLE: "FFmpeg/ffprobe chưa sẵn sàng.",
    EXECUTOR_OFFLINE: "Local executor đang offline.",
    EXECUTOR_UNPAIRED: "Desktop chưa được pair.",
    EXECUTOR_CONNECTING: "Local executor đang kết nối.",
    DEVICE_MISMATCH: "Device pairing không hợp lệ.",
    USER_MISMATCH: "Phiên đăng nhập không khớp với device.",
    INSUFFICIENT_DISK: "Không đủ dung lượng đĩa.",
    DISK_UNKNOWN: "Không xác định được dung lượng đĩa.",
    ASSET_MISSING: "Có asset local bị thiếu.",
    ASSET_CORRUPT: "Có asset local bị lỗi checksum.",
  };
  return messages[code];
}
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function formatTime(ms: number) { const totalSeconds = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`; }
function Properties({ clip, override, onChange, onReset }: Readonly<{ clip: VisualClip; override?: ProjectRenderBeatOverride; onChange: (patch: Omit<ProjectRenderBeatOverride, "visualBeatId">) => void; onReset: () => void }>) { return <div className="inspector-scroll"><section className="inspector-section clip-info"><div className="clip-heading"><div><span className="eyebrow">Clip</span><h3>{clip.asset}</h3></div><button type="button" className="small-action">Replace</button><IconButton label="More actions"><MoreVertical size={15} /></IconButton></div><div className="meta"><span className={clip.status}>{clip.status === "ready" ? "READY" : "GENERATING"}</span><span>{clip.scene}</span></div></section><InspectorSection title="Transform"><Field label="Position"><Value value="960.0" /><Value value="540.0" /></Field><Field label="Scale"><Value value="100.0 %" /><Value value="100.0 %" /><IconButton label="Lock aspect ratio"><LockKeyhole size={13} /></IconButton></Field><Field label="Rotation"><Value value="0.0°" /></Field><Field label="Opacity"><Slider value="100%" /></Field></InspectorSection><InspectorSection title="Crop"><Field label="Type"><select className="select" defaultValue="Fit"><option>Fit</option><option>Fill</option><option>Custom</option></select></Field><Field label="Left"><Value value="0" /><Value value="Right 0" /></Field><Field label="Top"><Value value="0" /><Value value="Bottom 0" /></Field></InspectorSection><InspectorSection title="Color"><Field label="Exposure"><Slider value="0.0" /></Field><Field label="Contrast"><Slider value="0.0" /></Field><button type="button" className="reset"><RotateCcw size={12} /> Reset adjustments</button></InspectorSection><InspectorSection title="AI Asset"><div className="strategy"><span>Strategy</span><b>{clip.status === "generating" ? "GENERATED" : "REUSED"}</b></div><div className="info-line"><span>Visual Beat</span><strong>{clip.title}</strong></div><div className="info-line"><span>Camera Motion</span><select className="select" value={override?.cameraMovement ?? clip.motion} onChange={(event) => onChange({ cameraMovement: event.target.value })}><option value="NONE">NONE</option><option value="PAN">PAN</option><option value="TILT">TILT</option><option value="PUSH_IN">PUSH_IN</option><option value="PULL_OUT">PULL_OUT</option><option value="ZOOM_IN">ZOOM_IN</option><option value="ZOOM_OUT">ZOOM_OUT</option></select></div><div className="info-line"><span>Duration (ms)</span><input className="value" type="number" min={1} value={override?.durationMs ?? clip.endMs - clip.startMs} onChange={(event) => onChange({ durationMs: Math.max(1, Number(event.target.value) || 1) })} /></div><div className="inspector-actions"><button type="button" onClick={onReset}><RotateCcw size={13} /> Reset override</button><button type="button"><WandSparkles size={13} /> Regenerate</button><button type="button"><Copy size={13} /> Reuse</button></div></InspectorSection></div>; }
function InspectorSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) { return <section className="inspector-section"><div className="section-title"><span>{title}</span><ChevronDown size={14} /></div>{children}</section>; }
function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) { return <div className="field"><span>{label}</span><div>{children}</div></div>; }
function Value({ value }: Readonly<{ value: string }>) { return <input className="value" aria-label={value} value={value} readOnly />; }
function Slider({ value }: Readonly<{ value: string }>) { return <div className="slider"><input type="range" min="0" max="100" defaultValue="50" /><span>{value}</span></div>; }
function RenderQueue({ job, notice, onStart, onOpenOutput }: Readonly<{ job: DesktopRenderJob | null; notice: string | null; onStart: () => void; onOpenOutput: () => void }>) {
  const active = Boolean(job && ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"].includes(job.status));
  const completed = job?.status === "COMPLETED";
  const statusLabel = completed ? "Completed" : job?.status === "FAILED" ? "Failed" : job?.status === "CANCELED" ? "Canceled" : job?.currentStep || (active ? "Queued by backend" : "No active render job");
  return <section className="render-queue"><div className="queue-title"><div><span className="eyebrow">Render Queue</span><h3>Production render</h3></div><b>{job ? "1" : "0"}</b></div><div className="queue-body"><div className="queue-line"><span>{statusLabel}</span><strong>{job ? `${Math.max(0, Math.min(100, job.progress))}%` : "—"}</strong></div><div className="progress"><i style={{ width: `${job?.progress ?? 0}%` }} /></div>{notice && <p className="queue-notice">{notice}</p>}{job && <div className="queue-meta"><span>Job</span><b>{job.jobId.slice(0, 8)}…</b><span>Type</span><b>{job.type}</b></div>}{!job && !notice && <p className="queue-notice">Export tạo job local qua production render API.</p>}</div><div className="queue-buttons"><button type="button" className="queue-export" onClick={completed ? onOpenOutput : onStart} disabled={active}><Sparkles size={13} /> {active ? "Rendering" : completed ? "Open output" : "Export"}</button></div><div className="queue-stage"><i /> {active ? "POLLING · LOCAL EXECUTOR" : completed ? "OUTPUT_READY · LOCAL" : "QUEUE_IDLE · LOCAL"}</div></section>;
}
function formatTimecode(ms: number) { const totalSeconds = Math.max(0, Math.floor(ms / 1000)); return `00:${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}:${String(Math.floor((ms % 1000) / 40)).padStart(2, "0")}`; }
