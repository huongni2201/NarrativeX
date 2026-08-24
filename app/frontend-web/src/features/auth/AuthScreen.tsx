import React, { useState } from "react";
import Image from "next/image";
import { authApi } from "@/features/auth/api/auth.api";
import { LoadingState } from "@/components/ui/LoadingState";
import { LoaderCircle } from "lucide-react";

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
      <LoadingState message={message} className="text-slate-300" />
      {action}
    </div>
  </div>
);

export const AuthScreen: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleLogin = () => {
    setError(null);
    setIsRedirecting(true);
    try {
      window.location.assign(authApi.googleLoginUrl());
    } catch {
      setIsRedirecting(false);
      setError("Không thể mở Google OAuth. Vui lòng thử lại.");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-text-primary md:flex-row">
      <Image
        src="/branding/auth-bg-wide.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none select-none object-cover"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/30 to-slate-950/70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/40" />

      <section className="relative z-10 flex min-h-[40vh] flex-col justify-between p-8 md:min-h-screen md:w-1/2 lg:w-[52%] md:p-12 xl:p-16">
        <BrandLogo size="lg" className="self-start" />
        <div className="max-w-lg space-y-3">
          <div className="inline-flex items-center rounded-md border border-primary/40 bg-primary-muted/90 px-3 py-1 text-xs font-semibold tracking-wide text-primary-hover backdrop-blur-sm">
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

      <main className="relative z-10 flex flex-1 items-center justify-center p-6 md:p-10 lg:justify-start lg:p-12 lg:pl-16 xl:pl-28">
        <div className="w-full max-w-lg space-y-7 rounded-2xl border border-border/80 bg-surface/95 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="space-y-3 text-center">
            <BrandLogo className="mx-auto" />
            <h1 className="text-2xl font-bold text-white">Đăng nhập NarrativeX</h1>
            <p className="text-sm text-slate-400">
              Sử dụng tài khoản Google để truy cập Story Workspace và Desktop Editor.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-danger/50 bg-danger-bg px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
            aria-busy={isRedirecting}
            className="w-full rounded-xl border border-border bg-surface-3 px-4 py-3.5 text-base font-semibold text-text-primary transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRedirecting && <LoaderCircle className="mr-2 inline-block h-4 w-4 animate-spin" />}
            {isRedirecting ? "Đang chuyển đến Google…" : "Tiếp tục với Google"}
          </button>

          <p className="text-center text-xs leading-5 text-slate-500">
            NarrativeX không lưu mật khẩu. Google quản lý xác thực và bạn có thể thu hồi quyền truy cập bất cứ lúc nào.
          </p>
        </div>
      </main>
    </div>
  );
};
