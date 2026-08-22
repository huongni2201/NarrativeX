import { ExternalLink, ImageIcon, MapPin } from "lucide-react";
import type {
  ApiProjectAsset,
  ApiProjectLocation,
} from "@/features/projects/api/project-resources.types";

interface ProjectResourcesTabProps {
  kind: "characters" | "locations" | "assets";
  locations?: ApiProjectLocation[];
  assets?: ApiProjectAsset[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onOpenLibrary?: () => void;
}

export function ProjectResourcesTab({
  kind,
  locations = [],
  assets = [],
  isLoading = false,
  errorMessage,
  onOpenLibrary,
}: Readonly<ProjectResourcesTabProps>) {
  if (kind === "characters") {
    return (
      <ResourceShell
        title="Nhân vật tham gia dự án"
        description="Nhân vật trong NarrativeX thuộc User/Workspace và tham gia project thông qua ProjectCharacter."
        action="Quản lý Thư viện nhân vật"
        onOpenLibrary={onOpenLibrary}
      />
    );
  }

  if (kind === "locations") {
    return (
      <ResourceShell
        title="Địa điểm & Bối cảnh thế giới"
        description="Dữ liệu dưới đây được tải trực tiếp từ API locations của project."
        isLoading={isLoading}
        errorMessage={errorMessage}
      >
        {locations.length === 0 && !isLoading && !errorMessage ? (
          <EmptyState text="Project chưa có Location nào." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {locations.map((location) => (
              <article key={location.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-white">{location.name}</h4>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        {location.status}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-slate-400">
                      {location.description || "Chưa có mô tả."}
                    </p>
                    {location.visualPrompt && (
                      <p className="line-clamp-3 text-[11px] leading-5 text-slate-500">
                        Visual prompt: {location.visualPrompt}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </ResourceShell>
    );
  }

  return (
    <ResourceShell
      title="Tài sản dự án (Assets)"
      description="Danh sách asset được tải trực tiếp từ API assets của project."
      isLoading={isLoading}
      errorMessage={errorMessage}
    >
      {assets.length === 0 && !isLoading && !errorMessage ? (
        <EmptyState text="Project chưa có Asset nào." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assets.map((asset) => (
            <article key={asset.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start gap-3">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate font-semibold text-white">{asset.name}</h4>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      {asset.assetType}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-500">{asset.mimeType}</p>
                  <p className="truncate text-[11px] text-slate-500">{asset.storageKey}</p>
                  {asset.url && (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:text-orange-300"
                    >
                      Mở asset <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </ResourceShell>
  );
}

function ResourceShell({
  title,
  description,
  action,
  onOpenLibrary,
  isLoading = false,
  errorMessage,
  children,
}: Readonly<{
  title: string;
  description: string;
  action?: string;
  onOpenLibrary?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  children?: React.ReactNode;
}>) {
  return (
    <div className="space-y-4 border-t border-slate-800 p-6 text-xs text-slate-300">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {action && onOpenLibrary && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
          >
            <span>{action}</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400">{description}</p>
      {isLoading && <p className="text-xs text-slate-500">Đang tải dữ liệu từ backend…</p>}
      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-rose-200">
          {errorMessage}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyState({ text }: Readonly<{ text: string }>) {
  return <div className="rounded-xl border border-dashed border-slate-800 p-5 text-slate-500">{text}</div>;
}
