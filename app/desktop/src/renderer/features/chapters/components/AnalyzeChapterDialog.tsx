import type { ImageGenerationProvider, VisualGenerationMode } from "@narrativex/client-contracts";
import { WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AnalyzeChapterDialog({
  visualGenerationMode,
  imageProvider,
  onVisualGenerationModeChange,
  onImageProviderChange,
  onCancel,
  onSubmit,
}: Readonly<{
  visualGenerationMode: VisualGenerationMode;
  imageProvider: ImageGenerationProvider;
  onVisualGenerationModeChange: (value: VisualGenerationMode) => void;
  onImageProviderChange: (value: ImageGenerationProvider) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="analyze-chapter-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface-panel shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 id="analyze-chapter-title" className="text-sm font-bold text-foreground">
              Analyze Chapter
            </h2>
            <p className="mt-1 text-[11px] leading-4 text-text-muted">
              Chọn loại visual và provider để AI chuẩn bị scene/visual beat phù hợp cho bước generation.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onCancel}
            className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Step 1 · Visual generation mode
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["IMAGE", "VIDEO"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onVisualGenerationModeChange(mode)}
                  className={`rounded-md border px-3 py-3 text-left transition ${
                    visualGenerationMode === mode
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-2"
                  }`}
                >
                  <div className="text-xs font-bold">{mode === "IMAGE" ? "Image" : "Video"}</div>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">
                    {mode === "IMAGE"
                      ? "Tạo storyboard still-image theo từng visual beat."
                      : "Chuẩn bị storyboard cho video generation."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {visualGenerationMode === "IMAGE" && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                Step 2 · Image provider
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["GEMINI_WEB", "API"] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => onImageProviderChange(provider)}
                    className={`rounded-md border px-3 py-3 text-left transition ${
                      imageProvider === provider
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-surface text-text-secondary hover:bg-surface-2"
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {provider === "GEMINI_WEB" ? "Gemini Web" : "API"}
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-text-muted">
                      {provider === "GEMINI_WEB"
                        ? "Manual generate/import trong Storyboard."
                        : "Generation job tự động qua backend provider."}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {visualGenerationMode === "IMAGE" && imageProvider === "GEMINI_WEB" && (
            <div className="rounded-md border border-info/25 bg-info-bg px-3 py-2 text-[10px] leading-4 text-text-secondary">
              Web image generation luôn tạo ảnh mới cho từng visual beat. Reuse và reframe không dùng với Gemini Web.
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onSubmit}>
            <WandSparkles size={13} /> Analyze
          </Button>
        </footer>
      </div>
    </div>
  );
}
