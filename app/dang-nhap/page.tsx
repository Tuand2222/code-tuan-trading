"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { authClient } from "../../lib/auth-client";
import {
  isEmailIdentifier,
  normalizePhoneNumber,
  safeAuthReturnTo,
  type AuthProvider,
} from "../../lib/auth-utils";

type AuthMode = "login" | "register" | "forgot";

type Capabilities = {
  providers: Record<AuthProvider, boolean>;
  resetPassword: boolean;
  turnstileSiteKey: string | null;
};

const EMPTY_CAPABILITIES: Capabilities = {
  providers: { google: false, facebook: false, apple: false },
  resetPassword: false,
  turnstileSiteKey: null,
};

const PROVIDER_COPY: Record<AuthProvider, { label: string; mark: string }> = {
  google: { label: "Google", mark: "G" },
  facebook: { label: "Facebook", mark: "f" },
  apple: { label: "Apple", mark: "●" },
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

function TurnstileBox({ siteKey, onToken }: { siteKey: string | null; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "flexible",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-tpp-turnstile="true"]');
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.tppTurnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, onToken]);

  if (!siteKey) {
    return (
      <div className="captcha-placeholder" aria-label="Bảo vệ chống bot đang chờ cấu hình">
        <span className="captcha-checkbox"><ShieldCheck size={15} /></span>
        <div><strong>Bảo vệ đăng nhập</strong><small>Turnstile sẽ tự bật khi khóa bảo vệ được cấu hình.</small></div>
        <span className="captcha-status">Đang chờ cấu hình</span>
      </div>
    );
  }

  return <div className="turnstile-container" ref={containerRef} />;
}

function PasswordField({ value, onChange, label = "Mật khẩu", autoComplete = "current-password" }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-input-wrap">
        <LockKeyhole size={17} />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={10}
          maxLength={128}
          placeholder="Tối thiểu 10 ký tự"
          required
        />
        <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}

export default function SignInPage() {
  const { data: currentSession, isPending: sessionPending } = authClient.useSession();
  const [mode, setMode] = useState<AuthMode>("login");
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("/");

  const captchaHeaders = useMemo(
    () => (captchaToken ? { "x-captcha-response": captchaToken } : undefined),
    [captchaToken],
  );

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedMode = params.get("mode");
      if (requestedMode === "register" || requestedMode === "forgot") setMode(requestedMode);
      setReturnTo(safeAuthReturnTo(params.get("returnTo")));
      if (params.get("error")) setError("Không thể hoàn tất đăng nhập. Vui lòng thử lại hoặc chọn phương thức khác.");
    }, 0);

    void fetch("/api/auth/capabilities", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<Capabilities> : EMPTY_CAPABILITIES)
      .then(setCapabilities)
      .catch(() => setCapabilities(EMPTY_CAPABILITIES));
    return () => window.clearTimeout(initializeTimer);
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    const params = new URLSearchParams();
    if (nextMode !== "login") params.set("mode", nextMode);
    if (returnTo !== "/") params.set("returnTo", returnTo);
    window.history.replaceState(null, "", `/dang-nhap${params.size ? `?${params}` : ""}`);
  };

  const signInSocial = async (provider: AuthProvider) => {
    if (!capabilities.providers[provider]) {
      setError(`${PROVIDER_COPY[provider].label} chưa được quản trị viên cấu hình.`);
      return;
    }
    setError("");
    await authClient.signIn.social({
      provider,
      callbackURL: returnTo,
      errorCallbackURL: `/dang-nhap?error=oauth&returnTo=${encodeURIComponent(returnTo)}`,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (capabilities.turnstileSiteKey && !captchaToken) {
      setError("Vui lòng hoàn tất kiểm tra chống bot.");
      return;
    }
    if (mode === "register" && !acceptedTerms) {
      setError("Vui lòng đồng ý điều khoản và chính sách bảo mật.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "forgot") {
        if (!capabilities.resetPassword) {
          setError("Dịch vụ gửi email đặt lại mật khẩu chưa được cấu hình.");
          return;
        }
        const result = await authClient.requestPasswordReset({
          email: email.trim().toLowerCase(),
          redirectTo: "/dat-lai-mat-khau",
          fetchOptions: captchaHeaders ? { headers: captchaHeaders } : undefined,
        });
        if (result.error) throw new Error(result.error.message || "Không thể gửi yêu cầu");
        setMessage("Nếu email tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu trong ít phút.");
        return;
      }

      if (mode === "register") {
        const normalizedPhone = phone.trim() ? normalizePhoneNumber(phone) : null;
        if (phone.trim() && !normalizedPhone) {
          setError("Số điện thoại chưa đúng định dạng. Ví dụ: 0912 345 678.");
          return;
        }
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phoneNumber: normalizedPhone ?? undefined,
          callbackURL: returnTo,
          fetchOptions: captchaHeaders ? { headers: captchaHeaders } : undefined,
        });
        if (result.error) throw new Error(result.error.message || "Không thể tạo tài khoản");
        window.location.assign(returnTo);
        return;
      }

      const cleanIdentifier = identifier.trim();
      const result = isEmailIdentifier(cleanIdentifier)
        ? await authClient.signIn.email({
            email: cleanIdentifier.toLowerCase(),
            password,
            rememberMe,
            fetchOptions: captchaHeaders ? { headers: captchaHeaders } : undefined,
          })
        : await authClient.signIn.phoneNumber({
            phoneNumber: normalizePhoneNumber(cleanIdentifier) ?? cleanIdentifier,
            password,
            rememberMe,
            fetchOptions: captchaHeaders ? { headers: captchaHeaders } : undefined,
          });
      if (result.error) throw new Error(result.error.message || "Thông tin đăng nhập chưa chính xác");
      window.location.assign(returnTo);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const configuredProviders = (Object.keys(PROVIDER_COPY) as AuthProvider[]).filter((provider) => capabilities.providers[provider]);

  if (!sessionPending && currentSession?.user) {
    return (
      <main className="auth-page">
        <div className="auth-ambient auth-ambient-one" /><div className="auth-ambient auth-ambient-two" />
        <section className="auth-card signed-in-card">
          <Link className="auth-brand" href="/"><span className="auth-brand-mark"><i /><i /><i /><i /><b /></span><span><strong>Trading Plan Pro</strong><small>by Tuan Trader</small></span></Link>
          <div className="signed-in-avatar">{currentSession.user.image ? <img src={currentSession.user.image} alt="" /> : <UserRound size={28} />}</div>
          <span className="auth-kicker">TÀI KHOẢN ĐANG HOẠT ĐỘNG</span>
          <h1>Xin chào, {currentSession.user.name}</h1>
          <p>{currentSession.user.email}</p>
          <Link className="auth-primary-button" href={returnTo}>Tiếp tục vào nhật ký</Link>
          <button className="auth-secondary-button" type="button" onClick={async () => { await authClient.signOut(); window.location.reload(); }}>Đăng xuất</button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient-one" /><div className="auth-ambient auth-ambient-two" />
      <Link className="auth-back" href="/"><ArrowLeft size={16} /> Về Trading Plan Pro</Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/"><span className="auth-brand-mark"><i /><i /><i /><i /><b /></span><span><strong>Trading Plan Pro</strong><small>by Tuan Trader</small></span></Link>

        <div className="auth-heading">
          <span className="auth-kicker">NHẬT KÝ GIAO DỊCH CỦA BẠN</span>
          <h1 id="auth-title">{mode === "login" ? "Chào mừng trở lại" : mode === "register" ? "Tạo tài khoản mới" : "Quên mật khẩu?"}</h1>
          <p>{mode === "login" ? "Đăng nhập để đồng bộ nhật ký an toàn trên mọi thiết bị." : mode === "register" ? "Một tài khoản riêng cho dữ liệu, hình ảnh và kết nối broker của bạn." : "Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết khôi phục."}</p>
        </div>

        {mode !== "forgot" && (
          <>
            {configuredProviders.length > 0 ? <div className="social-auth-grid">
              {configuredProviders.map((provider) => (
                <button
                  type="button"
                  key={provider}
                  className={`social-auth-button social-${provider}`}
                  onClick={() => void signInSocial(provider)}
                  aria-disabled={!capabilities.providers[provider]}
                  title={capabilities.providers[provider] ? `Tiếp tục với ${PROVIDER_COPY[provider].label}` : `${PROVIDER_COPY[provider].label} cần cấu hình OAuth`}
                >
                  <span>{PROVIDER_COPY[provider].mark}</span>{PROVIDER_COPY[provider].label}
                </button>
              ))}
            </div> : <div className="auth-provider-note"><ShieldCheck size={17} /><span><strong>Đăng nhập nhanh đang được hoàn thiện</strong><small>Hiện bạn có thể đăng nhập an toàn bằng email hoặc số điện thoại.</small></span></div>}
            <div className="auth-divider"><span>hoặc tiếp tục bằng tài khoản</span></div>
          </>
        )}

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label className="auth-field"><span>Họ và tên</span><div className="auth-input-wrap"><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Tên hiển thị của bạn" required /></div></label>
          )}

          {mode === "login" ? (
            <label className="auth-field"><span>Email hoặc số điện thoại</span><div className="auth-input-wrap"><Mail size={17} /><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" inputMode="email" placeholder="email@example.com hoặc 0912 345 678" required /></div></label>
          ) : (
            <label className="auth-field"><span>Email</span><div className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="email@example.com" required /></div></label>
          )}

          {mode === "register" && (
            <label className="auth-field"><span>Số điện thoại <small>(không bắt buộc)</small></span><div className="auth-input-wrap"><Phone size={17} /><input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="0912 345 678" /></div></label>
          )}

          {mode !== "forgot" && <PasswordField value={password} onChange={setPassword} autoComplete={mode === "register" ? "new-password" : "current-password"} />}
          {mode === "register" && <PasswordField value={confirmPassword} onChange={setConfirmPassword} label="Xác nhận mật khẩu" autoComplete="new-password" />}

          {mode === "login" && (
            <div className="auth-options"><label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Ghi nhớ đăng nhập</span></label><button type="button" onClick={() => changeMode("forgot")}>Quên mật khẩu?</button></div>
          )}
          {mode === "register" && (
            <label className="terms-check"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>Tôi đồng ý với <Link href="/bao-mat">chính sách bảo mật</Link> và điều khoản sử dụng.</span></label>
          )}

          <TurnstileBox siteKey={capabilities.turnstileSiteKey} onToken={setCaptchaToken} />

          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {message && <div className="auth-alert success" role="status">{message}</div>}

          <button className="auth-primary-button" type="submit" disabled={submitting}>
            {submitting ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : mode === "register" ? "Tạo tài khoản" : "Gửi liên kết khôi phục"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? <p>Chưa có tài khoản? <button type="button" onClick={() => changeMode("register")}>Đăng ký miễn phí</button></p> : <p><button type="button" onClick={() => changeMode("login")}><ArrowLeft size={14} /> Quay lại đăng nhập</button></p>}
        </div>
        <p className="auth-security-note"><ShieldCheck size={14} /> Mật khẩu được băm an toàn; phiên đăng nhập dùng cookie HttpOnly và dữ liệu được tách theo từng tài khoản.</p>
      </section>
    </main>
  );
}
