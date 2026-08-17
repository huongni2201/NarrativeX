import React from "react";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import {
  Users,
  MapPin,
  BookOpen,
  Film,
  Sparkles,
} from "lucide-react";

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
    {
      id: "plot",
      title: "Phân tích cốt truyện",
      status: "pending" as const,
      badge: "Chờ backend",
    },
    {
      id: "characters",
      title: "Nhận diện nhân vật",
      status: "pending" as const,
      badge: "Chờ backend",
    },
    {
      id: "locations",
      title: "Phân tích địa điểm",
      status: "pending" as const,
      badge: "Chờ backend",
    },
    {
      id: "chapters",
      title: "Phân chia chương",
      status: "pending" as const,
      badge: "Chờ backend",
    },
    {
      id: "visual_beats",
      title: "Tạo visual beats",
      status: "pending" as const,
      badge: "Chờ backend",
    },
  ];

  return (
    <div className="space-y-8 min-h-[480px]">
      {/* Header & Main Progress Bar */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Sẵn sàng gửi câu chuyện lên backend
            </h2>
            <p className="text-xs text-slate-400">
              Analysis job sẽ được enqueue sau khi bạn xác nhận project.
            </p>
          </div>
        </div>

        {/* Big Progress Container */}
        <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-purple-300 font-medium">Chưa bắt đầu</span>
            <span className="text-purple-400 font-bold text-sm">—</span>
          </div>
          <Progress value={0} color="purple" />
        </div>
      </div>

      {/* 5 Realtime Metrics Row matching Mockup */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className="p-3.5 rounded-xl bg-[#0d1420] border border-slate-800/90 flex flex-col items-center justify-center text-center space-y-1 hover:border-purple-500/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-950/60 flex items-center justify-center text-purple-400 mb-1">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xl font-extrabold text-white font-mono">
                {m.count}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* Checklist & AI Visual Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Checklist details (2 cols) */}
        <div className="md:col-span-2 p-5 rounded-xl bg-[#0a0f1d] border border-slate-800/80 space-y-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Phân tích chi tiết
          </h3>
          <div className="space-y-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#0d1420]/80 border border-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border border-slate-600" />
                  <span className="text-xs font-medium text-slate-500">
                    {item.title}
                  </span>
                </div>

                <Badge
                  variant="neutral"
                  size="sm"
                >
                  {item.badge}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* AI Note & Holographic Icon Box (1 col) */}
        <div className="p-5 rounded-xl bg-[#0a0f1d] border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-900/60 via-indigo-900/60 to-purple-600/30 border border-purple-500/40 flex items-center justify-center shadow-[0_0_35px_rgba(124,58,237,0.35)] animate-pulse-glow">
            <span className="font-extrabold text-2xl tracking-tight text-white font-mono">
              AI
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-slate-300">Ghi chú</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
            Backend sẽ trả về trạng thái và tiến độ thật sau khi job được tạo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
