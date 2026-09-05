import { useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useChapterContinuity,
  useCreateRegenerationJob,
  useCreateRegenerationPlan,
} from "../../generation/queries/continuity.queries";

type PendingSubmission = {
  regenerationPlanId: string;
  idempotencyKey: string;
};

export function BeatRegenerationAction({
  projectId,
  chapterId,
  visualBeatId,
}: Readonly<{
  projectId: string;
  chapterId: string;
  visualBeatId: string;
}>) {
  const continuity = useChapterContinuity(projectId, chapterId);
  const createPlan = useCreateRegenerationPlan(projectId, chapterId);
  const createJob = useCreateRegenerationJob(projectId, chapterId);
  const pendingSubmissionRef = useRef<PendingSubmission | null>(null);

  const blocking =
    continuity.data?.issues.some((issue) => issue.severity === "BLOCKING") ?? false;
  const disabled =
    continuity.isLoading ||
    continuity.isError ||
    !continuity.data ||
    blocking ||
    createPlan.isPending ||
    createJob.isPending;

  async function regenerate() {
    const report = continuity.data;
    if (!report || blocking) return;

    const plan = await createPlan.mutateAsync({
      expectedPlanId: report.planId,
      beatIds: [visualBeatId],
      reason: "User requested selective Visual Beat regeneration",
    });
    const accepted = window.confirm(
      `Regenerate ${plan.affectedBeatIds.length} Visual Beat với chi phí ước tính ${plan.estimatedCost} ${plan.currency}?\n\n${plan.reusableBeatIds.length} beat không bị ảnh hưởng sẽ được giữ lại.`,
    );
    if (!accepted) return;

    const pending = pendingSubmissionRef.current;
    const idempotencyKey =
      pending?.regenerationPlanId === plan.regenerationPlanId
        ? pending.idempotencyKey
        : crypto.randomUUID();
    pendingSubmissionRef.current = {
      regenerationPlanId: plan.regenerationPlanId,
      idempotencyKey,
    };

    await createJob.mutateAsync({
      request: {
        regenerationPlanId: plan.regenerationPlanId,
        maxAuthorizedCost: Number(plan.estimatedCost),
      },
      idempotencyKey,
    });
    pendingSubmissionRef.current = null;
  }

  const title = blocking
    ? "Continuity đang có blocking conflict; sửa conflict trước khi regenerate."
    : continuity.isError
      ? "Không tải được continuity plan hiện tại."
      : "Lập selective regeneration plan cho beat này và các beat downstream bị ảnh hưởng.";

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={() => void regenerate()}
      title={title}
      aria-label="Regenerate affected Visual Beats"
    >
      {createPlan.isPending || createJob.isPending ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <RefreshCw size={12} />
      )}
    </Button>
  );
}
