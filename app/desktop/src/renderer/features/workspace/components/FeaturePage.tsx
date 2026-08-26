import type { ReactNode } from "react";

export function FeaturePage({
  eyebrow = "NarrativeX Desktop",
  title,
  description,
  actions,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border-subtle bg-surface-dark px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-text-dim">
              {eyebrow}
            </span>
            <span className="h-3 w-px bg-border-subtle" aria-hidden="true" />
            <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
          </div>
          <p className="mt-1 max-w-3xl truncate text-[10px] text-text-muted">
            {description}
          </p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-h-0 overflow-auto bg-background p-3">{children}</div>
    </div>
  );
}

export function EmptyState({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div className="grid min-h-32 place-items-center rounded-md border border-dashed border-border bg-surface-panel p-6 text-center">
      <div>
        <strong className="text-[11px] font-semibold text-foreground">{title}</strong>
        <p className="mt-1 text-[9px] leading-4 text-text-muted">{description}</p>
      </div>
    </div>
  );
}
