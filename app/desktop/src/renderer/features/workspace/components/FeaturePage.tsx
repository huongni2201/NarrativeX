import type { ReactNode } from "react";

export function FeaturePage({
  eyebrow = "NarrativeX Desktop",
  title,
  description,
  actions,
  children,
  contentClassName = "min-h-0 overflow-auto bg-background p-6 lg:p-8",
}: Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}>) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface-dark px-6 lg:px-8 py-3.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">
              {eyebrow}
            </span>
            <span className="h-3 w-px bg-border-subtle" aria-hidden="true" />
            <h1 className="truncate text-[18px] lg:text-[20px] font-bold tracking-tight text-foreground">{title}</h1>
          </div>
          <p className="mt-1 max-w-3xl truncate text-[13px] leading-relaxed text-text-secondary">
            {description}
          </p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </header>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = "",
}: Readonly<{
  title: string;
  description: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={`grid min-h-48 place-items-center rounded-xl border border-dashed border-border/80 bg-surface-dark/30 px-6 py-12 text-center transition-all ${className}`}
    >
      <div className="flex max-w-md flex-col items-center">
        {Icon && (
          <div className="mb-3.5 flex size-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-2/60 text-text-muted shadow-xs">
            <Icon size={22} className="text-text-secondary" />
          </div>
        )}
        <strong className="text-[15px] font-semibold tracking-tight text-foreground">{title}</strong>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{description}</p>
        {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
