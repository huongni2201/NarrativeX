import type { AutoEditStyle, RenderResolution } from "@narrativex/client-contracts";
import { Film, FolderOpen, Loader2, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useRenderController } from "../useRenderController";

type RenderController = ReturnType<typeof useRenderController>;

export function RenderDialog({
  open,
  onClose,
  controller,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  controller: RenderController;
}>) {
  if (!open) return null;
  const job = controller.liveJob;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Render final video</h2>
              <p className="text-[10px] text-muted-foreground">Narration là master clock · Local FFmpeg</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="nx-icon-button" aria-label="Close render dialog">
            <X size={15} />
          </button>
        </header>

        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-[10px] text-muted-foreground">
              Resolution
              <Select
                value={controller.resolution}
                onValueChange={(value) => controller.setResolution(value as RenderResolution)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p · HD</SelectItem>
                  <SelectItem value="1080p">1080p · Full HD</SelectItem>
                  <SelectItem value="1440p">2K · 1440p QHD</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-1 text-[10px] text-muted-foreground">
              Auto Edit
              <Select
                value={controller.autoEditStyle}
                onValueChange={(value) => controller.setAutoEditStyle(value as AutoEditStyle)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Auto · Recommended</SelectItem>
                  <SelectItem value="CINEMATIC">Cinematic</SelectItem>
                  <SelectItem value="BALANCED">Balanced</SelectItem>
                  <SelectItem value="DYNAMIC">Dynamic</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-popover px-3 py-2.5">
            <span className="flex items-center gap-2">
              <Type size={13} className="text-primary" />
              <span>
                <strong className="block text-[11px]">Subtitles · Automatic</strong>
                <span className="text-[9px] text-muted-foreground">Narration subtitles are burned into the final video using alignment/fallback timing.</span>
              </span>
            </span>
            <span className="rounded bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-400">ON</span>
          </div>

          <div className="rounded-lg border border-border-subtle bg-popover p-3">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <FolderOpen size={13} />
              <span>Destination</span>
            </div>
            <p className="mt-1 truncate font-mono text-[10px] text-foreground">
              {controller.finalPath ?? controller.destinationDirectory ?? "Bạn sẽ chọn thư mục khi bắt đầu render"}
            </p>
          </div>

          {!!controller.readinessBlockers.length && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-[10px] text-warning">
              {controller.readinessBlockers.join(" · ")}
            </div>
          )}

          {controller.notice && (
            <div className="rounded-lg border border-border-subtle bg-popover p-3 text-[10px] text-muted-foreground">
              {controller.notice}
            </div>
          )}

          {job && (
            <div className="grid gap-2 rounded-lg border border-border-subtle p-3">
              <div className="flex justify-between text-[10px]">
                <span>{job.status}</span>
                <span>{Math.round(Math.max(0, Math.min(100, job.progress)))}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            onClick={() => void controller.startRender()}
            disabled={controller.busy || !controller.canRender}
          >
            {controller.busy ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
            {controller.busy ? "Preparing…" : "Choose folder & render"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
