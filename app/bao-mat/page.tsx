import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bảo mật và lưu trữ dữ liệu",
  description: "Cách Trading Plan Pro xử lý nhật ký giao dịch, bản lưu thiết bị, đồng bộ riêng tư và thông tin kết nối broker.",
  alternates: { canonical: "/bao-mat" },
  openGraph: {
    title: "Bảo mật dữ liệu · Trading Plan Pro",
    description: "Giải thích rõ dữ liệu nào ở thiết bị, dữ liệu nào được đồng bộ và cách khóa broker được bảo vệ.",
    url: "/bao-mat",
  },
};

export default function SecurityPage() {
  return (
    <main className="info-page">
      {/* Full reload keeps the hash-based dashboard state stable across runtimes. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="info-back" href="/#settings">← Trở lại Trading Plan Pro</a>
      <header className="info-hero security">
        <span>BẢO MẬT THEO THIẾT KẾ</span>
        <h1>Dữ liệu giao dịch phải riêng tư, có thể sao lưu và không bị trình bày mơ hồ</h1>
        <p>Cập nhật ngày 07/08/2026. Nội dung dưới đây mô tả cách phiên bản hiện tại xử lý dữ liệu; không thay thế thỏa thuận riêng với broker hoặc nền tảng giao dịch.</p>
      </header>

      <section className="info-card">
        <span className="info-kicker">DỮ LIỆU NHẬT KÝ</span>
        <h2>Hai chế độ lưu trữ được hiển thị rõ trong ứng dụng</h2>
        <div className="security-grid">
          <article><strong>Trên thiết bị</strong><p>Dữ liệu nằm trong trình duyệt hiện tại. Xóa dữ liệu trình duyệt hoặc đổi máy có thể làm mất nhật ký, vì vậy người dùng nên xuất bản sao JSON định kỳ.</p></article>
          <article><strong>Đồng bộ riêng tư</strong><p>Khi có danh tính hợp lệ, giao dịch được lưu theo tài khoản trong cơ sở dữ liệu của ứng dụng và chỉ được truy vấn theo người dùng đó.</p></article>
        </div>
      </section>

      <section className="info-card">
        <span className="info-kicker">KẾT NỐI BROKER</span>
        <h2>Khóa broker không được lưu trong localStorage</h2>
        <ul>
          <li>API key, API secret và bridge token được gửi tới máy chủ qua HTTPS.</li>
          <li>Thông tin nhạy cảm được mã hóa AES-GCM trước khi lưu.</li>
          <li>Ứng dụng chỉ yêu cầu quyền đọc lịch sử; người dùng phải tắt quyền Trade và Withdraw.</li>
          <li>Bản sao JSON chỉ chứa giao dịch và ghi chú, không chứa thông tin xác thực broker.</li>
        </ul>
      </section>

      <section className="info-card">
        <span className="info-kicker">TRÁCH NHIỆM NGƯỜI DÙNG</span>
        <h2>Kiểm tra quyền trước khi kết nối</h2>
        <p>Chỉ tạo khóa API riêng cho nhật ký, bật giới hạn IP nếu broker hỗ trợ, không dùng lại mật khẩu và thu hồi khóa ngay khi không còn sử dụng. Không nhập thông tin broker khi ứng dụng đang báo “trên thiết bị” hoặc “cloud chưa sẵn sàng”.</p>
      </section>

      <section className="info-card muted-card">
        <h2>Phạm vi công cụ</h2>
        <p>Trading Plan Pro không đặt lệnh, không rút tiền và không cung cấp khuyến nghị đầu tư cá nhân hóa. Mọi quyết định giao dịch và định giá vẫn thuộc trách nhiệm của người sử dụng.</p>
      </section>
    </main>
  );
}
