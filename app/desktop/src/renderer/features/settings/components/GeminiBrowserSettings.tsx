import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Globe2,
  LogIn,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { GeminiBrowserView } from "../../../../preload/types";
import { Button } from "../../../components/ui/button";

const STATUS_LABEL: Record<GeminiBrowserView["authStatus"], string> = {
  CHECKING: "Checking…",
  LOGGED_IN: "Logged in",
  NOT_LOGGED_IN: "Not logged in",
  UNAVAILABLE: "Unavailable",
};

export function GeminiBrowserSettings({
  onNotice,
}: Readonly<{
  onNotice: (message: string) => void;
}>) {
  const [browsers, setBrowsers] = useState<GeminiBrowserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyBrowserId, setBusyBrowserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBrowsers(await window.narrativex.geminiWeb.browsers.list());
    } catch (error) {
      onNotice(errorMessage(error, "Unable to check Gemini browsers."));
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runBrowserAction(
    browserId: string,
    action: () => Promise<GeminiBrowserView[] | void>,
    successMessage?: string,
  ) {
    setBusyBrowserId(browserId);
    try {
      const next = await action();
      if (next) setBrowsers(next);
      else await refresh();
      if (successMessage) onNotice(successMessage);
    } catch (error) {
      onNotice(errorMessage(error, "Unable to update Gemini browser."));
    } finally {
      setBusyBrowserId(null);
    }
  }

  async function addBrowser() {
    setAdding(true);
    try {
      setBrowsers(await window.narrativex.geminiWeb.browsers.add());
      onNotice("Added a new Gemini browser. Sign in when you are ready to use it.");
    } catch (error) {
      onNotice(errorMessage(error, "Unable to add Gemini browser."));
    } finally {
      setAdding(false);
    }
  }

  function resetLogin(browser: GeminiBrowserView) {
    const confirmed = window.confirm(
      `Reset ${browser.name} login? This removes only this browser's saved Chrome login on this device.`,
    );
    if (!confirmed) return;
    void runBrowserAction(
      browser.id,
      () => window.narrativex.geminiWeb.browsers.resetLogin(browser.id),
      `${browser.name} login was reset.`,
    );
  }

  function removeBrowser(browser: GeminiBrowserView) {
    const confirmed = window.confirm(
      `Remove ${browser.name}? This removes this browser profile from NarrativeX on this device. Other browsers are unchanged.`,
    );
    if (!confirmed) return;
    void runBrowserAction(
      browser.id,
      () => window.narrativex.geminiWeb.browsers.remove(browser.id),
      `${browser.name} was removed.`,
    );
  }

  return (
    <section className="overflow-hidden border border-border-subtle bg-surface-panel">
      <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">Gemini</span>
          <h2 className="mt-0.5 text-[13px] font-semibold text-foreground">Gemini Browsers</h2>
          <p className="mt-1 max-w-xl text-[10px] leading-4 text-text-muted">
            Mỗi browser có Chrome profile và phiên đăng nhập riêng. NarrativeX không lưu mật khẩu Google.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || adding}
          onClick={() => void refresh()}
          aria-label="Refresh Gemini browser status"
        >
          <RefreshCw size={14} />
        </Button>
      </header>

      <div className="divide-y divide-border-subtle">
        {loading && browsers.length === 0 ? (
          <div className="px-4 py-4 text-[10px] text-text-muted">Checking browser profiles…</div>
        ) : (
          browsers.map((browser) => {
            const busy = busyBrowserId === browser.id;
            const disabled = busy || browser.authStatus === "CHECKING" || browser.activeLeases > 0;
            return (
              <div
                key={browser.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[28px_minmax(0,1fr)_auto] md:items-center"
              >
                <span className="grid size-7 place-items-center text-text-muted">
                  <Globe2 size={16} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-foreground">{browser.name}</span>
                    <span className={statusClass(browser.authStatus)}>{STATUS_LABEL[browser.authStatus]}</span>
                    {browser.activeLeases > 0 && (
                      <span className="text-[9px] text-text-dim">{browser.activeLeases} active</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[9px] text-text-dim">
                    Independent local Chrome profile · login persists on this device
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {browser.authStatus === "NOT_LOGGED_IN" && (
                    <Button
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        void runBrowserAction(
                          browser.id,
                          () => window.narrativex.geminiWeb.browsers.login(browser.id),
                          `${browser.name} is signed in.`,
                        )
                      }
                    >
                      <LogIn size={13} /> Login
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || browser.authStatus === "CHECKING"}
                    onClick={() =>
                      void runBrowserAction(
                        browser.id,
                        () => window.narrativex.geminiWeb.browsers.open(browser.id),
                      )
                    }
                  >
                    <ExternalLink size={13} /> Open
                  </Button>
                  {browser.authStatus === "LOGGED_IN" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => resetLogin(browser)}
                    >
                      <RotateCcw size={13} /> Reset login
                    </Button>
                  )}
                  {browser.canRemove && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => removeBrowser(browser)}
                    >
                      <Trash2 size={13} /> Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border-subtle px-4 py-3">
        <Button size="sm" variant="outline" disabled={adding} onClick={() => void addBrowser()}>
          <Plus size={14} /> Add browser
        </Button>
      </div>
    </section>
  );
}

function statusClass(status: GeminiBrowserView["authStatus"]): string {
  const base = "rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em]";
  if (status === "LOGGED_IN") return `${base} border-border-subtle text-foreground`;
  return `${base} border-border-subtle text-text-muted`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
