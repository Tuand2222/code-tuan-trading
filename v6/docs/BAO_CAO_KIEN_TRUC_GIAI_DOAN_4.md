# Báo cáo Giai đoạn 4 — Giao diện nhật ký đa tài sản

Phạm vi: P4 của yêu cầu nâng cấp theo giai đoạn. Kế thừa P1–P3 chưa commit; chưa bắt đầu P5/P6. Dữ liệu thử nghiệm nằm trong browser context riêng, không ghi tài khoản hoặc website production.

## 1. Đã làm gì

- `lib/trade-normalizer.js`: tách nguyên normalizer P1 thành nguồn dùng chung, không đổi công thức. `lib/trade-form.js`: cấu hình bốn lớp tài sản, nhãn/step khối lượng, chứng từ giá/SL/hệ số nhân/tick/tỷ giá/chi phí và hai adapter form dùng chung.
- `app/classic/components/AssetTradeForm.tsx`, `app/classic/page.tsx`: thêm ngăn xác minh có thể bật trong form Classic, xem trước 1R và Net; bước khối lượng theo CP/HĐ/Lot/coin. Giữ cách nhập tay và các phần Classic đang có. Chế độ xác minh không tự điền phí, hệ số nhân hoặc tỷ giá. Thiếu SL/1R vẫn có thể lưu nếu Net và chi phí đã xác minh; R hiển thị chưa xác minh.
- `app/classic/components/JournalInlineCell.tsx`: sửa symbol/setup ngay trong bảng bằng double-click hoặc bàn phím, lưu qua kho chung. Các đại lượng dẫn xuất không mở ô sửa trực tiếp. Sửa symbol của bản ghi đã chuẩn hóa làm mất cờ xác minh để yêu cầu đối soát lại.
- `app/classic/components/numeric-input.ts`: thao tác chọn số trì hoãn chỉ thực hiện nếu ô vẫn đang có focus; tránh kéo focus về ô cũ khi nhập liên tiếp.
- `app/globals.css`, `app/classic/page.tsx`: bảng desktop trên 1.000 lệnh chỉ dựng một cửa sổ dòng, giữ chiều cao 48 px; dưới ngưỡng giữ phân trang cũ. Mobile Classic giữ thẻ nhật ký phân trang 200 lệnh, không ép dùng bảng desktop.
- `v6/index.html`: cùng form chuẩn hóa, xem trước theo dữ kiện, bảng ảo hóa 44 px cho trên 1.000 lệnh; giữ sửa tại ô, các nhóm cột và bộ lọc. Vẽ đường cong tối đa 1.200 điểm để hiển thị; tính toán vẫn dùng toàn bộ dữ liệu. Danh sách gợi ý lọc giới hạn số mục dựng, tìm kiếm vẫn chạy toàn bộ nhật ký.
- `RiskStore` ghi nhớ vốn/drawdown/daily/limits theo revision và cấu hình. Đổi bộ lọc chỉ tính lại phần thống kê lựa chọn, không tính lại số toàn cục. Không sửa RiskMath hoặc sao chép lõi toán vào worker mới.
- Chỉnh thông báo Classic cũ đang nói hai sổ lưu riêng thành mô tả kho chung theo tài khoản/đơn vị tiền. Nút phân trang dùng lại kiểu nút Classic và bố cục co giãn trên mobile.
- Nhãn kết quả có ▲ Thắng, ▼ Thua, ● Hòa hoặc ○ Chưa xác minh; trạng thái không chỉ phân biệt bằng màu.
- Kiểm thử form thật phát hiện lỗi kiểm tra danh tính chạy đồng thời: `ClassicSync.init()` từng đặt owner về null tạm thời, khiến tick của nhật ký device gọi nhầm cloud và ẩn view khi nhận 401. Giữ owner cho đến khi có kết quả danh tính; test đồng thời xác nhận không gọi cloud trades và không ẩn nhật ký. Bản ghi canonical trong ca lỗi luôn còn nguyên.
- `v6/scripts/sync-lifecycle.mjs`, `build.mjs`, `verify.mjs`: nhúng các module dùng chung vào HTML đơn file và kiểm tra nguồn khớp; không ghi lại HTML khi nội dung không đổi.
- Thêm test `trade-form.test.ts`, `numeric-focus.test.ts`, `p4-core.mjs`, `ui-p4-browser.mjs`, `benchmark-p4.mjs`, `classic-p4-browser.mjs`. Runner mặc định thêm suite UI P4; benchmark chạy riêng. Assertion R thiếu của regression đổi từ dấu gạch sang nhãn chưa xác minh theo UI mới.

## 2. Kết quả kiểm thử thật

Kết quả cuối: **153/153** ca Vitest trên 21 file; typecheck đạt; build Vinext/Worker đạt; **23/23** ca Node backend. Lượt `npm test` đầu đạt 153 ca nhưng typecheck bắt lỗi nullable ở biến preview; đã sửa giá trị thiếu thành NaN và chạy lại typecheck → build → Node, tất cả đạt; giữ cả hai log. V6 verify **94/94**, **3 script** qua node --check, **0 ID trùng**, **0 named function trùng**. Một lượt e2e V6 đầy đủ đạt **94/94** trên 11 suite. Classic P4 đạt **6/6** (5 ca form/sync/mobile và benchmark); đồng bộ hai tab hai transport **18/18**; Classic lifecycle **4/4**. PageErrors của các lượt cuối rỗng. Một assertion cũ đòi dấu gạch ở R thiếu đã được đổi sang nhãn rõ ràng theo yêu cầu P4; các assertion số tiền được giữ nguyên.

Lệnh chạy tại root: `npm test`; `node --experimental-loader ./scripts/cloudflare-validation-loader.mjs tests/classic-p4-browser.mjs`; tương tự với `tests/unified-two-tab-browser.mjs` và `tests/lifecycle-classic-browser.mjs`.

Lệnh chạy tại `v6/`: `node scripts/sync-lifecycle.mjs`, `node scripts/verify.mjs`, `node tests/unified/browser.mjs`; benchmark riêng dùng `UNIFIED_SUITES=benchmark-p4`.

Các ca form đối soát: cổ phiếu 37 đơn vị × chênh lệch 5 × hệ số 1.000 = 185.000 tiền rủi ro; gross 370.000 trừ phí 100 và thuế 20 = Net 369.880. Futures short tính bằng tick: 1R 500, Net 996; từ chối 0,5 hợp đồng khi step=1. Forex cho khối lượng lẻ, bắt buộc xác nhận FX; crypto dùng step 1e-8. Phí trống không được biến thành phí 0. Hai adapter giữ nguyên ID và số tiền; sửa setup giữ cờ xác minh.

Đã xem ảnh chụp form Classic và V6 ở 390×844, kiểm tra không tràn ngang. Cửa sổ bảng lớn kiểm tra chạm được lệnh cuối, chỉnh tại ô, ID DOM không trùng. Ảnh và JSON/log thực tế nằm trong gói kết quả.

Đối chiếu trực tiếp HTML đóng băng P3: khối **RiskMath 32.679 byte** giữ nguyên (SHA-256 `a085b48999897d6232996abd25e7a000e6cee061ac92da0be6bf8157f5d67de9`). Normalizer **4.921 byte** giữ nguyên sau khi bỏ khoảng trắng biên/chuẩn hóa xuống dòng; chỉ chuyển vị trí thành module dùng chung. `p4-core` kiểm tra cache vẫn khớp capitalNAV và được vô hiệu hóa khi dữ liệu/cấu hình thay đổi.

## 3. Hiệu năng đo thực tế

- **Classic**: ghi canonical 16474.2 ms, tải lại view 19789.0 ms. Cuộn đến hai frame: median 98.6 ms, p95 149.3 ms, max 756.0 ms. Khoảng cách frame median 83.3 ms, p95 166.6 ms. Lọc 5 truy vấn: median 461.5 ms, min/max 262.3 ms / 624.8 ms. Tối đa **24 dòng DOM**, lệnh cuối `BENCH-099999`, cao dòng 48 px.
- **V6**: dựng view 3257.8 ms, view + ghi canonical/mirror 33346.0 ms. Cuộn đến hai frame: median 68.4 ms, p95 85.7 ms, max 93.4 ms. Khoảng cách frame median 49.9 ms, p95 66.7 ms. Lọc 5 truy vấn: median 407.0 ms, min/max 105.9 ms / 1696.5 ms. Tối đa **25 dòng DOM**, lệnh cuối `BENCH-099999`, cao dòng 44 px.

Cả hai lượt cuối chạy tuần tự trên bản mã cuối, sau các bài kiểm thử khác. Cả 100.000 dòng được giữ trong kho chung; lọc đúng 1.000 / 0 / 1.000 / 100.000 / 100.000 dòng. Các phép dựng/ghi toàn bộ dữ liệu vẫn có độ trễ đáng kể; bảng ảo hóa không làm các bước đó tức thì. Số đo từng truy vấn, frame và môi trường có trong JSON đính kèm.

Phương pháp: Chromium headless desktop 1440×1000, deviceScaleFactor=1, không throttle CPU; fixture tổng hợp 100.000 lệnh với Net=0, 1R khai báo=100, 100 symbol, vốn 1 tỷ. Ghi vào IndexedDB thật trong context riêng; V6 còn phản chiếu kho tương thích. Đo 31 vị trí cuộn và 5 truy vấn lọc, chờ hai animation frame sau thao tác. Tải 100.000 lệnh và ghi kho được tách khỏi đo cuộn ổn định.

Số đo cuộn là độ trễ đến hai frame, không phải chứng nhận INP. Bộ dữ liệu toàn Net=0 không đại diện mọi phân phối đuôi, ảnh hoặc trường ghi chú dài. Không kết luận đạt mục tiêu <25 ms, INP<40 ms hay CLS=0 từ bài đo này. Không suy diễn khả năng local thành tốc độ đồng bộ cloud/đa thiết bị. Lượt đo sơ bộ chạy cùng tác vụ khác hoặc bị máy ngủ không dùng làm số cuối.

## 4. Điểm chưa chắc chắn / khác đề xuất PDF

- Không thêm thư viện, SharedArrayBuffer hoặc worker tính toán mới. Virtualization giảm số dòng DOM; các phép phân tích vẫn có chi phí khi tải/lọc số lượng lớn. Những chỉ tiêu hiệu năng trong PDF là mục tiêu, không phải kết quả đã đạt.
- Bật xác minh là lựa chọn rõ ràng để giữ luồng nhập tay Classic. Người dùng phải đối soát giá, khối lượng, SL, phí/thuế/swap và FX/hệ số khi có; form không tự suy ra từ tên symbol.
- 1R chỉ gồm rủi ro giá ban đầu, không gộp phí/thuế. Net trừ chi phí một lần theo normalizer P1. Các lớp tài sản ngoài bốn lớp đã hỗ trợ chưa có profile chuẩn hóa riêng.
- Classic vẫn dùng tài khoản VNĐ; V6/kho chung khác tiền tệ vẫn bị chặn ghi đè trái đơn vị theo P3. Không tự quy đổi toàn bộ lịch sử. Tài khoản V6 trống cần khai báo vốn trước khi nhập lệnh theo cổng vốn hiện có; chưa đổi quy tắc zero-capital của RiskMath.
- Mobile Classic còn phân trang thẻ; giới hạn gợi ý lọc V6 là giới hạn hiển thị, không cắt dữ liệu. Thống kê nâng cao/cỡ mẫu/CI/Basel/PLAT và tái cấu trúc repo/CI nằm ở P5/P6.
- Chưa kiểm tra thao tác cảm ứng trên thiết bị thật, mọi trình duyệt, đăng nhập cloud nhiều máy hoặc toàn bộ tổ hợp dữ liệu 100k. Không hứa lưu mãi mãi.

## 5. Rủi ro dữ liệu còn lại

- Không xóa dữ liệu người dùng, key cũ hoặc kho cũ trong P4. Tất cả thao tác thử dùng context riêng. Phiên chưa xác minh không được gán 1R hoặc phí giả; chỉnh thông tin tài chính/định danh tại ô phải đối soát lại.
- Browser có thể thu hồi dung lượng hoặc người dùng xóa dữ liệu trang; `storage.persist()` không phải bảo đảm lưu vô hạn. Cần bản JSON độc lập và kiểm thử phục hồi cloud.
- Canonical/mirror/cloud/R2 chưa có một transaction chung. Giữ cơ chế lỗi rõ ràng, archive và CAS P3; không bảo đảm thu hồi request cloud đã gửi hoặc chặn client cũ trên thiết bị khác sau reset.
- Giới hạn backup cloud 24 MiB/object và 64 MiB/JSON còn nguyên. Chưa benchmark hard reset/backup chứa 100.000 lệnh kèm ảnh; bài đo bảng không thay thế bài đo phục hồi dữ liệu.
- Tải/ghi lô lớn còn tốn thời gian; cần chờ trạng thái lưu hoàn tất và giữ bản JSON trước khi đóng tab hoặc đổi phiên bản. P4 không triển khai cloud mới hoặc dịch vụ lưu trữ dài hạn.

## 6. Bước tiếp theo và điểm dừng

**Đã hoàn tất P4** với form theo tài sản, xem trước 1R, nhãn/icon, bảng ảo hóa và kiểm thử cuộn/lọc 100.000 dòng thật trên cả hai view. Đã sửa lỗi focus số và lỗi đồng bộ đồng thời được kiểm thử phát hiện. Chưa làm các hạng mục P5/P6.

Đề xuất tiếp theo: P5 — thống kê nâng cao, ngưỡng mẫu và khoảng tin cậy; các kết luận chỉ gợi ý, không tự đổi Tier/khóa cổng. **DỪNG sau Giai đoạn 4, chờ người dùng nói “tiếp tục”. Chưa commit/push GitHub hoặc deploy website trong giai đoạn này.**
