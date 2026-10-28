# Giai đoạn 3 — Kho chung và đồng bộ Classic ↔ V6

Ngày: 27/10/2026, Asia/Ho_Chi_Minh. Repo `Tuand2222/code-tuan-trading`, nhánh `fix/audit-missing-net`, nền HEAD `02dbbeac46e2b3fb9d06dbc435ea4cc02773fcfd`. Giai đoạn này thực hiện theo lần “tiếp tục” sau báo cáo P2. Chưa bắt đầu P4–P6, chưa commit/push/merge/deploy.

## 1. Đã làm gì, các file thay đổi

- `lib/journal-unified.js`: kho IndexedDB `TuanNhatKy_Unified_DB`, version 1, dùng API browser sẵn có. `trades` là nguồn chính của lệnh, `cashflows` là nguồn chính của nạp/rút; `meta` chứa cấu hình vốn, revision và generation. `migrations` chứa biên nhận kiểm đếm/checksum; `archives` giữ nguồn nguyên bản và những bản trùng ID nhưng khác nội dung. Tách dữ liệu theo owner; xóa tạo tombstone để chặn bản sửa cũ hồi sinh lệnh.
- Mỗi ghi lệnh là delta so với bản đã đọc: chỉ thêm/sửa/xóa các ID thực sự thay đổi. Transaction kiểm tra bản trước ở từng ID và cấu hình vốn; hai tab sửa hai lệnh khác nhau có thể cùng được giữ, cùng sửa một ID thì từ chối cả batch thay vì âm thầm ghi đè. Thứ tự gốc được giữ bằng seq, tránh sắp lại lệnh theo UUID khi timestamp trùng. Generation thay đổi khi reset; bản ghi/hàng chờ thuộc generation cũ bị chặn.
- Migrate hai bước: ghi nguồn đầy đủ + dữ liệu + receipt trạng thái `staged` trong một transaction; đọc lại, kiểm tra số lượng và SHA-256 của nguồn/rows, đối chiếu từng bản canonical hoặc bản xung đột đã lưu; chỉ sau đó đặt `complete`. Nếu bị đóng tab giữa hai bước, lượt sau tiếp tục xác minh. Checksum sai thì không đánh dấu hoàn tất và không xóa nguồn. Khi migrate đã hoàn tất, canonical được ưu tiên; một mirror cũ hỏng không làm canonical bị thay thế hoặc phải nhập lại.
- Nguồn được đọc có kiểm chứng: LocalStorage Classic theo owner, cache/risk trong IndexedDB Classic và state/tables V6 hiện có. Các key A/B legacy vẫn được bộ migrate Core hiện có chuẩn hóa trước; key gốc vẫn giữ. Không đoán thêm schema/key chưa có trong mã. Bản gốc trong LocalStorage/DB cũ không bị xóa trong migration; DB cũ tiếp tục làm mirror/recovery cho các chức năng có sẵn.
- `BroadcastChannel` truyền ID thay đổi, revision/generation và cờ cấu hình; cùng gói cũng phát qua `storage` event để dự phòng. Event ID và sender chống nhận lại/vòng lặp. Gói lớn hơn 200 ID chuyển sang thông báo đọc lại kho chung, chỉ kèm tối đa 100 ID thêm/sửa và 100 ID xóa; không nhét 50.000 bản ghi vào LocalStorage. Các trang hiện đọc lại view từ kho chung; chưa tối ưu render/lọc theo từng hàng (P4).
- Gọi `navigator.storage.persist()` khi mở kho chung. Kết quả cấp/từ chối được giữ ở `UnifiedJournal.persisted`; một lần gọi không đồng nghĩa được browser cấp lưu trữ bền vững.
- `lib/journal-adapters.js`: trích adapter đã có thành đúng một nguồn, không thêm lõi toán. Giữ metadata chưa biết và nguồn Classic để không rơi trường khi sửa bên V6. `BUY/SELL`/Long/Short và phí, risk flags tiếp tục theo adapter hiện có. Lệnh Classic thiếu 1R vẫn hiện ở V6 với `is_1r_verified=false`, `realizedR=null`; không tự suy ra 1R hoặc phí 0.
- `lib/classic-persistence.ts`: đọc/ghi journal và baseline qua kho chung; giữ mirror cũ phục vụ recovery. Lịch sử, thùng rác, bằng chứng và hàng chờ cũ vẫn được giữ theo API hiện có. Hàng chờ mới có generation, kiểm tra lại trước từng request; hàng chờ cũ không được phát lại sau reset. Không ghi lại risk/notes không đổi chỉ để cập nhật timestamp.
- `app/classic/page.tsx`: nhận delta cùng owner và refresh lệnh/cấu hình; bắt lỗi khi BroadcastChannel không có để dùng fallback. Bản canonical trống có quyền ưu tiên trước mirror cũ. Khi lưu form, đợi transaction thành công rồi mới đóng; nếu lệnh thay đổi ở giao diện khác, giữ form để đối chiếu. Giữ nguyên giao diện Classic.
- `v6/index.html`: thêm projection `UnifiedView`, nối vào boot và hàng đợi lưu. Luồng device không còn ghi đè nguyên danh sách trong DB Classic; dùng cùng canonical với Classic. Áp dữ liệu từ kho chung không phát lại như một lần sửa mới. Khi conflict lúc lưu, giữ snapshot chờ trong archive và hiện lỗi lưu; không tự áp bản remote lên bản chờ đó. Form cũ không được ghi đè một lệnh đã đổi từ nơi khác. Reset dừng lịch sync mới, đợi lần sync hiện tại kết thúc (tối đa 10 giây, quá hạn thì giữ dữ liệu) rồi mới chuẩn bị backup; cập nhật generation của view khi xong.
- `lib/journal-lifecycle.js`: safety backup gồm kho chung đúng owner; hard reset dọn cả kho chung và kho tương thích, giữ control generation để chặn phát lại. Các bảo vệ JSON tải thật/mã xác nhận của P2 giữ nguyên.
- Tiền tệ được giữ rõ theo profile. Classic dùng VNĐ theo hợp đồng nhập hiện có; V6 nhận đúng nhãn VNĐ khi dùng profile Classic. Không tự đổi số tiền USD thành VNĐ: profile USD có số dư/lệnh được chặn ghi bằng Classic và giữ để mở ở V6/xác minh FX. Profile khác đơn vị không bị gộp âm thầm. Đây là chốt ở adapter/storage, chưa phải form FX đa tài sản P4.
- `v6/scripts/sync-lifecycle.mjs`, `verify.mjs`: sinh ba module chung vào single HTML và kiểm tra nguồn nhúng khớp. Không thêm thư viện hay script ứng dụng bên ngoài; không thêm Worker/SAB.
- Test mới: `tests/trading/unified-journal.test.ts`, `tests/unified-two-tab-browser.mjs`, `v6/tests/unified/unified-store-browser.mjs`. Browser runner thêm suite kho chung vào lượt e2e mặc định. Các file và hash chính xác có trong `SOURCE_MANIFEST.json` của gói bàn giao.

## 2. Kết quả kiểm thử thực tế

Chạy từ root, Node runtime có sẵn; browser dùng Chromium Playwright có sẵn:

```powershell
npm test
node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/trading/unified-journal.test.ts tests/trading/lifecycle-client.test.ts tests/trading/owner-queue.test.ts
node --experimental-loader ./scripts/cloudflare-validation-loader.mjs tests/unified-two-tab-browser.mjs
node --experimental-loader ./scripts/cloudflare-validation-loader.mjs tests/lifecycle-classic-browser.mjs
```

Chạy từ `v6/`:

```powershell
node scripts/sync-lifecycle.mjs
npm run verify
npm run build
npm run e2e
```

Lượt cuối đạt: **19 file Vitest, 143/143 ca**, typecheck đạt, build Vinext/Worker đạt, **23/23** kiểm tra Node backend đạt. Verify V6 **92/92**, **3 script** qua node --check, ID trùng **0**, named function trùng **0**. Tổng hợp e2e **89/89** trên 10 suite: 78 ca đầu đạt, lượt Chromium bị `ERR_NETWORK_IO_SUSPENDED`; chạy lại hai suite đuôi đạt 11/11 trên tiến trình mới, giữ nguyên assertion và lưu log lần bị ngắt. Đây là kết quả theo suite, không ghi nhận một lượt tổng thể duy nhất xanh. Kiểm thử hai tab **18/18** trên cả hai transport; Classic lifecycle **4/4** trên bản build cuối, pageErrors rỗng. Lượt targeted kiểm tra storage/lifecycle/owner queue **19/19**. Log và JSON nguyên bản đi kèm gói, không chỉ có con số trong báo cáo.

Ca mới ở lõi gồm: profile mới rỗng; nguồn LS giữ nguyên bytes + SHA-256; đóng giữa stage/verify rồi tiếp tục khi fetch không dùng được; archive bị sửa thì chặn; ID xung đột được lưu đối chiếu; hai client sửa ID khác nhau không làm mất lệnh mới; cùng ID thì rollback toàn batch; tombstone; generation sau reset; cashflow/settings chung transaction; owner isolation; thiếu 1R/fees không tự nâng cờ; profile USD không bị ghi thành VNĐ; outbox generation cũ không gửi request. Các test dùng fake IndexedDB/Dexie đã có sẵn, không thêm package.

Browser dùng IndexedDB thật: migration giữ nguyên nguồn JSON, request persist được gọi; đóng tab sau stage rồi mở tab mới tiếp tục đủ hai bản ghi với fetch bị mô phỏng offline; archive sai checksum bị chặn; thông báo 50.000 ID được thu gọn; record/nguồn ban đầu vẫn nguyên. Phần “50.000 ID” chỉ là test kích thước thông báo, không phải benchmark nhập/lưu 50.000 lệnh.

Hai trang Classic/V6 dùng cùng origin local. Mỗi luồng được chạy cả BroadcastChannel và chế độ tắt hoàn toàn BroadcastChannel: nhập CSV từ Classic, hiện lệnh thiếu 1R ở V6; sửa V6 → bảng Classic; modal Classic → V6; không tăng revision do echo; form cũ ở hai phía không đè sửa đồng thời; vốn/nạp-rút có trong JSON thực sự xuất từ Classic; xóa có JSON tải thật rồi restore giữ ID; reset truyền sang tab kia, bản ghi cũ bị từ chối. Dữ liệu hoàn toàn tổng hợp, không ghi production.

Phân biệt kết quả giả lập/thật: API auth/cloud trong browser harness trả anonymous; Classic được chạy từ build local, V6 là HTML cùng mã hiện tại; đây không phải kiểm thử đăng nhập cloud production hay nhiều máy. Native OS save picker không được thao tác; fallback tải JSON và chọn lại file được chạy thật. Suite legacy vẫn dùng picker giả như P2, được tách khỏi bằng chứng tải thật.

Các lỗi đã phát hiện và sửa: trường `_restoreIdentity` còn sót sau bỏ device queue cũ; hai bản module khác thời điểm trong lần harness thử; môi trường Node không có LocalStorage; ghi risk/notes không đổi làm thay timestamp; form cũ có thể ghi đè thay đổi mới. Một lượt verify đã chặn nguồn nhúng chưa sinh lại; sinh đúng source rồi chạy lại. Một lượt e2e treo ở cleanup HTTP của fixture service worker; thêm closeAllConnections, giữ nguyên assertion marker/cache/registration, lượt acceptance chạy lại đạt 9/9. Không bỏ test/đổi golden để lấy kết quả xanh.

Financial regression: so nguyên khối RiskMath với bản P2 đóng gói; kết quả/hash thực tế ghi trong `FINANCIAL_REGRESSION.json`. Không sửa GOLDEN_EXPECTED P0/P1 và không thêm công thức tài chính ở P3.

## 3. Số đo hiệu năng

Chưa benchmark cuộn/lọc 100.000 dòng, INP, CLS hoặc mục tiêu dưới 25 ms; dành cho P4. Không tuyên bố đồng bộ 50.000 lệnh đạt độ trễ cụ thể. Test và log có thời gian chạy nhưng không phải SLA.

Kiểm tra kích thước thông báo 50.000 ID xác nhận packet chỉ chứa tối đa 200 ID và cờ `reload`, nhỏ hơn 4.000 ký tự với fixture `id-N`; browser receiver đọc kho chung thay vì nhận toàn bộ ledger qua LocalStorage. Chưa có benchmark bộ nhớ đỉnh cho migration/archive hoặc serialization 50k–100k dữ liệu thật. UI vẫn có các lần đọc toàn bộ view và mirror còn được ghi đầy đủ; không coi đây là virtualization.

## 4. Điểm chưa chắc, khác PDF, phần chưa làm

- Dùng native IndexedDB, BroadcastChannel và storage fallback, không dùng SharedArrayBuffer/Lamport hay thêm Worker mới. Chỉ dùng cơ chế Worker RiskMath sẵn có.
- Demo được giữ ngoài ledger live chung để không đẩy mock vào nhật ký thật. Legacy chưa đủ bằng chứng được giữ USER_LIVE/nguồn archive, không đoán theo ID rồi xóa. Bản ID trùng khác nội dung không được tự chọn bản “đúng”; cả hai có trong backup, một bản canonical và bản xung đột trong archive.
- Chỉ journal/nạp-rút/baseline có nguồn chính chung trong bước này. UI preferences, chartbook, simulation, thùng rác/undo/evidence/outbox tương thích vẫn ở cấu trúc cũ và được safety backup/reset bao phủ. Không xóa raw legacy khi migrate thành công. Chưa làm cấu trúc repo P6.
- Các dữ liệu khác profile tiền tệ không tự gộp/quy đổi. Form và luồng quy đổi đa tài sản đầy đủ thuộc P4. Việc chặn ghi trái đơn vị có thông báo giữ dữ liệu, không tạo tỷ giá giả.
- Không triển khai/kiểm thử cloud production trong bước này; D1/backend/bridge hiện có vẫn giữ. Không thêm dịch vụ lưu mới hoặc hứa lưu mãi mãi. Không thay API schema bằng đề xuất trong PDF.
- Chưa làm bảng ảo hóa, sửa tại ô/form đa tài sản P4; ES CI/minN, Basel/PLAT/advisory P5; AI/CI/P6. Chưa push GitHub/deploy.

## 5. Rủi ro dữ liệu còn lại

- Mỗi transaction trong kho chung có tính nguyên tử; canonical + mirror cũ + cloud + R2 không có một transaction chung. Mirror thất bại phải báo lỗi; bản canonical hoặc source/archive đã giữ không tự biến mất. Browser không được cấp persist hoặc bị xóa dữ liệu trang vẫn có thể mất bản trên máy; cần JSON độc lập và cloud có kiểm tra phục hồi.
- Generation đã chặn ghi/tab/outbox của client P3 sau reset. Không thể thu hồi một request server đã gửi đi; thiết bị khác/phiên bản web cũ chưa dùng giao thức này chưa có server generation fence toàn cục. Vẫn cần kiểm thử vận hành cloud nhiều máy trước khi coi reset đa thiết bị là tuyệt đối.
- Canonical settings và nạp/rút được đồng bộ local; bridge đăng nhập/cloud giữ cơ chế CAS/hàng chờ sẵn có. Chưa chạy E2E đăng nhập cloud hai thiết bị. Không suy diễn kết quả hai tab local thành bảo đảm nhiều thiết bị.
- Khi conflict, bản pending V6 có archive, form Classic giữ nội dung. Chưa có giao diện gộp từng trường hoặc phục hồi mọi archive/evidence/queue vào cloud chỉ bằng một nút. Safety JSON có dữ liệu để đối chiếu/khôi phục; chưa hứa roundtrip tự động toàn bộ cloud/R2.
- Receipt `complete` là dấu chuyển quyền sang canonical; sửa raw key bằng phiên bản web cũ về sau không tự được nhập lại. Các key/database cũ vẫn còn để sao lưu/đối chiếu. Khi triển khai tương lai cần kiểm soát các tab/phiên bản cũ đang hoạt động.
- Các giới hạn backup 24 MiB object và 64 MiB JSON cloud của P2 vẫn có; fail closed khi vượt, chưa benchmark reset nhật ký 50k–100k có nhiều ảnh.

## 6. Bước tiếp theo và điểm dừng

P3 hoàn tất khi các lượt kiểm chứng nêu trên đều đạt: kho chính chung, migration không phá hủy có đếm/checksum và phục hồi gián đoạn, sync hai tab hai chiều với fallback và chống echo, giữ lệnh thiếu 1R ở trạng thái chưa xác minh.

Đề xuất P4: form theo asset class/đơn vị, xử lý profile tiền tệ rõ ràng, bảng ảo hóa/sửa tại ô, benchmark 100.000 dòng và kiểm tra nhãn/icon tiếp cận. **DỪNG sau Giai đoạn 3, chờ người dùng nói “tiếp tục”. Không push/deploy trong lượt này.**
