# code-tuan-trading Security Policy

## Reporting Security Vulnerabilities

Nếu bạn phát hiện lỗ hổng bảo mật, vui lòng **KHÔNG** tạo public issue.

Thay vào đó, vui lòng gửi email cho tôi với chi tiết:
- **Email**: Tuann4224@gmail.com
- **Tiêu đề**: Security Vulnerability Report
- **Chi tiết**: Mô tả lỗ hổng và cách tái tạo

---

## Security Best Practices

### 1. Environment Variables
- ❌ KHÔNG commit `.env` files
- ✅ Dùng `.env.example` cho template
- ✅ Thêm secrets trong GitHub Settings

### 2. Dependencies
- ✅ Giữ dependencies cập nhật
- ✅ Review security advisories
- ✅ Run `npm audit` regularly

### 3. Code Review
- ✅ Tất cả changes đều cần review
- ✅ No direct commits to main
- ✅ Require approvals before merge

### 4. Secrets Management
- ❌ KHÔNG hardcode secrets
- ✅ Dùng GitHub Secrets
- ✅ Rotate keys regularly

### 5. Account Security
- ✅ Mật khẩu được băm bởi Better Auth, không lưu dạng rõ
- ✅ Session dùng cookie `HttpOnly`, `SameSite=Lax` và `Secure` trên HTTPS
- ✅ Journal, ảnh và kết nối broker được truy vấn theo `user_id`
- ✅ OAuth, email khôi phục và Turnstile chỉ đọc secret từ biến môi trường

---

## Supported Versions

| Version | Status |
|---------|--------|
| 1.x     | Current |

---

## Security Updates

Security fixes sẽ được released ASAP khi được phát hiện.

---

**Questions?** Email: Tuann4224@gmail.com
