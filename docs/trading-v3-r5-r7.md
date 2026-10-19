# R5 / R7 — Sổ v3 xuyên trang

## Phạm vi

Sổ v3 là chế độ mặc định. Tổng quan, Nhật ký, Lịch, Quy trình setup, Review, Lợi thế, Lợi nhuận/rủi ro, MetriX, Theo dõi hệ thống, Kết nối và Cài đặt cùng đọc IndexedDB. Định giá doanh nghiệp giữ nguyên phương pháp và dữ liệu riêng theo yêu cầu; không biến lịch sử giao dịch thành dữ liệu định giá.

`LedgerProvider` theo dõi transaction qua Dexie liveQuery. `ledgerVersion` thay đổi gửi snapshot sang module Worker; phản hồi cũ bị bỏ qua. Replay cache theo tài khoản, selector cache theo nội dung snapshot/version/bộ lọc. Tái sử dụng kết quả tài khoản chưa đổi; chưa cache độc lập từng hedge book vì cash và overlay có thể liên quan nhiều vị thế. Danh sách nhật ký/review chỉ dựng các hàng trong vùng nhìn thấy. Các vòng quét cùng granularity và tổng hợp event được thay bằng index.

Nhật ký cũ và dữ liệu mẫu có nút riêng, không được cộng vào sổ v3. Công thức cũ còn trong giao diện cũ để giữ khả năng đối chiếu; chúng không cấp dữ liệu cho Dashboard v3. Vì vậy tiêu chí grep toàn repo không còn công thức trong component không được đánh dấu đạt tuyệt đối.

## Hành vi

- 24 chỉ số dùng registry, hiển thị n/of, lý do thiếu dữ liệu; không ép giá trị chưa biết thành 0.
- Bộ lọc ngày/tài khoản/thị trường/nguồn dùng chung. Exact-only chỉ giới hạn thống kê chu kỳ; tiền vẫn tính đủ sự kiện. Có lựa chọn đưa 1R cố định theo batch vào mẫu R.
- Lịch tính Net theo RealizedEvent và múi giờ, chốt từng phần/funding đúng ngày, số chu kỳ đóng riêng; có chi tiết ngày và mở hồ sơ lệnh.
- Nhật ký có nhóm đóng/mở/cần bổ sung/cần đối chiếu, chi tiết chân khớp/phí/nguồn, xuất CSV chống công thức, gán setup/lỗi/1R hàng loạt có xem trước và ghi nguyên tử.
- Nhập tay tạo hai fill đánh dấu synthetic=manual, dùng cùng stage/commit/replay; giờ nhập ghi rõ theo thiết bị. Forex/hàng hóa dùng đơn vị cơ sở đã quy đổi, không đoán contract size từ số lot.
- Review xen kẽ lỗ/lãi theo |Net|; phím trái/phải chuyển lệnh, 1–9 gắn lỗi. Không tự đánh dấu reviewed. Checklist có trọng số, chọn phiên bản playbook hiệu lực theo ngày lệnh. Overlay cần gắn lại được giữ, có thao tác gắn bằng ID và archive trước thay liên kết.
- Shadow giữ chung sự kiện với đường thực tế, công bố độ bao phủ và thiên lệch. Fee Impact tách phí/thuế, carrying trả/nhận, chi phí ròng. Rủi ro có phân bố R, sụt giảm hiện tại/lịch sử, kết quả tháng và tỷ trọng 5 lệnh lãi lớn nhất.
- Lợi thế theo setup/market/sản phẩm/chiều/nguồn/thứ/giữ lệnh/phiên: Wilson 95%, bootstrap percentile 2.000 vòng, seed cố định, n/of và trạng thái tín hiệu. Có cảnh báo so sánh nhiều nhóm. Monitor cửa sổ 20/50/100, CI âm, dữ liệu cũ và sụt giảm vượt kế hoạch. Không thêm MAE/MFE, Monte Carlo, backtest hay engine chặn giao dịch.
- Ghi chú ngày/tuần, tổng hợp review tuần theo dữ kiện và câu hỏi cố định.
- Cài đặt múi giờ, tỷ giá mặc định/lịch sử, ngưỡng kỷ luật/cỡ mẫu/dữ liệu cũ/biên hòa vốn/kế hoạch drawdown, phiên tùy chỉnh. Tỷ giá mới không ghi đè batch cũ.
- Sao lưu có checksum, restore có dry-run + tải sổ trước thay và archive; migration nhật ký cũ cần xác nhận, chỉ khi sổ trống và không phải dữ liệu mẫu. Không tự chuyển hoặc xóa dữ liệu thật.

## Kiểm tra

- Bộ cố định 3 tài khoản / 60 fills: Overview Net = Calendar Net = Gross − Cost = MetriX; từng chu kỳ = tổng event; n R và tổng nhóm đồng nhất.
- Kiểm tra cache invalidation, liveQuery sau transaction, ngày theo múi giờ, chốt một phần, Wilson/bootstrap, checklist hiệu lực, phiên qua đêm, CSV injection, từ chối settings sai.
- Replay 10.000 fills / 5.000 chu kỳ: kết quả 5.000 VNĐ, giới hạn regression 15 giây; chạy trên Node tại máy phát triển. Đây không phải cam kết tốc độ trên mọi điện thoại hoặc file 200.000 dòng.
- Browser QA localhost: nhập tay FPT 100 × (26.000 − 25.400), phí 7.740 → Gross 60.000 / Net 52.260 / 1R 100.000. Dashboard tự cập nhật; lịch ghi 52.260 vào ngày đóng; review 60 điểm + FOMO lưu thành công. Điều hướng các trang chính hiển thị đúng vùng dữ liệu v3.

## Giới hạn nghiệm thu

Không tuyên bố “100% Master Spec” khi chưa có file CSV/XLSX/HTML thật đã ẩn thông tin cho từng broker và chưa kiểm tra migration/restore trên bản sao dữ liệu thật của chủ website. Không thao tác dữ liệu thật chỉ để đạt checklist. Các adapter v3 hiện dựa trên fixture giả lập; bản PDF Binance cũ có test riêng, không chứng nhận các định dạng export mới.

Mode L lưu riêng theo origin và trình duyệt. Preview, production và Render không tự chia sẻ IndexedDB; chuyển dữ liệu bằng JSON. API/cloud cũ được giữ, có kiểm quyền; việc mở website không công khai dữ liệu tài khoản. Không triển khai R6/Mode S trong chặng này.

P2 sau chặng này: tự gắn quy tắc có dry-run, gộp/tách chu kỳ thủ công, xuất review PDF/ảnh, PWA, liên kết định giá và Local Bridge. Cache chi tiết từng book, đồ thị sụt giảm chuyên dụng và các lựa chọn cảnh báo nâng cao có thể tiếp tục cải tiến sau đo đạc dữ liệu thực.

## Khôi phục giao diện theo yêu cầu 19/10/2026

Tổng quan sử dụng lại bố cục gốc: hero, bốn thị trường, 24 thẻ chỉ số, đường cong vốn hai trục, donut kết quả, tổng hợp theo thứ và vòng kỷ luật. Nội dung Tổng quan v3 mới đã bỏ khỏi LedgerPages. Trading MetriX và Theo dõi hệ thống có hai chế độ chọn riêng, mặc định Giao diện gốc, nhớ lựa chọn trên thiết bị; không có sổ dữ liệu cũ riêng.

MetriX giữ vốn mô phỏng, mục tiêu, daily/max loss, Balance hai trục có zoom/pan, phân tích sản phẩm và bảng ngày phân trang. Theo dõi hệ thống giữ khoảng năm, vốn tham chiếu, biểu đồ năm và bảng 14 chỉ số. Các phép tính lấy cùng selectScope/metricsVM như v3. Balance dùng RealizedEvent kể cả chốt một phần; số lệnh dùng Cycle đã đóng. R chỉ dùng lệnh đủ rủi ro; điểm kỷ luật chỉ dùng lệnh review. Giá trị không xác định hiển thị —; Profit Factor không dùng sentinel 99. Trục % Tổng quan chỉ lấy Net của các lệnh đủ R chia tổng rủi ro của chính tập này, có hiển thị phạm vi; đường VNĐ giữ mọi sự kiện.

Xác minh: 88 Vitest + 20 test nền, TypeScript và build Worker đạt. Bổ sung test chốt từng phần qua năm/múi giờ, bộ lọc, thiếu Net/R/review và ROI với tập trộn lệnh đủ/thiếu rủi ro. Browser QA mở cả hai chế độ, kiểm tra lựa chọn độc lập giữa hai trang. Không sửa hay xóa lịch sử giao dịch khi đổi giao diện.
