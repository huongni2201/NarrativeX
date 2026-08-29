export function runBackgroundRefresh(
  refresh: () => Promise<void>,
  onFailure: (error: unknown) => void,
): void {
  void Promise.resolve().then(refresh).catch(onFailure);
}
