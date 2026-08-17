import React, { useState } from "react";
import { MediaAsset } from "@/types/assets";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { AssetTypeBadge } from "./AssetTypeBadge";
import { Button } from "@/components/ui/Button";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import {
  X,
  Download,
  RefreshCw,
  Trash2,
  ExternalLink,
  Lock,
  Unlock,
  CheckCircle2,
  Film,
  Play,
  Volume2,
} from "lucide-react";

interface AssetDetailDrawerProps {
  asset: MediaAsset | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onToggleLock?: (id: string) => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  asset,
  onClose,
  onDelete,
  onApprove,
  onReject,
  onToggleLock,
}) => {
  const { setScreen } = useStudioStore();
  const { setView, setActiveChapter, setActiveScene } = useProductionStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!asset) return null;

  const handleNavigateToUsage = (targetView?: string) => {
    if (targetView === "character-bible") {
      setScreen("character-bible");
    } else if (targetView === "storyboard") {
      setScreen("project-workspace");
      setView("storyboard");
    } else if (targetView === "visual-review") {
      setScreen("project-workspace");
      setView("visual-review");
    } else if (targetView === "workspace") {
      setScreen("project-workspace");
      setView("workspace");
    } else if (targetView === "preview") {
      setScreen("project-workspace");
      setView("preview");
    } else {
      setScreen("project-workspace");
      setView("storyboard");
    }
  };

  return (
    <aside className="w-full lg:w-[380px] xl:w-[420px] bg-[#0d1420] border-l border-slate-800 flex flex-col justify-between shrink-0 h-full overflow-y-auto z-20 select-none shadow-2xl animate-in slide-in-from-right-4 duration-200">
      {/* Header with Filename & Close Button matching Mockup */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0d1420]/95 backdrop-blur-md z-10">
        <h3 className="text-xs font-bold text-slate-100 truncate font-mono max-w-[300px]">
          {asset.filename}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-5 flex-1">
        {/* Large Media Preview Box */}
        <div className="w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-md relative group">
          {asset.type === "AUDIO" ? (
            <div className="p-6 bg-gradient-to-br from-[#0e1626] to-[#090e18] flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                <Volume2 className="w-7 h-7" />
              </div>
              <div className="w-full space-y-2">
                <div className="flex items-center justify-center gap-1 h-12 px-4">
                  {(asset.audioWaveform || [30, 50, 70, 90, 60, 40, 75, 95, 80, 60, 45, 65, 85, 90, 50]).map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="w-1.5 bg-purple-400 rounded-full"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>00:00</span>
                  <span>{asset.duration || "07:36"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="aspect-[16/10] w-full overflow-hidden relative">
              <img
                src={asset.thumbnailUrl}
                alt={asset.filename}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {(asset.type === "VIDEO" || asset.type === "FINAL_OUTPUT") && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Row */}
        <div className="flex items-center justify-between pt-1">
          <AssetTypeBadge type={asset.type} showIcon />
          <AssetStatusBadge status={asset.status} progressPercent={asset.progressPercent} />
        </div>

        {/* Structured Metadata Grid matching Mockup */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Thông tin chi tiết
          </h4>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-[#090e18] p-3.5 rounded-xl border border-slate-800/80 font-mono">
            <div>
              <span className="text-slate-500 text-[10px] block">Loại:</span>
              <span className="text-slate-200 font-semibold">{asset.type}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Kích thước:</span>
              <span className="text-slate-200 font-semibold">{asset.dimensions || asset.audioSampleRate || "1920 × 1080"}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Tỷ lệ:</span>
              <span className="text-slate-200 font-semibold">{asset.aspectRatio || "16:9"}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Dung lượng:</span>
              <span className="text-slate-200 font-semibold">{asset.fileSize}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Được tạo bởi:</span>
              <span className="text-slate-200 font-semibold">{asset.provider || "SD 2026.01"}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Ngày tạo:</span>
              <span className="text-slate-200 font-semibold">{asset.createdAt}</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-800/60">
              <span className="text-slate-500 text-[10px] block">Dự án:</span>
              <span className="text-purple-300 font-semibold font-sans">{asset.projectTitle}</span>
            </div>
            {asset.chapterTitle && (
              <div className="col-span-2">
                <span className="text-slate-500 text-[10px] block">Chapter:</span>
                <span className="text-slate-200 font-sans">{asset.chapterTitle}</span>
              </div>
            )}
            {asset.sceneTitle && (
              <div className="col-span-2">
                <span className="text-slate-500 text-[10px] block">Scene &amp; Beat:</span>
                <span className="text-slate-200 font-sans">{asset.sceneTitle} {asset.beatTitle ? `• Beat ${asset.beatTitle}` : ""}</span>
              </div>
            )}
            {asset.attempt && (
              <div>
                <span className="text-slate-500 text-[10px] block">Lần tạo:</span>
                <span className="text-slate-200 font-semibold">{asset.attempt}</span>
              </div>
            )}
          </div>
        </div>

        {/* Prompt if exists */}
        {asset.prompt && (
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Prompt AI
            </h4>
            <p className="text-xs text-slate-300 bg-[#090e18] p-3 rounded-xl border border-slate-800/80 leading-relaxed font-mono text-[11px]">
              {asset.prompt}
            </p>
          </div>
        )}

        {/* Được sử dụng trong (Used-in Relation) matching Mockup */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Được sử dụng trong
          </h4>

          {asset.usedIn && asset.usedIn.length > 0 ? (
            <div className="space-y-2">
              {asset.usedIn.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-2"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-[11px] text-slate-400">{item.subtitle}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleNavigateToUsage(item.targetView)}
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs justify-center text-purple-300 hover:text-purple-200 border-purple-900/60 hover:bg-purple-950/40"
                    rightIcon={<ExternalLink className="w-3.5 h-3.5 ml-1.5" />}
                  >
                    {item.linkText || "Xem trong Storyboard"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic bg-[#090e18] p-3 rounded-xl border border-slate-800/80">
              Tài sản chưa được liên kết trực tiếp vào scene nào.
            </p>
          )}
        </div>
      </div>

      {/* Action Footer matching Mockup (Tải xuống, Thay thế, Xóa) */}
      <div className="p-4 border-t border-slate-800/80 bg-[#090e18] sticky bottom-0 z-10 space-y-2">
        {showDeleteConfirm ? (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 space-y-2 animate-in fade-in duration-150">
            <p className="text-xs text-rose-200 font-semibold text-center">
              Bạn có chắc chắn muốn xóa tài sản này?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="justify-center"
              >
                Hủy
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onDelete(asset.id);
                  setShowDeleteConfirm(false);
                }}
                className="justify-center"
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="py-2 px-2.5 rounded-lg bg-[#0d1420] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải xuống</span>
            </button>

            <button
              type="button"
              className="py-2 px-2.5 rounded-lg bg-[#0d1420] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thay thế</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="py-2 px-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
