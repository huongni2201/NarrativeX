import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DesktopTimeline, DesktopTimelineBeat } from "@narrativex/client-contracts";
import { planBeatTransitions } from "../../../../shared/transition-planner";
import type { PlannedSubtitle } from "../../../../shared/subtitle-planner";
import { findEditorBeatAtTime, sortEditorBeats } from "../editor-timeline";
import { shouldUseFallbackPlaybackClock } from "../preview-playback";
import { transitionBlackOpacity } from "../preview-transition";
import { EditorMultiTrackTimeline } from "./EditorMultiTrackTimeline";
import { EditorPreviewViewport } from "./EditorPreviewViewport";

interface EditorPlaybackSurfaceProps {
  beats: DesktopTimelineBeat[];
  chapters: DesktopTimeline["chapters"];
  subtitleCues: PlannedSubtitle[];
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
  subtitleCues,
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
  const transitionByBeat = useMemo(
    () => new Map(planBeatTransitions(orderedBeats).map((plan) => [plan.visualBeatId, plan])),
    [orderedBeats],
  );
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(scopeWindowStartMs);
  const [narrationClockFailed, setNarrationClockFailed] = useState(false);
  const lastSelectedBeatIdRef = useRef(selectedBeatId);
  const hasNarration = Boolean(
    narrationUrl &&
      narrationStartMs != null &&
      narrationEndMs != null &&
      narrationEndMs > narrationStartMs,
  );
  const activeTransitionOpacity = previewBeat
    ? transitionBlackOpacity(
        previewBeat,
        transitionByBeat.get(previewBeat.visualBeatId) ?? { transitionInMs: 0, transitionOutMs: 0 },
        playheadMs,
      )
    : 0;

  useEffect(() => {
    setNarrationClockFailed(false);
  }, [narrationEndMs, narrationStartMs, narrationUrl]);

  useEffect(() => {
    if (!orderedBeats.length) {
      setPlayheadMs(scopeWindowStartMs);
      setPlaying(false);
      return;
    }

    if (lastSelectedBeatIdRef.current !== selectedBeatId) {
      lastSelectedBeatIdRef.current = selectedBeatId;
      if (!playing) {
        const selected = orderedBeats.find((beat) => beat.visualBeatId === selectedBeatId);
        if (selected) {
          const currentBeat = findEditorBeatAtTime(orderedBeats, playheadMs);
          if (currentBeat?.visualBeatId !== selectedBeatId) setPlayheadMs(selected.startMs);
        }
      }
    }
  }, [orderedBeats, playheadMs, playing, scopeWindowStartMs, selectedBeatId]);

  useEffect(() => {
    if (scopeWindowEndMs <= scopeWindowStartMs) return;
    if (playheadMs < scopeWindowStartMs || playheadMs > scopeWindowEndMs) {
      setPlayheadMs(scopeWindowStartMs);
    }
  }, [playheadMs, scopeWindowEndMs, scopeWindowStartMs]);

  useEffect(() => {
    if (
      !shouldUseFallbackPlaybackClock({ playing, hasNarration, narrationClockFailed }) ||
      scopeWindowEndMs <= scopeWindowStartMs
    ) {
      return;
    }
    const stepMs = 100;
    const timer = window.setInterval(() => {
      setPlayheadMs((current) => {
        if (current >= scopeWindowEndMs) {
          setPlaying(false);
          return scopeWindowStartMs;
        }
        return Math.min(scopeWindowEndMs, current + stepMs);
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [hasNarration, narrationClockFailed, playing, scopeWindowEndMs, scopeWindowStartMs]);

  useEffect(() => {
    const beatAtTime = findEditorBeatAtTime(orderedBeats, playheadMs);
    if (beatAtTime && beatAtTime.visualBeatId !== selectedBeatId) {
      lastSelectedBeatIdRef.current = beatAtTime.visualBeatId;
      onSelectBeat(beatAtTime);
    }
  }, [onSelectBeat, orderedBeats, playheadMs, selectedBeatId]);

  const selectBeat = useCallback((beat: DesktopTimelineBeat) => {
    lastSelectedBeatIdRef.current = beat.visualBeatId;
    setPlayheadMs(beat.startMs);
    onSelectBeat(beat);
  }, [onSelectBeat]);

  const handlePrevBeat = useCallback(() => {
    const currentIndex = orderedBeats.findIndex((beat) => beat.visualBeatId === selectedBeatId);
    if (currentIndex > 0) selectBeat(orderedBeats[currentIndex - 1]);
  }, [orderedBeats, selectBeat, selectedBeatId]);

  const handleNextBeat = useCallback(() => {
    const currentIndex = orderedBeats.findIndex((beat) => beat.visualBeatId === selectedBeatId);
    if (currentIndex >= 0 && currentIndex < orderedBeats.length - 1) {
      selectBeat(orderedBeats[currentIndex + 1]);
    }
  }, [orderedBeats, selectBeat, selectedBeatId]);

  const handleSeek = useCallback((targetMs: number) => {
    const clamped = Math.max(scopeWindowStartMs, Math.min(scopeWindowEndMs, targetMs));
    setPlayheadMs(clamped);
    const beatAtTime = findEditorBeatAtTime(orderedBeats, clamped);
    if (beatAtTime && beatAtTime.visualBeatId !== selectedBeatId) {
      lastSelectedBeatIdRef.current = beatAtTime.visualBeatId;
      onSelectBeat(beatAtTime);
    }
  }, [onSelectBeat, orderedBeats, scopeWindowEndMs, scopeWindowStartMs, selectedBeatId]);

  const handleStepMs = useCallback((deltaMs: number) => {
    handleSeek(playheadMs + deltaMs);
  }, [handleSeek, playheadMs]);

  const handleNarrationClock = useCallback((globalMs: number) => {
    setNarrationClockFailed(false);
    const clamped = Math.max(scopeWindowStartMs, Math.min(scopeWindowEndMs, globalMs));
    setPlayheadMs(clamped);
  }, [scopeWindowEndMs, scopeWindowStartMs]);

  const handleNarrationEnded = useCallback(() => {
    if (narrationEndMs != null && narrationEndMs < scopeWindowEndMs) {
      setNarrationClockFailed(true);
      handleSeek(Math.min(scopeWindowEndMs, narrationEndMs + 1));
      return;
    }
    setPlaying(false);
  }, [handleSeek, narrationEndMs, scopeWindowEndMs]);

  return (
    <div className="nx-editor-playback-surface h-full min-h-0 min-w-0 overflow-hidden border-r border-border-subtle bg-background">
      <div className="nx-editor-preview-panel min-h-0 overflow-hidden">
        <EditorPreviewViewport
          selectedBeat={previewBeat}
          subtitleCues={subtitleCues}
          transitionBlackOpacity={activeTransitionOpacity}
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
          onTogglePlay={() => {
            setPlaying((current) => !current);
          }}
          onPrevBeat={handlePrevBeat}
          onNextBeat={handleNextBeat}
          onStepMs={handleStepMs}
          onNarrationClock={handleNarrationClock}
          onNarrationEnded={handleNarrationEnded}
          onPlaybackError={() => {
            setNarrationClockFailed(true);
          }}
        />
      </div>

      <div className="nx-editor-timeline-panel border-t border-border-subtle overflow-hidden">
        <EditorMultiTrackTimeline
          beats={orderedBeats}
          chapters={chapters}
          subtitleCues={subtitleCues}
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
