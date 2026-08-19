import type { ApiProject } from "@/types/api";

export function ProjectInfoTab({ project }: Readonly<{ project: ApiProject }>) {
  return (
    <div className="border-t border-slate-800 p-6 text-xs leading-relaxed text-slate-300">
      <h3 className="text-sm font-bold text-white">Thông tin dự án &amp; cấu hình</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Tên dự án</span>
          <p className="text-sm font-bold text-white">{project.name}</p>
          <span className="block pt-2 text-[11px] font-semibold uppercase text-slate-400">Mô tả</span>
          <p className="text-xs text-slate-300">{project.description || "Chưa có mô tả."}</p>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Cấu hình production</span>
          <div className="flex flex-wrap gap-2">
            <ValueBadge label="Tỷ lệ" value={project.imageAspectRatio} />
            <ValueBadge label="Nguồn" value={project.sourceLanguage} />
            <ValueBadge label="Thuyết minh" value={project.narrationLanguage} />
            <ValueBadge label="Metadata" value={project.metadataLanguage} />
            <ValueBadge label="Chất lượng" value={project.imageQualityTier} accent />
          </div>
          <span className="block pt-1 text-[11px] font-semibold uppercase text-slate-400">Trạng thái</span>
          <p className="font-mono text-xs text-slate-300">{project.status}</p>
          <span className="block pt-1 text-[11px] font-semibold uppercase text-slate-400">ID Dự án</span>
          <p className="font-mono text-xs text-slate-400">{project.id}</p>
        </div>
      </div>
    </div>
  );
}

function ValueBadge({
  label,
  value,
  accent = false,
}: Readonly<{ label: string; value: string; accent?: boolean }>) {
  return (
    <span
      title={label}
      className={
        accent
          ? "rounded border border-purple-800 bg-purple-950 px-2 py-1 font-mono text-purple-300"
          : "rounded bg-slate-800 px-2 py-1 font-mono text-slate-200"
      }
    >
      {value}
    </span>
  );
}
