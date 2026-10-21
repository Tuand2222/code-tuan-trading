# Trading Plan Pro v6 — S1

V6 chạy song song với nhật ký v3. S1 cung cấp lõi tính toán, lưu trữ và trang kiểm chứng; chưa thay giao diện sản phẩm. Giữ Tổng quan cũ và lựa chọn giao diện MetriX/Theo dõi hệ thống theo yêu cầu chủ dự án.

## Chạy và kiểm tra

Trong `v6/`, Node 24.19.0:

```sh
npm ci
npm run dev
npm run verify
npx playwright install --with-deps chromium
npm run e2e
```

`verify` chạy lint, TypeScript strict, 20 kiểm thử unit/golden và build. E2E kiểm tra nhập fixture gốc, xác nhận trước lưu, tải lại vẫn còn dữ liệu và axe ở 360/768/1280. Kết quả CI phải được kiểm tra riêng; không coi việc viết test là đã chạy thành công.

## Phạm vi S1

- `src/core`: phép tính Decimal thuần, giá vốn sau chốt từng phần/mua thêm, 24 chỉ số, R, phí, lịch theo thời điểm hiện thực hóa, shadow giả định, hàng đợi review, setup/rolling và bootstrap có seed.
- `src/data`: schema v4, kiểm tra quan hệ và nghiệp vụ, Dexie transaction + revision chống ghi đè cạnh tranh; chỉ mục đóng lệnh nằm ngoài Trade canonical.
- Sao lưu JSON v4 có checksum, giữ nguyên nguồn v3. Xem trước trước khi lưu; tự sao lưu dữ liệu hiện có trước thay thế. Nhập v3 trùng ID sổ bị từ chối.
- `src/pages/Debug.tsx`: chọn JSON v3/v4, xem kết quả, lưu, xuất backup và tải bản gốc; phần phân tích chạy trong Worker.

Dữ liệu ở IndexedDB trên từng origin/trình duyệt. Bản xem trước không tự đọc được dữ liệu của website v3. Xuất JSON từ v3 rồi chọn file ở v6. Sao lưu trên cùng trình duyệt không thay thế bản sao ngoài máy.

## Quyết định nghiệp vụ đã chốt

Winrate = thắng / (thắng + thua), bỏ hòa vốn khỏi mẫu số, theo lựa chọn trực tiếp của chủ dự án. 4 thắng + 4 thua + 2 hòa = 50%.

Timestamps gốc xác nhận thời gian giữ lệnh trung bình **234,333 phút = 3,906 giờ**. Không sửa timestamps hoặc số mốc để ép khớp giả định đơn vị giờ trong tài liệu ban đầu.

Chi phí v4: commission/tax/other không âm; funding/swap dương khi trả, âm khi nhận. Net = Gross − tổng costs. `Leg.fee` là thông tin, không cộng lần hai. Phân bổ theo lượng đã chốt, phần cuối nhận số dư chính xác; phí của vị thế đang mở chỉ ghi nhận theo phần đã chốt. Báo cáo phí sử dụng cùng các sự kiện hiện thực hóa với đường vốn.

## Golden và tương thích

Fixture `tests/golden/fixture-30-trades.json` là bản xuất v3 nguyên vẹn, checksum/provenance không đổi. 30 lệnh là minh họa, không phải giao dịch thật. `core-golden.test.ts` kiểm chứng core v6 theo mục 4.1–4.9; test tham chiếu v3 ở root vẫn độc lập. Toàn bộ TODO S0 được thay bằng kiểm thử thực và ghi nhận quyết định trên.

`data/legacy-v3` giữ nguyên bộ đọc/replay v3 từ nhánh nền để chuyển đổi và đối chiếu lịch sử. Giao diện v6 và chỉ số mới không dùng bộ tính cũ này.

Migration chỉ nhận các chu kỳ tuyến tính có thể giữ chính xác giá, lượng, tiền tệ, Net và từng sự kiện đóng. Khi gặp P&L báo cáo không đủ legs, FX không đồng nhất, số dư đầu kỳ, điều chỉnh doanh nghiệp, cash event hoặc phân bổ chi phí không thể đối chiếu, hệ thống từ chối và giữ bản gốc. Không dựng giá giả để làm khớp P&L. Ảnh Blob chưa được đóng gói trong JSON S1 và bị từ chối rõ; ảnh/ZIP thuộc chặng sau.

## Git và triển khai

S1 ở nhánh `sprint/S1-core-storage`, PR dựa trên `sprint/S0-foundation`. Cần human approval trước merge main theo CONTRIBUTING. CI `v6-s0.yml` kiểm tra v6 và hồi quy v3.

Build tĩnh mặc định: `npm run build`, thư mục `dist`. Sites S1 dùng identity riêng, không thay identity v3. Website chính: https://tuannhatky.fabledcoot2.chatgpt.site/. Chỉ chuyển sản phẩm khi các trang S3 đạt nghiệm thu và có phương án rollback.

PWA/offline thuộc S9. Không tuyên bố CSP `_headers` có hiệu lực khi host chưa xác nhận hỗ trợ. Bản nhiều file là bản triển khai; `build:single` không phải đường phát hành đã kiểm chứng Worker.

## Cập nhật S2

Khung v6 tại `#workspace`, kiểm chứng S1 tại `#debug`, thuật ngữ tại `#glossary`, trạng thái mẫu tại `#components`. Tổng quan cũ mở về site v3. Chưa cutover.

24 tests kiểm chứng định dạng, đủ sáu phần KPI và bốn dòng trợ giúp, scope AND/OR không trộn sổ, URL roundtrip, projections %/R và thiếu dữ liệu. E2E thêm kiểm tra saved Views, lọc VCB (5 lệnh), tải lại, phím tắt trong input, bảng biểu đồ, overflow và axe ở 360/768/1280. Xem báo cáo phát hành để biết kiểm tra đã thực chạy.

Saved Views ở IndexedDB phụ `tuan-trader-v6-views`, chưa gồm trong backup ledger S1; có thể khôi phục cấu hình bằng URL bộ lọc. V6 mới là khung S2, các trang và giao dịch S3 đang chờ triển khai. Không tuyên bố đã xong Inline Edit/sao lệnh/1–9 trên một bảng lệnh chưa có.
