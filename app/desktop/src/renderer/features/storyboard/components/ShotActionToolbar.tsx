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
  isGenerating?: boolean;
  takeCount: number;
  onGenerate: () => void;
  onRetake: () => void;
  onOpenTakeSelector: () => void;
  onStrategyChange: (strategy: GenerationStrategy) => void;
}

export function ShotActionToolbar({
  currentStrategy,
  isGenerating,
  takeCount,
  onGenerate,
  onRetake,
  onOpenTakeSelector,
  onStrategyChange,
}: Readonly<ShotActionToolbarProps>) {
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
          <SelectItem value="TEXT_TO_VIDEO">Text to Video</SelectItem>
          <SelectItem value="IMAGE_TO_VIDEO">Image to Video</SelectItem>
          <SelectItem value="FIRST_LAST_FRAME">First/Last Frame</SelectItem>
          <SelectItem value="MULTI_KEYFRAME">Multi-Keyframe</SelectItem>
          <SelectItem value="VIDEO_EXTEND">Video Extend</SelectItem>
          <SelectItem value="VIDEO_RETAKE">Video Retake</SelectItem>
        </SelectContent>
      </Select>

      {/* Generate / Retake buttons */}
      <Button
        size="sm"
        variant="default"
        className="h-7 text-[11px] px-2.5"
        disabled={isGenerating}
        onClick={onGenerate}
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
