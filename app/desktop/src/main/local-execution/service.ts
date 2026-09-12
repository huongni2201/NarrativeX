import type { DesktopBackendApiService } from "../api/backend-api-service";
import { RenderExecutionError, isRenderCancellation, isResumableRenderInterruption, renderFailure } from "./errors";
import type { ProjectRenderer } from "./project-renderer";
import type { LocalExecutionConfig, LocalExecutionIdentity } from "./types";

export class LocalExecutionService {
  private readonly backendClient: DesktopBackendApiService;
  private readonly projectRenderer: ProjectRenderer;
  private readonly config: LocalExecutionConfig;
  private activeRender: { jobId: string; controller: AbortController } | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private renderPollTimer: ReturnType<typeof setInterval> | null = null;
  private sessionEpoch = 0;
  private sessionUserId: string | null = null;

  constructor(
    backendClient: DesktopBackendApiService,
    projectRenderer: ProjectRenderer,
    config: LocalExecutionConfig,
  ) {
    this.backendClient = backendClient;
    this.projectRenderer = projectRenderer;
    this.config = config;
  }

  start(identity: LocalExecutionIdentity): void {
    this.stop();
    this.sessionUserId = identity.userId;
    this.sessionEpoch += 1;
    const epoch = this.sessionEpoch;
    this.heartbeatTimer = setInterval(() => {
      if (!this.sessionIsCurrent(identity, epoch)) return;
      void this.backendClient.heartbeatLocalDevice(identity.deviceToken).catch(() => undefined);
    }, this.config.heartbeatIntervalMs);
    this.renderPollTimer = setInterval(() => {
      if (!this.sessionIsCurrent(identity, epoch)) return;
      void this.pollProjectRender(identity).catch(() => undefined);
    }, this.config.renderPollIntervalMs);
  }

  private sessionIsCurrent(identity: LocalExecutionIdentity, epoch: number): boolean {
    return this.sessionEpoch === epoch && this.sessionUserId === identity.userId;
  }

  private claimSessionIsCurrent(identity: LocalExecutionIdentity, epoch: number): boolean {
    return this.sessionIsCurrent(identity, epoch);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private stopRenderPolling(): void {
    if (this.renderPollTimer !== null) {
      clearInterval(this.renderPollTimer);
      this.renderPollTimer = null;
    }
  }

  private abortActiveRender(reason: RenderExecutionError): void {
    this.activeRender?.controller.abort(reason);
  }

  private async persistCancellation(
    identity: LocalExecutionIdentity,
    claimed: Awaited<ReturnType<DesktopBackendApiService["claimProjectRender"]>> & {},
  ): Promise<void> {
    await this.backendClient
      .cancelProjectRender(identity.deviceToken, claimed.jobId, claimed.leaseToken)
      .catch(() => undefined);
  }

  private async prepareClaimedProjectRender(
    claimed: NonNullable<Awaited<ReturnType<DesktopBackendApiService["claimProjectRender"]>>>,
    signal: AbortSignal,
  ) {
    return this.projectRenderer.prepare(claimed, signal);
  }

  async pollProjectRender(identity: LocalExecutionIdentity) {
    if (this.activeRender !== null) return null;

    const claimEpoch = this.sessionEpoch;
    const claimed = await this.backendClient.claimProjectRender(identity.deviceToken);
    if (!claimed) return null;
    if (!this.claimSessionIsCurrent(identity, claimEpoch)) {
      await this.persistCancellation(identity, claimed);
      return null;
    }

    const controller = new AbortController();
    this.activeRender = { jobId: claimed.jobId, controller };
    let leaseLost = false;
    const leaseTimer = setInterval(() => {
      void this.backendClient
        .heartbeatProjectRender(
          identity.deviceToken,
          claimed.jobId,
          claimed.leaseToken,
        )
        .catch(() => {
          leaseLost = true;
          controller.abort(
            new RenderExecutionError(
              "RENDER_LEASE_LOST",
              "Project render lease was lost.",
              true,
            ),
          );
        });
    }, Math.max(5_000, Math.floor(this.config.heartbeatIntervalMs / 2)));

    try {
      const prepared = await this.prepareClaimedProjectRender(claimed, controller.signal);
      if (leaseLost) {
        throw new RenderExecutionError(
          "RENDER_LEASE_LOST",
          "Project render lease was lost while preparing local assets.",
          true,
        );
      }

      const completion = await this.projectRenderer.render(
        prepared,
        controller.signal,
        async (progress, currentStep) => {
          if (leaseLost) {
            throw new RenderExecutionError(
              "RENDER_LEASE_LOST",
              "Project render lease was lost.",
              true,
            );
          }
          try {
            await this.backendClient.reportProjectRenderProgress(
              identity.deviceToken,
              claimed.jobId,
              claimed.leaseToken,
              progress,
              currentStep,
            );
          } catch (error) {
            leaseLost = true;
            const interruption = new RenderExecutionError(
              "RENDER_LEASE_LOST",
              "Project render lease was lost while reporting progress.",
              true,
              { cause: error },
            );
            controller.abort(interruption);
            throw interruption;
          }
        },
      );

      if (leaseLost) {
        throw new RenderExecutionError(
          "RENDER_LEASE_LOST",
          "Project render lease was lost before completion.",
          true,
        );
      }

      await this.backendClient.completeProjectRender(
        identity.deviceToken,
        claimed.jobId,
        claimed.leaseToken,
        completion,
      );
      return completion;
    } catch (error) {
      if (!leaseLost) {
        if (isRenderCancellation(error)) {
          await this.persistCancellation(identity, claimed);
        } else if (!isResumableRenderInterruption(error)) {
          const failure = renderFailure(error);
          await this.backendClient
            .failProjectRender(
              identity.deviceToken,
              claimed.jobId,
              claimed.leaseToken,
              failure.code,
              failure.retryable,
            )
            .catch(() => undefined);
        }
      }
      throw error;
    } finally {
      clearInterval(leaseTimer);
      if (this.activeRender?.jobId === claimed.jobId) this.activeRender = null;
    }
  }

  cancelProjectRender(jobId: string): boolean {
    if (this.activeRender?.jobId !== jobId) return false;
    this.activeRender.controller.abort(
      new RenderExecutionError("RENDER_CANCELLED", "Render was cancelled.", false),
    );
    return true;
  }

  stop(): void {
    this.sessionEpoch += 1;
    this.sessionUserId = null;
    this.stopHeartbeat();
    this.stopRenderPolling();
    this.abortActiveRender(
      new RenderExecutionError(
        "RENDER_INTERRUPTED",
        "Desktop execution stopped while rendering.",
        true,
      ),
    );
  }
}