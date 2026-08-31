import type { ReactNode } from "react";

export function WorkspacePane({
  children,
  className = "",
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`min-h-0 min-w-0 overflow-hidden bg-background ${className}`}>
      {children}
    </section>
  );
}

export function WorkspaceToolbar({
  children,
  className = "",
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={`flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-dark px-3 py-1.5 ${className}`}
    >
      {children}
    </div>
  );
}

export function PaneHeader({
  title,
  meta,
  actions,
  className = "",
}: Readonly<{
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={`flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-3 py-2 ${className}`}
    >
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold text-foreground">{title}</div>
        {meta ? <div className="mt-0.5 truncate text-[10px] text-text-dim">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function MetricStrip({
  items,
  className = "",
}: Readonly<{
  items: ReadonlyArray<Readonly<{ label: ReactNode; value: ReactNode }>>;
  className?: string;
}>) {
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted ${className}`}>
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <strong className="font-semibold tabular-nums text-text-secondary">{item.value}</strong>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

export function PropertyRow({
  label,
  value,
  className = "",
}: Readonly<{
  label: ReactNode;
  value: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={`grid min-h-8 grid-cols-[minmax(88px,.8fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-border-subtle px-3 py-1.5 last:border-b-0 ${className}`}
    >
      <span className="text-[10px] text-text-muted">{label}</span>
      <div className="min-w-0 text-right text-[11px] text-text-secondary">{value}</div>
    </div>
  );
}

export function StatusIndicator({
  label,
  tone = "neutral",
  className = "",
}: Readonly<{
  label: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
}>) {
  const toneClass = {
    neutral: "bg-text-dim text-text-muted",
    success: "bg-success text-success",
    warning: "bg-warning text-warning",
    danger: "bg-danger text-danger",
    info: "bg-info text-info",
    accent: "bg-primary text-primary-hover",
  }[tone];

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-[10px] font-medium ${toneClass.split(" ")[1]} ${className}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${toneClass.split(" ")[0]}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function InlineNotice({
  children,
  tone = "neutral",
  className = "",
}: Readonly<{
  children: ReactNode;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  className?: string;
}>) {
  const toneClass = {
    neutral: "border-border-dark text-text-muted",
    info: "border-info text-text-secondary",
    warning: "border-warning text-warning",
    danger: "border-danger text-danger",
    success: "border-success text-success",
  }[tone];

  return (
    <div
      className={`border-l-2 bg-surface-panel px-3 py-2 text-[10px] leading-4 ${toneClass} ${className}`}
      role="status"
    >
      {children}
    </div>
  );
}
