import type { StoryAnalysisActivity } from "../../../../shared/story-analysis.ts";

export interface LocalRunIndicator {
  tone: "success" | "warning" | "danger";
  text: string;
}

/** "45 giây", "4 phút 32 giây", "1 giờ 5 phút". */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút ${seconds % 60} giây`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

/** True for jobs whose run this Desktop can vouch for (a Chapter Analysis that the backend reports as running). */
export function isLocalAnalysisRunning(job: { jobType: string; status: string }): boolean {
  return job.jobType === "CHAPTER_ANALYZE" && job.status === "RUNNING";
}

/**
 * What this Desktop can say about a RUNNING chapter analysis: the backend only knows the job was claimed, while the
 * Desktop knows whether an agy process exists for it. Returns null when no statement can be made.
 */
export function describeLocalRun(
  job: { jobId: string; jobType: string; status: string },
  activity: StoryAnalysisActivity[] | undefined,
  now: number,
): LocalRunIndicator | null {
  if (!isLocalAnalysisRunning(job) || !activity) return null;
  const run = activity.find(entry => entry.jobId === job.jobId);
  if (!run) {
    return {
      tone: "warning",
      text: "Chưa thấy tiến trình agy cho tác vụ này trên máy. Nếu ứng dụng đã đóng giữa chừng, tác vụ sẽ báo lỗi để bạn chạy lại.",
    };
  }
  if (run.pid === null) return { tone: "success", text: "Đang khởi động agy…" };
  if (!run.processAlive) {
    return { tone: "danger", text: `Tiến trình agy (PID ${run.pid}) đã dừng trước khi trả kết quả. Tác vụ sẽ báo lỗi để bạn chạy lại.` };
  }
  const elapsed = formatElapsed(now - Date.parse(run.startedAt));
  return { tone: "success", text: `agy đang chạy · PID ${run.pid} · ${elapsed}` };
}
