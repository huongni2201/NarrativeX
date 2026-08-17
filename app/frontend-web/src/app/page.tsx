export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 backdrop-blur">
        <h1 className="text-4xl font-bold tracking-tight text-white">NarrativeX</h1>
        <p className="text-xl font-medium text-neutral-300">AI Story Studio</p>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950/80 px-3 py-1 text-sm font-medium text-emerald-400 border border-emerald-800/50">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Frontend is running.
        </div>
      </div>
    </main>
  );
}
