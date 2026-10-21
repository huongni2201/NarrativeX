import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DesktopJobHistoryItem } from "../../../../shared/api-types";
import type { AnalysisDiagnosticEntry } from "../../../../shared/story-analysis";
import { Button } from "../../../components/ui/button";

export function AnalysisErrorDetails({ job }: { job: DesktopJobHistoryItem }) {
  const [showLog, setShowLog] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const bridge = window.narrativex?.storyAnalysis;
  const logs = useQuery({
    queryKey: ["story-analysis", "diagnostics"],
    queryFn: () => bridge.diagnostics(),
    enabled: showLog && Boolean(bridge?.diagnostics),
    retry: false,
    staleTime: 0,
  });
  const matched = logs.data?.filter(entry => entry.jobId === job.jobId) ?? [];
  const entries = matched.length ? matched : logs.data?.filter(entry => !entry.jobId) ?? [];
  const stageDetails = (entry: AnalysisDiagnosticEntry) =>
    entry.stage
      ? `Giai đoạn: ${entry.stage}${entry.windowNumber ? ` · Cửa sổ ${entry.windowNumber}/${entry.windowCount ?? "—"}` : ""}`
      : null;
  const report = [
    `Job ID: ${job.jobId}`, `Error Code: ${job.errorCode ?? "—"}`, `Current Step: ${job.currentStep ?? "—"}`,
    ...(matched.length ? [] : ["Nhật ký CLI gần đây — chưa gắn với Job ID, không khẳng định thuộc tác vụ này."]),
    ...entries.map(entry => `${entry.at} · ${entry.code} · exit=${entry.exitCode ?? "—"} · ${entry.reason ?? "—"}${stageDetails(entry) ? ` · ${stageDetails(entry)}` : ""}\n${entry.excerpt || "CLI không cung cấp thông báo lỗi."}`),
  ].join("\n\n");

  async function copy() {
    try {
      await window.narrativex.system.copyText(report);
      setCopyStatus("Đã sao chép chi tiết lỗi.");
    } catch {
      setCopyStatus("Không thể sao chép. Bạn có thể chọn và sao chép nội dung bên dưới.");
    }
  }

  return <div className="mt-3 min-w-0">
    <Button size="sm" variant="outline" aria-expanded={showLog} aria-controls={`error-log-${job.jobId}`} onClick={() => setShowLog(value => !value)}>
      {showLog ? "Ẩn chi tiết lỗi" : "Xem đầy đủ lỗi"}
    </Button>
    {showLog && <section id={`error-log-${job.jobId}`} aria-label="Chi tiết lỗi phân tích" className="mt-3 min-w-0 space-y-3">
      <p className="text-caption text-text-muted">Nhật ký trên máy này: 20 lỗi gần nhất, tối đa 16.384 ký tự cuối mỗi lỗi. Nhật ký cũ có thể ngắn hơn. Thông tin nhạy cảm được che; không lưu nội dung chương hoặc kết quả model.</p>
      {!bridge?.diagnostics ? <p role="alert">Cần khởi động lại Desktop để đọc nhật ký lỗi.</p>
        : logs.isPending ? <p role="status">Đang đọc nhật ký lỗi…</p>
        : logs.isError ? <div role="alert">Không đọc được nhật ký lỗi. <Button size="sm" variant="outline" onClick={() => void logs.refetch()}>Thử lại</Button></div>
        : entries.length === 0 ? <p>Không còn nhật ký chi tiết cho tác vụ này trên máy. Lỗi mới sẽ được lưu kèm Job ID.</p>
        : <>
          {!matched.length && <p className="text-warning">Nhật ký CLI gần đây — chưa gắn với Job ID, không khẳng định thuộc tác vụ này.</p>}
          <Button size="sm" variant="outline" onClick={() => void copy()}>Sao chép chi tiết lỗi</Button>
          {entries.slice().reverse().map((entry, index) => <div key={`${entry.at}-${index}`} className="min-w-0 rounded border border-border-subtle bg-surface-dark p-3">
            <p className="break-words text-caption text-text-muted">{new Date(entry.at).toLocaleString()} · {entry.code} · Exit code: {entry.exitCode ?? "—"} · {entry.reason ?? "—"}{stageDetails(entry) ? ` · ${stageDetails(entry)}` : ""}</p>
            <pre tabIndex={0} aria-label={`Nội dung lỗi ${index + 1}`} className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-label text-foreground [overflow-wrap:anywhere]">{entry.excerpt || "CLI không cung cấp thông báo lỗi."}</pre>
          </div>)}
        </>}
      {copyStatus && <p role="status" className="text-label text-text-muted">{copyStatus}</p>}
    </section>}
  </div>;
}
