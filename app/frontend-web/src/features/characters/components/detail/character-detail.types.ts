export type DetailTab = "overview" | "visuals" | "appearances" | "assets" | "notes" | "history";

export function formatDateOnly(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeRole(role: string): "MAIN" | "SUPPORTING" | "ANTAGONIST" | "OTHER" {
  const normalized = role.trim().toUpperCase();
  if (normalized === "MAIN" || normalized === "PROTAGONIST" || normalized === "CHÍNH") return "MAIN";
  if (normalized === "SUPPORTING" || normalized === "SECONDARY" || normalized === "PHỤ") return "SUPPORTING";
  if (normalized === "ANTAGONIST" || normalized === "VILLAIN" || normalized === "PHẢN DIỆN" || normalized === "ĐỐI TRỌNG") return "ANTAGONIST";
  return "OTHER";
}

export function roleBadgeStyle(role: string): { label: string; className: string } {
  const norm = normalizeRole(role);
  if (norm === "MAIN") {
    return {
      label: "Chính",
      className: "border-badge-purple-border bg-badge-purple-bg text-badge-purple",
    };
  }
  if (norm === "SUPPORTING") {
    return {
      label: "Phụ",
      className: "border-badge-blue-border bg-badge-blue-bg text-badge-blue",
    };
  }
  if (norm === "ANTAGONIST") {
    return {
      label: "Phản diện",
      className: "border-badge-orange-border bg-badge-orange-bg text-badge-orange",
    };
  }
  return {
    label: role || "Nhân vật",
    className: "border-badge-slate-border bg-badge-slate-bg text-badge-slate",
  };
}
