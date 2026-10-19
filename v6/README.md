# Trading Plan Pro v6 — Sprint S0

Ứng dụng nhật ký đa thị trường, 100% trên thiết bị, không đăng nhập. Bản v6 được dựng **song song** trong `v6/`; website v3 đang hoạt động vẫn là https://tuannhatky.fabledcoot2.chatgpt.site/.

## Phạm vi S0 đã duyệt

Vite + React **18.3.1** + TypeScript strict, HashRouter (react-router-dom), Dexie/dexie-react-hooks, Zustand, ECharts, TanStack Table/Virtual, React Hook Form/Zod, decimal.js, date-fns/date-fns-tz, PapaParse/JSZip. Dependencies được khóa chính xác bằng package-lock. Node 24.19.0 dùng trong CI (khác ví dụ Node 20 trong tài liệu vì phiên bản Vite được cài yêu cầu runtime mới hơn).

S0 có schema v4, bộ fixture/golden, cấu hình ESLint/Prettier/Vitest/Playwright/axe, CI và bản build tĩnh. **Chưa có giao diện sản phẩm, core v6, Dexie repository hoặc migration.** Các phần này thuộc S1–S9. Không bật PWA trước S9; plugin đã được chuẩn bị.

## Chạy

Trong thư mục `v6/`:

```sh
npm ci
npm run dev
npm run verify
npm run build:single
npx playwright install --with-deps chromium
npm run e2e
```

`npm run verify`: lint → typecheck → unit/golden fixture → build. `npm run e2e`: kiểm tra khung S0 trống, tiêu đề, HTTP 200 và axe ở 360/768/1280 px. Không coi kiểm tra khung trống là nghiệm thu UI S2/S3. Có thể xem bản build bằng `npm run preview`; đây vẫn là nền trống có chủ đích.

## Dữ liệu gốc & số mốc

- `tests/golden/fixture-30-trades.json`: **file JSON xuất nguyên vẹn từ website v3** ngày 19/10/2026; 1 tài khoản minh họa, 60 fills, 30 overlay, 24 review. Không phải giao dịch thật, không phải fixture tái dựng.
- `provenance.json`: nguồn, checksum, SHA-256 của file, commit tham chiếu, seed dữ liệu và bootstrap.
- `golden.expected.json`: các số mốc 4.1–4.9 và dung sai 4.10; không thay đổi giá trị để làm test xanh.
- `../../tests/trading/v6-baseline.test.ts`: kiểm tra dữ liệu bằng **lõi v3 hiện hữu**, không chứng nhận lõi v6 chưa được viết. Chạy từ root repo bằng `npm run test:trading`.
- `golden.test.ts`: checksum, cấu trúc fixture và tính nhất quán số mốc. Ba `it.todo` công khai: nghiệm thu core v6 ở S1, mâu thuẫn đơn vị thời gian, chính sách mẫu số winrate khi có lệnh hòa vốn.

**Mâu thuẫn cần chốt trước S1:** timestamps gốc và code `replayBook.ts` cho trung bình **234,333 phút**, tương đương **3,906 giờ**, không phải 234,33 giờ như giả định trong đặc tả. Không nhân thời gian lên 60 lần. Ngoài ra v3 winrate tính thắng/tất cả chu kỳ; công thức v6 loại hòa vốn khỏi mẫu số. Bộ minh họa không có lệnh hòa nên không thể phân biệt hai định nghĩa bằng golden 30 lệnh.

Mọi schema chỉ lưu sự kiện/facts. Việc đối chiếu trạng thái closed/open với số lượng legs, foreign keys, thứ tự thời gian, highest/lowest và chi phí kế toán là cổng nghiệp vụ S1; S0 chưa thực hiện các phép tính đó. Chỉ mục `[journalId+closedAt]` trong đề xuất cũng cần chốt ở S1 vì schema cấm lưu trường dẫn xuất closedAt.

## Kiến trúc & cách chuyển đổi

`src/core/` không phụ thuộc React/DB; `src/data/` schema/repository; `src/ui/`, `src/pages/`, `src/app/`; mọi chuỗi UI mới lấy `src/i18n/vi.json`. Không dùng dữ liệu lệnh trong localStorage. Migration S1 phải lưu bản v3 nguyên vẹn trước khi chuyển, giữ điểm kỷ luật cũ và ID liên kết; không truy cập IndexedDB của origin khác.

## Git, CI và deploy

Nhánh `sprint/S0-foundation`, PR dựa trên `feature/multi-broker-quant-engine` để chỉ hiển thị thay đổi S0. PR #4 vẫn chứa phiên bản v3 production. Workflow `v6-s0.yml` kiểm tra nền v6 và hồi quy v3; bản build S0 được giữ làm artifact CI. Main cần ít nhất một human approval theo CONTRIBUTING.

Theo xác nhận phạm vi S0, **không deploy nền trống đè website chính**. Từ S2/S3, deploy bản v6 có UI song song để kiểm tra trước chuyển đổi. Cloudflare Pages: root `v6`, build `npm ci && npm run build`, output `dist`, Node 24.19.0; dùng HashRouter, không cần SPA rewrite. Nếu tiếp tục dùng Sites, tạo site v6 riêng ở bước triển khai UI, đặt static directory `dist` và giữ project identity riêng. Không dùng Worker/server v3 cho bản tĩnh v6. `public/_headers` dành cho host hỗ trợ file này; phải kiểm tra headers thực tế của host trước khi tuyên bố CSP đã có hiệu lực.

`npm run build:single` tạo một index.html với JS inline; CSP script-src self của bản nhiều file không dùng nguyên xi được cho bản single-file. Không triển khai single-file với unsafe-inline; cần thêm hash của bundle sau build hoặc dùng bản nhiều file mặc định.

Chỉ chuyển production khi core/golden/migration và các trang S3 đạt nghiệm thu, có bản sao lưu và kế hoạch rollback. Không xóa website hoặc dữ liệu v3 ở S0.
