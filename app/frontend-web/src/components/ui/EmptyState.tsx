type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  onAction?: () => void;
};

export function EmptyState({ eyebrow, title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-8">
      <p className="text-xs font-medium text-text-secondary">{eyebrow}</p>
      <h3 className="mt-4 text-2xl font-semibold text-text-primary">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
      <button type="button" onClick={onAction} className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
        {action}
      </button>
    </div>
  );
}
