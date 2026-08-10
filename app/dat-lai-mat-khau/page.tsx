"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authClient } from "../../lib/auth-client";
import { safeAuthReturnTo } from "../../lib/auth-utils";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [returnTo, setReturnTo] = useState("/");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setToken(params.get("token") ?? "");
      setReturnTo(safeAuthReturnTo(params.get("returnTo")));
    }, 0);
    return () => window.clearTimeout(initializeTimer);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) return setError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    if (password.length < 10) return setError("Mật khẩu mới cần tối thiểu 10 ký tự.");
    if (password !== confirmPassword) return setError("Mật khẩu xác nhận chưa khớp.");

    setSubmitting(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setSubmitting(false);
    if (result.error) return setError(result.error.message || "Không thể đặt lại mật khẩu.");
    setMessage("Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại.");
    window.setTimeout(() => window.location.assign(`/dang-nhap?returnTo=${encodeURIComponent(returnTo)}`), 1200);
  };

  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient-one" /><div className="auth-ambient auth-ambient-two" />
      <section className="auth-card reset-card">
        <Link className="auth-brand" href="/"><span className="auth-brand-mark"><i /><i /><i /><i /><b /></span><span><strong>Trading Plan Pro</strong><small>by Tuan Trader</small></span></Link>
        <div className="auth-heading"><span className="auth-kicker">BẢO MẬT TÀI KHOẢN</span><h1>Tạo mật khẩu mới</h1><p>Dùng mật khẩu riêng, dài ít nhất 10 ký tự và chưa từng dùng ở website khác.</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field"><span>Mật khẩu mới</span><div className="auth-input-wrap"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} required /></div></label>
          <label className="auth-field"><span>Xác nhận mật khẩu mới</span><div className="auth-input-wrap"><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} required /></div></label>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {message && <div className="auth-alert success" role="status">{message}</div>}
          <button className="auth-primary-button" type="submit" disabled={submitting}>{submitting ? "Đang cập nhật…" : "Lưu mật khẩu mới"}</button>
        </form>
        <div className="auth-switch"><p><Link href="/dang-nhap"><ArrowLeft size={14} /> Quay lại đăng nhập</Link></p></div>
        <p className="auth-security-note"><ShieldCheck size={14} /> Sau khi đổi mật khẩu, các phiên đăng nhập cũ sẽ bị thu hồi.</p>
      </section>
    </main>
  );
}
