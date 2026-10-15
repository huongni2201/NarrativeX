import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Check, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { PromptSettings, PromptStyleProfile } from "../../../../shared/api-types";
import { DesktopApiError } from "../../../api/client.ts";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { cn } from "../../../lib/utils";
import {
  MAX_PROMPT_BLOCK_BYTES,
  PROMPT_REVISION_CONFLICT_CODE,
  addStyle,
  clonePromptSettings,
  isPromptDraftDirty,
  removeStyle,
  resetToDefaults,
  updateInstruction,
  updateStyle,
  utf8Bytes,
  validatePromptDraft,
  type PromptInstructionKey,
} from "../model/prompt-settings-draft.ts";
import { usePromptSettings, useSavePromptSettings } from "../queries/prompt-settings.queries.ts";

const INSTRUCTION_FIELDS: ReadonlyArray<{ key: PromptInstructionKey; label: string; help: string }> = [
  {
    key: "chapterAnalysis",
    label: "Chapter analysis",
    help: "Extra guidance for story analysis. The response schema and safety rules stay fixed.",
  },
  {
    key: "characterReference",
    label: "Character reference",
    help: "Bullet points added to character reference prompts. Identity locks stay fixed.",
  },
  {
    key: "storyboard",
    label: "Storyboard images",
    help: "Framing and composition guidance for storyboard frames.",
  },
  {
    key: "video",
    label: "Video",
    help: "Motion guidance appended to shot video prompts.",
  },
];

const VIDEO_NEGATIVE_LABEL = "Video negative prompt";
const VIDEO_NEGATIVE_HELP = "Sent with every video generation.";

type StyleTextKey = "positivePrompt" | "negativePrompt" | "characterRenderingPrompt";

const STYLE_FIELDS: ReadonlyArray<{
  key: StyleTextKey;
  label: string;
  help: string;
  required?: boolean;
  wide?: boolean;
}> = [
  { key: "positivePrompt", label: "Positive prompt", help: "Describes the look of every image.", required: true },
  { key: "characterRenderingPrompt", label: "Character rendering", help: "How characters are drawn in this style." },
  { key: "negativePrompt", label: "Negative prompt", help: "What the image must avoid.", wide: true },
];

const STYLE_PREFIX = "style:";
const INSTRUCTION_PREFIX = "instruction:";
const VIDEO_NEGATIVE_TAB = "videoNegative";

const styleTab = (id: string) => `${STYLE_PREFIX}${id}`;
const instructionTab = (key: PromptInstructionKey) => `${INSTRUCTION_PREFIX}${key}`;

function isInstructionKey(value: string): value is PromptInstructionKey {
  return INSTRUCTION_FIELDS.some((field) => field.key === value);
}

/** Falls back to the active style when the selected section no longer exists (e.g. after Discard). */
function resolveTab(selected: string, draft: PromptSettings): string {
  if (selected === VIDEO_NEGATIVE_TAB) return selected;
  if (selected.startsWith(INSTRUCTION_PREFIX) && isInstructionKey(selected.slice(INSTRUCTION_PREFIX.length))) {
    return selected;
  }
  if (selected.startsWith(STYLE_PREFIX) && draft.styles.some((style) => style.id === selected.slice(STYLE_PREFIX.length))) {
    return selected;
  }
  return styleTab(draft.activeStyleId);
}

function styleChanged(style: PromptStyleProfile, saved: PromptSettings): boolean {
  const base = saved.styles.find((candidate) => candidate.id === style.id);
  return (
    !base ||
    base.name !== style.name ||
    base.positivePrompt !== style.positivePrompt ||
    base.negativePrompt !== style.negativePrompt ||
    base.characterRenderingPrompt !== style.characterRenderingPrompt
  );
}

export function PromptSettingsPanel() {
  const query = usePromptSettings();
  const save = useSavePromptSettings();
  const saved = query.data?.settings;
  const [draft, setDraft] = useState<PromptSettings | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [saveError, setSaveError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saveRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (saved && draft === null) {
      setDraft(clonePromptSettings(saved));
      setSelected(styleTab(saved.activeStyleId));
    }
  }, [saved, draft]);

  // Ctrl/Cmd+S saves from anywhere on the page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const dirty = isPromptDraftDirty(draft, saved);
  const problems = useMemo(() => (draft ? validatePromptDraft(draft) : []), [draft]);

  if (query.isPending) {
    return <p className="text-label text-text-muted">Loading prompt settings…</p>;
  }
  if (query.isError || !query.data || !draft || !saved) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-label text-destructive">
          {query.error instanceof Error ? query.error.message : "Unable to load prompt settings."}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const defaults = query.data.defaults;
  const currentTab = resolveTab(selected, draft);
  const editingStyle = currentTab.startsWith(STYLE_PREFIX)
    ? (draft.styles.find((style) => style.id === currentTab.slice(STYLE_PREFIX.length)) ?? null)
    : null;
  const canSave = dirty && problems.length === 0 && !save.isPending;

  function edit(next: PromptSettings) {
    setDraft(next);
    setNotice(null);
    setSaveError(null);
  }

  function onSave() {
    if (!draft || !canSave) return;
    setSaveError(null);
    save.mutate(draft, {
      onSuccess: (view) => {
        setDraft(clonePromptSettings(view.settings));
        setNotice(`Saved as revision ${view.settings.revision}. New operations will use it.`);
      },
      onError: (error) => {
        const conflict = error instanceof DesktopApiError && error.code === PROMPT_REVISION_CONFLICT_CODE;
        setSaveError({
          conflict,
          message: conflict
            ? "These settings changed since you opened them. Reload the latest version to continue; your unsaved edits will be discarded."
            : error instanceof Error
              ? error.message
              : "Unable to save prompt settings.",
        });
      },
    });
  }
  saveRef.current = onSave;

  async function onReload() {
    const result = await query.refetch();
    if (result.data) {
      setDraft(clonePromptSettings(result.data.settings));
      setSelected(styleTab(result.data.settings.activeStyleId));
      setSaveError(null);
      setNotice("Reloaded the latest saved settings.");
    }
  }

  function onAddStyle() {
    if (!draft) return;
    const next = addStyle(draft, editingStyle?.id ?? null);
    edit(next);
    setSelected(styleTab(next.styles[next.styles.length - 1].id));
  }

  function onRemoveStyle(styleId: string) {
    if (!draft) return;
    const next = removeStyle(draft, styleId);
    edit(next);
    setSelected(styleTab(next.activeStyleId));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border-subtle bg-surface-panel px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-body text-text-secondary">
            Applies to every project. Queued and retried work keeps the prompts it started with.
          </p>
          <p className="font-mono text-caption text-text-dim">
            Revision {saved.revision} · {query.data.effectiveHash.slice(0, 12)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span role="status" className="mr-1 inline-flex items-center gap-1.5 text-label text-warning">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : (
            notice && (
              <span role="status" className="mr-1 inline-flex items-center gap-1.5 text-label text-success">
                <Check size={14} aria-hidden="true" />
                {notice}
              </span>
            )
          )}
          <Button
            variant="ghost"
            disabled={save.isPending}
            onClick={() => edit(resetToDefaults(draft, defaults))}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset to defaults
          </Button>
          <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => edit(clonePromptSettings(saved))}>
            Discard changes
          </Button>
          <Button disabled={!canSave} onClick={onSave} title="Save (Ctrl+S)">
            <Save size={14} aria-hidden="true" /> {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {saveError && (
        <div role="alert" className="rounded-md border border-danger-border bg-danger-bg px-4 py-2.5 text-label text-danger">
          <p>{saveError.message}</p>
          {saveError.conflict && (
            <Button className="mt-2" size="sm" variant="outline" onClick={() => void onReload()}>
              Reload latest
            </Button>
          )}
        </div>
      )}
      {problems.length > 0 && (
        <ul
          role="alert"
          className="list-disc space-y-0.5 rounded-md border border-danger-border bg-danger-bg py-2.5 pl-8 pr-4 text-label text-danger"
        >
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <TabsPrimitive.Root
        orientation="vertical"
        value={currentTab}
        onValueChange={setSelected}
        className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-panel md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-1"
      >
        <nav
          aria-label="Prompt sections"
          className="flex max-h-56 min-h-0 flex-col gap-4 overflow-y-auto border-b border-border-subtle bg-surface-dark/50 p-3 md:max-h-none md:border-b-0 md:border-r"
        >
          <section>
            <div className="mb-1 flex items-center justify-between pl-2">
              <h2 className="text-label font-semibold text-text-dim">Image styles</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add style"
                title="Add style (copies the selected one)"
                disabled={draft.styles.length >= 32}
                onClick={onAddStyle}
              >
                <Plus size={15} aria-hidden="true" />
              </Button>
            </div>
            <TabsPrimitive.List aria-label="Image styles" className="flex flex-col gap-0.5">
              {draft.styles.map((style) => (
                <SectionTrigger
                  key={style.id}
                  value={styleTab(style.id)}
                  label={style.name || style.id}
                  inUse={style.id === draft.activeStyleId}
                  modified={styleChanged(style, saved)}
                />
              ))}
            </TabsPrimitive.List>
          </section>

          <section>
            <h2 className="mb-1 pl-2 text-label font-semibold text-text-dim">Instructions</h2>
            <TabsPrimitive.List aria-label="Instructions" className="flex flex-col gap-0.5">
              {INSTRUCTION_FIELDS.map((field) => (
                <SectionTrigger
                  key={field.key}
                  value={instructionTab(field.key)}
                  label={field.label}
                  modified={draft.instructions[field.key] !== saved.instructions[field.key]}
                />
              ))}
              <SectionTrigger
                value={VIDEO_NEGATIVE_TAB}
                label={VIDEO_NEGATIVE_LABEL}
                modified={draft.videoNegativePrompt !== saved.videoNegativePrompt}
              />
            </TabsPrimitive.List>
          </section>
        </nav>

        <TabsPrimitive.Content
          value={currentTab}
          className="min-h-0 overflow-y-auto p-5 outline-none lg:p-6"
        >
          {editingStyle ? (
            <StyleEditor
              style={editingStyle}
              defaultStyle={defaults.styles.find((style) => style.id === editingStyle.id)}
              inUse={editingStyle.id === draft.activeStyleId}
              canRemove={draft.styles.length > 1}
              onChange={(patch) => edit(updateStyle(draft, editingStyle.id, patch))}
              onUse={() => edit({ ...draft, activeStyleId: editingStyle.id })}
              onRemove={() => onRemoveStyle(editingStyle.id)}
            />
          ) : currentTab === VIDEO_NEGATIVE_TAB ? (
            <div className="flex h-full min-h-72 flex-col">
              <PromptField
                grow
                id="prompt-video-negative"
                label={VIDEO_NEGATIVE_LABEL}
                help={VIDEO_NEGATIVE_HELP}
                value={draft.videoNegativePrompt}
                defaultValue={defaults.videoNegativePrompt}
                onChange={(value) => edit({ ...draft, videoNegativePrompt: value })}
              />
            </div>
          ) : (
            INSTRUCTION_FIELDS.filter((field) => instructionTab(field.key) === currentTab).map((field) => (
              <div key={field.key} className="flex h-full min-h-72 flex-col">
                <PromptField
                  grow
                  id={`prompt-instruction-${field.key}`}
                  label={field.label}
                  help={field.help}
                  value={draft.instructions[field.key]}
                  defaultValue={defaults.instructions[field.key]}
                  onChange={(value) => edit(updateInstruction(draft, field.key, value))}
                />
              </div>
            ))
          )}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </div>
  );
}

function SectionTrigger({
  value,
  label,
  inUse = false,
  modified = false,
}: Readonly<{ value: string; label: string; inUse?: boolean; modified?: boolean }>) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-body text-text-muted outline-none transition-[background-color,color] duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=active]:bg-primary-muted data-[state=active]:text-foreground data-[state=active]:shadow-[inset_2px_0_0_var(--primary)]"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {inUse && <span className="shrink-0 text-caption font-medium text-primary">In use</span>}
      {modified && (
        <>
          <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
          <span className="sr-only">(unsaved changes)</span>
        </>
      )}
    </TabsPrimitive.Trigger>
  );
}

function StyleEditor({
  style,
  defaultStyle,
  inUse,
  canRemove,
  onChange,
  onUse,
  onRemove,
}: Readonly<{
  style: PromptStyleProfile;
  defaultStyle: PromptStyleProfile | undefined;
  inUse: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<PromptStyleProfile, "id">>) => void;
  onUse: () => void;
  onRemove: () => void;
}>) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="w-full max-w-sm space-y-1.5">
          <label htmlFor={`style-name-${style.id}`} className="block text-body font-medium text-foreground">
            Style name
          </label>
          <Input
            id={`style-name-${style.id}`}
            value={style.name}
            autoComplete="off"
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-caption text-text-dim" title="Style id">
            {style.id}
          </span>
          <Button variant={inUse ? "outline" : "default"} disabled={inUse} onClick={onUse}>
            {inUse ? (
              <>
                <Check size={14} aria-hidden="true" /> In use for new operations
              </>
            ) : (
              "Use for new operations"
            )}
          </Button>
          <Button variant="destructive" disabled={!canRemove} onClick={onRemove}>
            <Trash2 size={14} aria-hidden="true" /> Delete style
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {STYLE_FIELDS.map((field) => (
          <div key={field.key} className={cn("flex flex-col", field.wide && "lg:col-span-2")}>
            <PromptField
              id={`style-${style.id}-${field.key}`}
              label={field.label}
              help={field.help}
              required={field.required}
              minHeightClass={field.wide ? "min-h-32" : "min-h-56"}
              value={style[field.key]}
              defaultValue={defaultStyle?.[field.key]}
              onChange={(value) => onChange({ [field.key]: value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptField({
  id,
  label,
  help,
  value,
  defaultValue,
  required = false,
  grow = false,
  minHeightClass = "min-h-56",
  onChange,
}: Readonly<{
  id: string;
  label: string;
  help: string;
  value: string;
  defaultValue?: string;
  required?: boolean;
  grow?: boolean;
  minHeightClass?: string;
  onChange: (value: string) => void;
}>): ReactNode {
  const bytes = utf8Bytes(value);
  const tooLong = bytes > MAX_PROMPT_BLOCK_BYTES;
  const missing = required && !value.trim();
  const canRestore = defaultValue !== undefined && defaultValue !== value;

  return (
    <div className={cn("flex min-h-0 flex-col gap-1.5", grow && "flex-1")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="block text-body font-medium text-foreground">
            {label}
            {required && <span className="ml-1.5 font-normal text-text-dim">Required</span>}
          </label>
          <p id={`${id}-help`} className="text-caption text-text-dim">
            {help}
          </p>
        </div>
        {canRestore && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange(defaultValue)}>
            <RotateCcw size={13} aria-hidden="true" /> Restore default
          </Button>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        spellCheck={false}
        aria-describedby={`${id}-help ${id}-count`}
        aria-invalid={tooLong || missing || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-md border border-input bg-surface-input px-3.5 py-3 text-body leading-6 text-foreground outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-border-dark focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 aria-[invalid=true]:border-danger-border",
          grow ? "min-h-0 flex-1 resize-none" : cn("resize-y", minHeightClass),
        )}
      />
      <p
        id={`${id}-count`}
        className={cn("text-right text-caption tabular-nums", tooLong ? "text-danger" : "text-text-dim")}
      >
        {bytes.toLocaleString("en-US")} / {MAX_PROMPT_BLOCK_BYTES.toLocaleString("en-US")} bytes
      </p>
    </div>
  );
}
