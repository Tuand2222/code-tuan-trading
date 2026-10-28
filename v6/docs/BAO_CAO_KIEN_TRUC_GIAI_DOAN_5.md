# Báo cáo Giai đoạn 5 — Thống kê nâng cao có bằng chứng

Phạm vi P5 theo yêu cầu nâng cấp từng giai đoạn. Kế thừa mã P1–P4 chưa commit; không triển khai P6, không push/merge/deploy. Các dữ liệu kiểm thử là tổng hợp, trong context trình duyệt riêng.

## 1. Đã làm gì

- `v6/index.html`: bổ sung 13 phương thức thuần vào **một RiskMath đang có**: cấu hình bằng chứng, ES phần lẻ/CI, tham chiếu thanh khoản, họ đường cong RCK, Spearman/KS/PLAT và phân tích ma trận/gợi ý. Worker vẫn sinh mã từ chính các phương thức này; không có bản sao thuật toán hoặc thư viện mới.
- Sửa chênh lệch đã có test tái hiện: RiskStore dùng cùng tập có đủ cờ cho RCK, mô phỏng, chỉ số R và bảng nâng cao. NAV/ngày/hạn mức chỉ cộng Net đã có cờ xác minh; khi còn Net thiếu bằng chứng phải báo cảnh báo, không cho Sizer coi đó là vốn chắc chắn. `lib/journal-adapters.js` giữ trạng thái thiếu xác minh khi đi V6 → Classic → V6, không tự nâng cờ chỉ vì có số tiền dương. Bộ đếm và bảng R dùng cùng điều kiện bằng chứng. Chế độ Gross chỉ đối chiếu bảng lệnh; RCK, các cổng và mô phỏng dùng Net đã xác minh.
- Bộ mẫu sandbox được khai báo cờ rõ ràng cho các số Net/1R giả lập có sẵn; không dùng thao tác này để xác nhận lại migration hoặc nhật ký thật. Lệnh nhập tay cũ/gameplan/import thiếu cờ vẫn được lưu để đối soát; cần xác nhận ở ngăn xác minh trước khi dùng số đó trong rủi ro.
- Thống kê nâng cao lấy **Net P&L / initial 1R** với cả hai cờ xác minh bằng `true`, không bị chuyển thành Gross bởi nút chế độ hiển thị. Bản ghi thiếu cờ/1R/phí không được bổ sung rủi ro giả. Số lệnh đủ bằng chứng có thể nhỏ hơn số bản ghi trong nhật ký; không tự xác nhận lại dữ liệu cũ.
- ES signed-return 97,5%: tích phân khối lượng 2,5% thấp nhất, gồm phần lẻ; tính đồng thời toàn bộ lệnh và riêng nhóm lệnh lỗ. Tỷ số là `|ES| / |VaR|` chỉ khi cả hai âm và thương hữu hạn. VaR bằng 0 hoặc không có lỗ không được gán tỷ số 1, ES 0 hay kết luận an toàn.
- Mặc định mỗi pool cần **N≥200 và khối lượng đuôi≥5**; yêu cầu thực tế là max(minN, ceil(minMass/0,025)). Bootstrap IID percentile 95%, mặc định **400 lần**, seed lưu rõ. Thuật toán lấy mẫu lại toàn bộ pool bằng số lần xuất hiện trên mảng đã sort, đối chiếu với cách resample/sort trực tiếp; không cắt bớt nhật ký. CI tỷ số chỉ công bố khi ít nhất 80% mẫu bootstrap có tỷ số hữu hạn.
- Ngưỡng đuôi **1,35 có thể chỉnh**, cùng minN, minMass, số lần/seed bootstrap, số mẫu so sánh và cửa sổ gần nhất. Các giá trị mặc định trên là lựa chọn kỹ thuật, không là yêu cầu Basel hoặc ngưỡng thống kê đã hiệu chuẩn.
- Ma trận so sánh theo lớp tài sản, setup, kỷ luật, toàn bộ lịch sử/phần trước/cửa sổ 30 lệnh gần nhất. Dùng cùng Net R; không cộng chéo CP, HĐ và Lot. Nhóm thiếu mẫu hiện cảnh báo. Mỗi chiều giới hạn 100 nhóm lớn nhất để dựng kết quả; thông báo số nhóm/lệnh không dựng, vẫn giữ toàn bộ trong tổng thể và nhật ký.
- Gợi ý có mức tin cậy định tính và số mẫu. Không tự đổi Tier, cổng, cách định cỡ, hạn mức hoặc cấu hình. Đổi ngưỡng bằng chứng không làm mất kết quả kiểm chứng RCK/RoR vốn không phụ thuộc ngưỡng đó. So sánh kỳ vọng gần nhất với phần lịch sử trước là mô tả, không giả là kiểm định suy thoái có p-value.
- Basel/thanh khoản và PLAT **mặc định tắt**, có nhãn tham khảo. Chọn rõ yếu tố rủi ro MAR33; không suy phân loại pháp quy từ symbol/crypto. Hệ số thử nhạy cảm là `sqrt(LH/10)`; chế độ thanh khoản tùy chỉnh cũ được giữ và ghi rõ không phải bảng Basel. Tắt tùy chọn thì hệ số bằng 1. Bảng phân loại cũ không được tự nhận là Basel.
- PLAT nhập/lưu tối đa 5.000 cặp ngày HPL/RTPL đã đối soát, dùng 250 ngày mới nhất; xử lý hạng đồng giá bằng average ranks, KS bằng hai ECDF có ties. Thiếu mẫu, chưa xác nhận, trùng ngày, chuỗi hằng số đều không thể cho đèn xanh giả. Không thay HPL/RTPL bằng lịch sử lệnh hay MAE/MFE.
- Snapshot nâng `snapshot_schema=3`: ES/VaR thiếu bằng chứng là **null**, có `tail_evidence` ghi cỡ mẫu/trạng thái/CI nếu đã tính. Snapshot MC vẫn lưu được, JSON/SQL giữ nguyên từng trường và đơn vị; không cưỡng ép số hữu hạn cho thống kê chưa đủ mẫu.
- Job mới dùng Float64Array transferable với bản đầu vào còn nguyên để dự phòng; không dùng SharedArrayBuffer. Dùng lại Worker hiện có. Trên 20.000 lệnh cần bấm tính; Worker bị ngắt/không dùng được thì báo lỗi, không chuyển khối bootstrap lớn sang luồng giao diện.
- `schema/rules.schema.json`: mô tả cấu hình P5 bổ sung, giữ tên cấu hình cũ. `v6/scripts/verify.mjs`, `tests/unified/browser.mjs`: thêm suite P5. Các file kiểm thử mới: `advanced-core.mjs`, `advanced-browser.mjs`, `advanced-benchmark.mjs`. `core.mjs`, `regression.mjs`, `storage-browser.mjs`, `pdf-core.mjs`, `pdf-browser.mjs`, `pages.mjs`: cập nhật hợp đồng snapshot nullable và bật rõ tùy chọn thanh khoản cho ca thử chức năng cũ.

Không chỉnh bố cục giao diện Classic, schema giao dịch, cấu trúc kho lệnh/nạp-rút, quyền riêng tư Site, API broker hoặc dữ liệu production trong P5. Adapter chỉ được siết điều kiện cờ; số gốc và metadata vẫn được giữ.

## 2. Kết quả kiểm thử thật

Kết quả cuối: **116/116** ca V6 core (gồm **22 ca P5**); **3 script** qua node --check, **0 ID trùng**, **0 named function trùng**. Một lượt trình duyệt đầy đủ đạt **103/103** ca trên 12 suite, gồm **9/9** P5. Root đạt **153/153** ca Vitest trên 21 file, typecheck, build và **23/23** Node backend; build cuối chạy lại đạt. Đồng bộ hai tab **18/18** trên BroadcastChannel lẫn storage fallback; Classic lifecycle **4/4**, pageErrors các lượt cuối rỗng. Các assertion tiền/đơn vị gốc vẫn giữ; fixture nhập tay xác nhận rõ Net/1R/chi phí trước khi đòi các số đó đi vào rủi ro. Hợp đồng snapshot/import thiếu cờ được cập nhật để kiểm tra null/loại mẫu đúng, vẫn giữ từng trường JSON. Có log tái hiện hai lỗi cũ: nhận lệnh thiếu cờ và cho Gross đi vào rủi ro. Lỗi render ghi đè seed đang gõ được sửa bằng giữ giá trị ô đang có focus; có kiểm thử ép một lần ghi metadata trong lúc nhập. Log/JSON nguyên bản kèm gói.

Lệnh tại root: `npm test`; khi có bản build cuối, kiểm tra `tests/unified-two-tab-browser.mjs` bằng loader Cloudflare hiện có. Lệnh tại `v6/`: `node scripts/sync-lifecycle.mjs`, `node scripts/verify.mjs`, `node tests/unified/browser.mjs`. Benchmark riêng chọn `UNIFIED_SUITES=advanced-benchmark`.

Oracle độc lập Python Decimal 60 chữ số:

- α=0,7; β=0,1 → λ=**6,455696235812883**; `0,5^λ`=**0,0113930968735073**, tức khoảng **1,13931%**. Đây là ví dụ toán tham chiếu, không phải xác suất đo từ tài khoản người dùng.
- 100 quan sát gồm -5, -4, -3 và 97 số +1: khối lượng đuôi 2,5 → ES=(-5-4-0,5×3)/2,5=**-4,2**; VaR=-3; tỷ số=1,4. Ngưỡng mẫu được hạ rõ ràng trong ca unit test này; không đổi mặc định UI.
- Hệ số LH 10/20/40/60/120 lần lượt là 1; 1,41421356; 2; 2,44948974; 3,46410162. Không dùng các hệ số 1,18/1,76/2,15 trong đề xuất nếu chúng không khớp công thức.

22 ca P5 bao gồm cỡ mẫu riêng từng pool, phí/Net đã xác minh, tỷ số không xác định, bootstrap khớp oracle resample trực tiếp, biên PLAT nghiêm ngặt, ties, ma trận, Worker/main parity, từ chối backup PLAT lỗi, không thay Tier/gates và tránh fallback nặng. Test được tạo trước khi bổ sung API mới, lưu log thất bại do API chưa tồn tại.

9 ca trình duyệt P5 bao gồm thiếu mẫu, 480 lệnh đủ cờ/3 lệnh loại, CI Worker thật, cấu hình ngưỡng, hệ số sqrt(2), PLAT đỏ với 250 cặp vẫn giữ Tier/cổng, Gross không đổi ES Net, nhóm lọc 39 lệnh, kết quả stale, JSON roundtrip và mobile không tràn/ID không trùng. Log và ảnh thật nằm trong gói.

So sánh AST từng phương thức với HTML P4 đóng băng: **55 phương thức RiskMath cũ giữ nguyên**, chỉ `analyze` thêm nhánh gọi job mới; **13 phương thức thuần mới**. Thuật toán ES/RCK/NAV/MC cũ không bị thay bản khác. RiskStore/adapter siết tập bằng chứng và giữ đường rủi ro ở Net theo test trước/sau, do đó không giữ kết quả cũ nếu trước đó đã tính nhầm bản ghi thiếu cờ hoặc Gross. Sổ gốc và tiền nhập vẫn được giữ để đối soát. File FINANCIAL_REGRESSION.json liệt kê tên từng phương thức, REFERENCE_ORACLES.json chứa số Decimal độc lập.

## 3. Hiệu năng thực đo

- Luồng giao diện, 2.000 quan sát × 400 bootstrap: **109.9 ms** (engine 109 ms). Đây là phép đo nền, không là cách mặc định chạy CI trên giao diện.
- Worker thật, **100.000 quan sát × 200 bootstrap**, gồm CI và ma trận: **7706.8 ms** cả gửi/nhận, engine **7565 ms**. Giữ đủ 100000 quan sát, 41622 lệnh lỗ; cộng số mẫu trong chiều asset/setup khớp 100.000. Mảng nguồn còn nguyên 100.000 phần tử sau truyền.
- Khoảng cách frame lúc Worker chạy: 458 mẫu, median **16.7 ms**, p95 **16.8 ms**, max **100.1 ms**. Môi trường, CI và các số thô trong P5_ADVANCED_BENCHMARK.json. Lượt đo chạy riêng sau các bộ kiểm thử, không có ghi dữ liệu production.

Benchmark phân tích nâng cao không thay thế benchmark import, lưu kho, đồng bộ hoặc cuộn/lọc của P4. Chạy trên dữ liệu tổng hợp có lỗ lớn hiếm, bốn lớp tài sản và sáu setup; không dùng nhật ký thật. Ca lớn dùng 200 bootstrap (mức tối thiểu có thể cấu hình), khác mặc định 400. Không loại bớt quan sát để đạt thời gian thấp. Hai kích thước đo khác nhau nên không trình bày một tỷ lệ tăng tốc nhân tạo.

Không tuyên bố INP<40 ms, CLS=0 hoặc mọi thao tác 100k dưới 25 ms. Số đo frame khi Worker chạy chỉ mô tả bài đo, không chứng nhận trải nghiệm trên mọi thiết bị.

## 4. Điểm chưa chắc chắn / khác PDF

- Cỡ mẫu và bootstrap không bảo đảm nhìn thấy biến cố chưa xuất hiện; CI IID có thể lạc quan khi có tự tương quan/đổi chế độ. Nhóm không đủ mẫu giữ trạng thái thiếu bằng chứng. “Tin cậy cao/trung bình/thấp” là nhãn định tính theo hỗ trợ/CI, không phải xác suất kết luận đúng.
- ES đơn lệnh ở đây không phải ES ngân hàng dựa trên biến động 10 ngày. Số lệnh mô phỏng không tự tương đương số ngày. Nhân sqrt(LH/10) là thử nhạy cảm tham khảo; chưa thực hiện đầy đủ tập yếu tố rủi ro/tổng hợp nested horizons/hiệu chuẩn stress của FRTB. Các mô hình tổng nhiều lệnh cũ được ghi là mô phỏng; chưa có CI tham số riêng cho từng mô hình đó, không tính chúng thành quan sát lịch sử mới.
- PLAT áp dụng đúng hai metric và biên tham chiếu cho cặp dữ liệu đầu vào, không chứng nhận mô hình được chấp thuận. Quy tắc PLAT nằm ở MAR32, khác chỗ PDF gọi MAR33. Không tự hạ Tier/khóa cổng theo đèn giao thông như đề xuất PDF.
- Giữ các phương thức toán và cơ chế an toàn vốn cũ; chỉ siết tập đầu vào theo cờ đã xác minh. Vốn/rủi ro có thể được trình bày khác trước nếu bản cũ đã cộng dữ liệu thiếu cờ; dữ liệu gốc không bị xóa. Gợi ý P5 hoàn toàn không được nối thành lệnh tự điều khiển cơ chế đó. Các ngưỡng Tail P5 không phải ngưỡng mới của cổng an toàn vốn.
- Các giả định RCK ban đầu còn nguyên trong storage; ô α nội bộ cũ lưu tên `rckBeta`, β lưu tên `rckAlpha`. UI giải thích vai trò toán đúng, không rename dữ liệu người dùng hoặc đổi mặc định sang ví dụ 0,7/0,1.
- Chưa kiểm thử thị trường thực, mọi trình duyệt, điện thoại thật, cloud đa thiết bị hoặc bộ cấu hình tối đa 2.000 bootstrap × 100k. Không thêm cấu trúc thư mục/CI của P6 trong P5.

Nguồn gốc đã đối chiếu: [Busseti–Ryu–Boyd](https://web.stanford.edu/~boyd/papers/kelly.html), [MAR33.4/33.12](https://www.bis.org/basel_framework/chapter/MAR/33.htm?inforce=20230101&published=20200327), [MAR32.34–32.42](https://www.bis.org/basel_framework/chapter/MAR/32.htm?inforce=20230101&published=20200327). PDF và mã Gemini là đề xuất; các điều chỉnh bắt buộc của người dùng có ưu tiên cao hơn.

## 5. Rủi ro dữ liệu còn lại

- P5 không xóa key/kho cũ, không chạy reset trên nhật ký thật, không ghi website production. Cấu hình và cặp PLAT được đưa vào JSON backup, restore dữ liệu sai bị từ chối trước khi ghi. Khi cần xóa thật vẫn phải dùng quy trình tải/đọc lại backup của P2/P3.
- IndexedDB có thể bị người dùng/trình duyệt xóa; `storage.persist()` không là bảo đảm lưu vĩnh viễn. Canonical/mirror/cloud/R2 không có một transaction chung. Cần JSON độc lập và kiểm thử phục hồi cloud.
- Các giới hạn backup 24 MiB/object và 64 MiB/JSON cloud còn nguyên. Chưa chứng minh reset/khôi phục 100k lệnh kèm ảnh hoặc request server đã gửi trước reset. Client/thiết bị cũ chưa dùng generation fence vẫn là giới hạn P3.
- Cấu hình V6 và cặp PLAT nằm trong trạng thái V6 được backup; không suy diễn rằng chúng đã có một API cloud cấu hình P5 hoặc đồng bộ nhiều thiết bị được kiểm thử. Kho lệnh/nạp-rút chung vẫn giữ giao thức P3.
- Worker bị ngắt hoặc kết quả cũ không được sử dụng thay kết quả mới; dữ liệu đầu vào và nhật ký được giữ. Hơn 20k lệnh không tự chạy CI mỗi lần vào trang để tránh tính nặng ngoài ý muốn.

## 6. Bước tiếp theo và điểm dừng

**Đã hoàn tất P5**: ES hai pool có khối lượng phần lẻ/ngưỡng/CI, tỷ số cấu hình được, họ giới hạn RCK khớp oracle, ma trận đa chiều, gợi ý chỉ đọc và hai tham chiếu mặc định tắt. Đã sửa chênh lệch tập bằng chứng/Net trong đường rủi ro, adapter không tự nâng cờ và lỗi clobber seed được kiểm thử phát hiện.

Đề xuất P6: cấu trúc repo, chỉ dẫn AI, CI/CODEOWNERS và cơ chế chặn PR công thức khi kiểm thử đỏ. **DỪNG sau Giai đoạn 5, chờ người dùng nói “tiếp tục”. Chưa commit/push GitHub, merge hoặc deploy trong giai đoạn này.**
