import { useState } from 'react';
import { useLedger } from '../app/LedgerContext';
export function Welcome() {
  const { repo, revision } = useLedger(),
    [message, setMessage] = useState('');
  return (
    <section className="panel">
      <h2>Trading Plan Pro · Kỷ luật · Kiên định · Tăng trưởng</h2>
      <p>
        Nhật ký đa sổ có lưu cloud theo tài khoản, phân tích từ dữ kiện, giả định được ghi nhãn rõ
        ràng.
      </p>
      <div className="phase-grid">
        <article>
          <h3>Kỷ luật</h3>
          <p>Lập Plan trước phiên, ghi chip ba khâu và giới hạn rủi ro.</p>
        </article>
        <article>
          <h3>Kiên định</h3>
          <p>Review từng lệnh, lưu ảnh và theo dõi Efficiency theo thời gian.</p>
        </article>
        <article>
          <h3>Tăng trưởng</h3>
          <p>Đối chiếu lợi thế theo setup, giữ giả định tách biệt với kết quả thực.</p>
        </article>
      </div>
      <div className="actions">
        <a className="button" href="#settings">
          Tạo sổ của tôi
        </a>
        <a className="button" href="#connections">
          Nhập dữ liệu giao dịch
        </a>
        <button
          onClick={() =>
            void import('../../tests/golden/fixture-30-trades.json?raw')
              .then((m) => repo.importV3(m.default, revision))
              .then(() => {
                location.hash = '#overview';
              })
              .catch(() =>
                setMessage('Sổ minh họa đã có hoặc dữ liệu thay đổi. Mở Tổng quan để xem.'),
              )
          }
        >
          Bắt đầu với 30 lệnh minh họa
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <h3>Bắt đầu trong 3 bước</h3>
      <ol>
        <li>Tạo sổ theo tiền tệ; nhập vốn và quy tắc phí phù hợp.</li>
        <li>Nhập CSV khớp lệnh qua bộ ánh xạ hoặc nhập tay; đối chiếu bản xem trước.</li>
        <li>Review, xem Tổng quan rồi tải backup và thử khôi phục.</li>
      </ol>
      <h3>Câu hỏi thường gặp</h3>
      <details>
        <summary>Dữ liệu ở đâu?</summary>
        <p>
          Bản trên thiết bị dùng IndexedDB. Khi bật Cloud & lịch sử phiên bản, dữ liệu được lưu trên
          máy chủ theo tài khoản, có lịch sử và bản sao tải về. Cần bật đồng bộ trước khi chuyển
          thiết bị.
        </p>
      </details>
      <details>
        <summary>Làm sao tránh mất dữ liệu?</summary>
        <p>
          Xuất backup đầy đủ ra file và thử khôi phục. Quyền lưu bền và offline không thay thế
          backup ngoài trình duyệt. Xóa dữ liệu trình duyệt có thể xóa nhật ký.
        </p>
      </details>
      <details>
        <summary>Monte Carlo có dự báo lợi nhuận không?</summary>
        <p>
          Không. Đây là lấy mẫu lại kết quả đã biết theo giả định, không bảo đảm kết quả tương lai.
        </p>
      </details>
      <details>
        <summary>Binance hỗ trợ gì?</summary>
        <p>
          Có bộ nhập CSV khớp lệnh FIFO cho Spot/Futures, ánh xạ cột và lưu mẫu. Phí khác tiền tệ sổ
          cần quy đổi có bằng chứng trước khi nhập. Position History có bộ nhập riêng; luôn đối
          chiếu bản xem trước và Net trước khi lưu.
        </p>
      </details>
      <h3>Changelog</h3>
      <p>
        Bổ sung nhập FIFO và hoàn tác có kiểm tra phụ thuộc, gộp lệnh, hồ sơ phí theo ngày, Plan,
        OTP, Chartbook, phân tích đa cấp và Monte Carlo. Có PWA ngoại tuyến, báo cáo in/PDF và
        backup kèm ảnh. Biểu đồ nến/replay chờ nguồn OHLC do người dùng lựa chọn.
      </p>
      <h3>Điều khoản sử dụng</h3>
      <p>
        Công cụ ghi chép và phân tích dữ liệu do người dùng cung cấp, không phải tư vấn đầu tư hoặc
        dịch vụ môi giới. Không cam kết lợi nhuận. Người dùng tự kiểm tra dữ liệu, phí, giả định và
        quyền sử dụng nội dung/ảnh đính kèm.
      </p>
    </section>
  );
}
