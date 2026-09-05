import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InlineNotice, StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import {
  useChapterContinuity,
  useReviewContinuity,
} from "../../generation/queries/continuity.queries";

export function ContinuityReportPanel({ chapterId }: Readonly<{ chapterId: string | null }>) {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const reportQuery = useChapterContinuity(projectId, chapterId);
  const review = useReviewContinuity(projectId, chapterId);

  if (!chapterId || !projectId) {
    return (
      <section className="border-b border-border-subtle p-3 text-[10px] text-text-muted">
        Chọn chapter để xem continuity report.
      </section>
    );
  }
  if (reportQuery.isLoading) {
    return (
      <section className="flex items-center gap-2 border-b border-border-subtle p-3 text-[10px] text-text-muted">
        <Loader2 size={12} className="animate-spin" /> Đang tải continuity…
      </section>
    );
  }
  if (reportQuery.isError || !reportQuery.data) {
    return (
      <section className="border-b border-border-subtle p-3">
        <InlineNotice tone="warning">Không tải được continuity report cho storyboard hiện tại.</InlineNotice>
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => void reportQuery.refetch()}>
          <RefreshCw size={12} /> Thử lại
        </Button>
      </section>
    );
  }

  const report = reportQuery.data;
  const blocking = report.issues.filter((issue) => issue.severity === "BLOCKING");
  const warnings = report.issues.filter((issue) => issue.severity === "WARNING");

  async function acknowledgeWarning(issueId: string) {
    await review.mutateAsync({
      planId: report.planId,
      reportRevision: report.reportRevision,
      issueIds: [issueId],
      decision: "ACKNOWLEDGE_WARNING",
    });
  }

  return (
    <section className="border-b border-border-subtle">
      <div className="flex items-center justify-between gap-2 bg-surface-dark px-3 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">Continuity</span>
        <StatusIndicator
          label={report.status === "PASS" ? "Pass" : "Needs review"}
          tone={blocking.length ? "danger" : report.status === "PASS" ? "success" : "warning"}
        />
      </div>
      <div className="space-y-2 p-3">
        {report.status === "PASS" ? (
          <div className="flex items-center gap-2 text-[10px] text-success">
            <CheckCircle2 size={12} /> Không có continuity conflict đang mở.
          </div>
        ) : null}
        {blocking.map((issue) => (
          <div key={issue.id} className="border border-danger/30 bg-danger/5 p-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-danger">{issue.code}</div>
                <p className="mt-0.5 text-[10px] leading-4 text-text-secondary">{issue.message}</p>
                {issue.evidenceAnchors.length ? (
                  <p className="mt-1 line-clamp-2 text-[9px] text-text-dim">{issue.evidenceAnchors.join(" · ")}</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {warnings.map((issue) => (
          <div key={issue.id} className="border border-warning/30 bg-warning/5 p-2">
            <div className="text-[10px] font-semibold text-warning">{issue.code}</div>
            <p className="mt-0.5 text-[10px] leading-4 text-text-secondary">{issue.message}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 w-full"
              disabled={review.isPending}
              onClick={() => void acknowledgeWarning(issue.id)}
            >
              {review.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Acknowledge warning
            </Button>
          </div>
        ))}
        <div className="text-[9px] text-text-dim">
          Plan {report.planId.slice(0, 8)} · report r{report.reportRevision}
        </div>
      </div>
    </section>
  );
}
