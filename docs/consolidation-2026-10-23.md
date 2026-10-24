# Hợp nhất web cũ và v6

Ứng dụng v6 nằm trong `v6/`, mở từ `/` hoặc `/v6/`. Toàn bộ giao diện GitHub gốc được giữ tại `/classic`, gồm kết nối API/bridge, cloud, ảnh, PDF/Excel, ghi chú và cài đặt. Giao diện sổ v3 và bộ nhập nhiều tài khoản được giữ tại `/legacy`. Menu v6 có liên kết trực tiếp đến các công cụ này; lớp hosting, xác thực và API dùng chung repository và DB/R2 hiện tại. Chỉ chuyển một chức năng sang v6 và bỏ bản tương thích sau khi đã đối chiếu đủ luồng người dùng.

## Dữ liệu và phục hồi

- Cài đặt → **Đọc dữ liệu web cũ trên thiết bị** đọc IndexedDB v3 bằng một transaction chỉ đọc, không lọc dữ liệu minh họa, không sửa hoặc xóa nguồn cũ.
- **Chọn bản sao để gộp** nhận JSON v3/v4/workspace, kiểm tra checksum và đối chiếu trước khi ghi.
- Lệnh/ghi chú trùng hoàn toàn được giữ một bản. Nếu một sổ có bản ghi cùng ID khác nội dung, toàn bộ đồ thị liên kết của bản nhập được giữ trong sổ lưu trữ riêng. Sổ này không được tự cộng vào tổng của sổ hiện tại.
- Bản gốc đầy đủ được giữ trong nguồn riêng trên thiết bị. Trước khi gộp có workspace backup; commit có kiểm tra phiên bản để tránh ghi đè thay đổi của tab khác. Cơ chế phục hồi dở dang áp dụng cho cả gộp và khôi phục.
- Workspace backup mới giữ thêm cấu hình định giá và khoảng xem hệ thống trong danh sách khóa cho phép; bản sao cũ vẫn đọc được. Không đưa khóa API hoặc bí mật máy chủ vào backup trình duyệt.
- Nguồn đã xác minh trong phiên phục hồi: v3 có 30 lệnh/30 ghi chú; v6 trên máy có cùng 30 lệnh/30 ghi chú; v6 tên miền trống trước phục hồi. D1 `trades` và `trade_images` không có bản ghi. Đây là dữ liệu minh họa. Không dùng fixture hiệu năng hoặc dữ liệu tự tạo làm dữ liệu người dùng.
- Các file sao lưu của người dùng chỉ nằm trong thư mục `outputs/recovery-2026-10-23` của phiên làm việc, không nằm trong repository hoặc tài nguyên website công khai.

## Công cụ được đưa về giao diện chung

- CSV/TSV/TXT/XLSX/XLS/HTML → chọn bảng → ánh xạ cột → xem trước FIFO → xác nhận. Bộ đọc bảng trong v6 được tách khỏi sổ v3; luồng fills của v6 tính và ghi dữ liệu qua core v6. Bộ nhập nhiều tài khoản, MT4/MT5 và dữ liệu tổng hợp của web trước vẫn có tại `/legacy`. Worker đọc bảng, giữ chuỗi số và hệ ngày Excel 1900/1904. Không dựng khớp vào/ra từ báo cáo tổng hợp.
- Excel toàn bộ sổ gồm lệnh, khớp, ghi chú và dòng tiền, lấy số từ core v6. Thiếu phí/1R giữ trống; số thập phân lưu dạng văn bản và ghi chú được ghi thành chuỗi, không chạy như công thức.
- Định giá, TradingMetrix, System Tracker, biểu đồ, nhiều khớp, review, báo cáo và sao lưu có trong v6. Bản web gốc giữ nguyên giao diện tương ứng, bản Excel 5 sheet, nhập PDF Binance và ảnh cloud. Kết nối API/bridge dùng lại endpoint hiện có, token mã hóa và ownership gốc. Endpoint webhook lấy đúng origin hiện tại. Tự đồng bộ Pull chỉ bật theo lựa chọn trong phiên; đọc cloud có hủy khi đổi tài khoản và giữ/sao lưu dữ liệu thiết bị trước khi thay.

## Phạm vi các sổ

Cloud/web gốc, sổ v3 và sổ v6 có mô hình dữ liệu khác nhau. Chúng cùng website và source nhưng chưa phải một sổ ghi chung. Không tự biến báo cáo tổng hợp thành khớp lệnh hoặc tự chép số thiếu thành 0 vào v6. Dùng xem trước/gộp để chuyển các nguồn v3/v4 biểu diễn được chính xác; luôn giữ nguồn cũ.

## Giới hạn cần phân biệt

Khôi phục chỉ bảo đảm các nguồn thực sự tìm thấy và đọc được trong trình duyệt/backup hiện tại. Không thể suy ra dữ liệu từng bị xóa khỏi thiết bị hoặc dữ liệu ở trình duyệt khác. Các tài khoản v3 không biểu diễn được chính xác trong schema v4 bị chặn khi preview; bản gốc vẫn giữ nguyên. Chưa tuyên bố mọi hạng mục DoD của đặc tả v6 đều đạt; các giới hạn hiệu năng lạnh và replay/OHLC đã ghi trong `v6/docs/ACCEPTANCE-2026-10-23.md` vẫn còn.
