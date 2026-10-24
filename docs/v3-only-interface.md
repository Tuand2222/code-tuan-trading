# Một giao diện v3 duy nhất

Thay đổi này thay thế quyết định giữ hai giao diện trong báo cáo R5/R7 trước đó, theo yêu cầu chủ website.

- Xóa toàn bộ render và chế độ chuyển sang nhật ký cũ trong app/page.tsx; không còn giao diện demo, lịch tháng 8 cố định, biểu mẫu CRUD/import/kết nối hoặc chỉ số cũ trong ứng dụng chính.
- Xóa các component không còn sử dụng: TradingMetrix, SystemTracker, EquityTimeChart. Các trang tương ứng chỉ đọc selectors v3.
- Bỏ banner “Chặng 2” lỗi thời. Kết nối dữ liệu chỉ có trung tâm v3, không còn khối kết nối cũ bên dưới.
- Giữ công cụ Định giá doanh nghiệp hiện tại, bỏ thanh chuyển giao diện khỏi trang này. Không thay đổi công thức định giá.
- Giữ dữ liệu đã lưu trong localStorage/D1/R2 và chức năng chuyển có xem trước/sao lưu ở Cài đặt. Không xóa database, ảnh, migration, lịch sử Git hay API được bảo vệ.
- Đọc dữ liệu cũ chỉ khi mở Cài đặt. Không còn tự đồng bộ broker cũ, seed dữ liệu mẫu hoặc ghi đè localStorage khi mở website.

GitHub nhận commit xóa code trên nhánh PR; không viết lại lịch sử hoặc tự merge main khi chưa có approval theo CONTRIBUTING.

## Nhập tay và trải nghiệm 30 lệnh

Form nhập tay dùng `stageManualTrades` → `commitBatch` → cùng replay/selectors với import. Lưu cả setup, ghi chú, lỗi, review/điểm, 1R hoặc SL ban đầu xác nhận, quy mô hợp đồng và funding có dấu. Xem trước Gross/Net/R trước khi ghi, chuyển sang Nhật ký và lọc tài khoản sau khi lưu.

Trong form có nút xem trước 30 lệnh giả lập. Bộ dữ liệu được tạo khi người dùng bấm và xác nhận lưu, không tự seed khi truy cập. Tài khoản và từng ghi chú ghi rõ MINH HỌA; ứng dụng hiện banner khi phạm vi có dữ liệu giả lập. Một batch duy nhất cho 60 fills / 30 chu kỳ; chống tạo lặp khi batch còn hoạt động và có thể hoàn tác toàn bộ ở Lịch sử nhập. Bộ mẫu là các giao dịch chứng khoán giả lập trong 30 ngày làm việc gần nhất, không phải dữ liệu thị trường hoặc kết quả thật.

Kiểm tra: nhập tay giữ thông tin review xuyên commit/replay/calendar; tỷ giá/quy mô hợp đồng; stop đã dời; 1R dương; 30 chu kỳ có lãi/lỗ, các tổng xuyên trang khớp và hoàn tác về trạng thái trước nhập. Dữ liệu mẫu được lưu trên trình duyệt hiện tại, không tự đồng bộ sang trình duyệt/thiết bị khác.
