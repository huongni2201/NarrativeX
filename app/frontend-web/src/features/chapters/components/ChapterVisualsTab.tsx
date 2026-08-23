"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GenerateMediaModal } from "@/features/generation/components/GenerateMediaModal";
import { useMediaGeneration } from "@/features/generation/hooks/useMediaGeneration";
import type { ApiChapterWorkspaceProgressStep, ProjectId } from "@/types/api";

interface ChapterVisualsTabProps {
  projectId: ProjectId;
  chapterId: string | number;
  visualBeatCount: number;
  initialMedia: ApiChapterWorkspaceProgressStep;
}

export function ChapterVisualsTab({
  projectId,
  chapterId,
  visualBeatCount,
  initialMedia,
}: Readonly<ChapterVisualsTabProps>) {
  const [modalOpen, setModalOpen] = useState(false);
  const media = useMediaGeneration(projectId, chapterId, initialMedia);

  return (
    <section className="space-y-4 rounded-2xl border border-border-dark bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            Visual review
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Generated keyframes</h2>
          <p className="mt-1 text-sm text-slate-400">
            Ảnh đã validate vẫn cần review riêng trước khi render.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Generate visuals</Button>
      </div>

      {media.message && (
        <p className="rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-sm text-slate-300">
          {media.message}
        </p>
      )}

      {media.job && (
        <div className="rounded-lg border border-border-dark bg-surface-panel p-3 text-sm text-slate-300">
          Job {media.job.status.toLowerCase()} · {media.job.progress}%
          {media.mediaPlanRevision ? ` · plan revision ${media.mediaPlanRevision}` : ""}
        </div>
      )}

      {!media.details && (
        <p className="rounded-xl border border-dashed border-border-dark px-4 py-10 text-center text-sm text-slate-500">
          Chưa có media job cho Chapter này.
        </p>
      )}

      {media.details && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.details.items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border-dark bg-surface-panel p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">Beat {item.visualBeatId}</span>
                <span className="text-xs text-slate-500">attempt {item.attemptNumber}</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                {item.executionStatus} · {item.reviewStatus}
              </p>
              {item.errorCode && <p className="mt-2 text-xs text-rose-300">{item.errorCode}</p>}
              {item.reviewStatus === "NEEDS_REVIEW" && (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      media.review.mutate({
                        itemId: item.id,
                        decision: "APPROVED",
                        rowVersion: item.rowVersion,
                      })
                    }
                    disabled={media.review.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      media.review.mutate({
                        itemId: item.id,
                        decision: "REJECTED",
                        rowVersion: item.rowVersion,
                      })
                    }
                    disabled={media.review.isPending}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <GenerateMediaModal
        projectId={projectId}
        chapterId={chapterId}
        visualBeatCount={visualBeatCount}
        open={modalOpen}
        pending={media.createJob.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={(input) => {
          setModalOpen(false);
          media.createJob.mutate({ input, idempotencyKey: crypto.randomUUID() });
        }}
      />
    </section>
  );
}
