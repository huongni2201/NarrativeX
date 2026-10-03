import { Clapperboard, Film, Layers, Plus, RefreshCw, Sparkles } from "lucide-react";
import type { ProjectAspectRatio } from "@narrativex/client-contracts";
import { Button } from "@/components/ui/button";

const STARTER_FORMATS = [
  { value: "16:9", badge: "16:9", Icon: Film, title: "Video Ngang Cinematic", description: "Tối ưu cho YouTube, phim ngắn, tài liệu diễn họa và màn hình ngang tiêu chuẩn." },
  { value: "9:16", badge: "9:16", Icon: Clapperboard, title: "Video Dọc Shorts & Reels", description: "Tối ưu cho TikTok, YouTube Shorts và Instagram Reels với phụ đề dynamic." },
  { value: "1:1", badge: "1:1 / 4:3", Icon: Layers, title: "Khung Vuông & Cổ Điển", description: "Phù hợp cho mạng xã hội, poster nghệ thuật, visual podcast và phong cách retro." },
] as const;

export function ProjectsEmptyState({ onCreate, onRefresh }: {
  onCreate: (ratio?: ProjectAspectRatio) => void; onRefresh: () => void;
}) {
  return (
          <div className="mx-auto max-w-5xl py-4 sm:py-6">
            {/* Hero Launchpad Card */}
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-surface-elevated/90 via-surface-panel/80 to-surface-dark/95 p-8 sm:p-10 text-center shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-sm">
              <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-primary/15 blur-3xl" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary-muted text-primary shadow-lg shadow-primary/20">
                  <Sparkles size={28} />
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Chào mừng đến với NarrativeX Studio
                </h2>
                <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-text-muted">
                  Không gian làm việc kịch bản, nhân vật, hình ảnh AI và dựng video tự động. Khởi tạo project để bắt đầu workflow trên desktop.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button size="lg" className="shadow-primary px-6 text-[14px]" onClick={() => onCreate()}>
                    <Plus size={16} /> Tạo project mới
                  </Button>
                  <Button variant="outline" size="lg" className="px-5 text-[14px]" onClick={onRefresh}>
                    <RefreshCw size={14} /> Tải lại danh sách
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick-Start Aspect Ratio Starter Templates */}
            <div className="mt-8">
              <div className="mb-3.5">
                <h3 className="text-[14px] font-semibold text-foreground">Bắt đầu nhanh theo định dạng khung hình</h3>
                <p className="text-[12px] text-text-muted">Chọn định dạng video phù hợp để khởi tạo project ngay lập tức.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {STARTER_FORMATS.map(({ value, badge, Icon, title, description }) => (
                  <button key={value} type="button" onClick={() => onCreate(value)}
                    className="group flex flex-col rounded-xl border border-border bg-surface-card p-5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-surface-2 hover:shadow-lg cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-dark text-text-secondary group-hover:border-primary/40 group-hover:text-primary"><Icon size={20} /></div>
                      <span className="rounded-md border border-border-subtle bg-surface-dark px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">{badge}</span>
                    </div>
                    <strong className="mt-3.5 text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">{title}</strong>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Workflow Steps Infographic */}
            <div className="mt-8 rounded-xl border border-border-subtle bg-surface-dark/40 p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">Quy trình sản xuất 3 bước</span>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12.5px]">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[12px]">1</span>
                  <div>
                    <strong className="block text-foreground font-medium">Soạn kịch bản & phân tích</strong>
                    <span className="text-text-muted text-[12px]">Tự động tách cảnh, trích xuất nhân vật và định hình bối cảnh.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[12px]">2</span>
                  <div>
                    <strong className="block text-foreground font-medium">Duyệt Canon & giọng đọc</strong>
                    <span className="text-text-muted text-[12px]">Khoá diện mạo nhân vật và thiết lập giọng đọc lồng tiếng chuẩn xác.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[12px]">3</span>
                  <div>
                    <strong className="block text-foreground font-medium">Visual Beats & Render</strong>
                    <span className="text-text-muted text-[12px]">Sinh ảnh AI theo nhịp thời gian narration và xuất video thành phẩm.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
}
