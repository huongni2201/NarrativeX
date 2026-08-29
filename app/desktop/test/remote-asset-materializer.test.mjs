import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RemoteAssetMaterializer } from "../src/main/local-storage/remote-asset-materializer.ts";
import { ProjectStorage } from "../src/main/local-storage/project-storage.ts";

const projectId = "00000000-0000-0000-0000-000000000003";

function backendApi(downloadUrl, requestedPaths = []) {
  return {
    async request({ path }) {
      requestedPaths.push(path);
      if (path.includes("/download-url?")) {
        return { status: 200, bodyText: JSON.stringify({ success: true, data: { url: downloadUrl, filename: "image.png" } }) };
      }
      return { status: 200, bodyText: JSON.stringify({ success: true, data: { id: "asset-1", type: "IMAGE", contentType: "image/png", sizeBytes: 1, sha256: "a".repeat(64), status: "READY" } }) };
    },
  };
}

test("project materialization reuses an already-local character reference without backend handoff", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-local-reference-"));
  const source = join(root, "character.png");
  await writeFile(source, Buffer.from("character-reference"));
  const storage = new ProjectStorage(join(root, "projects"));
  const registered = await storage.registerAsset(projectId, {
    assetId: "asset-1",
    kind: "IMAGE",
    sourcePath: source,
  });
  let requests = 0;
  const materializer = new RemoteAssetMaterializer(storage, {
    async request() {
      requests += 1;
      throw new Error("backend should not be called for an already-local reference");
    },
  });

  try {
    const result = await materializer.materialize({ projectId, assetId: "asset-1" });
    assert.equal(requests, 0);
    assert.deepEqual(result, {
      assetId: registered.assetId,
      kind: registered.kind,
      relativePath: registered.relativePath,
      sizeBytes: registered.sizeBytes,
      checksumSha256: registered.checksumSha256,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chapter narration materialization resolves the project-local audio through its chapter workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "narrativex-chapter-narration-"));
  const storage = new ProjectStorage(join(root, "projects"));
  const chapterId = "00000000-0000-4000-8000-000000000004";
  const assetId = "00000000-0000-4000-8000-000000000005";
  const audioBytes = Buffer.from("generated-chapter-narration");
  const checksumSha256 = createHash("sha256").update(audioBytes).digest("hex");
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBytes.length),
    });
    response.end(audioBytes);
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const audioUrl = `http://127.0.0.1:${address.port}/chapter.mp3`;
  const requestedPaths = [];
  const materializer = new RemoteAssetMaterializer(storage, {
    async request({ path }) {
      requestedPaths.push(path);
      return {
        status: 200,
        bodyText: JSON.stringify({
          success: true,
          data: {
            pipeline: {
              audio: { status: "READY", audioUrl },
            },
          },
        }),
      };
    },
  });

  try {
    const result = await materializer.materializeChapterNarration({
      projectId,
      chapterId,
      assetId,
      sizeBytes: audioBytes.length,
      checksumSha256,
    });

    assert.deepEqual(requestedPaths, [
      `/api/v1/projects/${projectId}/chapters/${chapterId}/workspace`,
    ]);
    assert.equal(result.kind, "AUDIO");
    assert.deepEqual(
      await readFile(await storage.resolveAsset(projectId, assetId)),
      audioBytes,
    );
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("project asset handoff includes project scope and rejects unsafe URLs", async () => {
  const storage = new ProjectStorage("./.test-remote-materializer");
  const requestedPaths = [];
  const materializer = new RemoteAssetMaterializer(
    storage,
    backendApi("http://evil.example/image.png", requestedPaths),
  );
  await assert.rejects(
    materializer.materialize({ projectId, assetId: "asset-1" }),
    /HTTPS outside localhost/i,
  );
  assert.deepEqual(requestedPaths, [
    `/api/v1/assets/asset-1?projectId=${projectId}`,
    `/api/v1/assets/asset-1/download-url?projectId=${projectId}`,
  ]);
});

test("project asset handoff rejects credential-bearing signed URL metadata", async () => {
  const storage = new ProjectStorage("./.test-remote-materializer");
  const materializer = new RemoteAssetMaterializer(storage, backendApi("https://user:password@example.com/image.png"));
  await assert.rejects(materializer.materialize({ projectId, assetId: "asset-1" }), /credentials/i);
});

test("project materialization rejects path-like identifiers before backend lookup", async () => {
  let requests = 0;
  const storage = new ProjectStorage("./.test-remote-materializer");
  const materializer = new RemoteAssetMaterializer(storage, {
    async request() {
      requests += 1;
      return backendApi("https://example.com/image.png").request({ path: "/unused" });
    },
  });
  await assert.rejects(materializer.materialize({ projectId, assetId: "../outside" }), /unsupported characters/i);
  assert.equal(requests, 0);
});
