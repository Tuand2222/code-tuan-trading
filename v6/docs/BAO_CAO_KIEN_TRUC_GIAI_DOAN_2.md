# Giai đoạn 2 — Vòng đời nhật ký và bảo vệ thao tác xóa

Ngày báo cáo: 27/10/2026, Asia/Ho_Chi_Minh. Repo `Tuand2222/code-tuan-trading`, nhánh `fix/audit-missing-net`, nền HEAD `02dbbeac46e2b3fb9d06dbc435ea4cc02773fcfd`. Các thay đổi P1/P2 đang ở bản làm việc, chưa commit/push/merge/deploy.

Phạm vi được duyệt là Giai đoạn 2 trong văn bản đính kèm. PDF là đề xuất; chưa triển khai Giai đoạn 3–6. Các kiểm thử chỉ dùng dữ liệu tổng hợp và trình duyệt local, không thao tác nhật ký thật hoặc bản web public.

## 1. Đã làm gì và file thay đổi

- `lib/journal-lifecycle.js`: nguồn chung cho trạng thái `UNINITIALIZED_FIRST_RUN`, `CLEAN_PRODUCTION`, `DEMO_SANDBOX`, `CLEAN_SLATE_LOCKED`, `LIVE_PRODUCTION`; cờ `noMock` bền qua các chuyển trạng thái sau khi khóa. Trạng thái tách theo tài khoản, phát CustomEvent/BroadcastChannel khi thay đổi. Chỉ lựa chọn mẫu rõ ràng mới được tạo mẫu; hồ sơ mới không tự có vốn hoặc lệnh mẫu.
- `AccountBaselineSettings` trong cùng file: vốn đầu kỳ, 1R mặc định, friction và hạn mức tiền khởi đầu bằng 0; sửa bằng các ô cài đặt hiện có. Demo có baseline riêng được gắn rõ. Khi bỏ mẫu, vốn/limit mẫu chưa được người dùng xác nhận và còn nguyên được trả về 0; giữ các giá trị người dùng đã sửa. Các tỷ lệ quản trị/preset và hằng số toán không bị tùy tiện xóa hoặc đổi công thức.
- `v6/index.html`: nối lifecycle vào boot, mẫu, xóa mẫu, sửa/hoàn tác, modal xóa lệnh, thùng rác, backup/import và hard reset. Giữ DOM/style trang nghiệp vụ; thêm nhóm điều khiển dữ liệu nhỏ. Gắn `origin` khi chuẩn hóa/ghi lệnh và dòng tiền. Mẫu cũ chỉ được nhận diện theo nội dung khớp chính xác; bản ghi không đủ bằng chứng được giữ như dữ liệu người dùng. Bản mẫu đã được sửa được giữ lại khi dọn mẫu.
- Bốn mức thao tác: dọn mẫu nguyên trạng; lịch sử sửa/hoàn tác tối đa 50 thao tác; xóa mềm với cửa sổ khôi phục 30 ngày, giữ ID và trường dữ liệu; hard reset phải có JSON đã lưu/xác minh và mã `XOA NHAT KY`. Undo từ chối ghi đè bản mới hơn. Khóa mẫu không bị undo làm mất.
- `app/classic/page.tsx`: bỏ seed tự động khi khởi tạo trống/lỗi; giữ giao diện Classic và thêm nút hoàn tác/hard reset trong phần quản lý. Xóa lệnh/ảnh, thay dữ liệu và reset chờ backup đã xác minh. Xuất JSON thêm `riskSettings`, gồm vốn và `cashFlows`; nhập lại hiểu cả JSON Classic và phần Classic trong safety backup. Xóa mẫu giữ lệnh thật lẫn trong bộ mẫu.
- `lib/classic-persistence.ts`: gắn origin ở biên ghi ledger; ledger và lịch sử thay đổi lưu cùng transaction IndexedDB. Đồng bộ từ xa không tạo lịch sử sửa giả; tiếp tục phát tín hiệu của bridge hiện có. Không thêm database P3.
- `lib/risk-analytics.ts`: vốn mặc định lấy từ baseline chung; không đổi công thức phân tích.
- Backup bảo vệ thao tác gồm view hiện tại, dữ liệu browser đúng tài khoản, queue/log/trash/archive và bằng chứng Blob/File được mã hóa base64. Native picker chờ đóng file và đọc lại đúng nội dung; trình duyệt không có picker sẽ tự tải JSON và yêu cầu chọn lại chính file đó để đối chiếu. Hủy, file sai hoặc dữ liệu thay đổi trong lúc lưu đều chặn thao tác xóa. Không dùng một lần click tải xuống làm bằng chứng đã lưu.
- `app/api/journal-reset/route.ts`: endpoint chỉ chủ tài khoản, xuất snapshot cloud có checksum và các object liên quan trước reset. POST kiểm tra xác nhận, chủ tài khoản, checksum và fence trong transaction D1; từ chối khi dữ liệu đổi. Xóa journal, trash/audit, report/cache và archive queue thuộc chủ tài khoản; giữ account, authentication và broker connections. Revision cloud tăng đơn điệu. Dọn object R2 có báo lỗi riêng nếu chưa hoàn tất.
- `v6/scripts/sync-lifecycle.mjs`, `build.mjs`, `verify.mjs`: sinh bản nhúng V6 từ đúng một nguồn lifecycle; kiểm tra nguồn nhúng khớp. V6 vẫn là một HTML, không thêm thư viện ứng dụng.
- Test mới: `v6/tests/unified/lifecycle.mjs`, `lifecycle-browser.mjs`, `tests/trading/journal-reset.test.ts`, `lifecycle-client.test.ts`, `tests/lifecycle-classic-browser.mjs`. Cập nhật fixture/đợi thao tác bất đồng bộ trong `browser.mjs`, `core.mjs`, `regression.mjs`, `storage-browser.mjs`; giữ các assertion nghiệp vụ và golden cũ.

Không sửa AGENTS.md, không thêm migration database, thư viện, Worker hay mạng ngoài mới. Browser test dùng CDN/font vốn có để tải trang; không tải dữ liệu thật lên dịch vụ ngoài.

## 2. Kiểm tra thực tế

Lệnh chạy từ `v6/`:

```text
node scripts/sync-lifecycle.mjs
npm run verify
npm run build
npm run e2e
$env:UNIFIED_SUITES='regression,lifecycle-browser'; node tests/unified/browser.mjs
```

Kết quả cuối: verify **92/92**, kiểm tra cú pháp **3 script**, ID trùng **0**, named function trùng **0**; build single HTML đạt. Lượt e2e đầy đủ **84/84** trên 9 suite. Sau khi bổ sung backup cho thao tác xóa ảnh Chartbook, chạy lại hai suite bị ảnh hưởng: regression **24/24**, lifecycle browser **6/6**, không lỗi JS.

Trong lifecycle browser, picker native bị tắt để thực sự tải JSON xuống đĩa và đọc lại: file sai/hủy giữ dữ liệu, xóa mềm rồi khôi phục khớp từng trường, undo không hồi sinh mẫu, hard reset rồi reload vẫn trống và vốn 0. Các suite legacy dùng picker giả để kiểm thử luồng bất đồng bộ; không coi đó là bằng chứng đã thử hộp thoại hệ điều hành.

Lệnh chạy từ root:

```text
npm test
node --experimental-loader ./scripts/cloudflare-validation-loader.mjs tests/lifecycle-classic-browser.mjs
```

Lượt `npm test` cuối đạt **18 file Vitest, 128/128 ca**, `tsc --noEmit` đạt, build Vinext/Worker đạt, **23/23** kiểm tra Node backend đạt. Lượt Classic browser chạy lại trên chính bản build cuối đạt **4/4**, `pageErrors=[]`, không ghi production. Test D1/client mới nằm trong lượt 128 này; lượt tách riêng trước đó cũng đạt **6/6**. Log gốc đi kèm để đối chiếu.

Classic browser kiểm tra profile mới → chọn mẫu → dọn mẫu → reload; CSV tổng hợp → JSON có cấu hình vốn; xóa có JSON → khôi phục đúng ID; hard reset đúng mã giữ dữ liệu tài khoản khác. `RESULTS.json` ghi số ca và pageErrors thực tế. API D1 được thử bằng Miniflare; R2 là byte store giả, không phải bucket production.

Test mới server/client bao gồm: owner mismatch, thiếu bằng chứng/mã, snapshot cũ, cập nhật chen giữa snapshot và transaction, thiếu object thì chặn, backup có bytes ảnh và lệnh trong trash, reset không đụng người khác, revision tăng; Blob/File giữ bytes/type/tên Unicode/lastModified=0; reset owner A giữ active V6 và archive owner B.

`RED_BEFORE.json` lưu **4/7 đạt, 3 lỗi** trước khi nối lifecycle vào Core; `GREEN_CORE.json` và lượt verify cuối đạt **7/7** ca lifecycle. Lỗi tìm thấy qua browser đã sửa: reset khi DB Classic chưa có store; trường tạm restore lọt vào bản ghi; assertion backup cũ chưa đọc wrapper; đợi thao tác xóa ảnh bất đồng bộ. Không bỏ ca lỗi để đạt.

Đối chiếu nguyên khối RiskMath với bản P1 đã đóng gói: **32.679 byte giống hệt**, SHA256 cả hai `a085b48999897d6232996abd25e7a000e6cee061ac92da0be6bf8157f5d67de9`. Không ghi đè golden P0/P1. Bằng chứng nằm trong `FINANCIAL_REGRESSION.json`, các JSON suite và log gốc đi kèm ZIP.

## 3. Số đo hiệu năng

Giai đoạn này không benchmark reset 50.000/100.000 lệnh, cuộn 100.000 dòng, INP, CLS hoặc mục tiêu dưới 25 ms. Thời gian test trong log là thời gian kiểm thử, không phải SLA. Build/Vitest đã chạy kiểm tra tải lớn có sẵn của repo; không suy diễn rằng backup/reset hoặc đồng bộ nhiều tab đã đạt tốc độ đó.

Backup cloud giới hạn 24 MiB bytes object và 64 MiB JSON để từ chối an toàn thay vì xóa khi không thể sao lưu đủ. Chưa có số đo bộ nhớ đỉnh cho backup lớn; mã hóa base64/JSON có thể tốn thêm bộ nhớ.

## 4. Điểm chưa chắc và phần chưa làm

- Chưa tạo `TuanNhatKy_Unified_DB`, migrate có checksum, delta protocol hoặc storage-event fallback. Đó là Giai đoạn 3. Tín hiệu hiện tại nối bridge sẵn có; chưa chứng minh giao thức hai tab hoàn chỉnh theo tiêu chí P3.
- `origin` của legacy không xác định được bảo toàn như USER_LIVE, không đoán theo ID và xóa. Đồng bộ/chuẩn hóa toàn bộ dữ liệu lịch sử thuộc P3. IMPORTED_VERIFIED không được gán chỉ vì tệp CSV có mặt; vẫn cần đủ bằng chứng P1.
- Khóa lifecycle lưu theo tài khoản trên browser hiện tại; chưa là generation toàn cloud. Profile mới luôn bắt đầu trống, nhưng máy khác có trạng thái cũ cần cơ chế P3.
- Thùng rác local giữ nội dung quá 30 ngày nhưng vô hiệu hóa khôi phục, tránh xóa vĩnh viễn tự động khi chưa có backup. Cloud vẫn dùng chính sách xóa mềm/governance hiện có. Chưa thêm dịch vụ dọn định kỳ mới.
- Đã kiểm thử anonymous/device Classic trong trình duyệt và API owner bằng D1 giả lập; chưa chạy hộp thoại native OS, tài khoản đăng nhập production hoặc reset tài khoản thật. Không mở public site để thay đổi dữ liệu.
- Chưa làm form đa tài sản/virtualization (P4), ES CI/minN, Basel/PLAT/advisory (P5) và tái cấu trúc AI/CI (P6).

## 5. Rủi ro dữ liệu còn tồn tại

- D1 có fence transaction; D1 + R2 + hai database browser không có một transaction chung. Mất mạng/lỗi dọn local sau khi cloud đã reset có thể để lại trạng thái dở dang; JSON đã xác minh là bản phục hồi. Lỗi xóa object được báo `cleanupErrors`, có thể còn object riêng tư chờ dọn.
- Tab hoặc thiết bị cũ còn dữ liệu/queue trong bộ nhớ có thể ghi lại dữ liệu thật sau reset. Chưa có generation token và điều phối dừng mọi thiết bị; cần giải quyết ở P3 trước khi coi reset đa thiết bị là hoàn chỉnh. Test hiện tại chỉ chứng minh khóa mẫu/reload và phân quyền snapshot/reset.
- Undo nhiều lệnh trên cloud không có transaction chung cho toàn bộ thao tác; xung đột version có thể làm áp dụng một phần hoặc yêu cầu dùng mục khôi phục/governance. Không tuyên bố undo cloud có tính nguyên tử toàn bộ.
- Safety JSON chứa snapshot đa kho và bytes bằng chứng; giao diện nhập hiện tại khôi phục view được hỗ trợ, chưa tự động tái nhập toàn bộ cloud/R2/queue/archive vào mọi kho. Cần adapter khôi phục đầy đủ ở P3. Giữ JSON độc lập trước khi reset thật.
- Chưa có ràng buộc generation server cho mọi POST cũ; fence reset chỉ kiểm tra khoảng đua được test, không thay thế giao thức đồng bộ chống phát lại. Không tuyên bố đã xử lý toàn bộ cạnh tranh nhiều thiết bị.
- Không có cam kết lưu vĩnh viễn trên browser. Browser có thể bị người dùng/OS dọn. Sao lưu và cloud vẫn cần chính sách vận hành/kiểm tra phục hồi riêng.

## 6. Bước tiếp theo và điểm dừng

Giai đoạn 2 hoàn tất tiêu chí profile mới không tự có mẫu, xóa mẫu rồi reload không hồi sinh mẫu; bốn cấp thao tác và baseline đã nối UI, có kiểm chứng như trên. Bản làm việc được đóng gói cùng manifest/checkpoint và kết quả thật, chưa push GitHub/deploy.

Đề xuất Giai đoạn 3: kho IndexedDB thống nhất, migrate không phá hủy có đếm/checksum, sync delta hai giao diện và fallback; ưu tiên generation/reset coordination, kiểm thử hai tab/mất kết nối và adapter phục hồi đa kho. **DỪNG tại đây, chờ người dùng nói “tiếp tục” theo quy trình được yêu cầu.**
