# S5–S9 — bản tích hợp 0.9.0-preview

Ngày: 23/10/2026. Base GitHub S3: `97751b07bdfe8aba6c5f2bb71a4d322650047050`.
Đây là mã và artifact kiểm thử local. Chưa merge, chưa publish, chưa thay website chính.

## Chức năng có thể sử dụng trong bản preview

- S5: nhập CSV đối chiếu Binance qua Worker, preview, đối chiếu PNL, ID ổn định theo sổ/Position ID, chống thêm trùng, phát hiện xung đột và hoàn tác batch không ghi đè hồ sơ đã sửa. Có trình sửa nhiều legs với Gross/Net/R xem trước, CAS và mở lại review. Merge chỉ thành công khi từng sự kiện Gross/Net/phí và metadata được bảo toàn; nguồn gốc được lưu.
- S6: checklist trọng số, gắn chip theo entry/management/exit, thống kê tỷ lệ chip tiêu cực có n/N, phiên theo timezone kể cả qua nửa đêm và giới hạn số lệnh/ngày. Giữ disciplineLegacy, không thay 85% của fixture.
- S7: cực trị nhập tay cho MFE/MAE, OTP, efficiency và management effect khi đủ dữ kiện; multi-leg không đủ căn cứ thì không suy diễn. Drill-down hai chiều có ID bằng chứng; 20 custom slots và tên tùy chọn; hai biểu đồ Equity/MA20/50 và các đường Monte Carlo mẫu. Chartbook hỗ trợ tối đa 6 ảnh/URL, nén ảnh PNG/JPEG/WebP, bytes nằm trong snapshot và backup, ZIP chứa ảnh + ledger + workspace bao gồm Views. Báo cáo HTML tĩnh theo ngày/tuần/tháng và 24 KPI; mở rồi In/Lưu PDF, mặc định bỏ ghi chú, URL chart và trade ID.
- S8: Monte Carlo 1.000 đường trong Worker, seed tái lập, bước 1–1000, phân vị và tần suất đạt mốc cuối kỳ; hiển thị 10 đường mẫu, cảnh báo giả định lấy mẫu độc lập/không đổi phân phối. What-if bỏ các lệnh có chip lỗi, Planned/Missed/Taken có ID liên kết, phương án R thay thế theo setup và trợ lý quy tắc trả ID/Net/R. Các giả định không cộng vào ledger thực.
- S9: manifest/service worker cache tài nguyên ứng dụng, được kiểm tra offline trên localhost với IndexedDB còn nguyên; Ctrl+K dùng dialog native; trang FAQ/điều khoản/changelog; backup AES-256-GCM với PBKDF2-SHA256 600.000 vòng, salt/IV ngẫu nhiên, giải mã + preview + xác nhận trước restore. Không lưu mật khẩu và không thêm dịch vụ cloud/login.

Các công cụ mới truy cập từ “Phân tích nâng cao” hoặc Ctrl+K; nhập Binance, legs và backup tại Cài đặt. Các bộ lọc giữ journal isolation; báo cáo/drill-down/What-if sử dụng cùng scope ngày hiện thực hóa. Cấu hình và planned trades có phạm vi toàn sổ.

## Phạm vi Binance được hỗ trợ — không coi là mọi file Binance

Adapter thử nghiệm nhận USDT Futures tuyến tính, vị thế đã đóng có bằng chứng đúng một entry fill và một exit fill. Cần các cột:

`Position ID, Symbol, Position Side, Open Time, Close Time, Entry Price, Avg Close Price, Closed Quantity, Entry Fill ID, Exit Fill ID, Entry Fill Count, Exit Fill Count, Fee Coin`.

Hai Fill Count phải bằng 1. `Fee Coin` phải USDT; không mặc định tiền phí khi thiếu. Side phải LONG/SHORT; symbol kết thúc bằng USDT. Thời điểm không có offset được diễn giải UTC như nội dung preview. Commission/Tax/Other là phí trả không âm; Funding/Swap dương khi trả, âm khi nhận. Thiếu bất kỳ khoản phí nào thì costsKnown=false và Net/R chưa xác định. PNL báo cáo nếu có phải khớp chính xác basis Gross/Net đã chọn; không dựng giá/legs để ép khớp.

Không nhận báo cáo tổng hợp chỉ có giá bình quân mà không chứng minh được fills, Trade History FIFO tổng quát, Income/funding độc lập, COIN-M, phí BNB hoặc FX chưa có tỷ giá. Những nhánh không biểu diễn mất mát bằng schema hiện tại bị từ chối. Chưa có mẫu export thực để tuyên bố hỗ trợ native CSV trên mọi phiên bản Binance. File CSV ví dụ kèm bàn giao là dữ liệu tổng hợp dùng kiểm thử, không phải lịch sử giao dịch thật.

## Kiểm thử và các giới hạn nghiệm thu

Kết quả cuối cùng và log được đóng gói cùng patch. Unit/golden phải giữ 30 lệnh, Net 3.302.290 VND, 18/12, thời gian 234,333 phút, tháng 10 1.389.630, W42 143.950. Việc viết module không tự chứng minh đã qua cổng production.

Benchmark core 10.000 lệnh trước tối ưu khoảng 35 giây; sau cache timezone cục bộ và sắp xếp hàng đợi review một lần, khoảng 4 giây trên máy này, cùng Net 1.103.963.790 của bộ lặp fixture. Kiểm thử trình duyệt đo riêng import/render/reload và số hàng DOM, không đánh đồng thời gian core với UI. Không đặt ngưỡng thời gian CI phụ thuộc phần cứng.

Phân tích nâng cao, nhập CSV, Monte Carlo và tạo báo cáo dùng Worker để không chặn thao tác chính. Kết quả phân tích gắn revision/scope; đổi dữ liệu hoặc bộ lọc sẽ ẩn kết quả mô phỏng cũ. Danh sách bằng chứng dài giới hạn số hàng hiển thị, nhóm drill-down có thể tải toàn bộ ID.

Kiểm chứng bản tích hợp: 46 unit/golden đạt, ESLint và TypeScript đạt; build production thành công. Hai lượt hồi quy đầy đủ chạy trên Chromium 360/768/1280 px; kết quả lượt cuối được ghi trong `s5-s9-all-e2e.log` của gói chứng cứ. Hai ca performance mobile được chủ động bỏ qua; luồng 10.000 lệnh chạy desktop. Golden fixtures và các test golden gốc không bị sửa.

PWA chạy ở HTTPS hoặc localhost, cần build rồi preview; chế độ Vite dev không đại diện offline. Installability/Lighthouse và CSP `_headers` trên host production chưa được xác nhận. Service worker không tự skipWaiting/claim để tránh thay ứng dụng đang nhập liệu. Cache chỉ phục vụ app assets, dữ liệu vẫn IndexedDB; offline không thay backup ngoài trình duyệt.

S5–S9 chưa đạt toàn bộ DoD sản phẩm: raw broker FIFO/Income và các nguồn ngoài Binance, chart nến/replay phụ thuộc OHLC C6, chứng cứ file broker thực, Lighthouse/host QA, hợp nhất Định giá/Kết nối vào runtime duy nhất và cutover cùng Site identity còn ngoài phạm vi được chứng minh. Bản preview giữ liên kết tham chiếu cũ cho các module đó. Không được dùng release này để tuyên bố production đã hợp nhất hoàn chỉnh.

## Chạy lại và rollback

Trong thư mục v6, dùng Node 24.19.0 hoặc phiên bản đáp ứng engines, `npm ci`, `npm run verify`, cài Chromium Playwright rồi `npm run e2e`. Toàn bộ test E2E tự dùng fixture demo; kiểm tra 10.000 lệnh chạy desktop, hai viewport mobile được đánh dấu skip cho bài performance và vẫn chạy các luồng responsive thông thường.

Backup ảnh vẫn là schema v4 nhưng bản v6 S3 cũ từ chối blob sources; trước cutover phải giữ backup/artifact cũ. Rollback mã không có nghĩa tự chuyển dữ liệu ngược v3. Chưa deploy nên patch có thể bỏ/revert local; không có thay đổi production cần rollback trong đợt này.
