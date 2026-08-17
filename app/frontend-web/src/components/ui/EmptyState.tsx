type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  onAction?: () => void;
};

export function EmptyState({ eyebrow, title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-[#10131f]/70 p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d9f99d]">{eyebrow}</p>
      <h3 className="display-type mt-4 text-3xl text-[#f5f4ee]">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#9ca3b4]">{description}</p>
      <button type="button" onClick={onAction} className="mt-6 rounded-full bg-[#d9f99d] px-5 py-3 text-sm font-bold text-[#1a2510] transition hover:bg-[#ecfccb] focus:outline-none focus:ring-2 focus:ring-[#d9f99d] focus:ring-offset-2 focus:ring-offset-[#10131f]">
        {action}
      </button>
    </div>
  );
}
