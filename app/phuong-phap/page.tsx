import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phương pháp tính chỉ số giao dịch",
  description: "Cách Trading Plan Pro tính tỷ lệ thắng, Profit Factor, kỳ vọng theo R, sụt giảm tối đa và đánh giá độ tin cậy theo cỡ mẫu.",
  alternates: { canonical: "/phuong-phap" },
  openGraph: {
    title: "Phương pháp tính chỉ số · Trading Plan Pro",
    description: "Công thức minh bạch và ngưỡng cỡ mẫu dùng trong nhật ký giao dịch Trading Plan Pro.",
    url: "/phuong-phap",
  },
};

const metrics = [
  ["Tỷ lệ thắng", "Số lệnh có P/L dương ÷ tổng số giao dịch."],
  ["Profit Factor", "Tổng lợi nhuận của lệnh thắng ÷ giá trị tuyệt đối tổng thua lỗ."],
  ["Kỳ vọng mỗi lệnh", "Lợi nhuận ròng ÷ tổng số giao dịch, hiển thị theo tiền."],
  ["Kỳ vọng theo R", "Trung bình của P/L ÷ rủi ro dự kiến trên từng giao dịch."],
  ["Sụt giảm tối đa", "Mức giảm lớn nhất từ một đỉnh vốn đến đáy tiếp theo trên chuỗi giao dịch."],
  ["Hệ số phục hồi", "Lợi nhuận ròng ÷ sụt giảm tối đa."],
  ["Điểm kỷ luật", "Tỷ lệ checklist được tuân thủ trên tất cả giao dịch đã ghi."],
];

export default function MethodologyPage() {
  return (
    <main className="info-page">
      {/* Full reload keeps the hash-based dashboard state stable across runtimes. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="info-back" href="/#overview">← Trở lại Trading Plan Pro</a>
      <header className="info-hero">
        <span>MINH BẠCH PHƯƠNG PHÁP</span>
        <h1>Chỉ số chỉ có ý nghĩa khi công thức và cỡ mẫu được hiểu đúng</h1>
        <p>Trang này giải thích cách Trading Plan Pro tổng hợp nhật ký. Công cụ hỗ trợ review quyết định; không tạo tín hiệu giao dịch và không cam kết lợi nhuận.</p>
      </header>

      <section className="info-card">
        <span className="info-kicker">01 · NGUỒN DỮ LIỆU</span>
        <h2>Tách biệt dữ liệu minh họa và dữ liệu cá nhân</h2>
        <p>Hai mươi giao dịch xuất hiện ở chế độ demo chỉ là dữ liệu giả lập để minh họa giao diện. Khi người dùng bắt đầu nhật ký thật, dữ liệu mẫu được loại khỏi phép tính và không được ghi vào vùng dữ liệu riêng.</p>
      </section>

      <section className="info-card">
        <span className="info-kicker">02 · ĐỊNH NGHĨA</span>
        <h2>Công thức các chỉ số cốt lõi</h2>
        <div className="method-table">
          {metrics.map(([name, formula]) => <div key={name}><strong>{name}</strong><p>{formula}</p></div>)}
        </div>
        <p className="info-note">Nếu nhiều giao dịch cùng ngày không có giờ thực thi, hệ thống sắp xếp tiếp theo mã giao dịch để tất cả màn hình dùng cùng một chuỗi vốn.</p>
      </section>

      <section className="info-card">
        <span className="info-kicker">03 · ĐỘ TIN CẬY</span>
        <h2>Không gọi một kết quả là “lợi thế” khi mẫu còn nhỏ</h2>
        <div className="sample-scale">
          <article><strong>&lt; 20</strong><span>Quan sát sơ bộ</span><p>Chỉ dùng để phát hiện câu hỏi cần kiểm tra thêm.</p></article>
          <article><strong>20–49</strong><span>Đủ mẫu tối thiểu</span><p>Có thể so sánh, nhưng kết luận vẫn mang tính tạm thời.</p></article>
          <article><strong>50–99</strong><span>Đang hình thành</span><p>Kiểm tra thêm theo thị trường, phiên và điều kiện setup.</p></article>
          <article><strong>100+</strong><span>Mạnh hơn</span><p>Vẫn cần theo dõi thay đổi chế độ thị trường và thực thi.</p></article>
        </div>
      </section>

      <section className="info-card">
        <span className="info-kicker">04 · GIỚI HẠN</span>
        <h2>Những gì số liệu không thể thay bạn quyết định</h2>
        <ul>
          <li>Kết quả quá khứ không bảo đảm hiệu suất tương lai.</li>
          <li>Thống kê có thể bị sai lệch nếu bỏ sót lệnh, phí hoặc thay đổi cách ghi dữ liệu.</li>
          <li>Không tăng rủi ro chỉ vì một sản phẩm hoặc setup đang đứng đầu bảng.</li>
          <li>Định giá doanh nghiệp phụ thuộc vào dữ liệu chuẩn hóa và giả định đầu vào.</li>
        </ul>
      </section>
    </main>
  );
}
