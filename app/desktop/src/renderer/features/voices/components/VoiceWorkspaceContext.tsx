import type { ReactNode } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopVoice,
  VoiceReferenceScope,
} from "@narrativex/client-contracts";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  FileAudio,
  FolderPlus,
  Mic2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDuration } from "../model/voice-ui";
import { useAccountVoiceReferences } from "../queries/voice-media.queries";

type Props = Readonly<{
  selectedVoice: DesktopVoice | null;
  chapters: DesktopChapterDetails[];
  chapterId: string;
  speakingRate: string;
  selectedAssetIds: string[];
  audioAssets: DesktopAsset[];
  tagCounts: Array<{ label: string; count: number }>;
  totalDurationMs: number;
  totalSizeBytes: number;
  busy: boolean;
  voiceReferenceName: string | null;
  voiceReferenceScope: VoiceReferenceScope | null;
  previewText: string;
  previewStatus: string | null;
  previewUrl: string | null;
  previewBusy: boolean;
  onToggleAsset: (assetId: string) => void;
  onSelectAccountVoice: (assetId: string, originalFilename: string) => void;
  onCreateTake: () => void;
  onResetFilters: () => void;
  onUploadVoiceReference: () => void;
  onClearVoiceReference: () => void;
  onPreviewTextChange: (value: string) => void;
  onGeneratePreview: () => void;
  onBatch: () => void;
  onChapterChange: (chapterId: string) => void;
  onSpeakingRateChange: (value: string) => void;
  onTagFilter: (value: string) => void;
  onOpenAssets: () => void;
}>;

export function VoiceWorkspaceContext({
  selectedVoice,
  chapters,
  chapterId,
  speakingRate,
  selectedAssetIds,
  audioAssets,
  tagCounts,
  totalDurationMs,
  totalSizeBytes,
  busy,
  voiceReferenceName,
  voiceReferenceScope,
  previewText,
  previewStatus,
  previewUrl,
  previewBusy,
  onToggleAsset,
  onSelectAccountVoice,
  onCreateTake,
  onResetFilters,
  onUploadVoiceReference,
  onClearVoiceReference,
  onPreviewTextChange,
  onGeneratePreview,
  onBatch,
  onChapterChange,
  onSpeakingRateChange,
  onTagFilter,
  onOpenAssets,
}: Props) {
  const accountVoices = useAccountVoiceReferences();
  const reusableAccountVoices = (accountVoices.data ?? []).filter((asset) => asset.status === "READY");
  const customVoiceLabel =
    voiceReferenceScope === "PROJECT"
      ? "Project voice · local"
      : voiceReferenceScope === "ACCOUNT"
        ? "Account voice · R2"
        : "Custom voice";

  return (
    <aside className="min-h-0 overflow-auto bg-[var(--voice-context)] p-4">
      <section className="border-b border-border pb-4">
        <span className="text-[9px] font-bold uppercase tracking-[.18em] text-text-muted">
          Workspace Context
        </span>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Voice</h2>
          <span className="text-[10px] text-text-muted">
            {selectedAssetIds.length} project file đã chọn
          </span>
        </div>
        <div className="mt-4 grid gap-3 text-[10px]">
          <ContextStat label="Voice đang chọn" value={selectedVoice?.name ?? "Chưa chọn"} />
          <ContextStat label="Tổng thời lượng" value={formatDuration(totalDurationMs)} />
          <ContextStat label="Tổng dung lượng" value={formatBytes(totalSizeBytes)} />
        </div>
      </section>

      <section className="mt-4 grid gap-2 rounded-lg border border-border bg-surface-input p-3">
        <span className="text-[9px] font-bold uppercase tracking-[.14em] text-text-muted">
          Narration setup
        </span>
        <label className="grid gap-1 text-[10px] text-text-secondary">
          <span>Chapter</span>
          <select
            className="h-8 rounded-md border border-border bg-surface-2 px-2 text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
            value={chapterId}
            onChange={(event) => onChapterChange(event.target.value)}
          >
            <option value="">Chọn chapter</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-text-secondary">
          <span>Speaking rate</span>
          <Input
            type="number"
            min="0.25"
            max="2"
            step="0.1"
            value={speakingRate}
            onChange={(event) => onSpeakingRateChange(event.target.value)}
            className="h-8 border-border bg-surface-2 text-[10px]"
          />
        </label>
      </section>

      <section className="mt-4 rounded-lg border border-primary/25 bg-primary-muted/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[.14em] text-primary-hover">
              {customVoiceLabel}
            </span>
            <p className="mt-1 text-[9px] leading-4 text-text-muted">
              Chọn audio bên dưới để dùng local trong project, hoặc chọn/upload account voice trên R2 để reuse giữa các project.
            </p>
          </div>
          {voiceReferenceName && (
            <button
              type="button"
              aria-label="Bỏ giọng tham chiếu"
              onClick={onClearVoiceReference}
              disabled={busy}
              className="rounded p-1 text-text-muted hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {reusableAccountVoices.length > 0 && (
          <div className="mt-3 grid gap-1">
            <span className="text-[9px] font-medium text-text-secondary">Account voices · R2</span>
            {reusableAccountVoices.slice(0, 5).map((asset) => {
              const selected = voiceReferenceScope === "ACCOUNT" && voiceReferenceName === asset.originalFilename;
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectAccountVoice(asset.id, asset.originalFilename)}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] disabled:opacity-40 ${
                    selected
                      ? "bg-primary-muted text-primary-hover"
                      : "bg-surface-input text-text-secondary"
                  }`}
                >
                  <Mic2 size={13} />
                  <span className="min-w-0 flex-1 truncate">{asset.originalFilename}</span>
                  {selected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onUploadVoiceReference}
          disabled={busy}
          className="mt-3 flex min-h-20 w-full items-center justify-center rounded-lg border border-dashed border-border-dark bg-surface-input px-3 text-center text-[10px] text-text-secondary transition-colors hover:border-primary/50 hover:bg-primary-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>
            <Upload className="mx-auto mb-1.5 text-text-muted" size={18} />
            <span className="block truncate">
              {voiceReferenceScope === "ACCOUNT" && voiceReferenceName
                ? voiceReferenceName
                : "Upload account voice (R2)"}
            </span>
          </span>
        </button>

        <label className="mt-3 grid gap-1 text-[10px] text-text-secondary">
          <span>Câu đọc thử</span>
          <textarea
            value={previewText}
            maxLength={500}
            rows={3}
            onChange={(event) => onPreviewTextChange(event.target.value)}
            className="resize-none rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
          />
          <span className="text-right text-[9px] text-text-muted">{previewText.length}/500</span>
        </label>

        <Button
          type="button"
          onClick={onGeneratePreview}
          disabled={!voiceReferenceName || !selectedVoice || !chapterId || !previewText.trim() || previewBusy}
          className="mt-2 h-9 w-full bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover"
        >
          <Sparkles size={13} />
          {previewBusy ? "Đang tạo giọng mẫu…" : "Tạo giọng mẫu"}
        </Button>

        {previewStatus && !previewUrl && (
          <p className="mt-2 text-[9px] text-text-muted">Trạng thái: {previewStatus}</p>
        )}
        {previewUrl && (
          <audio
            key={previewUrl}
            controls
            preload="metadata"
            src={previewUrl}
            className="mt-3 h-9 w-full"
          />
        )}
      </section>

      <Button
        variant="outline"
        onClick={onOpenAssets}
        className="mt-3 h-9 w-full border-primary/35 bg-primary-muted text-[10px] text-primary-hover hover:bg-primary-light"
      >
        <FolderPlus size={13} />
        Mở Asset Browser
      </Button>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-medium text-text-secondary">Thẻ phổ biến</h3>
          <button type="button" onClick={onResetFilters} className="text-[9px] text-primary-hover">
            Đặt lại
          </button>
        </div>
        <div className="grid gap-1">
          {tagCounts.slice(0, 5).map(({ label, count }) => (
            <button
              key={label}
              type="button"
              onClick={() => onTagFilter(label)}
              className="flex h-8 items-center justify-between rounded-md bg-surface-input px-2.5 text-[10px] text-text-secondary hover:bg-surface-3"
            >
              <span>{label}</span>
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] text-text-muted">
                {count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {audioAssets.length > 0 && (
        <section className="mt-5 border-t border-border pt-4">
          <h3 className="mb-1 text-[10px] font-medium text-text-secondary">Project voices · local</h3>
          <p className="mb-2 text-[9px] text-text-muted">Chọn một AUDIO asset để clone giọng mà không upload lên R2.</p>
          <div className="grid gap-1">
            {audioAssets.slice(0, 4).map((asset) => {
              const selected = selectedAssetIds.includes(asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onToggleAsset(asset.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-[9px] ${
                    selected
                      ? "bg-primary-muted text-primary-hover"
                      : "bg-surface-input text-text-secondary"
                  }`}
                >
                  <FileAudio size={13} />
                  <span className="min-w-0 flex-1 truncate">{asset.originalFilename}</span>
                  {selected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-5 border-t border-border pt-4">
        <span className="text-[9px] font-bold uppercase tracking-[.17em] text-text-muted">
          Quick actions
        </span>
        <QuickAction label="Reset voice filters" icon={<Mic2 size={13} />} onClick={onResetFilters} />
        <QuickAction
          label="Tạo voice take"
          icon={<Sparkles size={13} />}
          onClick={onCreateTake}
          disabled={!selectedVoice || !chapterId || busy}
        />
        <QuickAction
          label="Tạo batch narration"
          icon={<AudioLines size={13} />}
          onClick={onBatch}
          disabled={!selectedVoice || !chapters.length || busy}
        />
      </section>
    </aside>
  );
}

function ContextStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
      <span className="text-text-muted">{label}</span>
      <strong className="min-w-0 truncate text-text-secondary">{value}</strong>
    </div>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  disabled = false,
}: Readonly<{
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 flex w-full items-center justify-between rounded-md px-1 py-1 text-[10px] text-text-secondary hover:text-primary-hover disabled:opacity-40"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ArrowUpRight size={13} />
    </button>
  );
}
