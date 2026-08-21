export function CharacterLibraryUnavailable() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-700 bg-surface/50 p-8">
      <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Character API</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Thư viện nhân vật chưa kết nối</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        Backend chưa expose character, project-character và group endpoints. Production UI không dùng fixture để tránh hiển thị dữ liệu giả.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Data source", "API required"],
          ["Search & filters", "Server-side ready"],
          ["Create / edit", "API pending"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-surface-panel p-4">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
