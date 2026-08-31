import type { LocalRenderPreflight } from "@narrativex/client-contracts";
import type {
  LocalExecutionStatus,
  LocalRenderPreflightInput,
} from "../../../preload/types";

interface LocalRenderExecutorDependencies {
  status: () => Promise<LocalExecutionStatus>;
  requestPairingCode: () => Promise<{ code: string; expiresAt: string }>;
  pair: (code: string) => Promise<LocalExecutionStatus>;
}

interface LocalRenderPreflightDependencies extends LocalRenderExecutorDependencies {
  preflight: (input: LocalRenderPreflightInput) => Promise<LocalRenderPreflight>;
}

export async function prepareLocalRenderExecutor(
  dependencies: LocalRenderExecutorDependencies,
): Promise<LocalExecutionStatus> {
  let status = await dependencies.status();

  if (status.state === "UNPAIRED") {
    const pairing = await dependencies.requestPairingCode();
    status = await dependencies.pair(pairing.code);
  }

  if (status.state !== "ONLINE" || !status.deviceId) {
    throw new Error(
      status.lastError ?? `Desktop local executor is not online (${status.state}).`,
    );
  }

  return status;
}

export async function runLocalRenderPreflight(
  input: LocalRenderPreflightInput,
  dependencies: LocalRenderPreflightDependencies,
): Promise<LocalRenderPreflight> {
  await prepareLocalRenderExecutor(dependencies);
  return dependencies.preflight(input);
}
