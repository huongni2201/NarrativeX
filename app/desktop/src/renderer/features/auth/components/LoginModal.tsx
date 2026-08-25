import { useEffect, useState } from "react";
import { LogIn, ShieldCheck, X } from "lucide-react";

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
    <div className="auth-modal-backdrop" role="presentation">
      <section
        className="auth-card auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button type="button" className="auth-modal-close" aria-label="Đóng" onClick={onClose}>
          <X size={17} />
        </button>
        <img
          src="/branding/narrativex-icon.png"
          alt="NarrativeX"
          width={56}
          height={56}
          className="auth-logo-img"
        />
        <span className="eyebrow">NarrativeX Desktop</span>
        <h1 id="auth-modal-title">Đăng nhập để dùng tính năng này</h1>
        <p>{reason ?? "Tính năng này cần tài khoản NarrativeX."}</p>
        <p className="auth-preserve-context">
          Sau khi đăng nhập, bạn vẫn ở nguyên project và màn hình đang làm việc.
        </p>
        <button
          type="button"
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
        </button>
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
      </section>
    </div>
  );
}
