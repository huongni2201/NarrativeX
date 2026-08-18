import React, { FormEvent, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export const AuthLoadingScreen: React.FC<{
  message: string;
  action?: React.ReactNode;
}> = ({ message, action }) => (
  <div className="min-h-screen w-full bg-[#070b14] flex items-center justify-center text-slate-100 p-6">
    <div className="text-center space-y-3">
      <img src="/branding/narrativex-logo-dark.png" alt="NarrativeX Logo" className="h-12 w-auto mx-auto" />
      <p className="text-sm text-slate-300">{message}</p>
      {action}
    </div>
  </div>
);

export const AuthScreen: React.FC = () => {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = mode === "login"
        ? await api.login({ email, password })
        : await api.register({ displayName, email, password });
      setAuthenticated(user);
    } catch (cause) {
      setError(apiErrorMessage(cause, "Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    setError(null);
    setIsRedirecting(true);
    window.location.assign(api.googleLoginUrl());
  };

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#070b14] flex flex-col md:flex-row text-slate-100">
      <div className="relative md:w-1/2 lg:w-3/5 min-h-[40vh] md:min-h-screen bg-slate-950 overflow-hidden flex flex-col justify-between p-8 md:p-12">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#070b14]/40 to-[#070b14]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-black/60" />
        <div className="absolute inset-0 bg-purple-950/20 mix-blend-color" />

        <div className="relative z-10 flex items-center">
          <img
            src="/branding/narrativex-logo-dark.png"
            alt="NarrativeX Logo"
            className="h-14 w-auto object-contain drop-shadow-[0_0_25px_rgba(124,58,237,0.7)]"
          />
        </div>

        <div className="relative z-10 max-w-lg space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            AI STORY VIDEO STUDIO
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-md">
            Biến truyện chữ thành video sống động với vai nhân vật nhất quán.
          </h2>
          <p className="text-sm text-slate-300">
            Hệ thống phân tích cốt truyện, quản lý Character Bible và dựng visual beats tự động hỗ trợ bởi AI thế hệ mới.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <div className="w-full max-w-md space-y-6 bg-[#0d1420]/90 backdrop-blur-xl p-8 rounded-2xl border border-slate-800/80 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <img
                src="/branding/narrativex-logo-dark.png"
                alt="NarrativeX Logo"
                className="h-13 w-auto object-contain drop-shadow-[0_0_20px_rgba(124,58,237,0.55)]"
              />
            </div>
            <h1 className="text-xl font-bold text-white">
              {mode === "login" ? "Đăng nhập NarrativeX" : "Tạo tài khoản NarrativeX"}
            </h1>
            <p className="text-xs text-slate-400">
              {mode === "login"
                ? "Tiếp tục dự án của bạn bằng email hoặc Google."
                : "Tạo tài khoản để bắt đầu sản xuất video AI."}
            </p>
          </div>

          <div className="grid grid-cols-2 rounded-lg bg-slate-950/70 p-1 text-sm">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-md px-3 py-2 transition ${mode === "login" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`rounded-md px-3 py-2 transition ${mode === "register" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <label className="block space-y-1.5 text-sm">
                <span className="text-slate-300">Tên hiển thị</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  minLength={2}
                  maxLength={160}
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-white outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  placeholder="Tên của bạn"
                />
              </label>
            )}

            <label className="block space-y-1.5 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-white outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="text-slate-300">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-white outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                placeholder="Tối thiểu 8 ký tự"
              />
            </label>

            {error && (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isRedirecting}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Đang xử lý…"
                : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-slate-800" />
            hoặc
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isRedirecting || isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-white text-slate-900 font-semibold text-sm transition-all duration-200 shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            <span>{isRedirecting ? "Đang chuyển đến Google…" : "Tiếp tục với Google"}</span>
          </button>

          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            NarrativeX dùng session bảo mật trên server; mật khẩu không được lưu dạng plain text.
          </p>
        </div>
      </div>
    </div>
  );
};
