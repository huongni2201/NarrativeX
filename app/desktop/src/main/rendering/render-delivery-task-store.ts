export type RenderDeliveryTaskState = "PENDING" | "DELIVERING" | "FAILED" | "DELIVERED";

export interface RenderDeliveryTask {
  projectId: string;
  jobId: string;
  senderId: number;
  directory: string;
  state: RenderDeliveryTaskState;
  finalPath: string | null;
  lastError: string | null;
}

export class RenderDeliveryTaskStore {
  private readonly tasks = new Map<string, RenderDeliveryTask>();

  bind(input: {
    projectId: string;
    jobId: string;
    senderId: number;
    directory: string;
  }): RenderDeliveryTask {
    const key = taskKey(input.projectId, input.jobId);
    const existing = this.tasks.get(key);
    if (existing) {
      if (existing.senderId !== input.senderId) {
        throw new Error("Render delivery belongs to another window.");
      }
      if (existing.directory !== input.directory) {
        throw new Error("Render delivery destination is already bound for this job.");
      }
      return existing;
    }
    const task: RenderDeliveryTask = {
      ...input,
      state: "PENDING",
      finalPath: null,
      lastError: null,
    };
    this.tasks.set(key, task);
    return task;
  }

  find(projectId: string, jobId: string, senderId: number): RenderDeliveryTask | null {
    const task = this.tasks.get(taskKey(projectId, jobId));
    if (!task) return null;
    if (task.senderId !== senderId) {
      throw new Error("Render delivery belongs to another window.");
    }
    return task;
  }

  begin(projectId: string, jobId: string, senderId: number): RenderDeliveryTask {
    const task = this.require(projectId, jobId, senderId);
    if (task.state === "DELIVERED") return task;
    if (task.state === "DELIVERING") {
      throw new Error("Render delivery is already in progress.");
    }
    task.state = "DELIVERING";
    task.lastError = null;
    return task;
  }

  fail(projectId: string, jobId: string, senderId: number, error: unknown): void {
    const task = this.require(projectId, jobId, senderId);
    if (task.state === "DELIVERED") return;
    task.state = "FAILED";
    task.lastError = error instanceof Error ? error.message : String(error);
  }

  complete(projectId: string, jobId: string, senderId: number, finalPath: string): void {
    const task = this.require(projectId, jobId, senderId);
    task.state = "DELIVERED";
    task.finalPath = finalPath;
    task.lastError = null;
  }

  private require(projectId: string, jobId: string, senderId: number): RenderDeliveryTask {
    const task = this.find(projectId, jobId, senderId);
    if (!task) throw new Error("Render delivery destination is not bound to this job.");
    return task;
  }
}

function taskKey(projectId: string, jobId: string): string {
  return `${projectId}:${jobId}`;
}
