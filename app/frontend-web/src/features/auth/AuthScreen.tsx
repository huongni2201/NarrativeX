import React, { FormEvent, useState } from "react";
import Image from "next/image";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthSessionLifecycle } from "@/features/auth/hooks/useAuthSessionLifecycle";
import { apiErrorMessage } from "@/shared/api/client";

const LOGO_SRC = "/branding/narrativex-logo-dark.png";

export const AuthLoadingScreen: React.FC<{ message: string; action?: React.ReactNode }> = ({
  message,
  action,
}) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#070b14] p-6 text-slate-100">
    <div className="space-y-3 text-center">
      <Image
        src={LOGO_SRC}
        alt="NarrativeX"
        width={240}
        height={64}
        priority
        className="mx-auto h-12 w-auto"
      />
      <p className="text-sm text-slate-300">{message}</p>
      {action}
    </div>
  </div>
);

export const AuthScreen: React.FC = () => {
  const { markAuthenticated } = useAuthSessionLifecycle();
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
      const user =
        mode === "login"
          ? await authApi.login({ email, password })
          : await authApi.register({ displayName, email, password });
      markAuthenticated(user);
    } catch (cause) {
      setError(
        apiErrorMessage(cause, "Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
  };

  const handleGoogleLogin = () => {
    setError(null);
    setIsRedirecting(true);
    window.location.assign(authApi.googleLoginUrl());
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#070b14] text-slate-100 md:flex-row">
      <section className="relative flex min-h-[40vh] flex-col justify-between overflow-hidden bg-slate-950 p-8 md:min-h-screen md:w-1/2 md:p-12 lg:w-3/5">
        <Image
          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#070b14]/40 to-[#070b14]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-black/60" />

        <Image
          src={LOGO_SRC}
          alt="NarrativeX"
          width={280}
          height={72}
          priority
          className="relative z-10 h-14 w-auto self-start object-contain"
        />

        <div className="relative z-10 max-w-lg space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/80 px-3 py-1 text-xs font-semibold tracking-wide text-purple-300">
            <span
              className="h-2 w-2 rounded-full bg-purple-400 motion-safe:animate-pulse"
              aria-hidden="true"
            />
            AI STORY VIDEO STUDIO
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">
            Biến truyện chữ thành video sống động với vai nhân vật nhất quán.
          </h2>
          <p className="text-sm text-slate-300">
            Phân tích cốt truyện, quản lý Character Bible và xây dựng production workflow trên cùng
            một workspace.
          </p>
        </div>
      </section>

      <main className="relative z-10 flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/80 bg-[#0d1420]/90 p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="space-y-2 text-center">
            <Image src={LOGO_SRC} alt="NarrativeX" width={240} height={64} className="mx-auto h-12 w-auto" />
            <h1 className="text-xl font-bold text-white">
              {mode === "login" ? "Đăng nhập NarrativeX" : "Tạo tài khoản NarrativeX"}
            </h1>
            <p className="text-xs text-slate-400">
              {mode === "login"
                ? "Tiếp tục dự án của bạn bằng email hoặc Google."
                : "Tạo tài khoản để bắt đầu sản xuất video AI."}
            </p>
          </div>

          <div
            className="grid grid-cols-2 rounded-lg bg-slate-950/70 p-1 text-sm"
            aria-label="Chế độ xác thực"
          >
            <button
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => switchMode("login")}
              className={`rounded-md px-3 py-2 transition ${mode === "login" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              aria-pressed={mode === "register"}
              onClick={() => switchMode("register")}
              className={`rounded-md px-3 py-2 transition ${mode === "register" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Đăng ký
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-describedby={error ? "auth-error" : undefined}
          >
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
              />
            </label>

            {error && (
              <div
                id="auth-error"
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isRedirecting}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
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
            className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRedirecting ? "Đang chuyển đến Google…" : "Tiếp tục với Google"}
          </button>
        </div>
      </main>
    </div>
  );
};
