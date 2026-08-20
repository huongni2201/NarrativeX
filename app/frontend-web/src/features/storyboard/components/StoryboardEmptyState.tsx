import { ImageIcon } from "lucide-react";

interface StoryboardEmptyStateProps {
  title: string;
  description: string;
}

export function StoryboardEmptyState({ title, description }: Readonly<StoryboardEmptyStateProps>) {
  return (
    <div className="flex min-h-[330px] items-center justify-center rounded-xl border border-dashed border-border bg-surface-panel px-6 text-center">
      <div>
        <ImageIcon className="mx-auto h-9 w-9 text-slate-700" />
        <h3 className="mt-3 text-sm font-semibold text-slate-300">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
