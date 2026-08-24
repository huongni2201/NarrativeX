export type LocalExecutionConnectionState =
  | "UNPAIRED"
  | "CONNECTING"
  | "ONLINE"
  | "OFFLINE";

export interface LocalExecutionStatus {
  state: LocalExecutionConnectionState;
  backendBaseUrl: string;
  deviceId: string | null;
  capabilities: string[];
  projectRenderEnabled: boolean;
  lastError: string | null;
}

export interface NarrativeXDesktopBridge {
  appVersion(): Promise<string>;
  localExecution: {
    status(): Promise<LocalExecutionStatus>;
    pair(pairingCode: string): Promise<LocalExecutionStatus>;
    unpair(): Promise<LocalExecutionStatus>;
    onStatusChanged(listener: (status: LocalExecutionStatus) => void): () => void;
  };
}
