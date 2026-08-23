import { Button } from "@/components/ui/Button";

interface RenderSettingsProps {
  resolution: "720p" | "1080p";
  onResolutionChange: (resolution: "720p" | "1080p") => void;
  onRender: () => void;
  isLoading: boolean;
  canRender: boolean;
  isReady: boolean;
}

export function RenderSettings({
  resolution,
  onResolutionChange,
  onRender,
  isLoading,
  canRender,
  isReady,
}: Readonly<RenderSettingsProps>) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-slate-300">
        Resolution
        <select
          className="mt-2 block min-h-11 rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          value={resolution}
          onChange={(event) => onResolutionChange(event.target.value as "720p" | "1080p")}
        >
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>
      </label>
      <Button onClick={onRender} isLoading={isLoading} disabled={!canRender}>
        {isLoading ? "Đang gửi render…" : isReady ? "Render lại Chapter" : canRender ? "Render Chapter" : "Approve toàn bộ keyframe để render"}
      </Button>
    </div>
  );
}
