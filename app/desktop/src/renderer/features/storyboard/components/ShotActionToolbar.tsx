import type { GenerationStrategy } from "@narrativex/client-contracts";
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
  takeCount: number;
  onGenerate: () => void;
  onRetake: () => void;
  onOpenTakeSelector: () => void;
  onStrategyChange: (strategy: GenerationStrategy) => void;
}

export function ShotActionToolbar({
  currentStrategy,
  supportedStrategies,
  isGenerating,
  isBlocked,
  blockedReason,
  takeCount,
  onGenerate,
  onRetake,
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
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Strategy selector */}
      <Select
        value={currentStrategy}
        onValueChange={(val) => onStrategyChange(val as GenerationStrategy)}
      >
        <SelectTrigger className="h-7 text-[10px] min-w-[120px] bg-surface-dark border-border-soft">
          <SelectValue placeholder="Strategy" />
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

      {/* Generate / Retake buttons */}
      <Button
        size="sm"
        variant="default"
        className="h-7 text-[11px] px-2.5"
        disabled={isGenerating || isBlocked}
        onClick={onGenerate}
        title={isBlocked ? (blockedReason ?? "Generation blocked") : undefined}
      >
        {isGenerating ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Play size={11} className="fill-current" />
        )}
        <span>{takeCount > 0 ? "New Take" : "Generate"}</span>
      </Button>

      {takeCount > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-2"
          disabled={isGenerating}
          onClick={onRetake}
          title="Reason-aware retake"
        >
          <RefreshCw size={11} />
          <span>Retake</span>
        </Button>
      )}

      {/* Take selector / Trimming drawer trigger */}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[11px] px-2 text-text-secondary hover:text-foreground"
        onClick={onOpenTakeSelector}
      >
        <Layers size={12} />
        <span>Takes ({takeCount})</span>
      </Button>
    </div>
  );
}
