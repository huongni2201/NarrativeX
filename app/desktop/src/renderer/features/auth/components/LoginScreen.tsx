import { useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";

export function LoginScreen({ onLogin, error }: Readonly<{ onLogin: () => Promise<void>; error?: string }>) {
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleLogin() {
    setBusy(true);
    setLoginError(null);
    try {
      await onLogin();
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : "Không thể mở trình duyệt đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <img src="/branding/narrativex-icon-orange-v2.png" alt="NarrativeX" width={56} height={56} className="auth-logo-img" />
        <span className="eyebrow">NarrativeX Desktop</span>
        <h1>Đăng nhập để tiếp tục</h1>
        <p>Google sẽ mở trong trình duyệt hệ thống. NarrativeX không nhúng Google login và không lưu Google token.</p>
        <button type="button" className="auth-login-button" onClick={() => void handleLogin()} disabled={busy}>
          <LogIn size={17} /> {busy ? "Đang mở trình duyệt…" : "Đăng nhập với Google"}
        </button>
        <div className="auth-security-note"><ShieldCheck size={15} /><span>Phiên làm việc được tạo lại trong desktop app qua mã dùng một lần.</span></div>
        {(loginError || error) && <p className="auth-error">{loginError ?? error}</p>}
      </section>
    </main>
  );
}
