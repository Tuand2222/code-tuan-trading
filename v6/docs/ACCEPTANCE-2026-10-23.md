# Hoàn thiện S5–S9 và hợp nhất website · 23/10/2026

## Phạm vi đã triển khai

- CSV khớp lệnh chung/Binance: ánh xạ cột, lưu mẫu, ghép FIFO Spot/Futures, phí theo tiền tệ, xem trước từng lỗi, bỏ trùng, lưu nguồn và hoàn tác có kiểm tra phụ thuộc. Dòng giống nhau không có ID giữ số lần xuất hiện trong file; cần ID sàn để đối chiếu các file chỉ chứa một phần lịch sử.
- Vào/ra nhiều phần ngay trong form; chọn và gộp lệnh giữ nguyên từng sự kiện Gross/Net, thời điểm phân bổ phí và hồ sơ. Không cho gộp các lệnh nhập FIFO đang được quản lý tự động.
- Hồ sơ phí theo ngày hiệu lực, lô/hệ số hợp đồng, thuế bán, swap theo tồn kho và cảnh báo T+ trên từng lần thoát. Tham số do người dùng xác nhận; không công bố đây là biểu phí hiện hành. Lịch thanh toán chưa chứa ngày nghỉ lễ của từng sàn.
- Đơn vị tiền/%/R và thời gian giữ toàn sổ, Plan với giới hạn phiên/setup/số lệnh/lỗ ngày, Tiltmeter và Efficiency 20 lệnh tách biệt kỷ luật cũ.
- OTP Có/Không/Hòa vốn theo quan sát; Actual/Set-and-forget, ΔR, Updraw/Drawdown/điểm thoát, đường vốn Gross/Net/MA20/50/Tilt và gộp ngày; scatter thời gian giữ.
- Phân tích nhiều cấp, thứ vào/ra và khung 10/30 phút, kích thước vị thế, R-bucket, CI Winrate/PF/kỳ vọng R, bằng chứng ID, 20 custom slots và so sánh cạnh nhau.
- Tháng mở tuần và mũi tên; Chartbook Thực/Planned/Missed, tối đa 6 ảnh kèm mô tả, bỏ ảnh và ZIP kèm workspace; Planned chuyển thành lệnh thực, missed R và alternative R từng lệnh tách khỏi ledger.
- Monte Carlo tối thiểu 20 kết quả R, 1.000 đường × 50–500 bước, seed tái lập, 1R cố định hoặc % vốn, 5 dải phân vị, P(Net>0), ngưỡng cháy và độ bất định n<50; 9 cột mốc thói quen.
- PWA, biểu tượng 192/512, cập nhật ứng dụng, offline, lưu bền/cảnh báo dung lượng, nhắc backup 7 ngày/20 lệnh, backup mã hóa và thư mục tùy chọn trên trình duyệt hỗ trợ; báo cáo HTML và In/Lưu PDF trên máy.
- Định giá 9 mô hình chạy trong ứng dụng mới. Trang gốc chuyển sang `/v6/` trên cùng origin; `/legacy` giữ giao diện cũ. Không xóa dữ liệu trình duyệt, D1 hoặc R2.

## Bằng chứng kiểm tra

- 61 unit/golden qua; bộ fixture và kết quả 30 lệnh chuẩn không thay đổi: 18 thắng/12 thua, Net 3.302.290 VND, phí 1.027.710 VND, Gross 4.330.000 VND, drawdown 1.243.950 VND.
- 49 E2E qua ở 360/768/1280. Hai ca hiệu năng di động được bỏ qua có chủ đích; ca 10.000 lệnh nhập/xem bảng ảo/tải lại chạy trên desktop. 9 ca bổ sung cho thay đổi mở Tổng quan và đơn vị cũng qua trên cả ba kích thước.
- axe không có lỗi serious/critical trong các luồng được kiểm tra, gồm trang định giá. Không phát sinh yêu cầu ngoài origin trong kiểm thử định giá.
- 89 unit của ứng dụng cũ và 22 kiểm tra runtime qua. TypeScript và lint của v6 qua; build v6 và Worker thành công.
- Lighthouse **11.7.1**: PWA 100, accessibility 100 trên bản local. Đây là phiên bản cố định để tái hiện tiêu chí cũ: [Lighthouse đã bỏ kiểm tra PWA ở các phiên bản mới](https://developer.chrome.com/docs/lighthouse/pwa/content-width?hl=en). Không diễn giải thành điểm PWA của Lighthouse hiện hành.
- Worker khai báo binding `ASSETS` và xử lý trước static assets. Shell HTML nằm trong `app-shell.txt`; `/v6/` và `/v6/index.html` được trả qua Worker với CSP, nosniff, referrer/permissions policy và no-cache. Phải xác nhận lại HTTP trên tên miền sau triển khai.

## Giới hạn còn cần phân biệt

- Mốc mở Tổng quan 10.000 lệnh dưới 1 giây đã quan sát khi cache tính toán hợp lệ (khoảng 0,5–0,6 giây trên Chromium desktop, không throttle). Lần tính đầu/cache miss khoảng 2 giây trong lần đo riêng; **chưa đạt dưới 1 giây cho tình huống này**. Cache phân biệt phiên dữ liệu và bản build, không tái dùng sau chỉnh sửa/restore. Không tuyên bố nghiệm thu hiệu năng vô điều kiện hoặc đã đạt toàn bộ DoD v1.0.
- Nến OHLC/replay G01/I03 tiếp tục hoãn theo C6 vì chưa chọn nguồn dữ liệu. Không suy ra thứ tự chạm TP/SL từ Highest/Lowest.
- Adapter riêng cho các broker khác và mức độ tương thích mọi biến thể file xuất chưa được xác nhận bằng file broker thật; C12 cho phép giới hạn này. Bộ CSV/FIFO bắt buộc đã có và được kiểm tra bằng dữ liệu có kết quả tính tay.
- Quyền thư mục File System Access phụ thuộc trình duyệt/người dùng; khi không hỗ trợ vẫn có tải file backup. Quyền lưu bền và offline không thay thế bản sao bên ngoài trình duyệt.

GitHub được cập nhật qua PR #9; theo CONTRIBUTING, chưa merge main nếu chưa có approval của người duyệt.
