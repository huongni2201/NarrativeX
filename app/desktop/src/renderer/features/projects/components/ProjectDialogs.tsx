import type { FormEvent } from "react";
import type { DesktopProject, ProjectAspectRatio } from "@narrativex/client-contracts";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ASPECT_RATIOS: ReadonlyArray<{
  value: ProjectAspectRatio;
  label: string;
}> = [
  { value: "16:9", label: "16:9 · Ngang" },
  { value: "9:16", label: "9:16 · Dọc" },
  { value: "1:1", label: "1:1 · Vuông" },
  { value: "4:3", label: "4:3 · Ngang cổ điển" },
  { value: "3:4", label: "3:4 · Dọc cổ điển" },
];

interface CreateProps {
  open: boolean; onOpenChange: (open: boolean) => void;
  name: string; setName: (name: string) => void;
  description: string; setDescription: (description: string) => void;
  imageAspectRatio: ProjectAspectRatio; setImageAspectRatio: (ratio: ProjectAspectRatio) => void;
  isPending: boolean; error: Error | null; onSubmit: (event: FormEvent) => void;
}

export function CreateProjectDialog({ open, onOpenChange, name, setName, description, setDescription, imageAspectRatio, setImageAspectRatio, isPending, error, onSubmit }: CreateProps) {
  return (
      <Dialog
        open={open}
        onOpenChange={(open) => {
          if (!open && !isPending) onOpenChange(false);
        }}
      >
        <DialogContent
          className="w-[min(680px,calc(100vw-32px))] gap-5 bg-surface-panel p-6"
          aria-describedby="create-project-description"
        >
          <DialogCloseButton disabled={isPending} />
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-[18px] font-bold text-foreground">Create project</DialogTitle>
            <DialogDescription id="create-project-description" className="text-[13px] leading-relaxed text-text-muted">
              Khởi tạo workspace mới rồi mở thẳng vào Editor.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-[minmax(240px,1.2fr)_minmax(200px,.8fr)]">
              <label className="grid gap-2 text-[12px] font-medium text-text-secondary">
                <span>Tên project</span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  placeholder="My next story"
                  className="h-10 text-[13.5px]"
                />
              </label>
              <div className="grid content-start gap-2 text-[12px] font-medium text-text-secondary">
                <label htmlFor="project-aspect-ratio">Khung hình</label>
                <div className="grid grid-cols-5 gap-1.5 mb-1">
                  {ASPECT_RATIOS.map((ratio) => {
                    const isSelected = imageAspectRatio === ratio.value;
                    return (
                      <button
                        key={ratio.value}
                        type="button"
                        onClick={() => setImageAspectRatio(ratio.value)}
                        className={`group flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary shadow-xs"
                            : "border-border-subtle bg-surface-dark text-text-muted hover:border-border hover:bg-surface-3 hover:text-text-secondary"
                        }`}
                        title={ratio.label}
                      >
                        <div className="flex h-5 items-center justify-center">
                          <div
                            className={`rounded-xs border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/25"
                                : "border-border-subtle bg-surface-2 group-hover:border-border"
                            }`}
                            style={{
                              width: ratio.value === "16:9" ? "22px" : ratio.value === "9:16" ? "12px" : ratio.value === "1:1" ? "16px" : ratio.value === "4:3" ? "20px" : "15px",
                              height: ratio.value === "16:9" ? "12px" : ratio.value === "9:16" ? "20px" : ratio.value === "1:1" ? "16px" : ratio.value === "4:3" ? "15px" : "19px",
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] font-semibold">{ratio.value}</span>
                      </button>
                    );
                  })}
                </div>
                <Select
                  value={imageAspectRatio}
                  onValueChange={(value) => setImageAspectRatio(value as ProjectAspectRatio)}
                >
                  <SelectTrigger id="project-aspect-ratio" className="w-full h-10 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="grid gap-2 text-[12px] font-medium text-text-secondary md:col-span-2">
                <span>Mô tả (tuỳ chọn)</span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  placeholder="Mô tả tóm tắt về nội dung dự án..."
                  className="min-h-24"
                />
              </label>
            </div>

            {Boolean(error) && (
              <p className="m-0 border-l-2 border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger" role="alert">
                {error?.message}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="default" disabled={isPending || !name.trim()}>
                {isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

  );
}

export function DeleteProjectDialog({ project, onClose, isPending, error, onConfirm }: {
  project: DesktopProject | null; onClose: () => void; isPending: boolean; error: Error | null; onConfirm: () => void;
}) {
  return (
      <Dialog
        open={project !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) onClose();
        }}
      >
        <DialogContent
          className="w-[min(460px,calc(100vw-32px))] gap-4 bg-surface-panel p-6"
          aria-describedby="delete-project-description"
        >
          <DialogCloseButton disabled={isPending} />
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-[16px] font-bold text-foreground">Xoá project?</DialogTitle>
            <DialogDescription id="delete-project-description" className="text-[13px] leading-relaxed text-text-muted">
              Project <strong className="font-semibold text-foreground">{project?.name}</strong>{" "}
              sẽ biến mất khỏi workspace. Dữ liệu local vẫn được giữ lại để backup hoặc khôi phục.
            </DialogDescription>
          </DialogHeader>

          {Boolean(error) && (
            <p className="m-0 border-l-2 border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger" role="alert">
              Không thể xoá project: {error?.message}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
            <Button
              variant="outline"
              size="default"
              disabled={isPending}
              onClick={() => onClose()}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              size="default"
              disabled={isPending}
              onClick={onConfirm}
            >
              <Trash2 size={14} />
              {isPending ? "Đang xoá…" : "Xoá project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}
