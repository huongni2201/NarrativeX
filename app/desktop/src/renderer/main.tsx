import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { DesktopApp } from "./app/DesktopApp";
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
          <section className="w-full max-w-xl border-y border-border-subtle py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-warning">Renderer error</p>
            <h1 className="mt-2 text-[16px] font-semibold tracking-tight">NarrativeX chưa tải được giao diện</h1>
            <p className="mt-2 text-[12px] leading-5 text-text-secondary">
              Một lỗi giao diện đã xảy ra. Hãy thử tải lại ứng dụng; chi tiết lỗi đã được ghi vào console.
            </p>
            <pre className="mt-4 max-h-32 overflow-auto border-l-2 border-warning bg-warning-bg p-3 text-[10px] leading-4 text-warning">{this.state.error.message}</pre>
            <button
              type="button"
              className="mt-4 h-8 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              onClick={() => window.location.reload()}
            >
              Tải lại giao diện
            </button>
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
        <DesktopApp />
      </RendererErrorBoundary>
    </TooltipProvider>
  </StrictMode>,
);
