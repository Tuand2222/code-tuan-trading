import { env, waitUntil } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, phoneNumber } from "better-auth/plugins";
import { getDb } from "../db";
import { account, authRateLimit, session, user, verification } from "../db/schema";
import { AUTH_PROVIDERS, normalizePhoneNumber, type AuthProvider } from "./auth-utils";

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

function configuredPair(values: RuntimeEnv, idKey: string, secretKey: string) {
  const clientId = values[idKey]?.trim();
  const clientSecret = values[secretKey]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getAuthCapabilities() {
  const values = runtimeEnv();
  const providers = Object.fromEntries(
    AUTH_PROVIDERS.map((provider) => [
      provider,
      Boolean(
        configuredPair(
          values,
          `${provider.toUpperCase()}_CLIENT_ID`,
          `${provider.toUpperCase()}_CLIENT_SECRET`,
        ),
      ),
    ]),
  ) as Record<AuthProvider, boolean>;

  return {
    providers,
    resetPassword: Boolean(values.RESEND_API_KEY && values.AUTH_EMAIL_FROM),
    turnstileSiteKey: values.TURNSTILE_SITE_KEY?.trim() || null,
  };
}

async function sendResetEmail(input: { email: string; name: string; url: string }) {
  const values = runtimeEnv();
  const apiKey = values.RESEND_API_KEY?.trim();
  const from = values.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Đặt lại mật khẩu Trading Plan Pro",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#17202a"><h2>Đặt lại mật khẩu</h2><p>Xin chào ${escapeHtml(input.name)},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu Trading Plan Pro. Liên kết này có hiệu lực trong 60 phút.</p><p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">Tạo mật khẩu mới</a></p><p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p></div>`,
    }),
  });

  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function getAuth(request?: Request) {
  const values = runtimeEnv();
  const requestOrigin = request ? new URL(request.url).origin : null;
  const baseURL = values.BETTER_AUTH_URL?.trim() || requestOrigin || "http://localhost:3000";
  const secret = values.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not configured");

  const google = configuredPair(values, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  const facebook = configuredPair(values, "FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET");
  const apple = configuredPair(values, "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET");
  const resetEmailReady = Boolean(values.RESEND_API_KEY && values.AUTH_EMAIL_FROM);
  const turnstileSecret = values.TURNSTILE_SECRET_KEY?.trim();
  const trustedOrigins = [
    baseURL,
    ...(values.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];

  return betterAuth({
    appName: "Trading Plan Pro",
    baseURL,
    secret,
    trustedOrigins,
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: { user, session, account, verification, authRateLimit },
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      ...(resetEmailReady
        ? {
            sendResetPassword: async ({ user: accountUser, url }: { user: { email: string; name: string }; url: string }) => {
              waitUntil(sendResetEmail({
                email: accountUser.email,
                name: accountUser.name || accountUser.email,
                url,
              }));
            },
          }
        : {}),
    },
    socialProviders: {
      ...(google ? { google } : {}),
      ...(facebook ? { facebook } : {}),
      ...(apple ? { apple } : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
      modelName: "authRateLimit",
    },
    advanced: {
      cookiePrefix: "trading_plan_pro",
      useSecureCookies: baseURL.startsWith("https://"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      database: { generateId: "uuid" },
    },
    plugins: [
      phoneNumber({
        sendOTP: async () => {
          throw new Error("SMS verification is not configured");
        },
        requireVerification: false,
        phoneNumberValidator: (value) => normalizePhoneNumber(value) === value,
      }),
      ...(turnstileSecret
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: turnstileSecret,
              endpoints: ["/sign-up/email", "/sign-in/email", "/sign-in/phone-number", "/request-password-reset"],
            }),
          ]
        : []),
    ],
  });
}
