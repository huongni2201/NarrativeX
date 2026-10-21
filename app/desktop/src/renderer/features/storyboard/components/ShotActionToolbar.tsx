import type { GenerationStrategy } from "../../../../shared/api-types";
import { Film, Layers, Loader2, Play, RefreshCw, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ShotActionToolbarProps {
  currentStrategy: GenerationStrategy;
  supportedStrategies?: GenerationStrategy[];
  isGenerating?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  isReconciliationRequired?: boolean;
  takeCount: number;
  onGenerate: () => void;
  onRetake: () => void;
  onReconcile?: () => void;
  onOpenTakeSelector: () => void;
  onStrategyChange: (strategy: GenerationStrategy) => void;
}

export function ShotActionToolbar({
  currentStrategy,
  supportedStrategies,
  isGenerating,
  isBlocked,
  blockedReason,
  isReconciliationRequired,
  takeCount,
  onGenerate,
  onRetake,
  onReconcile,
  onOpenTakeSelector,
  onStrategyChange,
}: Readonly<ShotActionToolbarProps>) {
  const isT2VSupported = supportedStrategies
    ? supportedStrategies.includes("TEXT_TO_VIDEO")
    : true;
  const isI2VSupported = supportedStrategies
    ? supportedStrategies.includes("IMAGE_TO_VIDEO")
    : false;
  const isFLFSupported = supportedStrategies
    ? supportedStrategies.includes("FIRST_LAST_FRAME")
    : false;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Generate / Retake buttons */}
      {isReconciliationRequired ? (
        <Button
          size="sm"
          variant="default"
          className="h-7 text-caption px-2.5"
          disabled={isGenerating || !onReconcile}
          onClick={onReconcile}
          title="Gửi lại đúng yêu cầu cũ với idempotency key ban đầu"
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={11} />
          )}
          <span>Đối soát</span>
        </Button>
      ) : (
        <Button
          size="sm"
          variant={isBlocked ? "outline" : "default"}
          className="h-7 text-caption px-2.5"
          disabled={isGenerating || isBlocked}
          onClick={onGenerate}
          title={isBlocked ? (blockedReason ?? "Không thể tạo video lúc này") : undefined}
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={11} className="fill-current" />
          )}
          <span>{isGenerating ? "Đang tạo…" : takeCount > 0 ? "Tạo take mới" : "Tạo video"}</span>
        </Button>
      )}

      {takeCount > 0 && !isReconciliationRequired && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-caption px-2"
          disabled={isGenerating || isBlocked}
          onClick={onRetake}
          title={isBlocked ? (blockedReason ?? "Không thể tạo video lúc này") : "Tạo lại từ take hiện tại"}
        >
          <RefreshCw size={11} />
          <span>Tạo lại</span>
        </Button>
      )}

      {/* Take selector / Trimming drawer trigger */}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-caption px-2 text-text-secondary hover:text-foreground"
        onClick={onOpenTakeSelector}
      >
        <Layers size={12} />
        <span>Take ({takeCount})</span>
      </Button>

      {/* Strategy selector: rarely changed, so it sits last */}
      <Select
        value={currentStrategy}
        onValueChange={(val) => onStrategyChange(val as GenerationStrategy)}
      >
        <SelectTrigger
          className="mt-0.5 h-7 w-full border-border bg-surface-input text-caption"
          aria-label="Chiến lược tạo video"
        >
          <SelectValue placeholder="Chiến lược" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TEXT_TO_VIDEO" disabled={!isT2VSupported}>
            Text to Video {!isT2VSupported ? "(Chưa hỗ trợ)" : ""}
          </SelectItem>
          <SelectItem value="IMAGE_TO_VIDEO" disabled={!isI2VSupported}>
            Image to Video {!isI2VSupported ? "(Chưa hỗ trợ)" : ""}
          </SelectItem>
          <SelectItem value="FIRST_LAST_FRAME" disabled={!isFLFSupported}>
            First/Last Frame {!isFLFSupported ? "(Chưa hỗ trợ)" : ""}
          </SelectItem>
          <SelectItem value="MULTI_KEYFRAME" disabled>
            Multi-Keyframe (Chưa hỗ trợ)
          </SelectItem>
          <SelectItem value="VIDEO_EXTEND" disabled>
            Video Extend (Chưa hỗ trợ)
          </SelectItem>
          <SelectItem value="VIDEO_RETAKE" disabled>
            Video Retake (Chưa hỗ trợ)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
