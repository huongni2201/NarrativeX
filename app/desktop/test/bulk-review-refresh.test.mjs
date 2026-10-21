import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { refreshProduction, videoProductionQueryKeys } from "../src/renderer/features/production/queries/production-cache.ts";
import { invalidateVisualBeatReviewQueries } from "../src/renderer/features/storyboard/queries/storyboard.queries.ts";

for (const [name, refresh] of [["Take", refreshProduction], ["chapter", invalidateVisualBeatReviewQueries]]) {
  test(`${name} bulk refresh propagates errors on request and recovers without replaying writes`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = videoProductionQueryKeys.chapterProduction("p", "c");
    client.setQueryData(key, { stale: true });
    let offline = true;
    const observer = new QueryObserver(client, {
      queryKey: key, staleTime: Infinity,
      queryFn: async () => { if (offline) throw new Error("offline"); return { fresh: true }; },
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await assert.rejects(refresh(client, "p", "c", { throwOnError: true }), /offline/);
      assert.deepEqual(client.getQueryData(key), { stale: true });
      assert.equal(client.getQueryState(key).status, "error");
      await refresh(client, "p", "c"); // Existing callers retain their previous behavior.
      offline = false;
      await refresh(client, "p", "c", { throwOnError: true });
      assert.deepEqual(client.getQueryData(key), { fresh: true });
      assert.equal(client.getQueryState(key).status, "success");
    } finally { unsubscribe(); client.clear(); }
  });
}
