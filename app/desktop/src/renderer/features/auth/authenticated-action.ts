export interface AuthenticatedActionGate {
  signedIn: boolean;
  onAuthenticationRequired: (reason: string) => void;
}

const DEFAULT_REASON = "Đăng nhập để sử dụng tính năng này.";
let gate: AuthenticatedActionGate = {
  signedIn: false,
  onAuthenticationRequired: () => undefined,
};

export function configureAuthenticatedActionGate(nextGate: AuthenticatedActionGate): () => void {
  gate = nextGate;
  return () => {
    if (gate === nextGate) {
      gate = { signedIn: false, onAuthenticationRequired: () => undefined };
    }
  };
}

export function runAuthenticatedAction(
  action: () => void,
  reason = DEFAULT_REASON,
): boolean {
  if (!gate.signedIn) {
    gate.onAuthenticationRequired(reason);
    return false;
  }
  action();
  return true;
}
