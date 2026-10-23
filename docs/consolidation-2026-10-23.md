# Hợp nhất web cũ và v6

Ứng dụng chính duy nhất nằm trong `v6/`. Site giữ nguyên tên miền và chuyển `/` về `/v6/`; `/legacy` mở Cài đặt của cùng ứng dụng. Đã bỏ 15 thành phần giao diện cũ bị trùng với các trang nhật ký, thống kê, hệ thống và định giá của v6. Root vẫn giữ lớp hosting, xác thực, API kết nối và các công cụ đọc dữ liệu tương thích.

## Dữ liệu và phục hồi

- Cài đặt → **Đọc dữ liệu web cũ trên thiết bị** đọc IndexedDB v3 bằng một transaction chỉ đọc, không lọc dữ liệu minh họa, không sửa hoặc xóa nguồn cũ.
- **Chọn bản sao để gộp** nhận JSON v3/v4/workspace, kiểm tra checksum và đối chiếu trước khi ghi.
- Lệnh/ghi chú trùng hoàn toàn được giữ một bản. Nếu một sổ có bản ghi cùng ID khác nội dung, toàn bộ đồ thị liên kết của bản nhập được giữ trong sổ lưu trữ riêng. Sổ này không được tự cộng vào tổng của sổ hiện tại.
- Bản gốc đầy đủ được giữ trong nguồn riêng trên thiết bị. Trước khi gộp có workspace backup; commit có kiểm tra phiên bản để tránh ghi đè thay đổi của tab khác. Cơ chế phục hồi dở dang áp dụng cho cả gộp và khôi phục.
- Workspace backup mới giữ thêm cấu hình định giá và khoảng xem hệ thống trong danh sách khóa cho phép; bản sao cũ vẫn đọc được. Không đưa khóa API hoặc bí mật máy chủ vào backup trình duyệt.
- Nguồn đã xác minh trong phiên phục hồi: v3 có 30 lệnh/30 ghi chú; v6 trên máy có cùng 30 lệnh/30 ghi chú; v6 tên miền trống trước phục hồi. D1 `trades` và `trade_images` không có bản ghi. Đây là dữ liệu minh họa. Không dùng fixture hiệu năng hoặc dữ liệu tự tạo làm dữ liệu người dùng.
- Các file sao lưu của người dùng chỉ nằm trong thư mục `outputs/recovery-2026-10-23` của phiên làm việc, không nằm trong repository hoặc tài nguyên website công khai.

## Công cụ được đưa về giao diện chung

- CSV/TSV/TXT/XLSX/XLS/HTML → chọn bảng → ánh xạ cột → xem trước FIFO → xác nhận. Bộ đọc bảng cũ được tách khỏi sổ v3; tính toán và ghi dữ liệu chỉ qua v6. Worker đọc bảng, giữ chuỗi số và hệ ngày Excel 1900/1904. Không dựng khớp vào/ra từ báo cáo tổng hợp.
- Excel toàn bộ sổ gồm lệnh, khớp, ghi chú và dòng tiền, lấy số từ core v6. Thiếu phí/1R giữ trống; số thập phân lưu dạng văn bản và ghi chú được ghi thành chuỗi, không chạy như công thức.
- Định giá, TradingMetrix, System Tracker, biểu đồ, nhiều khớp, review, báo cáo và sao lưu dùng giao diện v6. Các thư viện/parser cũ còn được API hoặc kiểm thử sử dụng được giữ để tránh mất tương thích.

## Giới hạn cần phân biệt

Khôi phục chỉ bảo đảm các nguồn thực sự tìm thấy và đọc được trong trình duyệt/backup hiện tại. Không thể suy ra dữ liệu từng bị xóa khỏi thiết bị hoặc dữ liệu ở trình duyệt khác. Các tài khoản v3 không biểu diễn được chính xác trong schema v4 bị chặn khi preview; bản gốc vẫn giữ nguyên. Chưa tuyên bố mọi hạng mục DoD của đặc tả v6 đều đạt; các giới hạn hiệu năng lạnh và replay/OHLC đã ghi trong `v6/docs/ACCEPTANCE-2026-10-23.md` vẫn còn.
