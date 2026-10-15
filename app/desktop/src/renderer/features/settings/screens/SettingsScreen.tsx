import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, Cpu, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { DesktopPreferenceResetScope, LocalExecutionStatus } from "../../../../preload/types";
import { Button } from "../../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { cn } from "../../../lib/utils";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import { PromptSettingsPanel } from "../components/PromptSettingsPanel";
import { accountHrefFrom, applicationReturnPath } from "../../accounts/account-navigation";

type ExecutorState = LocalExecutionStatus | "unavailable" | null;

export function SettingsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedReturnTo = applicationReturnPath(location.search);
  const returnTo = requestedReturnTo === "/settings" ? "/projects" : requestedReturnTo;
  const returnLabel = returnTo.startsWith("/projects/") ? "Return to workspace" : "Back to Projects";
  const [executor, setExecutor] = useState<ExecutorState>(null);
  const [preferenceNotice, setPreferenceNotice] = useState<{ text: string; failed: boolean } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    let active = true;
    window.narrativex.localExecution
      .status()
      .then((status) => active && setExecutor(status))
      .catch(() => active && setExecutor("unavailable"));
    const unsubscribe = window.narrativex.localExecution.onStatusChanged((status) => {
      if (active) setExecutor(status);
    });
    window.narrativex.preferences
      .get()
      .then(() => undefined)
      .catch((error) =>
        setPreferenceNotice({
          text: error instanceof Error ? error.message : "Unable to load application settings.",
          failed: true,
        }),
      );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function resetPreferences(scope: DesktopPreferenceResetScope) {
    try {
      await window.narrativex.preferences.reset(scope);
      setPreferenceNotice({
        text: scope === "WINDOW" ? "Window layout reset." : "Application settings reset.",
        failed: false,
      });
    } catch (error) {
      setPreferenceNotice({
        text: error instanceof Error ? error.message : "Unable to reset application settings.",
        failed: true,
      });
    } finally {
      setConfirmingReset(false);
    }
  }

  return (
    <FeaturePage
      eyebrow="Application"
      title="Settings"
      description="Runtime diagnostics and application-scoped Desktop preferences."
      contentClassName="min-h-0 overflow-hidden bg-background p-4 lg:p-5"
      actions={
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="default" onClick={() => navigate(returnTo, { replace: true })}>
            <ArrowLeft size={14} /> {returnLabel}
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => navigate(accountHrefFrom(`${location.pathname}${location.search}`))}
          >
            Account
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="general" className="flex h-full min-h-0 flex-col">
        <TabsList className="mb-4 shrink-0 self-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
        </TabsList>
        <TabsContent value="prompt" className="min-h-0 flex-1">
          <PromptSettingsPanel />
        </TabsContent>
        <TabsContent value="general" className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SettingsGroup
              icon={<Cpu size={16} aria-hidden="true" />}
              title="Runtime"
              description="The local execution environment that runs generation and render jobs on this computer."
            >
              <RuntimeDetails executor={executor} />
            </SettingsGroup>

            <SettingsGroup
              icon={<RotateCcw size={16} aria-hidden="true" />}
              title="Reset"
              description="Restore Desktop application preferences to their defaults."
            >
              <div className="divide-y divide-border-subtle">
                <ResetRow
                  title="Reset window layout"
                  description="Forget the saved size and position and restore the default Desktop layout."
                  action={
                    <Button variant="outline" onClick={() => void resetPreferences("WINDOW")}>
                      Reset layout
                    </Button>
                  }
                />
                <ResetRow
                  title="Reset all application settings"
                  description="Reset every application-scoped Desktop setting."
                  action={
                    confirmingReset ? (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => void resetPreferences("ALL")}>
                          Confirm reset
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => setConfirmingReset(true)}>
                        Reset all
                      </Button>
                    )
                  }
                />
              </div>
              {preferenceNotice && (
                <p
                  role={preferenceNotice.failed ? "alert" : "status"}
                  className={cn(
                    "border-t border-border-subtle px-5 py-3 text-label",
                    preferenceNotice.failed ? "text-danger" : "text-success",
                  )}
                >
                  {preferenceNotice.text}
                </p>
              )}
            </SettingsGroup>
          </div>
        </TabsContent>
      </Tabs>
    </FeaturePage>
  );
}

function SettingsGroup({
  icon,
  title,
  description,
  children,
}: Readonly<{
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-panel">
      <header className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-dark text-text-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-label leading-5 text-text-muted">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

type Tone = "success" | "warning" | "danger" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-surface-3 text-text-muted",
};

function connectionBadge(executor: ExecutorState): { label: string; tone: Tone } {
  if (executor === null) return { label: "Checking…", tone: "neutral" };
  if (executor === "unavailable") return { label: "Unavailable", tone: "danger" };
  switch (executor.state) {
    case "ONLINE":
      return { label: "Online", tone: "success" };
    case "CONNECTING":
      return { label: "Connecting…", tone: "warning" };
    case "UNPAIRED":
      return { label: "Not paired", tone: "warning" };
    default:
      return { label: "Offline", tone: "danger" };
  }
}

function RuntimeDetails({ executor }: Readonly<{ executor: ExecutorState }>) {
  const badge = connectionBadge(executor);
  const status = typeof executor === "object" && executor !== null ? executor : null;

  return (
    <dl className="divide-y divide-border-subtle">
      <DetailRow label="Local executor">
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label font-medium",
            TONE_CLASS[badge.tone],
          )}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {badge.label}
        </span>
      </DetailRow>
      {status && (
        <>
          <DetailRow label="Device ID">
            {status.deviceId ? <CopyableValue value={status.deviceId} label="device ID" /> : <Muted>Not assigned</Muted>}
          </DetailRow>
          <DetailRow label="Backend">
            <span className="block truncate font-mono text-label text-text-secondary" title={status.backendBaseUrl}>
              {status.backendBaseUrl}
            </span>
          </DetailRow>
          <DetailRow label="Project rendering">
            {status.projectRenderEnabled ? "Enabled" : <Muted>Disabled</Muted>}
          </DetailRow>
          <DetailRow label="Unfinished renders">
            <span className="tabular-nums">{status.unfinishedRenderCount.toLocaleString("en-US")}</span>
          </DetailRow>
          <DetailRow label="Capabilities">
            {status.capabilities.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {status.capabilities.map((capability) => (
                  <li
                    key={capability}
                    className="rounded-md border border-border-subtle bg-surface-dark px-2 py-0.5 font-mono text-caption text-text-secondary"
                  >
                    {capability}
                  </li>
                ))}
              </ul>
            ) : (
              <Muted>None reported</Muted>
            )}
          </DetailRow>
          {status.lastError && (
            <DetailRow label="Last error">
              <span className="break-words text-label text-danger">{status.lastError}</span>
            </DetailRow>
          )}
        </>
      )}
    </dl>
  );
}

function DetailRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-4 px-5 py-3">
      <dt className="text-body text-text-muted">{label}</dt>
      <dd className="min-w-0 text-body text-foreground">{children}</dd>
    </div>
  );
}

function Muted({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="text-text-dim">{children}</span>;
}

function CopyableValue({ value, label }: Readonly<{ value: string; label: string }>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate font-mono text-label text-text-secondary" title={value}>
        {value}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        title={copied ? "Copied" : `Copy ${label}`}
        onClick={() => void copy()}
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </Button>
    </span>
  );
}

function ResetRow({
  title,
  description,
  action,
}: Readonly<{ title: string; description: string; action: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
      <div className="min-w-0 flex-1 basis-60">
        <div className="text-body font-medium text-foreground">{title}</div>
        <div className="text-label text-text-muted">{description}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
