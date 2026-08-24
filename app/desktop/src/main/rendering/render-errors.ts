export class RenderExecutionError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = true) {
    super(message);
    this.name = "RenderExecutionError";
  }
}
