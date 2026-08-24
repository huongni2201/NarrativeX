export function installNativeWindowControls(): () => void {
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>("button.window-button");
    if (!button) return;

    const controls = window.narrativex?.windowControls;
    if (!controls) return;

    const action = button.getAttribute("aria-label");
    if (action === "Minimize") {
      void controls.minimize();
    } else if (action === "Maximize") {
      void controls.toggleMaximize();
    } else if (action === "Close") {
      void controls.close();
    }
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
