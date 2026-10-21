import { useCallback, useEffect, useRef, useState } from "react";
import { generationApi } from "../../generation/api/generation.api";
import { narrationApi } from "../../generation/api/narration.api";
import { playableSampleUrl } from "../model/voice-filters";
import { VOICE_SAMPLE_TEXT } from "../model/vieneu-voices";

const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 3 * 60_000;
const URL_REFRESH_SKEW_MS = 30_000;

export type VoiceSampleState =
  | { voiceId: null; phase: "idle" }
  | { voiceId: string; phase: "generating" | "playing" }
  | { voiceId: string; phase: "error"; message: string };

const IDLE: VoiceSampleState = { voiceId: null, phase: "idle" };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Plays a 10–15 second sample of a catalog voice. A catalog `sampleUrl` (pre-rendered, hosted
 * remotely) plays immediately; voices without one (custom voices) fall back to a voice-preview job,
 * where a repeated request reuses the finished job instead of generating again.
 * Only one sample is active at a time; starting another (or unmounting) cancels the previous one.
 */
export function useVoiceSamplePlayer(projectId: string, chapterId: string | null) {
  const [state, setState] = useState<VoiceSampleState>(IDLE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0);
  const urlCacheRef = useRef(new Map<string, { url: string; expiresAtMs: number }>());

  const stop = useCallback(() => {
    runRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    setState(IDLE);
  }, []);

  useEffect(() => () => {
    runRef.current += 1;
    audioRef.current?.pause();
  }, []);

  const play = useCallback(
    async (voiceId: string, sampleUrl?: string | null) => {
      const hosted = sampleUrl ? playableSampleUrl(sampleUrl) : null;
      if (!hosted && !chapterId) return;
      const run = ++runRef.current;
      const current = () => runRef.current === run;
      audioRef.current?.pause();
      audioRef.current = null;
      setState({ voiceId, phase: hosted ? "playing" : "generating" });
      const fail = (message: string) => {
        if (current()) setState({ voiceId, phase: "error", message });
      };

      try {
        let url = hosted
          ? { url: hosted, expiresAtMs: Number.POSITIVE_INFINITY }
          : urlCacheRef.current.get(voiceId);
        if (!url || url.expiresAtMs - Date.now() < URL_REFRESH_SKEW_MS) {
          const job = await narrationApi.generatePreview(projectId, {
            chapterId: chapterId as string,
            voiceId,
            sampleText: VOICE_SAMPLE_TEXT,
          });
          const deadline = Date.now() + POLL_TIMEOUT_MS;
          let status = job.status;
          while (current() && (status === "QUEUED" || status === "RUNNING" || status === "UNKNOWN" || status === "STALLED")) {
            if (Date.now() > deadline) return fail("Tạo giọng mẫu quá lâu. Hãy thử lại sau.");
            await sleep(POLL_INTERVAL_MS);
            if (!current()) return;
            status = (await generationApi.getGenerationJob(job.jobId)).status;
          }
          if (!current()) return;
          if (status !== "COMPLETED") return fail("Không thể tạo giọng mẫu. Hãy thử lại.");
          const result = await narrationApi.getPreviewResult(projectId, job.jobId);
          if (!current()) return;
          const playable = playableSampleUrl(result.url);
          if (!playable) return fail("Giọng mẫu có URL không hợp lệ.");
          url = { url: playable, expiresAtMs: Date.parse(result.expiresAt) || Date.now() };
          urlCacheRef.current.set(voiceId, url);
        }

        const player = new Audio(url.url);
        player.onended = () => { if (current()) setState(IDLE); };
        player.onerror = () => {
          if (!hosted) urlCacheRef.current.delete(voiceId);
          fail("Không phát được giọng mẫu.");
        };
        audioRef.current = player;
        await player.play();
        if (current()) setState({ voiceId, phase: "playing" });
      } catch {
        fail(hosted ? "Không phát được giọng mẫu. Hãy kiểm tra kết nối mạng." : "Không thể tạo hoặc phát giọng mẫu. Hãy thử lại.");
      }
    },
    [chapterId, projectId],
  );

  return { state, play, stop };
}
