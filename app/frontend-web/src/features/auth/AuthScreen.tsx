import React, { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Sparkles, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export const AuthScreen: React.FC = () => {
  const { authMode, setAuthMode, login } = useStudioStore();
  const [email, setEmail] = useState("you@email.com");
  const [password, setPassword] = useState("••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      login();
    }, 600);
  };

  return (
    <div className="min-h-screen w-full bg-[#070b14] flex flex-col md:flex-row text-slate-100">
      {/* Left Column - Epic Cinematic Fantasy Hero Banner */}
      <div className="relative md:w-1/2 lg:w-3/5 min-h-[40vh] md:min-h-screen bg-slate-950 overflow-hidden flex flex-col justify-between p-8 md:p-12">
        {/* Background Image with Cinematic Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop')`,
          }}
        />
        {/* Dark Vignette & Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#070b14]/40 to-[#070b14]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-black/60" />
        <div className="absolute inset-0 bg-purple-950/20 mix-blend-color" />

        {/* Top Brand Logo on Hero */}
        <div className="relative z-10 flex items-center">
          <img
            src="/branding/narrativex-logo-dark.png"
            alt="NarrativeX Logo"
            className="h-14 w-auto object-contain drop-shadow-[0_0_25px_rgba(124,58,237,0.7)]"
          />
        </div>

        {/* Bottom Hero Tagline */}
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

      {/* Right Column - Auth Card */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <div className="w-full max-w-md space-y-7 bg-[#0d1420]/90 backdrop-blur-xl p-8 rounded-2xl border border-slate-800/80 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img
                src="/branding/narrativex-logo-dark.png"
                alt="NarrativeX Logo"
                className="h-13 w-auto object-contain drop-shadow-[0_0_20px_rgba(124,58,237,0.55)]"
              />
            </div>
            <p className="text-xs text-purple-300 font-medium tracking-wide">AI Story Video Studio</p>
            <p className="text-xs text-slate-400 pt-1">
              {authMode === "login"
                ? "Biến truyện chữ thành video sống động với vai nhân vật nhất quán"
                : "Tạo tài khoản mới để bắt đầu sản xuất phim truyện AI"}
            </p>
          </div>

          {/* Google SSO Button */}
          <button
            type="button"
            onClick={login}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-white text-slate-900 font-semibold text-sm transition-all duration-200 shadow-md active:scale-[0.99]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Đăng nhập với Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-slate-800" />
            <span className="bg-[#0d1420] px-3 text-xs text-slate-500 uppercase tracking-widest absolute font-medium">
              hoặc
            </span>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                icon={<Mail className="w-4 h-4" />}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Mật khẩu</label>
                {authMode === "login" && (
                  <button
                    type="button"
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              {authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </Button>
          </form>

          {/* Footer toggle */}
          <div className="text-center text-xs text-slate-400 pt-2">
            {authMode === "login" ? (
              <p>
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className="text-purple-400 font-semibold hover:text-purple-300 ml-1"
                >
                  Đăng ký
                </button>
              </p>
            ) : (
              <p>
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="text-purple-400 font-semibold hover:text-purple-300 ml-1"
                >
                  Đăng nhập
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
