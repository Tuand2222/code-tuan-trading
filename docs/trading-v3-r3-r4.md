# Trading Plan Pro v3 — R3 / R4

## Phạm vi

Trung tâm Kết nối dữ liệu v3 được mở tại `#connections`. File và bảng dán đi qua
Web Worker → adapter → chuẩn hóa → dedupe multiset → replay thử → Preview →
commit IndexedDB. Chưa có API broker ở Mode L. Chưa tự chạy migration dữ liệu cũ.
Dashboard, Lịch và các trang phân tích vẫn dùng nguồn cũ đến R5; thông báo này
được hiển thị trên bản xem trước. Không gọi đây là bản hoàn tất 12 trang.

## Bộ đọc và adapter

- CSV/TSV qua PapaParse, XLS/XLSX/HTML qua SheetJS CE 0.20.3 từ CDN chính thức.
  Giới hạn 10 MB/file, 200.000 dòng. Giữ mã dòng, cột lạ và SHA-256 file gốc.
- Excel lấy giá trị số gốc và giá trị công thức đã tính, không chạy công thức
  hay macro. Phân biệt hệ ngày 1900/1904. Bảng HTML có nhiều phần được tách để chọn.
- Nhận diện có confidence và ánh xạ; người dùng xác nhận nguồn, tài khoản,
  múi giờ, dấu số, đơn vị giá, Gross/Net, độ đầy đủ phí và số dư đầu kỳ.
- Tám adapter: `vn-stock-fills`, `vn-stock-realized-pl`, `mt5-positions`,
  `mt5-deals`, `binance-position-history`, `binance-trade-history`,
  `binance-transaction-history`, `generic-template`.
- **Chưa kiểm chứng với file thật của các nguồn mới.** Có ít nhất ba biến thể
  giả lập cho mỗi adapter; thêm kiểm thử Excel, HTML, dấu phí, FIFO và lưu trữ.
  Không coi bộ fixture là chứng nhận hỗ trợ mọi bản xuất của SSI/VPS/TCBS/DNSE.
- Không điền 0 khi giá/khối lượng/P&L lỗi. Dòng lỗi chặn lưu cả file; CSV lỗi
  có chống formula injection. Dòng nạp/rút không vào P&L; realized income chỉ đối chiếu.
- VN: kiểm giá × lượng với thành tiền, phí thiếu giữ missing/derived. Giá trị
  bán − giá trị ròng có thể cho tổng phí/thuế bán, không cộng thuế thêm lần nữa.
- MT5: đảo dấu Commission/Fee/Swap; Profit chỉ gắn deal out. SL mặc định là
  reported-current; xác nhận stop ban đầu tạo overlay riêng, không sửa fill/hash.
- Binance: dấu phí có cấu hình; phí base coin đổi theo giá khớp; BNB/ngoại tệ
  thiếu tỷ giá giữ Net chưa biết. Max Open Interest không thay khối lượng thực đóng.

## Chống đếm đôi chéo nguồn

Thực hiện quyết định Round 0 thay cho việc tự shadow theo khoảng ngày đơn thuần:

1. Chỉ tự dùng bản position để đối chiếu khi có cùng Position ID, đầy đủ chu kỳ,
   cùng thời gian mở/đóng và cùng khối lượng. Fill đứng trước báo cáo trong mặc định.
2. Các chồng lấn chưa chứng minh được tạo blocker. Người dùng chọn ưu tiên fill
   hoặc báo cáo đóng và xem trước số chu kỳ/Net đã biết thay đổi.
3. Lựa chọn là settings dẫn xuất theo tài khoản; raw rows còn nguyên và có thể
   chuyển lại “Yêu cầu xác minh”. Các mức thấp hơn dùng position > closing-order > day-symbol.
4. Chu kỳ shadowed vẫn giữ số tiền để đối chiếu nhưng không vào thống kê/đường vốn.
5. Commission cash có khả năng đã có trong file fill tạo blocker. Liên kết đối chiếu
   phải trỏ đến fill có cùng loại phí, tiền tệ, số tiền và symbol; không tự loại theo ngày.

Chọn nguồn ưu tiên có thể bỏ cả chu kỳ nguồn phụ bị chồng lấn một phần. Preview
nêu rõ tác động; người dùng cần kiểm tra độ phủ của nguồn được giữ.

## Giao diện và lưu batch

- Năm tab: Nguồn, Tài khoản, Lịch sử nhập, Mẫu ánh xạ, Sức khỏe dữ liệu.
- Wizard ba bước; năm tab Preview, phân trang 50 dòng, đối chiếu báo cáo/tính từ giá,
  nhập 1R batch hoặc overlay theo chu kỳ, xác nhận stop và cảnh báo.
- Kéo file toàn trang; dán TSV hoặc HTML table; mẫu CSV chuẩn; hướng dẫn theo nguồn.
- Mẫu ánh xạ theo tài khoản + fingerprint; có xem/sửa/xóa và dùng lại để đi thẳng Preview.
- Nhiều bảng cùng bố cục dùng chung cấu hình đã xác nhận. Bố cục khác cần cấu hình
  riêng; có thể bỏ bảng không cần trước khi lưu. Batch được commit theo thời gian.
- Mỗi batch là một transaction CAS. Nếu có cửa sổ khác sửa sổ giữa các batch,
  dừng và báo các batch đã lưu; không hứa nguyên tử cho toàn bộ nhiều file.
- Hoàn tác hiển thị sổ, chu kỳ, batch phụ thuộc, overlay và anomalies sau replay.
- Tài khoản có biểu phí/số dư đầu kỳ; sửa cấu hình phải xem tác động và có archive cũ.
- Import Summary có số dòng mới/trùng, chu kỳ đóng/mở/thiếu, khoảng thời gian,
  độ phủ R/review/phí và Net đã biết kèm độ phủ. Nhập lại cùng file không tạo lệnh mới.

## Kiểm tra

- `npm test`: Vitest domain/import/storage, TypeScript, build Worker/SSR và 20 test nền.
- Bộ v3 hiện có 73 test, gồm 33 test R1/R2 và 40 test adapter/tích hợp mới.
- Browser QA với fixture giả lập: dán hai fill → xác nhận cấu trúc → gán 1R →
  Preview Gross 60.000, phí 7.740, Net 52.260 VNĐ → lưu. Nhập lại: 0 mới, 2 trùng.
  Hoàn tác: từ 1 chu kỳ về 0, batch vẫn còn lịch sử.
- `scripts/verified-platform.mjs` giữ các kiểm tra Linux đang có và hỗ trợ
  cài/build trên Windows mà không dùng script Linux làm điều kiện bắt buộc.

Tiêu chí 6.9: luồng import/duplicate/overlap/rollback/clipboard/Summary đã có.
Phần “12 trang cập nhật” của mục 7 còn ở R5; API mục 8 còn ở R6 (chỉ Mode S).
Kiểm tra hiệu năng quy mô lớn, Wilson/bootstrap và nghiệm thu xuyên 12 trang thuộc R5/R7.

## Xuất bản

Nhánh GitHub: `feature/multi-broker-quant-engine`, PR #4. Chặng này xuất bản một
Sites riêng cho preview, giữ dữ liệu và URL production hiện tại. Source preview
chỉ khác nhận diện hosting và metadata URL của bản preview; mã domain/import/UI
giống nhánh GitHub. Bản production được cập nhật sau khi nối 12 trang và nghiệm thu.

Tham khảo thư viện: [SheetJS installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/),
[PapaParse](https://www.papaparse.com/docs).
