type MetricCardProps = { label: string; value: string; detail: string };

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3b4]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#f5f4ee]">{value}</p>
      <p className="mt-2 text-xs text-[#9ca3b4]">{detail}</p>
    </div>
  );
}
