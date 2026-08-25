export const REPLACE_PROJECT_DIALOG_RESPONSE = 1;

export function shouldProceedWithRestore(
  targetExists: boolean,
  dialogResponse: number | undefined,
): boolean {
  return !targetExists || dialogResponse === REPLACE_PROJECT_DIALOG_RESPONSE;
}
