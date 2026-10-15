import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CSSProperties, PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { useUiPreferencesStore } from "./ui-preferences.store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function DesktopProviders({ children }: PropsWithChildren) {
  const theme = useUiPreferencesStore((state) => state.theme);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        theme={theme}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--foreground)",
            "--normal-border": "var(--border-dark)",
            "--success-bg": "var(--popover)",
            "--success-text": "var(--success)",
            "--success-border": "var(--border-dark)",
            "--error-bg": "var(--popover)",
            "--error-text": "var(--danger)",
            "--error-border": "var(--danger-border)",
            fontFamily: "inherit",
          } as CSSProperties
        }
      />
    </QueryClientProvider>
  );
}
