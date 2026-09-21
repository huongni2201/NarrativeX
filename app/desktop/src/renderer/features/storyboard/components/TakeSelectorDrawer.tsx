import { useState } from "react";
import type { DesktopSelectedTake, DesktopShot, DesktopTake } from "@narrativex/client-contracts";
import { AlertCircle, CheckCircle2, Clapperboard, Film, Scissors, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TakeSelectorDrawerProps {
  shot: DesktopShot | null;
  takes: DesktopTake[];
  selectedTake: DesktopSelectedTake | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectTake: (takeId: string, sourceInMs: number, sourceOutMs: number) => void;
}

export function TakeSelectorDrawer({
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

  if (!isOpen || !shot) return null;

  const currentTake = takes.find((t) => t.id === activeTakeId) ?? takes[0];
  const maxDuration = currentTake?.sourceDurationMs ?? shot.targetDurationMs;

  const handleSelectTake = (take: DesktopTake) => {
    setActiveTakeId(take.id);
    const duration = take.sourceDurationMs ?? shot.targetDurationMs;
    setSourceInMs(0);
    setSourceOutMs(duration);
  };

  const handleSaveSelection = () => {
    if (activeTakeId && sourceOutMs > sourceInMs) {
      onSelectTake(activeTakeId, sourceInMs, sourceOutMs);
      onClose();
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
                </div>
              );
            })
          )}
        </div>

        {/* Trimming Section */}
        {currentTake && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <div className="flex items-center gap-1.5 font-semibold text-[12px] mb-2 text-foreground">
              <Scissors size={14} className="text-primary" />
              <span>Edit Decision Trimming (In / Out)</span>
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

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-border-subtle flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSelection}
            disabled={!activeTakeId || sourceOutMs <= sourceInMs}
            className="flex-1"
          >
            Apply Take to Edit
          </Button>
        </div>
      </aside>
    </div>
  );
}
