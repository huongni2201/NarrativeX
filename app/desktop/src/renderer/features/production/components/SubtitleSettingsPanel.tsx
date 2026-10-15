import { useId } from "react";
import { RotateCcw, Save, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SubtitleFontFamily, SubtitlePosition, SubtitlePreset, SubtitleStyle } from "@narrativex/client-contracts";
import { SUBTITLE_FONTS } from "../../../../shared/subtitle-style";
import { renderDimensions } from "../../../../shared/render-dimensions";
import type { RenderController } from "../useRenderController";
import { SubtitleOverlay } from "./SubtitleOverlay";

export const SUBTITLE_POSITION_OPTIONS: { value: SubtitlePosition; label: string }[] = [
  {value: "TOP_LEFT", label: "Trên trái"}, {value: "TOP_CENTER", label: "Trên giữa"}, {value: "TOP_RIGHT", label: "Trên phải"},
  {value: "MIDDLE_LEFT", label: "Giữa trái"}, {value: "MIDDLE_CENTER", label: "Chính giữa"}, {value: "MIDDLE_RIGHT", label: "Giữa phải"},
  {value: "BOTTOM_LEFT", label: "Dưới trái"}, {value: "BOTTOM_CENTER", label: "Dưới giữa"}, {value: "BOTTOM_RIGHT", label: "Dưới phải"},
];
const presets: {value: SubtitlePreset; label: string}[] = [
  {value: "DEFAULT", label: "Mặc định"}, {value: "OUTLINE", label: "Chữ có viền"},
  {value: "SHADOW", label: "Chữ có bóng"}, {value: "BACKGROUND", label: "Nền mờ"},
];

export function subtitlePositionLabel(position: SubtitlePosition) {
  return SUBTITLE_POSITION_OPTIONS.find((option) => option.value === position)?.label ?? position;
}

type SubtitleStatusSource = Pick<RenderController,
  "subtitleSettingsSaving" | "subtitleSettingsDirty" | "subtitleSettingsReady">;

export function subtitleSaveStatus(controller: SubtitleStatusSource, saved = "Đã lưu theo Project") {
  if (controller.subtitleSettingsSaving) return "Đang lưu…";
  if (controller.subtitleSettingsDirty) return "Chưa lưu";
  return controller.subtitleSettingsReady ? saved : "";
}

/**
 * `full` keeps the standalone layout (own sample preview) used by the Render screen.
 * `inspector` is a single-column layout for the narrow Editor Inspector; the live preview
 * is the real video frame, so no separate sample figure is rendered.
 */
export function SubtitleSettingsPanel({ controller, aspectRatio = "16:9", variant = "full" }: Readonly<{
  controller: RenderController; aspectRatio?: string; variant?: "full" | "inspector";
}>) {
  const id = useId();
  const compact = variant === "inspector";
  const style = controller.subtitleStyle;
  const disabled = controller.busy || controller.subtitleSettingsSaving || !controller.subtitleSettingsReady;
  const update = (patch: Partial<SubtitleStyle>) => controller.setSubtitleStyle({ ...style, ...patch });
  return (
    <section aria-label="Tùy chỉnh phụ đề" className="grid min-w-0 gap-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Type size={15} className="text-primary" />{compact ? "Phụ đề toàn video" : "Phụ đề"}</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-primary" checked={controller.subtitlesEnabled}
            disabled={disabled} onChange={(event) => controller.setSubtitlesEnabled(event.target.checked)} />Bật phụ đề
        </label>
      </div>
      {controller.subtitleSettingsLoading && <p role="status" className="text-muted-foreground">Đang tải tùy chỉnh…</p>}
      {controller.subtitleSettingsError && <div role="alert" className="grid gap-2 text-danger">
        <p>{controller.subtitleSettingsError}</p>
        {!controller.subtitleSettingsReady && <Button variant="outline" onClick={controller.retrySubtitleSettings}>Thử lại</Button>}
      </div>}
      <fieldset disabled={disabled || !controller.subtitlesEnabled} className="grid min-w-0 gap-4 disabled:opacity-60">
        <legend className="sr-only">Kiểu và vị trí phụ đề</legend>
        <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
          <div className="grid content-start gap-2">
            <span>Vị trí</span>
            <div role="group" aria-label="Vị trí phụ đề" className="grid grid-cols-3 gap-1.5">
              {SUBTITLE_POSITION_OPTIONS.map((position) => <button key={position.value} type="button"
                aria-label={position.label} aria-pressed={style.position === position.value}
                onClick={() => update({position: position.value})}
                className={`min-h-11 rounded border px-1 py-2 text-caption transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed ${style.position === position.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-foreground hover:bg-accent"}`}
              >{position.label}</button>)}
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-font`}>Font chữ</label>
              <Select value={style.fontFamily} onValueChange={(value) => update({fontFamily: value as SubtitleFontFamily})} disabled={disabled || !controller.subtitlesEnabled}>
                <SelectTrigger id={`${id}-font`}><SelectValue /></SelectTrigger>
                <SelectContent>{SUBTITLE_FONTS.map((font) => <SelectItem key={font} value={font}><span style={{fontFamily: font}}>{font} · Tiếng Việt</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-preset`}>Mẫu hiển thị</label>
              <Select value={style.preset} onValueChange={(value) => update({preset: value as SubtitlePreset})} disabled={disabled || !controller.subtitlesEnabled}>
                <SelectTrigger id={`${id}-preset`}><SelectValue /></SelectTrigger>
                <SelectContent>{presets.map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={style.fontWeight === 700}
              onChange={(event) => update({fontWeight: event.target.checked ? 700 : 400})} />Chữ đậm</label>
          </div>
        </div>
        <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
          <label className="grid gap-1.5">Cỡ chữ · {(style.fontSizeRatio * 100).toFixed(1)}% chiều cao
            <input aria-label="Cỡ chữ" className="w-full accent-primary" type="range" min="2" max="8" step="0.1" value={style.fontSizeRatio * 100}
              onChange={(event) => update({fontSizeRatio: Number(event.target.value) / 100})} />
          </label>
          <label className="grid gap-1.5">Khoảng cách mép · {(style.edgeMarginRatio * 100).toFixed(0)}%
            <input aria-label="Khoảng cách mép" className="w-full accent-primary" type="range" min="2" max="20" step="1" value={style.edgeMarginRatio * 100}
              onChange={(event) => update({edgeMarginRatio: Number(event.target.value) / 100})} />
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          {([ ["primaryColor", "Màu chữ"], ["outlineColor", "Màu viền / bóng"], ["backgroundColor", "Màu nền"] ] as const).map(([field, label]) =>
            <label key={field} className="flex items-center gap-2"><input aria-label={label} type="color" value={style[field]}
              disabled={field === "outlineColor" ? style.preset === "DEFAULT" || style.preset === "BACKGROUND" : field === "backgroundColor" ? style.preset === "OUTLINE" || style.preset === "SHADOW" : false}
              onChange={(event) => update({[field]: event.target.value})} className="h-8 w-10 cursor-pointer rounded border border-border bg-secondary" />{label}</label>)}
        </div>
        <label className="grid gap-1.5">Độ đậm nền · {Math.round(style.backgroundOpacity * 100)}%
          <input aria-label="Độ đậm nền" className="w-full accent-primary" type="range" min="0" max="100" value={style.backgroundOpacity * 100}
            disabled={style.preset !== "DEFAULT" && style.preset !== "BACKGROUND"}
            onChange={(event) => update({backgroundOpacity: Number(event.target.value) / 100})} />
        </label>
      </fieldset>
      {compact ? (
        <p className="text-muted-foreground">Xem trước trực tiếp trên khung video. Khi playhead chưa có lời thoại, khung hiển thị câu mẫu.</p>
      ) : <figure className="grid gap-2">
        <figcaption className="text-muted-foreground">Xem trước kiểu chữ · câu mẫu tiếng Việt</figcaption>
        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded border border-border bg-surface-dark" style={{aspectRatio: aspectRatio.replace(":", "/")}}>
          {controller.subtitlesEnabled && <SubtitleOverlay text="Đường về nhà — những câu chuyện đẹp." style={style}
            referenceHeight={renderDimensions(controller.resolution, aspectRatio).height} />}
          {!controller.subtitlesEnabled && <span className="absolute inset-0 grid place-items-center text-muted-foreground">Phụ đề đã tắt</span>}
        </div>
      </figure>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={controller.resetSubtitleStyle}><RotateCcw size={13} />Mặc định</Button>
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-muted-foreground">{subtitleSaveStatus(controller)}</span>
          <Button type="button" disabled={disabled || !controller.subtitleSettingsDirty}
            onClick={() => void controller.saveSubtitleSettings().catch(() => undefined)}><Save size={13} />Lưu tùy chỉnh</Button>
        </div>
      </div>
    </section>
  );
}
