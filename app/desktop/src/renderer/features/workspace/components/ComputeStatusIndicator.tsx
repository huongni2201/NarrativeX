import { useState } from "react";
import { Cpu, CheckCircle2, AlertTriangle, WifiOff, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";

export interface ComputeStatusIndicatorProps {
  status?: "Ready" | "Busy" | "Degraded" | "Offline";
}

export function ComputeStatusIndicator({ status = "Ready" }: ComputeStatusIndicatorProps) {
  const [open, setOpen] = useState(false);

  const getStatusBadge = () => {
    switch (status) {
      case "Busy":
        return {
          icon: <RefreshCw size={13} className="animate-spin text-primary" />,
          colorClass: "border-primary/30 bg-primary-muted text-primary",
          label: "Compute: Busy",
        };
      case "Degraded":
        return {
          icon: <AlertTriangle size={13} className="text-warning" />,
          colorClass: "border-warning/30 bg-warning-bg text-warning",
          label: "Compute: Degraded",
        };
      case "Offline":
        return {
          icon: <WifiOff size={13} className="text-destructive" />,
          colorClass: "border-destructive/30 bg-danger-bg text-destructive",
          label: "Compute: Offline",
        };
      case "Ready":
      default:
        return {
          icon: <CheckCircle2 size={13} className="text-success" />,
          colorClass: "border-success/30 bg-success-bg text-success",
          label: "Compute: Ready",
        };
    }
  };

  const current = getStatusBadge();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition-all hover:brightness-110 focus-visible:ring-1 focus-visible:ring-primary ${current.colorClass}`}
        title="Bấm để xem chi tiết hạ tầng tính toán (Compute details)"
        aria-label={current.label}
      >
        {current.icon}
        <span>{current.label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[440px] border border-border bg-card p-5 text-card-foreground shadow-2xl">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2 text-foreground">
              <Cpu className="size-5 text-primary" />
              <DialogTitle className="text-[16px] font-semibold">Trạng thái hạ tầng tính toán (Compute)</DialogTitle>
            </div>
            <DialogDescription className="text-[13px] text-text-muted">
              Hệ thống xử lý AI ngoại vi phục vụ phân tích kịch bản, sinh giọng đọc và tạo hình ảnh.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-dark px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-text-secondary">Trạng thái kết nối</span>
              <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[12px] font-medium bg-surface-3 text-foreground">
                {current.icon}
                {status}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-dark px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-text-secondary">Mục tiêu GPU thực thi</span>
              <span className="font-mono text-[12px] text-foreground">RTX 3090 (Windows Remote GPU)</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-dark px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-text-secondary">Giao thức truyền tải</span>
              <span className="font-mono text-[12px] text-foreground">Compute Protocol v1 (SSE)</span>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface-dark p-3.5">
              <span className="text-[13px] font-medium text-text-secondary block mb-2">Các pipeline khả dụng</span>
              <ul className="flex flex-col gap-1.5 text-[12px] text-text-muted">
                <li className="flex items-center justify-between">
                  <span>Gemini 3.8 Flash (Story Director)</span>
                  <span className="text-success font-mono">OK</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>VieNeu (Vietnamese TTS)</span>
                  <span className="text-success font-mono">OK</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>WhisperX (Forced Alignment)</span>
                  <span className="text-success font-mono">OK</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>ComfyUI (RealVisXL / Image Gen)</span>
                  <span className="text-success font-mono">OK</span>
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
