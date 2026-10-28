# BÁO CÁO KIẾN TRÚC — GIAI ĐOẠN 1

Ngày26/10/2026. Hoàn thành schema và lõi chuẩn hóa Giai đoạn1; dừng trước Giai đoạn2 theo quy trình đã yêu cầu. Source thay đổi trên checkout branch fix/audit-missing-net từ commit02dbbeac46e2b3fb9d06dbc435ea4cc02773fcfd. Chưa commit/push/deploy các thay đổi Giai đoạn1; website công khai vẫn ở phiên bản trước.

## 1. Đã làm / file thay đổi

- schema/trade.schema.json: hợp đồng dữ liệu chuẩn bốn asset class, đơn vị riêng, origin bắt buộc do caller xác nhận, cờ xác minh Net/1R, tiền tệ và payload gốc. Không suy luận origin từ tên file.
- schema/rules.schema.json: mô tả đúng năm giả định và lựa chọn hiện tại; không tạo thêm kho settings mới.
- v6/index.html: TradeNormalizer thuần, expose qua Unified; RiskMath.netR/verifiedNet lọc cờ thiếu phí/P&L/1R; capitalNAV/capitalLimits/dailyTracker bỏ tiền chưa xác minh, NAV đánh warning để safety gate không mở khi thiếu dữ liệu. Core.normalizeTrade và adapter Classic không xuất realizedR cho lệnh chưa xác minh; toClassic không nâng cờ1R/P&L false thành true.
- v6/tests/unified/normalizer.mjs: 19 ca số học/schema/biên và worker. v6/tests/unified/normalizer-browser.mjs:2 ca browser.
- v6/scripts/verify.mjs và v6/tests/unified/browser.mjs: đưa test mới vào lệnh kiểm tra sẵn có; không thêm workflow CI hoặc thư viện ứng dụng.
- v6/docs/BAO_CAO_KIEN_TRUC_GIAI_DOAN_1.md: báo cáo này.

Giữ nguyên DOM, màu/nhãn, form và cấu trúc Classic/V6. Không thay backend/D1, key LocalStorage hay tên IndexedDB, không migrate hoặc xóa dữ liệu. Normalizer mới là API thuần đã kiểm thử; chưa nối mọi form/import qua schema mới. Đó là adapter/lưu trữ Giai đoạn3 và form thích ứng Giai đoạn4, không tuyên bố giao diện đa tài sản mới đã triển khai.

## Quy ước tiền và xác minh

- 1R mới = |Entry−Stop ban đầu| × Quantity × Contract multiplier × FX(account/quote), **không gồm phí, thuế, funding**. Stop phải ở đúng phía và được xác nhận là stop ban đầu; không lấy stop hiện tại làm bằng chứng. Reported1R chỉ được nhận khi caller xác nhận nguồn và PRICE_ONLY; không tự đổi1R đã gồm phí sang giá trị mới.
- Net = Gross − (fees + taxes + swap_cost) × FX. Phí và thuế là chi phí không âm; swap_cost có thể âm khi nhận tiền. Các chi phí nhập cùng quote_ccy. Không tự ước tính phí; số0 phải được xác minh như các giá trị khác.
- Nếu có reported net đã xác minh, coi là số tiền account_ccy và giữ nguyên; không trừ phí lần hai. Reported1R cũng ở account_ccy. Hai cờ false luôn thắng dù có con số dương.
- FX chỉ tự1 khi hai currency giống hệt nhau. Khác tiền tệ phải có tỷ giá dương được xác minh. Multiplier/tick conversion phải do caller xác nhận, không đoán theo mã. Không tự ghép USD và USDT.
- SHARES/CONTRACTS/LOTS/UNITS có tổng riêng; không có total_quantity cộng chéo. Cổ phiếu37 giữ37; cổ phiếu phân số chỉ nhận khi khai bước broker rõ ràng; hợp đồng bắt buộc số nguyên; không làm tròn0 lên1.
- Notional chỉ cộng trong cùng account_ccy; thiếu tỷ giá/hệ số cho null và đếm thiếu, không đổi thành0.
- Legacy có netPnl/initialRisk khai báo từ trước vẫn giữ quy ước đã có, để không tự đổi lịch sử. Cờ feesKnown/pnlKnown/riskEstimated và cờ xác minh mới đều được tôn trọng; chưa mass-migrate/khẳng định mọi lệnh legacy đã có bằng chứng độc lập. Sổ gốc vẫn giữ các con số và metadata cho bước đối chiếu sau.

## 2. Test thực tế

Đã chạy test yêu cầu mới trên mã trước khi sửa:16/16 ca đỏ, gồm tái hiện phí/P&L chưa biết vẫn đi vào R, API normalizer chưa tồn tại và cờfalse bị bỏ qua. Sau triển khai:19/19 ca xanh, thêm kiểm tra vốn/daily loss, worker và JSON Schema. Lưu RED_BEFORE.json/GREEN.json trong gói kết quả.

```powershell
# Trong v6/ — Node v24.22.1 và Chromium đã cài
node tests/unified/normalizer.mjs
node scripts/verify.mjs
node scripts/build.mjs
$env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/ADMIN/AppData/Local/ms-playwright'
node tests/unified/browser.mjs
# Suite mới được bổ sung khi lượt full cũ đang chạy, nên chạy riêng thêm:
$env:UNIFIED_SUITES='normalizer-browser'
node tests/unified/browser.mjs
# Từ workspace, đối chiếu đường cơ sở P0 nguyên vẹn:
node outputs/architecture-p1/golden-regression.mjs work/code-tuan-trading
git -C work/code-tuan-trading diff --check
```

Output cuối được lưu trong VERIFY_RESULTS.json/BROWSER_RESULTS.json/GOLDEN_RESULTS.json:

```json
{"unitAndCorePassed":85,"total":85,"scriptsChecked":3,"duplicateIds":0,"duplicateFunctions":0}
{"browserPassed":78,"browserTotal":78,"pageErrors":[],"suites":8}
{"unchangedP0GoldenCases":23,"comparedLeaves":3176,"workerParityCases":2,"pass":true}
{"singleHtmlBuild":true,"buildMatchesSource":true,"sha256":"5605595eaad46dc79bc3dd492ff0fdf5881e789bf9caef906185d85872d4481f"}
```

Trong23 nhóm golden giữ nguyên có dữ liệu A/B, ES/VaR, RCK, RoR, NAV/dòng tiền, sizer, năm giả định, backup và xóa mẫu nạp lại. Chỉ loại khỏi so số cũ nhóm classicV6VerificationBoundary vốn chính là lỗi được sửa; thay bằng test yêu cầu mới. Không ghi lại/đổi GOLDEN_EXPECTED củaP0.

Kết quả số mẫu tự tính tay: stock37CP, Entry100/Stop95/Exit110, multiplier1000 ⇒1R185000, gross370000, chi phí120 ⇒net369880. Futures short2HĐ ES, tick12.5/.25 ⇒multiplier50, khoảng stop5 ⇒1R500; lãi10điểm ⇒gross1000, phí4 ⇒net996. Forex.03lot ×100000, khoảng stop.01, FX25000 ⇒1R750000VND; gross60USD, phí2 và funding nhận.5 ⇒net1462500VND. Crypto short.00125unit, khoảng giá1000 ⇒1R1.25, phí.1 ⇒net1.15.

Browser mới kiểm chứng lệnh gross120/fees10/swap5/risk100 nhưng feesKnown=false: rN0, realizedRnull, equity phần đã biết10000, warningtrue, gatesfalse, header$10,000.00; trang Lớp2 vẫn render, không lỗiJS. Browser đầy đủ kiểm tra21route, thêm/sửa/backup/restore, responsive, a11y, Worker và cache. Dữ liệu hoàn toàn tổng hợp trong browser local; không chạm dữ liệu tài khoản thật.

Lỗi harness đã xử lý: dung sai tuyệt đối1e-9 quá chặt cho tiềnFX khoảng1.46triệu, đổi sang tương đối1e-11 (không làm tròn công thức/đổi số kỳ vọng); browser fixture đầu dùng sample chưa có mặc định UI gây lỗi ext2.opt, sửa fixture giữ snapshot đã boot. Test cuối đều xanh; không bỏ test đỏ để đạt.

AJV đã có sẵn qua dependency phát triển được dùng để kiểm tra schema trong Node; không cài/thêm package và không đưa AJV vào ứng dụng. V6 vẫn một HTML, không thêm external script mới. Chỉ tài nguyên CDN/font vốn có được browser test sử dụng.

## 3. Hiệu năng

Không chạy benchmark100k ở Giai đoạn1 và không tuyên bố đạt INP/CLS/<25ms. Các thời gian NodeVM đơn lẻ có trong GOLDEN_RESULTS.json, dùng để truy vết lần chạy, không coi là SLA. Không thêm Worker/SAB mới; Worker hiện có vẫn sinh đúng từ RiskMath.

## 4. Điểm chưa chắc / phạm vi chưa làm

- Currency và multiplier phải được xác nhận theo báo cáo/broker. P1 không tự chọn tỷ giá theo tên symbol, không tự chuyển currency của hồ sơ legacy.
- PRICE_ONLY là quy ước canonical mới; không áp lại lên initialRisk cũ khi chưa biết có gồm phí hay không. Adapter đối chiếu kiểu risk và quy đổi toàn bộ dữ liệu là bước sau.
- Chưa thay form Classic, CSV parser cũ, state lifecycle, migrate hai DB hoặc cơ chế sync. Bộ normalizer đã sẵn sàng, việc nối đầy đủ các luồng cần đúng Giai đoạn3/4.
- Chưa sửa ES CI/minN, ngưỡng1.35, BaselLH/PLAT hoặc advisory; chưa dùng các hệ số sai trong PDF. Đây là Giai đoạn5.
- Full root backend/D1 test không chạy lại vì không thay backend/Classic; chưa chạy toàn bộ import cloud với100k ởP1. Browser kiểm thử V6 local, không xác minh phiên bản public sau triển khai vì chưa deploy.

## 5. Rủi ro dữ liệu còn lại

Các rủi ro P0 vẫn còn: Classic JSON thiếu cấu hình/nạp-rút; hard reset chưa đợi bản JSON thật tải xong; origin/lifecycle chưa migrate thống nhất; cloud/settings/queue cần adapter và backup đầy đủ. P1 không xóa/migrate dữ liệu và không thay kho lưu, nên không tạo thao tác mất dữ liệu mới. Các lệnh thiếu bằng chứng vẫn giữ trong nhật ký; chỉ bị loại khỏi tính R và số tiền chưa xác minh không nâng vốn an toàn.

Phần tính vốn đã biết vẫn có thể xuất số tạm khi thiếu P&L, nhưng warning và safety gate phản ánh dữ liệu chưa đủ. Không được coi con số này là equity đã đối soát hoàn chỉnh. Cần nhãn/form khắc phục ở Giai đoạn4. Cờ xác minh false không thể tự nâng chỉ nhờ sửa ghi chú hoặc nhập số1R dương.

## 6. Bước tiếp theo và điểm dừng

Đề xuất Giai đoạn2: vòng đời dữ liệu và xóa dữ liệu mẫu, CLEAN_SLATE_LOCKED, bốn cấp xóa, baseline settings. Giữ nguyên UI Classic và dữ liệu gốc; test lại không tái sinh mẫu sau reload. Chưa bắt đầu Giai đoạn2 trong lượt này.

**DỪNG sau Giai đoạn1 theo chỉ dẫn “sau mỗi giai đoạn… chờ tôi nói tiếp tục”. Chưa pushGitHub/deploy thay đổiP1.**
