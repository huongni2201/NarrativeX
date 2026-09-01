const MIN_CAPACITY = 1;
const MAX_CAPACITY = 8;

export interface GeminiWebSlotLease<T> {
  index: number;
  slot: T;
  release(): void;
}

type Waiter<T> = {
  resolve: (lease: GeminiWebSlotLease<T>) => void;
};

export class GeminiWebSlotPool<T> {
  private readonly slots: T[];
  private readonly available: number[];
  private readonly waiters: Array<Waiter<T>> = [];
  private readonly leased = new Set<number>();

  constructor(
    readonly capacity: number,
    createSlot: (index: number) => T,
  ) {
    if (!Number.isInteger(capacity) || capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
      throw new Error("Gemini slot pool capacity must be an integer between 1 and 8.");
    }
    this.slots = Array.from({ length: capacity }, (_, index) => createSlot(index));
    this.available = Array.from({ length: capacity }, (_, index) => index);
  }

  acquire(): Promise<GeminiWebSlotLease<T>> {
    const index = this.available.shift();
    if (index !== undefined) return Promise.resolve(this.createLease(index));
    return new Promise((resolve) => {
      this.waiters.push({ resolve });
    });
  }

  private createLease(index: number): GeminiWebSlotLease<T> {
    this.leased.add(index);
    let released = false;
    return {
      index,
      slot: this.slots[index],
      release: () => {
        if (released) return;
        released = true;
        this.release(index);
      },
    };
  }

  private release(index: number): void {
    if (!this.leased.delete(index)) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(this.createLease(index));
      return;
    }
    this.available.push(index);
    this.available.sort((left, right) => left - right);
  }
}
