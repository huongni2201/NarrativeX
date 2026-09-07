import type { GeminiQueueState } from "./gemini-queue";

export type GeminiQueueReducer = (state: GeminiQueueState) => GeminiQueueState;

/**
 * Owns the mutable state for one concurrent Gemini queue run.
 *
 * Provider calls may execute in parallel, but every queue transition is applied synchronously
 * against the latest state. This prevents a task that awaited IPC/provider work from restoring a
 * stale queue snapshot over progress committed by another task.
 */
export class GeminiQueueRunController {
  private state: GeminiQueueState;

  constructor(
    initialState: GeminiQueueState,
    private readonly publish: (state: GeminiQueueState) => void,
  ) {
    this.state = initialState;
  }

  current(): GeminiQueueState {
    return this.state;
  }

  update(reducer: GeminiQueueReducer): GeminiQueueState {
    const next = reducer(this.state);
    this.state = next;
    this.publish(next);
    return next;
  }

  replace(next: GeminiQueueState): GeminiQueueState {
    this.state = next;
    this.publish(next);
    return next;
  }
}
