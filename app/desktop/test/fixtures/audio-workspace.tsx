import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AudioWorkspaceScreen } from "../../src/renderer/features/voices/screens/AudioWorkspaceScreen";
import { voicesApi } from "../../src/renderer/features/voices/api/voices.api";
import type { DesktopWorkspaceState } from "../../src/renderer/features/workspace/queries/useProjectWorkspace";
import "../../src/renderer/styles.css";

const scenario = new URLSearchParams(location.search).get("scenario");
const profiles: Record<string, { characterRowVersion: number; pinnedVoiceProfileId: string | null; profiles: unknown[] }> = {
  lan: { characterRowVersion: 0, pinnedVoiceProfileId: null, profiles: [] },
  nam: { characterRowVersion: 0, pinnedVoiceProfileId: null, profiles: [] },
};
const presetMetadata = (extra: object) => JSON.stringify({ preset: true, providerVoice: "x", ...extra });
const voices: Array<Record<string, unknown>> = scenario === "no-vieneu" ? [] : [
  { id: "vieneu-default", name: "VieNeu Default", provider: "VIENEU", language: "vi-VN", gender: "NEUTRAL", sampleUrl: null, metadataJson: null },
  { id: "vieneu-preset-minh-duc", name: "Minh Đức", provider: "VIENEU", language: "vi-VN", gender: null, sampleUrl: null, metadataJson: presetMetadata({ region: "north" }) },
  { id: "vieneu-preset-minh-quan-pro", name: "Minh Quân Pro", provider: "VIENEU", language: "vi-VN", gender: null, sampleUrl: null, metadataJson: presetMetadata({ featured: true }) },
];
const referenceStatus = scenario === "reference-rejected" ? "REJECTED" : "READY";

window.narrativex = {
  api: {
    uploadVoiceReference: async () => ({ assetId: "reference-1", status: "VALIDATING", originalFilename: "giong-mau.wav", contentType: "audio/wav", sizeBytes: 2048, checksumSha256: "a".repeat(64) }),
    request: async ({ path, method = "GET", body }: { path: string; method?: string; body?: string }) => {
      const ok = (data: unknown, status = 200) => ({ status, statusText: "OK", bodyText: JSON.stringify({ success: true, message: "OK", timestamp: "2026-10-16T00:00:00Z", data }) });
      const fail = (status: number, message: string) => ({ status, statusText: "Error", bodyText: JSON.stringify({ success: false, message }) });
      if (path === "/api/v1/voices") return ok(voices);
      if (path === "/api/v1/voice-references") return ok([]);
      if (path === "/api/v1/voice-references/reference-1") {
        return ok({ id: "reference-1", originalFilename: "giong-mau.wav", contentType: "audio/wav", sizeBytes: 2048, sha256: "a".repeat(64), status: referenceStatus });
      }
      if (path === "/api/v1/voices/custom" && method === "POST") {
        const input = JSON.parse(body!);
        if (voices.some(voice => String(voice.name).toLowerCase() === String(input.name).toLowerCase())) return fail(409, `Đã có giọng tên '${input.name}'`);
        const voice = { id: `custom-${voices.length}`, name: input.name, provider: "VIENEU", language: "vi-VN", gender: input.gender ?? null, sampleUrl: null,
          metadataJson: JSON.stringify({ custom: true, referenceAssetId: input.referenceAssetId, referenceFilename: "giong-mau.wav", description: input.description }) };
        voices.push(voice);
        sessionStorage.setItem("custom-voice-body", body!);
        return ok(voice, 201);
      }
      const deleted = /^\/api\/v1\/voices\/custom\/([^/]+)$/.exec(path);
      if (deleted && method === "DELETE") {
        const index = voices.findIndex(voice => voice.id === deleted[1]);
        if (index < 0) return fail(404, "Custom voice not found");
        voices.splice(index, 1);
        return ok(null);
      }
      const id = /\/characters\/([^/]+)\/voice-profiles/.exec(path)?.[1];
      if (!id) throw new Error(`Unexpected fixture API: ${path}`);
      if (scenario === "error") return fail(503, "Voice service unavailable");
      if (method === "POST") {
        if (sessionStorage.getItem("fail-voice-save")) return fail(409, "Nhân vật đã thay đổi. Hãy tải lại hồ sơ.");
        const input = JSON.parse(body!);
        const profile = { id: `${id}-voice-${profiles[id]!.profiles.length + 1}`, characterId: id, versionNumber: profiles[id]!.profiles.length + 1, status: "ACTIVE", referenceScope: "GLOBAL_LOCAL", ...input };
        profiles[id]!.profiles.unshift(profile); profiles[id]!.pinnedVoiceProfileId = profile.id; profiles[id]!.characterRowVersion++;
        sessionStorage.setItem("voice-save-count", String(Number(sessionStorage.getItem("voice-save-count") ?? 0) + 1));
        return ok(profile, 201);
      }
      return ok(profiles[id]);
    },
  },
} as unknown as typeof window.narrativex;

function Harness() {
  const voiceQuery = useQuery({ queryKey: ["voices"], queryFn: voicesApi.list });
  const workspace = { status: voiceQuery.isLoading ? "loading" : "ready", projects: [], chapters: [{ id: "chapter", title: "Chương thử" }],
    assets: [], voices: voiceQuery.data ?? [],
    characters: scenario === "empty" ? [] : [{ id: "lan", canonicalName: "Lan", status: "ACTIVE" }, { id: "nam", canonicalName: "Nam", status: "ACTIVE" }],
    presets: [], timeline: null, error: null,
  } as DesktopWorkspaceState;
  return <AudioWorkspaceScreen projectId="fixture" workspace={workspace} />;
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/fixture/audio?tab=characters&characterId=lan"]}><Harness /></MemoryRouter></QueryClientProvider>);
