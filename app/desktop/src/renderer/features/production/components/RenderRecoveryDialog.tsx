import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface UnfinishedRenderInfo {
  projectId: string;
  jobId: string;
  stage: string;
  recoveryAction: string;
  updatedAt: string;
  renderFingerprint: string;
}

export function RenderRecoveryDialog() {
  const [unfinishedList, setUnfinishedList] = useState<UnfinishedRenderInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    async function checkRecovery() {
      if (typeof window === "undefined" || !window.narrativex?.render?.recoveryStatus) {
        return;
      }
      try {
        const result = await window.narrativex.render.recoveryStatus();
        if (result?.unfinished && result.unfinished.length > 0) {
          setUnfinishedList(result.unfinished);
          setCurrentIndex(0);
          setIsOpen(true);
        }
      } catch (err) {
        console.warn("Failed to check render recovery status:", err);
      }
    }

    void checkRecovery();
  }, []);

  const unfinished = unfinishedList[currentIndex] ?? null;

  if (!unfinished) return null;

  const handleDiscard = async () => {
    if (!unfinished) return;
    setIsBusy(true);
    try {
      if (window.narrativex?.render?.discardRecovery) {
        await window.narrativex.render.discardRecovery({
          projectId: unfinished.projectId,
          jobId: unfinished.jobId,
        });
      } else if (window.narrativex?.render?.cancel) {
        await window.narrativex.render.cancel(unfinished.jobId);
      }
      const nextList = unfinishedList.filter((_, idx) => idx !== currentIndex);
      setUnfinishedList(nextList);
      if (nextList.length === 0) {
        setIsOpen(false);
      } else {
        setCurrentIndex((prev) => Math.min(prev, nextList.length - 1));
      }
    } catch (err) {
      console.warn("Failed to discard unfinished render job:", err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleResume = async () => {
    if (!unfinished) return;
    setIsBusy(true);
    try {
      if (window.narrativex?.render?.resumeRecovery) {
        await window.narrativex.render.resumeRecovery({
          projectId: unfinished.projectId,
          jobId: unfinished.jobId,
        });
      }
      setIsOpen(false);
      window.location.hash = `#/projects/${unfinished.projectId}/editor`;
    } catch (err) {
      console.warn("Failed to resume render job:", err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning mb-1">
            <AlertTriangle size={18} />
            <DialogTitle className="text-[16px] font-semibold text-foreground">
              Phát hiện tiến trình xuất video bị gián đoạn {unfinishedList.length > 1 ? `(Tác vụ ${currentIndex + 1}/${unfinishedList.length})` : ""}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[12px] text-text-muted text-left">
            Một tác vụ kết xuất video trước đó đã dừng đột ngột hoặc chưa hoàn thành trên thiết bị này.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border-subtle bg-surface-dark p-3 text-[12px] space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-text-dim">Project:</span>
            <span className="text-foreground truncate max-w-[240px]">{unfinished.projectId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Job ID:</span>
            <span className="text-foreground truncate max-w-[240px]">{unfinished.jobId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Giai đoạn:</span>
            <span className="text-primary font-semibold">{unfinished.stage}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Hành động gợi ý:</span>
            <span className="text-success">{unfinished.recoveryAction}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Thời điểm:</span>
            <span className="text-text-secondary">{new Date(unfinished.updatedAt).toLocaleString()}</span>
          </div>
        </div>

        {unfinishedList.length > 1 && (
          <div className="flex items-center justify-between text-xs text-text-dim px-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIndex === 0 || isBusy}
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              className="h-7 px-2 text-xs"
            >
              <ArrowLeft size={12} className="mr-1" />
              Trước
            </Button>
            <span>Tác vụ {currentIndex + 1} trên {unfinishedList.length}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIndex === unfinishedList.length - 1 || isBusy}
              onClick={() => setCurrentIndex((idx) => Math.min(unfinishedList.length - 1, idx + 1))}
              className="h-7 px-2 text-xs"
            >
              Sau
              <ArrowRight size={12} className="ml-1" />
            </Button>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={isBusy}
            className="text-text-dim hover:text-danger"
          >
            <Trash2 size={13} className="mr-1.5" />
            Huỷ bỏ tác vụ cũ
          </Button>
          <Button
            size="sm"
            onClick={handleResume}
            disabled={isBusy}
          >
            <span>Mở dự án để xử lý</span>
            <ArrowRight size={13} className="ml-1.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
