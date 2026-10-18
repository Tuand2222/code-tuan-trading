# Trading Plan Pro v3 — R1 / R2

## Phạm vi và trạng thái

Chặng này cung cấp lõi domain và kho dữ liệu Mode L. Chưa thay nguồn dữ liệu của
12 trang, chưa chạy migration trên trình duyệt người dùng, chưa bật connector mới
và chưa deploy. R3–R4 làm adapter/Wizard; R5 nối giao diện; R7 nghiệm thu toàn web.

Baseline GitHub `50b95224b36e13213e95855e9fbf213d819a2481` được bổ sung các thay đổi
đã chạy trên Sites `a23d1c88974a0174820b2ef71a83c9cb83a6b27b`: nhận diện phiên Sites,
endpoint phiên, cấu hình project đang dùng và các sửa TypeScript/build. Không mang
thư mục `lib/trading` dang dở theo spec cũ từ bản làm việc Sites vào nhánh này.

## Các nhóm file

- `lib/trading/domain/types.ts`: hợp đồng và validator cho account, batch, fill,
  reported position/close, cash, overlay, Cycle, RealizedEvent và backup snapshot.
- `decimal.ts`, `normalize.ts`, `identity.ts`: số thập phân, chuẩn hóa UTC/đơn vị số,
  SHA-256 JSON tuple, multiset và xung đột. Suffix symbol chỉ bỏ theo cấu hình rõ ràng.
- `replayBook.ts`, `finance.ts`: FIFO/bình quân, mở/chốt từng phần/thêm lại/đảo chiều,
  lot đầu kỳ, cost allocation, quy đổi, reported records, cash, rủi ro, overlay.
- `selectors/metricRegistry.ts`: đủ 24 định nghĩa; `selectors/index.ts`: metric,
  calendar, fee impact, Shadow, setup, review; `dimensions.ts`: ngày/tuần/phiên/bucket.
- `application/replayLedger.ts`: replay nhiều tài khoản, re-anchor, preview rollback.
- `storage/LedgerStore.ts`, `DexieLedgerStore.ts`: port và transaction IndexedDB.
- `storage/backup.ts`, `migration.ts`, `browserStorage.ts`: checksum, dry-run,
  backup trước khôi phục/migration, persistence và nhắc sao lưu.
- `tests/trading/`: golden examples, property tests, storage/concurrency, baseline.

## Quyết định nghiệp vụ

Tiền và khối lượng là chuỗi thập phân. `decimal.js` dùng cấu hình riêng, precision
60, HALF_EVEN. Khi chia phí/giá vốn, các mảnh trung gian lấy 24 chữ số thập phân;
mảnh cuối nhận toàn bộ số dư để bảo toàn tổng. Không dùng EPSILON để đóng vị thế.

Phí dương là trả, âm là nhận. Phí chưa biết có `origin: missing` và **không có
amount**. Không đồng nhất thiếu dữ liệu với 0. Nếu báo cáo có Net thật nhưng không
đủ phí, giữ Net, để Gross chưa biết và đánh dấu partial. Tỷ giá gắn với từng batch
và từng khoản phí. Net tiền gốc và Net VNĐ được tính riêng, không suy ngược Net gốc
từ Net VNĐ khi các batch dùng tỷ giá khác nhau.

Sự kiện tiền tệ dùng ngày thực hiện; chu kỳ dùng ngày đóng cuối. Chốt một phần của
chu kỳ đang mở vẫn nằm trong Net/Lịch nhưng không nằm trong mẫu Win rate. Funding
ghi vào ngày phát sinh, gắn vào chu kỳ khi chỉ có một ứng viên; không cộng lại dòng
`reported-realized`. Dòng phí đối chiếu có `reconcilesFillId` không bị tính lần hai.

Không tự shadow chỉ vì cùng khoảng thời gian. Phần lõi chỉ tự shadow báo cáo khi
có Position ID chung và chu kỳ fill đã đóng; chồng thời gian đơn thuần yêu cầu xác
nhận. R3 phải bổ sung đối chiếu bao phủ/khối lượng và cấu hình lựa chọn nguồn.

Stop phải được xác nhận ban đầu, đúng phía và chu kỳ chỉ có một lần vào. Nguồn MT5
`reported-current` không tự sinh R. R cố định batch không vào số chính nếu chưa bật
`includeEstimatedRisk`. Tử và mẫu ROI/R dùng cùng tập mẫu.

Overlay giữ anchor cũ khi chu kỳ tách; tie-break tradeId xác định và đánh dấu
needs-attention. Nhiều overlay hội tụ một chu kỳ không được âm thầm ghi đè nhau.
Rollback giữ bằng chứng inactive. Import lại sau rollback sinh UUID mới; overlay
không còn anchor active sẽ detached, không bị xóa.

## Lưu trữ và migration

`commitBatch` kiểm schema, chuẩn hóa lại, tính hash, dedupe, replay và cảnh báo
trước khi mở transaction. Transaction so `expectedLedgerVersion`, ghi toàn bộ
thay đổi và tăng version cùng lúc. Hai tab cùng version chỉ một tab ghi được.
Hash/crypto/replay không chạy trong transaction IndexedDB để tránh tự auto-commit.

Hiện thay snapshot trong một transaction để ưu tiên tính đúng. R7 sẽ tối ưu cập
nhật các book bị ảnh hưởng và cache/Worker, không đổi port. Replay của R1/R2 là hàm
thuần async dùng được ở Worker nhưng chưa có Worker UI.

Migration legacy yêu cầu ledger rỗng, scope localStorage rõ ràng và cờ dữ liệu thật.
Giữ localStorage nguyên vẹn; lưu nguyên văn bản cũ vào archive trong cùng transaction
với ledger mới. Ghi chú, cài đặt hệ thống/định giá được giữ trong settings legacy.
Không tự đọc/gộp dữ liệu D1 hay tài khoản khác.

Vì nhật ký cũ không phải execution ledger, mỗi lệnh cũ thành hai fill tổng hợp trong
book riêng. Giá/khối lượng kỹ thuật không được xem là giá/khối lượng thật; bản ghi
gốc được giữ nguyên trong raw. Đóng lúc 12:00 giờ VN theo ngày cũ, mở lùi theo
durationMin; đây là thời gian quy ước, không phải timestamp broker. P&L lấy từ số
đã lưu, không tính lại từ giá giả lập. R và điểm kỷ luật cũ được giữ như thông tin
người dùng đã khai; không áp cách suy ra R từ stop cho synthetic legacy.

Backup schemaVersion 3 có SHA-256, kiểm schema/liên kết/active/uniqueness và dry-run.
Khôi phục là replace có kiểm version, tự lưu snapshot hiện tại vào archive trước
khi thay. Checksum phát hiện hỏng dữ liệu, **không phải chữ ký chứng minh nguồn**.
`exportAll` chỉ tạo JSON; UI phải gọi `markBackupDownloaded` sau khi tải thành công.
Persistence được yêu cầu sau lần commit đầu; nếu trình duyệt từ chối vẫn cần backup.

## Kiểm thử và cách chạy

```sh
npm run test:trading
npm run typecheck
npm run build
node --experimental-strip-types --experimental-loader ./scripts/cloudflare-validation-loader.mjs --test tests/*.test.mjs
```

Trên máy Windows dùng Node 24.19 và gọi trực tiếp `vinext/dist/cli.js build` do các
wrapper shell của dự án dành cho môi trường Sites. Worker production đã build,
bài test rendered HTML kiểm tra `default.fetch` hoạt động.

33 tests R1/R2 đã qua: gồm 60 lượt property FIFO/bình quân/bảo toàn phí, 100 lượt
fuzz chỉ số và 30 lượt hoán vị thứ tự replay (seed cố định). 20 tests cũ đã qua.
TypeScript không lỗi. Fixture `legacy-baseline.json` chụp 20 lệnh minh họa và 24
kết quả của baseline đã deploy, không chứa nhật ký thật của người dùng.

Test IndexedDB dùng fake-indexeddb; đây chưa phải nghiệm thu trình duyệt thiết bị
thật. Quota/eviction và chuyển đổi dữ liệu thật cần kiểm tra ở R5/R7 sau backup.

## Việc còn lại theo chặng

- R3: adapter thật, xác nhận đơn vị/múi giờ, báo cáo chéo, rate cho phí coin khác;
  file mẫu chưa có thì phải ghi chưa kiểm chứng. Không tự đoán tỷ giá BNB.
- R4: Wizard, batch history, yêu cầu xác nhận có giao diện, summary, tải CSV lỗi.
- R5: nối 12 trang, giao diện backup/persist, chạy migration có người dùng xem
  trước, Wilson/bootstrap và review UI; giữ logic định giá hiện có.
- R7: Worker, virtualization, cập nhật tăng dần, nghiệm thu dữ liệu thật.
- Điều chỉnh sự kiện doanh nghiệp là fill synthetic manual với quantityFactor,
  basisDelta và lý do do người dùng khai. Replay giữ provenance, không sinh P&L
  giả tại ngày điều chỉnh, phân bổ lại lot và không tự suy ra từ oversell.
  Form nhập điều chỉnh sẽ được nối ở R4/R5.
- Không triển khai Mode S mới/Binance API ở chặng này. D1/R2 cũ được giữ nguyên.

## Tài liệu thư viện đã đối chiếu

- https://dexie.org/docs/Dexie/Dexie.transaction(): auto-commit, atomic transaction.
- https://mikemcl.github.io/decimal.js/: cấu hình precision, rounding và clone.
