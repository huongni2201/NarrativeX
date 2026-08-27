import { useEffect, useMemo, useState } from "react";
import type { DesktopTimeline, DesktopTimelineBeat } from "@narrativex/client-contracts";
import { findEditorBeatAtTime, sortEditorBeats } from "../editor-timeline";
import { EditorMultiTrackTimeline } from "./EditorMultiTrackTimeline";
import { EditorPreviewViewport } from "./EditorPreviewViewport";

interface EditorPlaybackSurfaceProps {
  beats: DesktopTimelineBeat[];
  chapters: DesktopTimeline["chapters"];
  selectedBeatId: string;
  previewBeat: DesktopTimelineBeat | null;
  mediaUrl: string | null;
  narrationUrl: string | null;
  narrationStartMs: number | null;
  narrationEndMs: number | null;
  previewLoading: boolean;
  previewMessage: string | null;
  totalDurationMs: number;
  scopeWindowStartMs: number;
  scopeWindowEndMs: number;
  onSelectBeat: (beat: DesktopTimelineBeat) => void;
  onUploadMedia?: (type: "IMAGE" | "VIDEO") => void;
}

export function EditorPlaybackSurface({
  beats,
  chapters,
  selectedBeatId,
  previewBeat,
  mediaUrl,
  narrationUrl,
  narrationStartMs,
  narrationEndMs,
  previewLoading,
  previewMessage,
  totalDurationMs,
  scopeWindowStartMs,
  scopeWindowEndMs,
  onSelectBeat,
  onUploadMedia,
}: Readonly<EditorPlaybackSurfaceProps>) {
  const orderedBeats = useMemo(() => sortEditorBeats(beats), [beats]);
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(scopeWindowStartMs);
  const scopeDurationMs = Math.max(0, scopeWindowEndMs - scopeWindowStartMs);

  useEffect(() => {
    if (!orderedBeats.length) {
      setPlayheadMs(scopeWindowStartMs);
      setPlaying(false);
      return;
    }

    const selected = orderedBeats.find((beat) => beat.visualBeatId === selectedBeatId);
    if (!selected) return;
    const currentBeat = findEditorBeatAtTime(orderedBeats, playheadMs);
    if (currentBeat?.visualBeatId !== selectedBeatId) {
      setPlayheadMs(selected.startMs);
    }
  }, [orderedBeats, playheadMs, scopeWindowStartMs, selectedBeatId]);

  useEffect(() => {
    if (scopeWindowEndMs <= scopeWindowStartMs) return;
    if (playheadMs < scopeWindowStartMs || playheadMs > scopeWindowEndMs) {
      setPlayheadMs(scopeWindowStartMs);
    }
  }, [playheadMs, scopeWindowEndMs, scopeWindowStartMs]);

  useEffect(() => {
    if (!playing || scopeDurationMs <= 0) return;
    const timer = window.setInterval(() => {
      setPlayheadMs((current) =>
        current >= scopeWindowEndMs
          ? scopeWindowStartMs
          : Math.min(scopeWindowEndMs, current + 250),
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, scopeDurationMs, scopeWindowEndMs, scopeWindowStartMs]);

  useEffect(() => {
    const beatAtTime = findEditorBeatAtTime(orderedBeats, playheadMs);
    if (beatAtTime && beatAtTime.visualBeatId !== selectedBeatId) {
      onSelectBeat(beatAtTime);
    }
  }, [onSelectBeat, orderedBeats, playheadMs, selectedBeatId]);

  const selectBeat = (beat: DesktopTimelineBeat) => {
    setPlayheadMs(beat.startMs);
    onSelectBeat(beat);
  };

  const handlePrevBeat = () => {
    const currentIndex = orderedBeats.findIndex((beat) => beat.visualBeatId === selectedBeatId);
    if (currentIndex > 0) selectBeat(orderedBeats[currentIndex - 1]);
  };

  const handleNextBeat = () => {
    const currentIndex = orderedBeats.findIndex((beat) => beat.visualBeatId === selectedBeatId);
    if (currentIndex >= 0 && currentIndex < orderedBeats.length - 1) {
      selectBeat(orderedBeats[currentIndex + 1]);
    }
  };

  const handleStepMs = (deltaMs: number) => {
    setPlayheadMs((current) =>
      Math.max(scopeWindowStartMs, Math.min(scopeWindowEndMs, current + deltaMs)),
    );
  };

  const handleSeek = (targetMs: number) => {
    const clamped = Math.max(scopeWindowStartMs, Math.min(scopeWindowEndMs, targetMs));
    setPlayheadMs(clamped);
    const beatAtTime = findEditorBeatAtTime(orderedBeats, clamped);
    if (beatAtTime && beatAtTime.visualBeatId !== selectedBeatId) {
      onSelectBeat(beatAtTime);
    }
  };

  return (
    <div className="nx-editor-playback-surface h-full min-h-0 min-w-0 overflow-hidden border-r border-border-subtle bg-background">
      <div className="nx-editor-preview-panel min-h-0 overflow-hidden">
        <EditorPreviewViewport
          selectedBeat={previewBeat}
          mediaUrl={mediaUrl}
          narrationUrl={narrationUrl}
          narrationStartMs={narrationStartMs}
          narrationEndMs={narrationEndMs}
          previewLoading={previewLoading}
          previewMessage={previewMessage}
          playheadMs={playheadMs}
          scopeWindowStartMs={scopeWindowStartMs}
          scopeWindowEndMs={scopeWindowEndMs}
          playing={playing}
          onTogglePlay={() => setPlaying((current) => !current)}
          onPrevBeat={handlePrevBeat}
          onNextBeat={handleNextBeat}
          onStepMs={handleStepMs}
        />
      </div>

      <div className="nx-editor-timeline-panel border-t border-border-subtle overflow-hidden">
        <EditorMultiTrackTimeline
          beats={orderedBeats}
          chapters={chapters}
          playheadMs={playheadMs}
          totalDurationMs={totalDurationMs}
          selectedBeatId={selectedBeatId}
          onSelectBeat={selectBeat}
          onSeek={handleSeek}
          onUploadMedia={onUploadMedia}
        />
      </div>
    </div>
  );
}
