import { ExternalLink } from "lucide-react";

type ResourceKind = "characters" | "locations" | "assets";

interface ProjectResourcesTabProps {
  kind: ResourceKind;
  onOpenLibrary?: () => void;
}

const resourceContent: Record<ResourceKind, { title: string; description: string; action?: string }> = {
  characters: {
    title: "Nhân vật tham gia dự án",
    description: "Nhân vật trong NarrativeX thuộc quyền sở hữu của User/Workspace và được tham gia vào dự án thông qua ProjectCharacter snapshot bất biến.",
    action: "Quản lý Thư viện nhân vật",
  },
  locations: {
    title: "Địa điểm & Bối cảnh thế giới",
    description: "Địa điểm và bối cảnh (Location Bible) giúp đảm bảo tính nhất quán môi trường qua từng Visual Beat. API đang được hoàn thiện.",
  },
  assets: {
    title: "Tài sản dự án (Assets)",
    description: "Các hình ảnh, video clip, audio âm thanh đã được render và duyệt cho dự án này.",
    action: "Mở Thư viện tài sản",
  },
};

export function ProjectResourcesTab({ kind, onOpenLibrary }: Readonly<ProjectResourcesTabProps>) {
  const content = resourceContent[kind];
  return (
    <div className="space-y-4 border-t border-slate-800 p-6 text-xs text-slate-300">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{content.title}</h3>
        {content.action && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300"
          >
            <span>{content.action}</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400">{content.description}</p>
    </div>
  );
}

