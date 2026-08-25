import { useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function LoginModal({
  onLogin,
  onClose,
  reason,
  error,
}: Readonly<{
  onLogin: () => Promise<void>;
  onClose: () => void;
  reason?: string;
  error?: string;
}>) {
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [browserOpened, setBrowserOpened] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setLoginError(null);
    try {
      await onLogin();
      setBrowserOpened(true);
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : "Không thể mở trình duyệt đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(420px,calc(100vw-32px))] rounded-xl border-[var(--border)] bg-[var(--surface)] p-7 shadow-2xl" aria-describedby="auth-modal-description">
        <DialogCloseButton aria-label="Đóng" />
        <img
          src="/branding/narrativex-icon.png"
          alt="NarrativeX"
          width={56}
          height={56}
          className="mb-2 size-14 rounded-xl object-contain"
        />
        <span className="block text-[9px] font-bold uppercase tracking-[.13em] text-[var(--text-3)]">NarrativeX Desktop</span>
        <DialogTitle id="auth-modal-title" className="mt-1 text-xl font-semibold text-[var(--text)]">Đăng nhập để dùng tính năng này</DialogTitle>
        <DialogDescription id="auth-modal-description" className="mt-2 text-sm leading-6 text-[var(--text-3)]">
          {reason ?? "Tính năng này cần tài khoản NarrativeX."}
        </DialogDescription>
        <p className="mt-4 text-xs leading-5 text-[var(--text-3)]">
          Sau khi đăng nhập, bạn vẫn ở nguyên project và màn hình đang làm việc.
        </p>
        <Button
          className="mt-5 w-full justify-center"
          onClick={() => void handleLogin()}
          disabled={busy}
        >
          <LogIn size={17} />
          {busy
            ? "Đang mở trình duyệt…"
            : browserOpened
              ? "Mở lại đăng nhập Google"
              : "Tiếp tục với Google"}
        </Button>
        <div className="mt-4 flex gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] p-3 text-[11px] leading-5 text-[var(--text-3)]">
          <ShieldCheck size={15} />
          <span>
            Google mở trong trình duyệt hệ thống. NarrativeX chỉ nhận mã đăng nhập dùng một lần.
          </span>
        </div>
        {browserOpened && !loginError && !error && (
          <p className="mt-3 text-xs text-[var(--cyan)]">Hoàn tất đăng nhập trong trình duyệt để tiếp tục.</p>
        )}
        {(loginError || error) && <p className="mt-3 text-xs text-[var(--danger)]">{loginError ?? error}</p>}
      </DialogContent>
    </Dialog>
  );
}
