import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import "./styles.css";

class RendererErrorBoundary extends Component<Readonly<{ children: ReactNode }>, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("NarrativeX renderer crashed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid h-full place-items-center bg-background p-6 text-foreground">
          <section className="w-full max-w-xl rounded-lg border border-border bg-surface-panel p-6 shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-warning">Renderer error</p>
            <h1 className="mt-2 text-lg font-semibold">NarrativeX chưa tải được giao diện</h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Một lỗi giao diện đã xảy ra. Hãy thử tải lại ứng dụng; chi tiết lỗi đã được ghi vào console.</p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-surface-2 p-3 text-[10px] text-warning">{this.state.error.message}</pre>
            <button type="button" className="mt-4 h-9 rounded-md bg-primary px-4 text-xs text-primary-foreground" onClick={() => window.location.reload()}>Tải lại giao diện</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={350} skipDelayDuration={100}>
      <RendererErrorBoundary>
        <App />
      </RendererErrorBoundary>
    </TooltipProvider>
  </StrictMode>,
);
