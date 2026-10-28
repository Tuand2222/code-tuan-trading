# Tuấn Nhật Ký: triển khai đề xuất PDF giao diện trading

Nguồn yêu cầu: `Cải Tiến Giao Diện Trading.pdf`, 26 trang. Tài liệu được dùng làm đặc tả sản phẩm; các điểm số mục tiêu trong báo cáo không phải kết quả nghiệm thu đã đo được.

## Những phần đã thay đổi

- `/classic` có buồng lái dùng chung `lib/risk-analytics.ts`: sáu KPI, Net sau phí/swap, SQN, tỷ lệ Sharpe/Sortino theo R mỗi lệnh (Rf/MAR=0, không thường niên hóa), số mẫu, MAE/MFE được ghi nhận, ma trận setup/mã/phiên/tuân thủ và mô phỏng chỉ giữ lệnh tuân thủ. Màn hình MetriX và theo dõi hệ thống chi tiết vẫn truy cập được, nhận P&L đã chuẩn hóa Net.
- Điều hướng gồm bốn giai đoạn; Ctrl/Cmd+K mở lệnh nhanh. Bộ lọc dùng URL và được giữ khi đổi tác vụ. Lịch và điểm trên biểu đồ mở nhật ký của ngày tương ứng. Biểu đồ vốn, SMA20, giả định và underwater dùng trục riêng.
- Font Be Vietnam Pro 400/500/600/700, Geist Mono cho số liệu; font v6 tự lưu trữ và được đưa vào bộ nhớ ngoại tuyến. Có chế độ màu xanh dương/cam, dòng bảng gọn và bố cục điện thoại.
- Vốn, giới hạn lỗ ngày, sàn static/trailing, HWM, P&L đang mở và các ngưỡng được cấu hình riêng. Cảnh báo ngày ở 50/70/80/90%; phòng thủ giảm ngân sách một nửa. Tầng dừng khóa luồng kế hoạch, giữ quyền ghi nhận giao dịch đã xảy ra; bản rà soát và điều kiện hạn mức phải hợp lệ để mở lại.
- Máy tính tính khối lượng theo khoảng SL, hệ số hợp đồng/tỷ giá, phí mỗi đơn vị và bước khối lượng; chuyển kế hoạch sang form. Nhóm phơi nhiễm tương quan do người dùng khai báo được lưu cùng cấu hình. Không suy tương quan từ ticker; lỗ quá 1R chỉ là dấu hiệu cần đối chiếu, không phải bằng chứng đã nới SL.
- Form/ghi chú/cấu hình có lưu nháp IndexedDB sau 200ms. Hàng đợi ghi cloud được lưu trước khi gửi, thử lại khi có mạng; xung đột CAS được giữ để đối soát. Ảnh dán từ clipboard được nén WebP; ảnh chưa gửi được giữ cục bộ.
- Các nguồn file, manual, API và webhook đi qua cổng định danh chung. D1 batch ghi bản ghi, nguồn thô đã che trường bí mật, audit và con trỏ trong một giao dịch. Upsert bổ sung dữ kiện tài chính, giữ ghi chú/checklist/ảnh. Có version/CAS, xóa mềm và khôi phục trong 30 ngày; không tự xóa vật lý ảnh.
- Hash định danh gồm chủ sở hữu, broker, tài khoản, mã, loại hồ sơ và execution ID. Hash theo phút/giá/khối lượng làm tròn chỉ tìm ứng viên, không tự xóa. Diff View cho phép bỏ qua/cập nhật dữ kiện/giữ cả hai. Các dòng giống nhau không có ID thật vẫn giữ số lần xuất hiện; file giống hệt có ID dòng theo checksum.
- Execution được giữ nguyên; phép chiếu chu kỳ gom scale-in/out và VWAP, tách phiếu chưa ghép khỏi số lệnh đã đóng. Không tạo chân giao dịch giả từ báo cáo tổng hợp. Lịch sử bắt đầu giữa vị thế không được coi là chu kỳ đầy đủ khi nhận ra P&L đóng ở dòng đầu.
- Binance PDF không tự suy 1R từ P&L, không coi thiếu phí là 0, dùng ngày đóng và giữ giờ UTC. File ngoại tệ yêu cầu tỷ giá trước khi lưu VNĐ. Các adapter v3/v6 cho MT4/MT5/HTML/CSV vẫn được giữ tại công cụ nhập nâng cao.

## Báo cáo và lịch chạy

`lib/governance-report.ts` tạo đúng năm sheet quản trị, nhật ký, rủi ro ngày, phương pháp và audit; có định dạng, công thức kèm kết quả cache và freeze pane thực trong XML. Sau xác nhận nhập hoặc sync, trình duyệt nhận Excel đối soát. Nút kết thúc phiên tạo báo cáo và lưu bản sao IndexedDB. Gói cuối tuần được tạo một lần sau 22h Chủ nhật khi web đang mở (có thể tắt).

PDF một trang nhúng font tiếng Việt. ZIP chứa JSON, CSV, cấu hình rủi ro, metadata kết nối và ảnh đã tải; không xuất khóa broker. Khôi phục giữ bản trước thao tác, đưa giao dịch qua bước đối soát và lưu ảnh cục bộ. Cấu hình rủi ro từ bản sao cần được áp dụng trong trang quản trị.

Worker có scheduled handler và cấu hình hourly cron. Cấu hình gửi theo ngày/Chủ nhật, múi giờ, Telegram hoặc email Resend nằm trong khu vực tài khoản. Khóa kênh gửi mã hóa bằng cơ chế AES-GCM hiện có, không trả lại trên GET. Mỗi chủ tài khoản/kỳ/kênh có một job duy nhất; lỗi gửi mơ hồ được giữ ở `needs-review` để tránh tự gửi trùng. File riêng được giữ trong R2. Chưa nhập địa chỉ/chat ID, khóa và bật opt-in thì không gửi. Việc triển khai mã cron không tự chứng minh nền tảng hosting đã kích hoạt lịch; phải xác nhận lịch chạy trên hosting trước khi dựa vào gửi tự động khi đóng trình duyệt.

## Giới hạn có chủ đích

- Chưa có khóa/địa chỉ nhận thật để thử gửi Telegram/email; kiểm thử dùng transport giả, không gửi dữ liệu ra ngoài.
- Import cloud tối đa 500 bản ghi/lô, giới hạn payload thô 1,5 triệu ký tự; vượt biên bị từ chối toàn lô. Không chia một file thành nhiều request rồi giả định atomic.
- Sync Binance/Bybit lần đầu lấy cửa sổ gần nhất 7 ngày, chồng lấn 5 phút, có phân trang/bảo vệ tràn và retry cooldown. Nếu vượt biên lô, không tiến con trỏ và hướng dẫn dùng file export. Không tuyên bố đã nhập toàn bộ lịch sử tài khoản.
- Phí bằng đồng khác quote cần tỷ giá; Spot execution chưa có realized P&L không được coi là lệnh đóng. Thiếu phí/P&L khóa việc xác nhận hạn mức; không suy số còn thiếu từ giá cuối.
- Sổ v6 và Classic vẫn giữ phạm vi lưu trữ cũ để bảo toàn dữ liệu đã khôi phục. Link qua lại rõ ràng; không tự nhập 20 lệnh demo Classic vào 30 lệnh v6.
- Phân tích tiền tệ đòi hỏi vốn đầu kỳ ứng với lịch sử và điều chỉnh nạp/rút đúng. Không có feed giá trực tiếp; trường unrealized do người dùng cung cấp. Máy tính không đặt hoặc ngăn lệnh tại broker.

## Kiểm chứng

Các bài kiểm thử gồm đối chiếu Gross/fees/swap/Net; SQN và mẫu R thiếu/độ lệch chuẩn 0; các ngưỡng rủi ro; timezone; identity chéo nguồn và tài khoản; bảo toàn execution/VWAP; workbook/PDF tiếng Việt; D1 rollback toàn batch và con trỏ; giữ notes khi upsert; CAS đồng thời; xóa/khôi phục; job gửi một lần và giữ lỗi mơ hồ. Có kiểm thử trình duyệt riêng cho desktop/mobile, form nháp, auto report và URL filters, cùng các bài kiểm thử hồi quy web cũ/v6.

Không xóa migration cũ chỉ vì tên chứa từ “broken”. Chỉ bỏ hai tệp demo `examples/d1` không có tham chiếu và các hàm dashboard/parser Classic không còn dùng sau khi chuyển sang lõi chung.
