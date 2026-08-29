import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RemoteAssetMaterializer } from "../src/main/local-storage/remote-asset-materializer.ts";
import { ProjectStorage } from "../src/main/local-storage/project-storage.ts";

const projectId = "00000000-0000-0000-0000-000000000003";

function backendApi(downloadUrl) {
  return {
    async request({ path }) {
      if (path.endsWith("/download-url")) {
        return { status: 200, bodyText: JSON.stringify({ success: true, data: { url: downloadUrl, filename: "image.png" } }) };
      }
      return { status: 200, bodyText: JSON.stringify({ success: true, data: { id: "asset-1", type: "IMAGE", contentType: "image/png", sizeBytes: 1, sha256: "a".repeat(64), status: "READY" } }) };
    },
  };
}

test("remote materialization reuses an already-local character reference without backend download", async () => {
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

test("remote materialization rejects URLs that are not safe main-process downloads", async () => {
  const storage = new ProjectStorage("./.test-remote-materializer");
  const materializer = new RemoteAssetMaterializer(storage, backendApi("http://evil.example/image.png"));
  await assert.rejects(
    materializer.materialize({ projectId, assetId: "asset-1", downloadUrl: "https://renderer-controlled.example/file" }),
    /HTTPS outside localhost/i,
  );
});

test("remote materialization rejects credential-bearing signed URL metadata", async () => {
  const storage = new ProjectStorage("./.test-remote-materializer");
  const materializer = new RemoteAssetMaterializer(storage, backendApi("https://user:password@example.com/image.png"));
  await assert.rejects(materializer.materialize({ projectId, assetId: "asset-1" }), /credentials/i);
});

test("remote materialization rejects path-like identifiers before backend lookup", async () => {
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
