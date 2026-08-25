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
      <DialogContent className="auth-card auth-modal-card" aria-describedby="auth-modal-description">
        <DialogCloseButton aria-label="Đóng" />
        <img
          src="/branding/narrativex-icon.png"
          alt="NarrativeX"
          width={56}
          height={56}
          className="auth-logo-img"
        />
        <span className="eyebrow">NarrativeX Desktop</span>
        <DialogTitle id="auth-modal-title" className="auth-modal-title">Đăng nhập để dùng tính năng này</DialogTitle>
        <DialogDescription id="auth-modal-description">
          {reason ?? "Tính năng này cần tài khoản NarrativeX."}
        </DialogDescription>
        <p className="auth-preserve-context">
          Sau khi đăng nhập, bạn vẫn ở nguyên project và màn hình đang làm việc.
        </p>
        <Button
          className="auth-login-button"
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
        <div className="auth-security-note">
          <ShieldCheck size={15} />
          <span>
            Google mở trong trình duyệt hệ thống. NarrativeX chỉ nhận mã đăng nhập dùng một lần.
          </span>
        </div>
        {browserOpened && !loginError && !error && (
          <p className="auth-waiting">Hoàn tất đăng nhập trong trình duyệt để tiếp tục.</p>
        )}
        {(loginError || error) && <p className="auth-error">{loginError ?? error}</p>}
      </DialogContent>
    </Dialog>
  );
}
