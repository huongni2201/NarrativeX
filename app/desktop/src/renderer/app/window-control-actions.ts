export type WindowControlAction = "minimize" | "toggleMaximize" | "close";

export interface NativeWindowControls {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<boolean>;
  close(): Promise<void>;
}

export async function invokeWindowControl(
  controls: NativeWindowControls | undefined,
  action: WindowControlAction,
): Promise<void | boolean> {
  if (!controls) throw new Error("Native window controls are unavailable.");

  if (action === "minimize") return await controls.minimize();
  if (action === "toggleMaximize") return await controls.toggleMaximize();
  return await controls.close();
}
