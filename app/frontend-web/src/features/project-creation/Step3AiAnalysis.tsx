import React from "react";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { Users, MapPin, BookOpen, Film, Sparkles } from "lucide-react";

interface Step3Props {
  onNext: () => void;
  onBack: () => void;
}

export const Step3AiAnalysis: React.FC<Step3Props> = () => {
  const metrics = [
    { id: "characters", label: "Nhân vật", count: "—", icon: Users },
    { id: "locations", label: "Địa điểm", count: "—", icon: MapPin },
    { id: "chapters", label: "Chương", count: "—", icon: BookOpen },
    { id: "scenes", label: "Cảnh", count: "—", icon: Film },
    { id: "visual_beats", label: "Visual Beats", count: "—", icon: Sparkles },
  ];

  const checklist = [
    "Phân tích cốt truyện",
    "Nhận diện nhân vật",
    "Phân tích địa điểm",
    "Phân chia chương",
    "Tạo visual beats",
  ];

  return (
    <div className="space-y-8 min-h-[480px]">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-700/60 flex items-center justify-center text-orange-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Phân tích AI chưa được bật</h2>
            <p className="text-xs text-slate-400">
              Bạn vẫn có thể tạo project và lưu truyện. Analysis sẽ được mở khi backend có durable execution hoàn chỉnh.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-panel border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-amber-300 font-medium">Tạm thời chưa khả dụng</span>
            <span className="text-slate-500 font-bold text-sm">—</span>
          </div>
          <Progress value={0} color="orange" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.id} className="p-3.5 rounded-xl bg-surface border border-slate-800/90 flex flex-col items-center justify-center text-center space-y-1">
              <div className="w-8 h-8 rounded-lg bg-orange-950/60 flex items-center justify-center text-orange-400 mb-1">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xl font-extrabold text-white font-mono">{metric.count}</span>
              <span className="text-[11px] text-slate-400 font-medium">{metric.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-5 rounded-xl bg-surface-dark border border-slate-800/80 space-y-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phân tích chi tiết</h3>
          <div className="space-y-3">
            {checklist.map((title) => (
              <div key={title} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface/80 border border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border border-slate-600" />
                  <span className="text-xs font-medium text-slate-500">{title}</span>
                </div>
                <Badge variant="neutral" size="sm">Chưa khả dụng</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-dark border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-orange-900/60 via-orange-900/60 to-orange-600/30 border border-orange-500/40 flex items-center justify-center shadow-xl">
            <span className="font-extrabold text-2xl tracking-tight text-white font-mono">AI</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-slate-300">Ghi chú</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[210px]">
              Không có job giả hoặc progress giả. Khi durable worker flow hoàn tất, màn này sẽ dùng trạng thái thật từ backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
