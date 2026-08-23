import type { RenderArtifact } from "../api/artifacts.types";

export function RenderPreview({ artifact }: Readonly<{ artifact: RenderArtifact }>) {
  return (
    <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4" aria-labelledby="render-preview-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="render-preview-title" className="text-sm font-semibold text-emerald-200">
            Render preview
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {artifact.width && artifact.height ? `${artifact.width} × ${artifact.height}` : "Kích thước chưa rõ"}
            {artifact.durationMs !== null ? ` · ${formatDuration(artifact.durationMs)}` : ""}
            {artifact.sizeBytes !== null ? ` · ${formatBytes(artifact.sizeBytes)}` : ""}
            {` · ${artifact.mimeType === "video/mp4" ? "MP4" : artifact.mimeType ?? "MP4"}`}
          </p>
        </div>
        {artifact.downloadAvailable && artifact.downloadUrl ? (
          <a
            className="text-sm font-medium text-orange-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={artifact.downloadUrl}
            download
          >
            Tải MP4
          </a>
        ) : null}
      </div>
      {artifact.previewUrl ? (
        <video
          data-testid="render-video"
          className="mt-4 aspect-video w-full rounded-lg bg-surface-dark object-contain"
          controls
          preload="metadata"
          src={artifact.previewUrl}
        >
          Trình duyệt không hỗ trợ phát video.
        </video>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border-dark px-3 py-6 text-center text-sm text-slate-400">
          Preview chưa sẵn sàng cho artifact này.
        </p>
      )}
    </section>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
