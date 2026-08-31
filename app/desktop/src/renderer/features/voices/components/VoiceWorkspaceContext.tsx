import type { ReactNode } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopVoice,
  VoiceReferenceScope,
} from "@narrativex/client-contracts";
import { ArrowUpRight, AudioLines, Check, FileAudio, FolderPlus, Mic2, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  InlineNotice,
  PaneHeader,
  PropertyRow,
  StatusIndicator,
} from "../../workspace/components/WorkstationPrimitives";
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
  const customVoiceLabel = voiceReferenceScope === "PROJECT"
    ? "Project voice · local"
    : voiceReferenceScope === "ACCOUNT"
      ? "Account voice · R2"
      : "Custom voice";

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden bg-surface-panel">
      <PaneHeader title="Voice Context" meta={`${selectedAssetIds.length} project file selected`} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <InspectorSection title="Selection">
          <PropertyRow label="Voice" value={selectedVoice?.name ?? "Chưa chọn"} />
          <PropertyRow label="Duration" value={formatDuration(totalDurationMs)} />
          <PropertyRow label="Storage" value={formatBytes(totalSizeBytes)} />
        </InspectorSection>

        <InspectorSection title="Narration">
          <div className="grid gap-2 p-2.5">
            <label className="grid gap-1 text-[9px] text-text-muted">
              Chapter
              <Select value={chapterId || undefined} onValueChange={onChapterChange}>
                <SelectTrigger aria-label="Narration chapter"><SelectValue placeholder="Chọn chapter" /></SelectTrigger>
                <SelectContent>{chapters.map((chapter) => <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-[9px] text-text-muted">
              Speaking rate
              <Input type="number" min="0.25" max="2" step="0.1" value={speakingRate} onChange={(event) => onSpeakingRateChange(event.target.value)} />
            </label>
          </div>
        </InspectorSection>

        <InspectorSection title={customVoiceLabel} actions={voiceReferenceName ? <Button variant="ghost" size="icon-sm" aria-label="Bỏ giọng tham chiếu" onClick={onClearVoiceReference} disabled={busy}><Trash2 size={12} /></Button> : undefined}>
          {voiceReferenceName ? (
            <PropertyRow
              label="Active reference"
              value={<StatusIndicator label={voiceReferenceName} tone="accent" className="justify-end max-w-full" />}
            />
          ) : null}

          {reusableAccountVoices.length ? (
            <div className="border-b border-border-subtle p-2.5">
              <div className="mb-1.5 text-[9px] text-text-dim">Account voices · R2</div>
              <div className="grid gap-1">
                {reusableAccountVoices.slice(0, 5).map((asset) => {
                  const selected = voiceReferenceScope === "ACCOUNT" && voiceReferenceName === asset.originalFilename;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onSelectAccountVoice(asset.id, asset.originalFilename)}
                      className={`flex min-h-8 items-center gap-2 border-l-2 px-2 py-1.5 text-left text-[9px] transition-colors disabled:opacity-40 ${selected ? "border-l-primary bg-primary-muted text-primary-hover" : "border-l-transparent bg-surface-dark text-text-secondary hover:bg-surface-hover"}`}
                    >
                      <Mic2 size={12} />
                      <span className="min-w-0 flex-1 truncate">{asset.originalFilename}</span>
                      {selected ? <Check size={11} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 p-2.5">
            <Button variant="outline" size="sm" onClick={onUploadVoiceReference} disabled={busy} className="w-full justify-start">
              <Upload size={12} /> {voiceReferenceScope === "ACCOUNT" && voiceReferenceName ? voiceReferenceName : "Upload account voice (R2)"}
            </Button>
            <label className="grid gap-1 text-[9px] text-text-muted">
              Preview text
              <Textarea value={previewText} maxLength={500} rows={3} onChange={(event) => onPreviewTextChange(event.target.value)} className="min-h-16 resize-none" />
              <span className="text-right text-[8px] text-text-dim">{previewText.length}/500</span>
            </label>
            <Button type="button" size="sm" onClick={onGeneratePreview} disabled={!voiceReferenceName || !selectedVoice || !chapterId || !previewText.trim() || previewBusy} className="w-full">
              <Sparkles size={12} /> {previewBusy ? "Đang tạo giọng mẫu…" : "Tạo giọng mẫu"}
            </Button>
            {previewStatus && !previewUrl ? <StatusIndicator label={previewStatus} tone="neutral" /> : null}
            {previewUrl ? <audio key={previewUrl} controls preload="metadata" src={previewUrl} className="h-8 w-full" /> : null}
          </div>
        </InspectorSection>

        {audioAssets.length ? (
          <InspectorSection title="Project voices · local">
            <div className="grid gap-1 p-2.5">
              {audioAssets.slice(0, 4).map((asset) => {
                const selected = selectedAssetIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onToggleAsset(asset.id)}
                    className={`flex min-h-8 items-center gap-2 border-l-2 px-2 py-1.5 text-left text-[9px] transition-colors ${selected ? "border-l-primary bg-primary-muted text-primary-hover" : "border-l-transparent bg-surface-dark text-text-secondary hover:bg-surface-hover"}`}
                  >
                    <FileAudio size={12} />
                    <span className="min-w-0 flex-1 truncate">{asset.originalFilename}</span>
                    {selected ? <Check size={11} /> : null}
                  </button>
                );
              })}
            </div>
          </InspectorSection>
        ) : null}

        <InspectorSection title="Popular tags" actions={<button type="button" onClick={onResetFilters} className="text-[9px] text-primary-hover">Reset</button>}>
          <div className="flex flex-wrap gap-1 p-2.5">
            {tagCounts.slice(0, 5).map(({ label, count }) => (
              <button key={label} type="button" onClick={() => onTagFilter(label)} className="inline-flex min-h-7 items-center gap-1.5 border border-border-subtle bg-surface-dark px-2 text-[9px] text-text-secondary hover:bg-surface-hover">
                {label}<span className="text-text-dim">{count}</span>
              </button>
            ))}
          </div>
        </InspectorSection>

        <InspectorSection title="Quick actions">
          <div className="grid gap-0.5 p-2">
            <QuickAction label="Asset Browser" icon={<FolderPlus size={12} />} onClick={onOpenAssets} />
            <QuickAction label="Reset voice filters" icon={<Mic2 size={12} />} onClick={onResetFilters} />
            <QuickAction label="Tạo voice take" icon={<Sparkles size={12} />} onClick={onCreateTake} disabled={!selectedVoice || !chapterId || busy} />
            <QuickAction label="Tạo batch narration" icon={<AudioLines size={12} />} onClick={onBatch} disabled={!selectedVoice || !chapters.length || busy} />
          </div>
        </InspectorSection>

        {accountVoices.isError ? <InlineNotice tone="warning">Không tải được account voice list.</InlineNotice> : null}
      </div>
    </aside>
  );
}

function InspectorSection({ title, actions, children }: Readonly<{ title: string; actions?: ReactNode; children: ReactNode }>) {
  return (
    <section className="border-b border-border-subtle">
      <div className="flex min-h-7 items-center justify-between gap-2 bg-surface-dark px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">
        <span>{title}</span>{actions}
      </div>
      {children}
    </section>
  );
}

function QuickAction({ label, icon, onClick, disabled = false }: Readonly<{ label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }>) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-8 w-full items-center justify-between px-2 text-[9px] text-text-secondary hover:bg-surface-hover hover:text-primary-hover disabled:opacity-40">
      <span className="inline-flex items-center gap-2">{icon}{label}</span><ArrowUpRight size={11} />
    </button>
  );
}
