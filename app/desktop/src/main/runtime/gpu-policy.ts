export function shouldDisableHardwareAcceleration(
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[],
): boolean {
  const configured = env.NARRATIVEX_DISABLE_GPU?.trim().toLowerCase();
  return (
    configured === "1" ||
    configured === "true" ||
    configured === "yes" ||
    argv.includes("--safe-mode") ||
    argv.includes("--disable-gpu")
  );
}
