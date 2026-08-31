import { Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CharacterGeminiQueueState } from "../model/character-gemini-queue";

export function CharacterGeminiQueueBanner({
  queue,
  currentCharacterName,
  processedCount,
  busy,
  onStart,
  onResume,
  onSkip,
  onStop,
  onDismiss,
}: Readonly<{
  queue: CharacterGeminiQueueState | null;
  currentCharacterName: string | null;
  processedCount: number;
  busy: boolean;
  onStart: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onDismiss: () => void;
}>) {
  if (!queue) return null;

  const total = queue.characterIds.length;
  const percent = total ? Math.round((processedCount / total) * 100) : 0;
  const completed = queue.status === "COMPLETED";
  const running = queue.status === "RUNNING";

  return (
    <div className="shrink-0 border-b border-border-subtle bg-surface-panel">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {running ? <Loader2 size={13} className="shrink-0 animate-spin text-primary" /> : <WandSparkles size={13} className="shrink-0 text-primary" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-semibold text-foreground">Character All</span>
              <span className="tabular-nums text-text-dim">{processedCount}/{total} · {percent}%</span>
              <span className={`font-medium ${completed ? "text-success" : running ? "text-primary-hover" : "text-warning"}`}>
                {completed ? "Completed" : running ? "Running" : "Paused"}
              </span>
            </div>
            <div className="max-w-[480px] truncate text-[10px] text-text-muted">
              {completed
                ? `${queue.completedCharacterIds.length} generated · ${queue.skippedCharacterIds.length} skipped`
                : currentCharacterName ?? "Character identity"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {completed ? (
            <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
          ) : running ? (
            <Button variant="outline" size="sm" onClick={onStop} className="text-danger hover:text-danger">Stop after current</Button>
          ) : (
            <>
              <Button size="sm" disabled={busy} onClick={onResume}><WandSparkles size={12} /> Resume</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={onSkip}>Skip</Button>
              <Button variant="ghost" size="sm" onClick={onStop} className="text-danger hover:text-danger">Stop</Button>
            </>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-surface-input">
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${percent}%` }} />
      </div>
      <button type="button" className="sr-only" onClick={onStart}>Generate all characters</button>
    </div>
  );
}
