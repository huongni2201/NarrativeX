import type { DesktopVoice } from "@narrativex/client-contracts";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import { languageShort } from "../model/voice-ui";

type Props = Readonly<{
  voice: DesktopVoice;
  index: number;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}>;

export function VoiceCard({ voice, selected, playing, onSelect, onPreview }: Props) {
  return (
    <article
      className={`group flex min-h-[72px] min-w-0 items-center gap-2.5 border-l-2 border-b border-b-border-subtle px-2.5 py-2 transition-colors ${
        selected ? "border-l-primary bg-primary-muted/45" : "border-l-transparent bg-surface-panel hover:bg-surface-hover"
      }`}
    >
      <button
        type="button"
        onClick={onPreview}
        className="grid size-11 shrink-0 place-items-center border border-border-subtle bg-surface-dark text-text-secondary transition-colors hover:bg-surface-3 hover:text-foreground"
        aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}
      >
        {playing ? <Pause size={16} /> : <Play className="ml-0.5" size={16} />}
      </button>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left focus-visible:outline-none">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className={`truncate text-[11px] font-semibold ${selected ? "text-primary-hover" : "text-foreground"}`}>{voice.name}</span>
          <StatusIndicator label={languageShort(voice.language)} tone={selected ? "accent" : "neutral"} className="shrink-0" />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-text-muted">
          <span>{voice.gender ?? "Neutral"}</span>
          <span className="text-text-dim">·</span>
          <span className="truncate">{voice.language}</span>
        </div>
        <div className="mt-1 text-[9px] text-text-dim">{voice.sampleUrl ? "Sample available" : "No sample audio"}</div>
      </button>

      <Button
        variant={playing ? "default" : "ghost"}
        size="icon-sm"
        aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}
        onClick={onPreview}
        className="shrink-0"
      >
        {playing ? <Pause size={11} /> : <Play size={11} />}
      </Button>
    </article>
  );
}
