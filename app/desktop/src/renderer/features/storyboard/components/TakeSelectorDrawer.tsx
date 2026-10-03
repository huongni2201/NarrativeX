import { useState, useEffect } from "react";
import type { DesktopSelectedTake, DesktopShot, DesktopTake } from "@narrativex/client-contracts";
import { AlertCircle, CheckCircle2, Clapperboard, Film, Loader2, RotateCcw, Scissors, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";

export interface TakeSelectorDrawerProps {
  projectId?: string;
  shot: DesktopShot | null;
  takes: DesktopTake[];
  selectedTake: DesktopSelectedTake | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectTake: (takeId: string, sourceInMs: number, sourceOutMs: number) => Promise<void> | void;
}

export function TakeSelectorDrawer({
  projectId,
  shot,
  takes,
  selectedTake,
  isOpen,
  onClose,
  onSelectTake,
}: Readonly<TakeSelectorDrawerProps>) {
  const [activeTakeId, setActiveTakeId] = useState<string>(
    selectedTake?.takeId ?? takes[0]?.id ?? ""
  );
  const [sourceInMs, setSourceInMs] = useState<number>(selectedTake?.sourceInMs ?? 0);
  const [sourceOutMs, setSourceOutMs] = useState<number>(
    selectedTake?.sourceOutMs ?? shot?.targetDurationMs ?? 4000
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronize internal state whenever drawer opens or active shot/selected take changes
  useEffect(() => {
    if (isOpen && shot) {
      const initialTakeId = selectedTake?.takeId ?? takes[0]?.id ?? "";
      setActiveTakeId(initialTakeId);
      const initialTake = takes.find((t) => t.id === initialTakeId) ?? takes[0];
      const maxDur = initialTake?.sourceDurationMs ?? shot.targetDurationMs ?? 4000;
      setSourceInMs(selectedTake?.sourceInMs ?? 0);
      setSourceOutMs(selectedTake?.sourceOutMs ?? maxDur);
      setSaveError(null);
    }
  }, [isOpen, shot?.id, selectedTake?.takeId, takes]);

  if (!isOpen || !shot) return null;

  const currentTake = takes.find((t) => t.id === activeTakeId) ?? takes[0];
  const maxDuration = Math.max(100, currentTake?.sourceDurationMs ?? shot.targetDurationMs ?? 4000);

  const handleSelectTake = (take: DesktopTake) => {
    setActiveTakeId(take.id);
    const duration = Math.max(100, take.sourceDurationMs ?? shot.targetDurationMs ?? 4000);
    setSourceInMs(0);
    setSourceOutMs(duration);
    setSaveError(null);
  };

  const handleSaveSelection = async () => {
    if (!activeTakeId || sourceOutMs <= sourceInMs || isSaving) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSelectTake(activeTakeId, sourceInMs, sourceOutMs);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể áp dụng take vào timeline edit.";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-xs">
      <aside className="w-full max-w-md bg-surface-panel border-l border-border-subtle p-5 flex flex-col h-full shadow-2xl text-[12px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2 font-semibold text-[14px]">
            <Film size={16} className="text-primary" />
            <span>Shot Takes & Trimming</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-foreground cursor-pointer"
            aria-label="Close drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shot Summary */}
        <div className="mt-3 p-3 bg-surface-dark border border-border-soft rounded">
          <div className="font-medium text-foreground">{shot.narrativePurpose}</div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-[10px]">
              {shot.generationStrategy}
            </Badge>
            {shot.retentionRole && (
              <Badge variant="outline" className="text-[10px] text-cyan border-cyan/40">
                {shot.retentionRole}
              </Badge>
            )}
            <span className="text-[10px] text-text-muted">Target: {shot.targetDurationMs}ms</span>
          </div>
        </div>

        {/* Candidate Takes List */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider text-text-dim font-bold">
            Available Takes ({takes.length})
          </div>
          {takes.length === 0 ? (
            <div className="grid place-items-center py-8 text-text-muted border border-dashed border-border-soft rounded">
              <Clapperboard size={24} className="mb-2 text-text-dim" />
              <span>No takes generated yet for this shot.</span>
            </div>
          ) : (
            takes.map((take) => {
              const isSelected = take.id === activeTakeId;
              const isPassed = take.status === "PASSED" || take.validationResult?.passed === true;
              const failureReason = take.validationResult?.failureReason;
              const retryRecommendation = take.validationResult?.retryRecommendation;

              return (
                <div
                  key={take.id}
                  onClick={() => handleSelectTake(take)}
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border-soft bg-surface-dark hover:border-border-dark"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Take #{take.attemptNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isPassed ? (
                        <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                          <CheckCircle2 size={12} /> Passed QA
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                          <AlertCircle size={12} /> Failed QA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] text-text-muted mt-1">
                    Model: {take.model} ({take.provider}) • Duration: {take.sourceDurationMs ?? "?"}ms
                  </div>

                  {failureReason && (
                    <div className="mt-2 text-[10px] p-2 bg-destructive/10 text-destructive-foreground rounded">
                      <span className="font-bold">Failure:</span> {failureReason}
                      {retryRecommendation && (
                        <div className="mt-1 text-text-secondary">
                          <span className="font-bold text-primary">Recommendation:</span>{" "}
                          {retryRecommendation}
                        </div>
                      )}
                    </div>
                  )}

                  {take.whisperXSummary && (
                    <div className="mt-2 text-[10px] p-2 bg-info/10 text-info-foreground border border-info/20 rounded space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>WhisperX Dialogue QA</span>
                        <span className="font-mono">
                          {(take.whisperXSummary.confidence * 100).toFixed(0)}% conf · {(take.whisperXSummary.coverage * 100).toFixed(0)}% cov
                        </span>
                      </div>
                      <div className="text-[9px] text-text-secondary">
                        <div><span className="font-bold">Expected:</span> "{take.whisperXSummary.expectedText}"</div>
                        <div><span className="font-bold">Recognized:</span> "{take.whisperXSummary.recognizedText}"</div>
                      </div>
                    </div>
                  )}

                  {projectId && take.outputAssetId && isSelected && (
                    <div className="mt-2 overflow-hidden rounded border border-border-soft aspect-video bg-black">
                      <video
                        src={localAssetPreviewUrl(projectId, take.outputAssetId)}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Trimming Section */}
        {currentTake && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between font-semibold text-[12px] mb-2 text-foreground">
              <div className="flex items-center gap-1.5">
                <Scissors size={14} className="text-primary" />
                <span>Edit Decision Trimming (In / Out)</span>
              </div>
              <span className="text-[10px] text-text-muted font-mono">
                {sourceInMs}ms — {sourceOutMs}ms / {maxDuration}ms
              </span>
            </div>

            {/* Visual Trim Rail */}
            <div className="space-y-1.5 mb-3 bg-surface-dark p-2.5 rounded border border-border-soft">
              <div className="relative h-5 bg-background/80 border border-border-subtle rounded overflow-hidden select-none">
                {/* Active trimmed window */}
                <div
                  className="absolute top-0 bottom-0 bg-primary/30 border-x-2 border-primary transition-all duration-75"
                  style={{
                    left: `${Math.min(100, Math.max(0, (sourceInMs / maxDuration) * 100))}%`,
                    width: `${Math.max(0, Math.min(100, (sourceOutMs / maxDuration) * 100) - Math.min(100, Math.max(0, (sourceInMs / maxDuration) * 100)))}%`,
                  }}
                />
              </div>

              {/* Sliders */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[9px] text-text-dim">In: {sourceInMs}ms</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, sourceOutMs - 100)}
                    step={50}
                    value={sourceInMs}
                    disabled={isSaving}
                    onChange={(e) => setSourceInMs(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-1 bg-surface-panel rounded appearance-none cursor-pointer accent-primary"
                    title="Trim In Point"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[9px] text-text-dim">Out: {sourceOutMs}ms</span>
                  <input
                    type="range"
                    min={Math.min(maxDuration, sourceInMs + 100)}
                    max={maxDuration}
                    step={50}
                    value={sourceOutMs}
                    disabled={isSaving}
                    onChange={(e) => setSourceOutMs(Math.min(maxDuration, parseInt(e.target.value) || 0))}
                    className="w-full h-1 bg-surface-panel rounded appearance-none cursor-pointer accent-primary"
                    title="Trim Out Point"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setSourceInMs(0);
                    setSourceOutMs(maxDuration);
                  }}
                  className="text-[10px] text-primary hover:underline cursor-pointer"
                >
                  Reset (Full {maxDuration}ms)
                </button>
                {maxDuration > shot.targetDurationMs && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setSourceInMs(0);
                      setSourceOutMs(shot.targetDurationMs);
                    }}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    Match Target ({shot.targetDurationMs}ms)
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-text-dim font-bold block mb-1">
                  In Point (ms)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={sourceOutMs - 100}
                  value={sourceInMs}
                  disabled={isSaving}
                  onChange={(e) => setSourceInMs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-dim font-bold block mb-1">
                  Out Point (ms)
                </label>
                <Input
                  type="number"
                  min={sourceInMs + 100}
                  max={maxDuration}
                  value={sourceOutMs}
                  disabled={isSaving}
                  onChange={(e) =>
                    setSourceOutMs(Math.min(maxDuration, parseInt(e.target.value) || 0))
                  }
                  className="h-8 text-[11px]"
                />
              </div>
            </div>
            <div className="mt-2 text-[10px] text-text-muted">
              Timeline Edit Duration:{" "}
              <span className="font-semibold text-foreground">
                {Math.max(0, sourceOutMs - sourceInMs)}ms
              </span>
            </div>
          </div>
        )}

        {/* Inline Error Message */}
        {saveError && (
          <div className="mt-3 p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Lỗi lưu take: </span>
              {saveError}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-border-subtle flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSelection}
            disabled={!activeTakeId || sourceOutMs <= sourceInMs || isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 size={13} className="animate-spin mr-1.5" />
                <span>Applying Take...</span>
              </>
            ) : (
              <span>Apply Take to Edit</span>
            )}
          </Button>
        </div>
      </aside>
    </div>
  );
}
