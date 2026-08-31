import type { ReactNode } from "react";

export function FeaturePage({
  eyebrow = "NarrativeX Desktop",
  title,
  description,
  actions,
  children,
  contentClassName = "min-h-0 overflow-auto bg-background p-3",
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
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border-subtle bg-surface-dark px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
              {eyebrow}
            </span>
            <span className="h-3 w-px bg-border-subtle" aria-hidden="true" />
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">{title}</h1>
          </div>
          <p className="mt-1 max-w-3xl truncate text-[11px] leading-4 text-text-muted">
            {description}
          </p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

export function EmptyState({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div className="grid min-h-32 place-items-center border-y border-dashed border-border-subtle px-6 py-8 text-center">
      <div className="max-w-sm">
        <strong className="text-[12px] font-semibold text-foreground">{title}</strong>
        <p className="mt-1 text-[11px] leading-4 text-text-muted">{description}</p>
      </div>
    </div>
  );
}
