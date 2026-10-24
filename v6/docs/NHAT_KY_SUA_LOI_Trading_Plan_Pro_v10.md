# Nhật ký dự án v10 — checkpoint S3

## 1. Trạng thái hiện tại

Ngày 21/10/2026. S0–S2 đã nghiệm thu; S3 đang kiểm thử cuối và phát hành. Đọc đặc tả v6, S3-release.md và lịch sử [checkpoint v9](NHAT_KY_SUA_LOI_Trading_Plan_Pro_v9.md). Các tài liệu gốc không sửa số mốc.

Nhánh `sprint/S3-journal` dựa trên `sprint/S2-interface`. Website v6 song song; website v3 tham chiếu giữ nguyên. Không merge main khi chưa có người duyệt.

## 6. Quyết định tiếp tục có hiệu lực

- Tổng quan giữ giao diện cũ và 24 chỉ số theo yêu cầu chủ dự án; đây là ngoại lệ F08. MetriX/System có hai chế độ cùng ledger.
- Không đăng nhập, dữ liệu trên thiết bị; không coi sao lưu JSON là đồng bộ đám mây.
- Winrate bỏ hòa vốn, fixture nguyên gốc không đổi, holding thực 234,333 phút; không sửa timestamp để khớp giả định giờ.
- Không tự thay bản v3 hoặc xóa dữ liệu thật. S3 không bao gồm biên tập nhiều legs/nhập broker mới của S5.

## 7. Nhật ký bổ sung

- QT02: test trước lõi thêm/sửa, repository CAS/reload; nối form, bảng, sao, sửa nhanh, hồ sơ lệnh.
- QT03: T-R1 chạy trên fixture thật; review thêm 3 thắng còn cảnh báo, 4 thắng hết, đủ 6 hết.
- F05/F10: kiểm thử MWG theo ID đầy đủ và tổng tháng/tuần không đổi; cấu hình ngưỡng, đơn vị và nhắc thiếu dữ liệu.
- F08: port giao diện MetriX/System cũ và điều khiển sang adapter của core v6; test cùng Net/Winrate/Kỷ luật. Giữ các khối Tổng quan cũ.
- ND03/ND04: mẫu theo phạm vi, checklist bảo toàn ID khi sắp lại/đổi trọng số; tiêu chí bị bỏ báo cần gắn lại. Không ghi đè điểm legacy.
- N02: test checksum, xem trước không ghi DB, restore chính xác ledger/Views, revision cũ bị từ chối, recovery không lồng vào các bản backup tiếp theo.
- Phát hiện: form datetime-local làm tròn tới phút; giữ timestamp cũ khi người dùng không sửa giờ để tránh đổi giây gốc. Worker cập nhật dữ liệu giữ component bảng đang mở, không reset sao/sắp xếp mỗi lần lưu.
- Còn đang nghiệm thu: CI E2E sáng/tối 360/768/1280, hồi quy v3, deploy exact source và bằng chứng site đã phát hành.
- CI lần đầu phát hiện khối bar chart trong grid Tổng quan gây tràn ngang: chuyển cột sang minmax(0,…) và giữ cuộn bên trong khối. Đo DOM desktop sau sửa: scrollWidth 1265 ≤ viewport 1280. Sửa locator test chọn đúng mã TEST, tránh khớp chữ Retest trong tên setup; giữ toàn bộ điều kiện kiểm thử.
- CI lần 2: 9/12 E2E đạt, toàn bộ luồng thêm/sửa/sao/review/lịch/reload và axe trên 3 viewport đạt. Ba bài F01–F10 dừng ở bộ chọn đơn vị thời gian do nhãn label gộp cả tên option. Thêm aria-label cố định, giữ nguyên test; đặt giới hạn chờ thao tác để báo lỗi sớm thay vì đợi hết cả bài.
- CI lần 3 đạt 30 unit/golden + 12 E2E và hồi quy v3. Đã phát hành Sites version 4. QA ảnh phát hiện thẻ nguyên tắc nền sáng tương phản thấp; chỉnh palette. Bổ sung test USDT để ngăn biểu đồ port từ v3 giữ nhãn VND khi đổi sổ, và đặt chế độ dark rõ ràng trước khi chụp ảnh dark (không dựa vào mặc định trình duyệt).
- Kiểm thử sổ USDT xác nhận Net = 1.00 USDT và không cộng chéo 30 lệnh VND. Điều chỉnh giá trị kỳ vọng đúng chuẩn v6 5D.2b (USD/USDT dấu thập phân chấm); biểu đồ dùng chung formatValue thay bộ định dạng vi-VN riêng.
