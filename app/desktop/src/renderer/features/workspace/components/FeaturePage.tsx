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
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <header className="flex items-end justify-between gap-4 border-b border-border bg-card px-5 py-4">
        <div className="min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">
            {eyebrow}
          </span>
          <h1 className="mt-1 text-lg font-semibold">{title}</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-h-0 overflow-auto p-4">{children}</div>
    </div>
  );
}

export function EmptyState({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <div>
        <strong className="text-sm">{title}</strong>
        <p className="mt-1 text-[10px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
