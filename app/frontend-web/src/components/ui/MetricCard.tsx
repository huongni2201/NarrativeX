type MetricCardProps = { label: string; value: string; detail: string };

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-text-primary">{value}</p>
      <p className="mt-2 text-xs text-text-secondary">{detail}</p>
    </div>
  );
}
