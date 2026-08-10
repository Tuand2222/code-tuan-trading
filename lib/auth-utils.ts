export const AUTH_PROVIDERS = ["google", "facebook", "apple"] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export function normalizePhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!compact) return null;

  let normalized = compact;
  if (/^0\d+$/.test(normalized)) normalized = `+84${normalized.slice(1)}`;
  else if (/^84\d+$/.test(normalized)) normalized = `+${normalized}`;
  else if (/^\d+$/.test(normalized)) normalized = `+${normalized}`;

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function safeAuthReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "https://trading-plan-pro.local");
    if (url.origin !== "https://trading-plan-pro.local") return "/";
    if (url.pathname.startsWith("/api/auth") || url.pathname === "/dang-nhap") {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function isEmailIdentifier(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
