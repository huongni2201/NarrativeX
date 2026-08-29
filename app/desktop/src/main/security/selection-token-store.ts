import { randomUUID } from "node:crypto";

interface Selection<T> {
  senderId: number;
  operation: string;
  value: T;
  expiresAt: number;
}

export class SelectionTokenStore<T> {
  private readonly selections = new Map<string, Selection<T>>();

  create(senderId: number, operation: string, value: T, ttlMs = 5 * 60_000): string {
    const token = randomUUID();
    this.selections.set(token, { senderId, operation, value, expiresAt: Date.now() + ttlMs });
    return token;
  }

  peek(token: string, senderId: number, operation: string): T {
    const selection = this.selections.get(token);
    if (!selection || selection.expiresAt < Date.now()) {
      throw new Error("Local selection expired. Choose the file again.");
    }
    if (selection.senderId !== senderId) throw new Error("Local selection belongs to another window.");
    if (selection.operation !== operation) throw new Error("Local selection cannot be used for this operation.");
    return selection.value;
  }

  consume(token: string, senderId: number, operation: string): T {
    const selection = this.selections.get(token);
    this.selections.delete(token);
    if (!selection || selection.expiresAt < Date.now()) {
      throw new Error("Local selection expired. Choose the file again.");
    }
    if (selection.senderId !== senderId) throw new Error("Local selection belongs to another window.");
    if (selection.operation !== operation) throw new Error("Local selection cannot be used for this operation.");
    return selection.value;
  }
}
