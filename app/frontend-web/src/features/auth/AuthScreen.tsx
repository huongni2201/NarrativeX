import React, { FormEvent, useState } from "react";
import Image from "next/image";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthSessionLifecycle } from "@/features/auth/hooks/useAuthSessionLifecycle";
import { apiErrorMessage } from "@/shared/api/client";

const ICON_SRC = "/branding/narrativex-icon-orange-v2.png";

const BrandLogo: React.FC<{ size?: "sm" | "lg"; className?: string }> = ({
  size = "sm",
  className,
}) => {
  const isLarge = size === "lg";

  return (
    <div
      className={`flex items-center gap-2.5 ${className ?? ""}`}
      role="img"
      aria-label="NarrativeX"
    >
      <Image
        src={ICON_SRC}
        alt=""
        width={isLarge ? 56 : 40}
        height={isLarge ? 56 : 40}
        className={`object-contain ${isLarge ? "h-14 w-14" : "h-10 w-10"}`}
        priority
      />
      <span
        className={`font-extrabold tracking-tight text-white ${isLarge ? "text-3xl" : "text-xl"}`}
      >
        Narrative<span className="text-primary-light">X</span>
      </span>
    </div>
  );
};

export const AuthLoadingScreen: React.FC<{ message: string; action?: React.ReactNode }> = ({
  message,
  action,
}) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-background p-6 text-text-primary">
    <div className="space-y-3 text-center">
      <BrandLogo className="mx-auto" />
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
    <div className="relative flex min-h-screen w-full flex-col bg-background text-text-primary md:flex-row overflow-hidden">
      {/* Full-width wide-angle background image */}
      <Image
        src="/branding/auth-bg-wide.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover pointer-events-none select-none"
        aria-hidden="true"
      />
      {/* Dark overlay & gradients for seamless atmosphere and text readability */}
      <div className="absolute inset-0 bg-slate-950/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/30 to-slate-950/70 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/40 pointer-events-none" />

      {/* Left section: Logo & Hero messaging */}
      <section className="relative z-10 flex min-h-[40vh] flex-col justify-between p-8 md:min-h-screen md:w-1/2 lg:w-[52%] md:p-12 xl:p-16">
        <BrandLogo size="lg" className="self-start" />

        <div className="max-w-lg space-y-3">
          <div className="inline-flex items-center rounded-md border border-primary/40 bg-primary-muted/90 backdrop-blur-sm px-3 py-1 text-xs font-semibold tracking-wide text-primary-hover">
            NARRATIVE WORKSPACE
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">
            Biến truyện chữ thành video sống động với vai nhân vật nhất quán.
          </h2>
          <p className="text-sm text-slate-300">
            Phân tích cốt truyện, quản lý Character Bible và chuẩn bị quy trình sản xuất trong một nơi.
          </p>
        </div>
      </section>

      {/* Right section: Auth Card enlarged and shifted slightly rightward */}
      <main className="relative z-10 flex flex-1 items-center justify-center lg:justify-start p-6 md:p-10 lg:p-12 lg:pl-16 xl:pl-28">
        <div className="w-full max-w-lg space-y-7 rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl">
          <div className="space-y-2 text-center">
            <BrandLogo className="mx-auto" />
            <h1 className="text-2xl font-bold text-white">
              {mode === "login" ? "Đăng nhập NarrativeX" : "Tạo tài khoản NarrativeX"}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === "login"
                ? "Tiếp tục dự án của bạn bằng email hoặc Google."
                : "Tạo tài khoản để bắt đầu xây dựng câu chuyện đầu tiên."}
            </p>
          </div>

          <div
            className="grid grid-cols-2 rounded-lg bg-surface-dark p-1 text-sm font-medium"
            aria-label="Chế độ xác thực"
          >
            <button
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => switchMode("login")}
              className={`rounded-md px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === "login" ? "bg-primary text-white font-semibold" : "text-slate-400 hover:text-white"}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              aria-pressed={mode === "register"}
              onClick={() => switchMode("register")}
              className={`rounded-md px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === "register" ? "bg-primary text-white font-semibold" : "text-slate-400 hover:text-white"}`}
            >
              Đăng ký
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            aria-describedby={error ? "auth-error" : undefined}
          >
            {mode === "register" && (
              <label className="block space-y-1.5 text-sm">
                <span className="text-slate-300 font-medium">Tên hiển thị</span>
                <input
                  name="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  minLength={2}
                  maxLength={160}
                  required
                  autoComplete="name"
                  className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-white text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                />
              </label>
            )}
            <label className="block space-y-1.5 text-sm">
              <span className="text-slate-300 font-medium">Email</span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                required
                autoComplete="email"
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-white text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-slate-300 font-medium">Mật khẩu</span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-white text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
              />
            </label>

            {error && (
              <div
                id="auth-error"
                role="alert"
                className="rounded-lg border border-danger/50 bg-danger-bg px-3.5 py-2.5 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isRedirecting}
              className="mt-7 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-primary/20"
            >
              {isSubmitting ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-border" />
            hoặc
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isRedirecting || isSubmitting}
            className="w-full rounded-xl border border-border bg-surface-3 px-4 py-3.5 text-base font-semibold text-text-primary transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRedirecting ? "Đang chuyển đến Google…" : "Tiếp tục với Google"}
          </button>
        </div>
      </main>
    </div>
  );
};
