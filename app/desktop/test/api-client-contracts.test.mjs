import assert from "node:assert/strict";
import test from "node:test";
import {
  apiCommand,
  apiRequest,
  DesktopApiError,
  DesktopApiProtocolError,
  resetApiSessionState,
} from "../src/renderer/api/client.ts";
import { parseCursorPage } from "../src/renderer/api/pagination.ts";
import { projectsApi } from "../src/renderer/features/projects/api/projects.api.ts";

const timestamp = "2026-08-26T00:00:00Z";

test("cursor page parser preserves backend pagination metadata", () => {
  const page = parseCursorPage(
    {
      content: [{ id: "item-1" }],
      nextCursor: "cursor-2",
      limit: 20,
      hasNext: true,
    },
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof value.id === "string",
    "invalid page",
  );

  assert.deepEqual(page, {
    content: [{ id: "item-1" }],
    nextCursor: "cursor-2",
    limit: 20,
    hasNext: true,
  });
  assert.throws(
    () =>
      parseCursorPage(
        { content: [], nextCursor: "stale", limit: 20, hasNext: false },
        () => true,
        "invalid page",
      ),
    /invalid page/,
  );
  assert.throws(
    () =>
      parseCursorPage(
        { content: [], nextCursor: null, limit: 20, hasNext: true },
        () => true,
        "invalid page",
      ),
    /invalid page/,
  );
});

test("desktop project api has no backend dashboard synchronization feed", () => {
  assert.equal("list" in projectsApi, false);
});

test("apiCommand accepts ApiResponse<Void> when data is omitted", async () => {
  await withApiTransport(async (input) => {
    if (input.path === "/api/v1/auth/csrf") {
      return ok({
        success: true,
        message: "CSRF token issued",
        data: { token: "csrf-token", headerName: "X-CSRF-TOKEN" },
        timestamp,
      });
    }
    if (input.path === "/api/v1/test-command") {
      assert.equal(input.method, "POST");
      assert.equal(input.headers["x-csrf-token"], "csrf-token");
      return ok({
        success: true,
        message: "Command completed",
        timestamp,
      });
    }
    throw new Error(`Unexpected request ${input.path}`);
  }, async () => {
    await apiCommand("/api/v1/test-command", { method: "POST" });
  });
});

test("projects api deletes a project through the owner-scoped endpoint", async () => {
  await withApiTransport(async (input) => {
    if (input.path === "/api/v1/auth/csrf") {
      return ok({
        success: true,
        message: "CSRF token issued",
        data: { token: "csrf-token", headerName: "X-CSRF-TOKEN" },
        timestamp,
      });
    }
    assert.equal(input.path, "/api/v1/projects/project%2Fwith%2Fslashes");
    assert.equal(input.method, "DELETE");
    assert.equal(input.headers["x-csrf-token"], "csrf-token");
    return { status: 204, statusText: "No Content", bodyText: "" };
  }, async () => {
    await projectsApi.remove("project/with/slashes");
  });
});

test("resetting api session state reloads CSRF for the next mutation", async () => {
  let csrfRequests = 0;
  const mutationTokens = [];

  await withApiTransport(async (input) => {
    if (input.path === "/api/v1/auth/csrf") {
      csrfRequests += 1;
      return ok({
        success: true,
        message: "CSRF token issued",
        data: { token: `csrf-${csrfRequests}`, headerName: "X-CSRF-TOKEN" },
        timestamp,
      });
    }
    if (input.path === "/api/v1/test-command") {
      mutationTokens.push(input.headers["x-csrf-token"]);
      return ok({
        success: true,
        message: "Command completed",
        timestamp,
      });
    }
    throw new Error(`Unexpected request ${input.path}`);
  }, async () => {
    await apiCommand("/api/v1/test-command", { method: "POST" });
    resetApiSessionState();
    await apiCommand("/api/v1/test-command", { method: "POST" });
  });

  assert.equal(csrfRequests, 2);
  assert.deepEqual(mutationTokens, ["csrf-1", "csrf-2"]);
});

test("apiRequest still requires data for data-bearing endpoints", async () => {
  await withApiTransport(async () =>
    ok({
      success: true,
      message: "Missing data",
      timestamp,
    }),
  async () => {
    await assert.rejects(
      () => apiRequest("/api/v1/test-data"),
      DesktopApiProtocolError,
    );
  });
});

test("api errors preserve backend code, correlation id and field violations", async () => {
  await withApiTransport(
    async () => ({
      status: 422,
      statusText: "Unprocessable Entity",
      bodyText: JSON.stringify({
        success: false,
        status: 422,
        code: "VALIDATION_FAILED",
        message: "Request validation failed",
        path: "/api/v1/projects",
        correlationId: "corr-123",
        errors: [
          {
            field: "name",
            code: "NotBlank",
            messageKey: "project.name.required",
            message: "Name is required",
          },
        ],
        timestamp,
      }),
    }),
    async () => {
      await assert.rejects(
        () => apiRequest("/api/v1/projects"),
        (error) => {
          assert.ok(error instanceof DesktopApiError);
          assert.equal(error.status, 422);
          assert.equal(error.code, "VALIDATION_FAILED");
          assert.equal(error.correlationId, "corr-123");
          assert.equal(error.errors?.[0]?.field, "name");
          return true;
        },
      );
    },
  );
});

async function withApiTransport(request, run) {
  const previousWindow = globalThis.window;
  resetApiSessionState();
  globalThis.window = {
    narrativex: {
      api: { request },
    },
  };

  try {
    await run();
  } finally {
    resetApiSessionState();
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

function ok(body) {
  return {
    status: 200,
    statusText: "OK",
    bodyText: JSON.stringify(body),
  };
}
