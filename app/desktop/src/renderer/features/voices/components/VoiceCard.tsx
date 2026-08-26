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

export function VoiceCard({ voice, index, selected, playing, onSelect, onPreview }: Props) {
  return (
    <article
      className={`group grid min-h-[94px] grid-cols-[66px_minmax(0,1fr)] gap-3 rounded-lg border p-2 transition-colors ${
        selected
          ? "border-primary/65 bg-[var(--voice-card-selected)] shadow-[var(--shadow-card)]"
          : "border-border bg-[var(--voice-card)] hover:border-border-dark"
      }`}
    >
      <button
        type="button"
        onClick={onPreview}
        className="relative grid h-[78px] place-items-center overflow-hidden rounded-md border border-cyan/20 bg-[var(--voice-preview)] text-white"
        aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}
      >
        {playing ? <Pause size={21} /> : <Play className="ml-0.5" size={21} />}
        <span
          className="absolute inset-x-2 bottom-2 flex h-5 items-end justify-center gap-[2px] opacity-70"
          aria-hidden="true"
        >
          {Array.from({ length: 21 }, (_, bar) => (
            <span
              key={bar}
              className="w-[2px] rounded-full bg-white/70"
              style={{ height: `${25 + ((bar * 17 + index * 9) % 65)}%` }}
            />
          ))}
        </span>
      </button>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="min-w-0 truncate text-left text-[11px] font-semibold text-foreground hover:text-primary-hover"
            onClick={onSelect}
          >
            {voice.name}
          </button>
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-text-muted opacity-70">
            <MoreVertical size={13} />
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-secondary">
          <span>{voice.gender ?? "Neutral"}</span>
          <span>•</span>
          <span className="truncate">{voice.language}</span>
          <span className="rounded bg-primary-muted px-1.5 py-0.5 text-[8px] text-primary-hover">
            {languageShort(voice.language)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant={playing ? "default" : "ghost"}
            size="icon"
            aria-label={`${playing ? "Tạm dừng" : "Phát thử"} ${voice.name}`}
            onClick={onPreview}
            className="size-6 rounded-full bg-surface-3"
          >
            {playing ? <Pause size={11} /> : <Play size={11} />}
          </Button>
          <span
            className="flex min-w-0 flex-1 items-center gap-[2px] opacity-60"
            aria-label={voice.sampleUrl ? "Sample audio waveform" : "Chưa có sample audio"}
          >
            {Array.from({ length: 28 }, (_, bar) => (
              <span
                key={bar}
                className="h-4 w-[2px] rounded-full bg-text-muted"
                style={{ transform: `scaleY(${0.2 + ((bar * 13 + index * 5) % 70) / 100})` }}
              />
            ))}
          </span>
          <span className="shrink-0 text-[9px] text-text-secondary">
            {voice.sampleUrl ? "Sample" : "—"}
          </span>
        </div>
      </div>
    </article>
  );
}
