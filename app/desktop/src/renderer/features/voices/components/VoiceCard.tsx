import type { DesktopVoice } from "@narrativex/client-contracts";
import { MoreVertical, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      className={`group grid min-h-[94px] grid-cols-[58px_minmax(0,1fr)] gap-3 rounded-md border p-2.5 transition-[background-color,border-color] duration-150 ${
        selected
          ? "border-primary/25 bg-primary-muted"
          : "border-border bg-surface-card hover:border-border-dark hover:bg-surface-2"
      }`}
    >
      <button
        type="button"
        onClick={onPreview}
        className="grid h-[70px] place-items-center overflow-hidden rounded-md border border-border-subtle bg-surface-dark text-text-secondary transition-colors hover:bg-surface-3 hover:text-foreground"
        aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}
      >
        {playing ? <Pause size={18} /> : <Play className="ml-0.5" size={18} />}
      </button>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="min-w-0 truncate text-left text-[12px] font-semibold text-foreground transition-colors hover:text-primary"
            onClick={onSelect}
          >
            {voice.name}
          </button>
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-text-muted opacity-70">
            <MoreVertical size={13} />
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-muted">
          <span>{voice.gender ?? "Neutral"}</span>
          <span className="text-text-dim">·</span>
          <span className="truncate">{voice.language}</span>
          <span className="font-mono text-[9px] font-medium text-text-dim">
            {languageShort(voice.language)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-2">
          <Button
            variant={playing ? "default" : "ghost"}
            size="icon-sm"
            aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}
            onClick={onPreview}
          >
            {playing ? <Pause size={11} /> : <Play size={11} />}
          </Button>
          <span className="min-w-0 flex-1 truncate text-[10px] text-text-muted">
            {voice.sampleUrl ? "Sample available" : "No sample audio"}
          </span>
        </div>
      </div>
    </article>
  );
}
