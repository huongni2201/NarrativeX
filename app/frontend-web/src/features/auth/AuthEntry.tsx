"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLoadingScreen, AuthScreen } from "@/features/auth/AuthScreen";
import { useAuthStore } from "@/store/useAuthStore";

export function AuthEntry() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/projects");
    }
  }, [router, status]);

  if (status === "bootstrapping" || status === "authenticated") {
    return <AuthLoadingScreen message="Đang kiểm tra phiên đăng nhập…" />;
  }

  if (status === "error") {
    return (
      <AuthLoadingScreen
        message={error || "Không thể kiểm tra phiên đăng nhập."}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-purple-300 hover:text-purple-200"
          >
            Thử lại
          </button>
        }
      />
    );
  }

  return <AuthScreen />;
}
