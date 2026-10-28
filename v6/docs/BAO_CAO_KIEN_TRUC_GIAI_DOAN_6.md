# Báo cáo kiến trúc nhật ký — Giai đoạn 6

Ngày: 28/10/2026 (Asia/Saigon). Phạm vi: cấu trúc nguồn, hướng dẫn AI, CI và bảo vệ nhánh. Hoàn thành P6; không sửa công thức P5, không merge main hoặc deploy trong giai đoạn này.

## 1. Đã làm gì — file thay đổi

- `src/core/trade-normalizer.js`, `trade-form.js`, `journal-adapters.js`, `journal-unified.js`, `journal-lifecycle.js`: chuyển năm triển khai dùng chung từ lib; các file lib tương ứng chỉ còn re-export. Bốn kiểm tra kiến trúc xác minh cả hai đường import cùng một đối tượng ESM.
- `src/core/journal-runtime.js`: nguồn Core, RiskMath, Worker được sinh từ chính hàm RiskMath, RiskStore và cầu đồng bộ hiện có. Không tạo lõi toán thứ hai.
- `src/views/v6/shell.html`, `src/views/v6/app.js`: DOM/CSS và UI/router/boot gốc. `scripts/render-v6.mjs` ghép thành `v6/index.html`; `v6/scripts/sync-lifecycle.mjs` giữ lệnh cũ cho quy trình build. `v6/scripts/verify.mjs` từ chối HTML chưa đồng bộ trước khi build có thể tự tạo lại.
- `src/views/classic/ClassicApp.tsx`: chuyển nguyên trang Classic, chỉ đổi đường import. `app/classic/page.tsx` là điểm vào framework. Thành phần/CSS Classic vẫn ở vị trí cũ để tránh refactor ngoài phạm vi. `src/README.md` ghi bản đồ nguồn.
- Giữ `schema/trade.schema.json`, `schema/rules.schema.json` từ P1. Thêm `AGENTS.md` cập nhật, `CLAUDE.md` import `@AGENTS.md`, `.cursor/rules/journal-invariants.mdc`, `.cursor/rules/journal-sources.mdc`.
- `.github/CODEOWNERS`, `.github/BRANCH_PROTECTION.md`, `.github/workflows/verify-main.yml`: yêu cầu chủ mã cho schema/core/CI; workflow chạy trên mọi PR vào main, main push, merge group và gọi thủ công. Gộp workflow V6 cũ vào CI chung, bỏ `.github/workflows/v6-s0.yml` để tránh chạy trùng.
- `scripts/ci-check.mjs`, `scripts/ci-gate.mjs`, `scripts/check-financial-guards.mjs`, `tests/architecture.test.mjs`, script `ci:check` trong `package.json`: kiểm thử tuần tự, lưu log, từ chối dependency failed/cancelled/skipped và thử công thức sai trên bản sao tạm.
- `tests/scale/sync-safety.mjs`: sửa fixture cũ để nạp kho Classic trước lần mở app đầu tiên; giữ và kiểm tra nguyên dữ liệu cũ sau migrate. Tạo bản chờ offline ổn định trước khi đổi tài khoản, tránh đếm nhầm yêu cầu đang bay của trang cũ. Thử quota dùng fault injection làm mọi lần ghi mirror thất bại thật trong hồ sơ thử; không chỉ gán cờ lỗi có thể bị lần lưu thành công xóa đi. Kiểm tra phục hồi qua lần ghi thật. Không sửa ứng dụng để làm bài thử này xanh.
- `.gitattributes`: chuẩn hóa LF khi lấy nguồn trên Windows/Linux. Không thêm thư viện ứng dụng hoặc thay manifest Site/DB/BUCKET.

P1–P5 đã được duyệt từng bước trước đó nhưng chưa commit. Commit `79d265d` đưa cả các bước này cùng P6 lên nhánh đang có; commit `cc7e23d` là phép thử ES sai có chủ đích; `f52fb14` đã khôi phục chính xác nguồn đúng. `git diff 79d265d f52fb14` không có thay đổi. Tất cả được cập nhật vào PR #9 hiện có, không tạo PR trùng.

Đối chiếu P5: HTML trước/sau tách nguồn khớp từng byte, SHA-256 `52060848d2f1972ee53b493ee8d9405d1537399bde3c0dd85126b21b09a891b3`. Trang Classic chỉ đổi đường import. Một bản lấy từ Git với LF cũng ghép thành HTML khớp P5 sau chuẩn hóa xuống dòng, SHA-256 `f65ae415490d7867aaef3fd61e7d012437a61bb9e54fd515bc9e39192200907d`. Vì vậy không có thay đổi DOM, nhãn, màu, handler hoặc công thức do tách thư mục.

## 2. Kết quả kiểm thử thật

Các lệnh đã chạy trên Windows:

- `npm run ci:check`: bước kiểm tra nguồn, 116/116 lõi V6, mutation guard 3/3, 153/153 Vitest, typecheck, build, 27/27 Node, 103/103 trình duyệt V6, 18/18 hai tab và 4/4 vòng đời Classic đều đạt. Bước cuối phát hiện fixture legacy đã lỗi thời, nên lượt đầu là 7/8 bước đạt; không gọi lượt này là toàn bộ CI xanh.
- Sau khi sửa fixture: `node tests/scale/sync-safety.mjs` đạt 5/5 nhóm (vốn dùng chung, bản chờ/quota, xung đột có backup, đổi tài khoản, migrate thiết bị và giữ nguồn cũ). `node --test tests/architecture.test.mjs` đạt 4/4. Không đổi mã toán/UI sau lượt thử chính. Lượt CI Linux đầu của bản đúng qua bảy bước, rồi phát hiện fixture quota đang gán cờ lỗi tạm; đã thay bằng lỗi ghi bền trong hồ sơ thử và chạy lại CI đầy đủ.
- Bản build thực tế của Classic và HTML V6 được mở trong hai tab cùng origin: BroadcastChannel và storage-event fallback; import CSV thiếu 1R, sửa hai chiều, xung đột đồng thời, nạp/rút, JSON tải xuống/đọc lại, xóa/khôi phục và reset chống ghi bản cũ. Kết quả 18/18, lỗi trang 0.
- V6: 12 bộ thử, 103/103; bao gồm Worker, số liệu dùng chung, thống kê nâng cao, form/bảng ảo hóa, bàn phím, sáng/tối, màn hình nhỏ và kiểm tra a11y tự động. 3 script inline hợp lệ, ID trùng 0, khai báo hàm có tên trùng 0. Không chạy lại benchmark 100.000 dòng vì P6 không đổi hành vi.
- `node scripts/check-financial-guards.mjs`: bản chuẩn qua 22 kiểm tra thống kê nâng cao; ES cố ý trả 0 và RCK cố ý trả lambda=1 đều bị cùng bộ kiểm thử thật từ chối (exit 1, cú pháp vẫn hợp lệ). Chỉ sửa bản sao tạm, không dùng dữ liệu người dùng.

Kiểm chứng GitHub trực tiếp:

- Trước P6: API trả `404 Branch not protected`; rulesets `[]`.
- Sau cấu hình: API 200, `Journal required checks` từ GitHub Actions app 15368 bắt buộc; strict/up-to-date, enforce_admins, ít nhất 1 review, code-owner review, bỏ duyệt cũ khi thêm commit, duyệt lần push cuối bởi người khác, giải quyết hội thoại; cấm force push/xóa nhánh.
- Bản ES sai `cc7e23d1466820d5f5658b09f7523182f6d88130`: [CI thực tế](https://github.com/Tuand2222/code-tuan-trading/actions/runs/40620218845) đỏ. Ba ca ES báo `0 != -1`, `0 != -1`, `0 != -9.8`. `Journal required checks: failure`; API PR trả `mergeable_state: blocked`, PR không phải draft. Không thử gọi merge và không đưa bản sai lên Site.
- Bản đúng `96d1b97`: toàn bộ CI GitHub đạt. Output API thật:

```json
{
  "codeRevision": "96d1b97c176f9459ec155a45b689f5e0f7ab8886",
  "checks": [
    {
      "name": "Journal required checks",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Tuand2222/code-tuan-trading/actions/runs/40621007142/job/122596253633",
      "head_sha": "96d1b97c176f9459ec155a45b689f5e0f7ab8886"
    },
    {
      "name": "Install, build, test and validate",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Tuand2222/code-tuan-trading/actions/runs/40621007142/job/122594754273",
      "head_sha": "96d1b97c176f9459ec155a45b689f5e0f7ab8886"
    }
  ],
  "mergeable_state": "blocked"
}
```

[PR #9](https://github.com/Tuand2222/code-tuan-trading/pull/9) và [kiểm tra hiện tại của PR](https://github.com/Tuand2222/code-tuan-trading/pull/9/checks). Log, JSON kết quả, ảnh trình duyệt và phản hồi API nằm trong gói bằng chứng đi kèm. CI trên commit báo cáo tiếp theo phải xanh trước khi PR sẵn sàng duyệt; cập nhật trạng thái cuối trong CHECKPOINT.json của gói giao.

## 3. Số đo hiệu năng thật

Không đo lại INP/CLS hoặc benchmark nhật ký 100.000 dòng trong P6. Các mục tiêu hiệu năng trong PDF không tự trở thành cam kết.

Thời gian thực của lượt kiểm tra Windows: lõi V6 43,716 giây; mutation guard 4,706 giây; nhóm test/typecheck/build/Node 416,567 giây; 12 bộ trình duyệt V6 238,077 giây; hai tab 34,667 giây; vòng đời Classic 7,381 giây. Đây là thời gian chạy kiểm thử trên máy hiện tại, không phải độ trễ sử dụng app hay thước đo so sánh Windows/Linux.

## 4. Điểm chưa chắc chắn hoặc khác PDF

- Giữ V6 đầu ra là một HTML theo yêu cầu trước đó, nhưng nguồn viết được tách thật vào src. Classic giữ các component/CSS cũ; không chuyển toàn bộ backend/lib hoặc thay kiến trúc ngoài P6.
- CODEOWNERS được đọc từ nhánh đích: quy tắc sở hữu file mới có hiệu lực sau khi PR chứa nó được duyệt và merge. Hiện PR đã bị ràng buộc bởi kiểm tra bắt buộc và yêu cầu review trên server. Không coi riêng CODEOWNERS là bằng chứng chặn merge.
- Không thay đổi ngưỡng, công thức hoặc kết quả tài chính P5. Không thêm phụ thuộc, SharedArrayBuffer, Lamport timestamp, SEO phức tạp hoặc cam kết lưu trữ vĩnh viễn.
- GitHub connector chỉ có quyền đọc ở kết nối hiện tại. Git trên máy đã kiểm tra được quyền push; API dùng cùng thông tin xác thực có quyền admin để đọc/cấu hình bảo vệ nhánh. Không ghi thông tin xác thực ra file hoặc log.

Nguồn kiểm chứng quy tắc GitHub: [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 5. Rủi ro mất dữ liệu còn tồn tại

Không thao tác ghi/xóa nhật ký production, không đổi key hoặc schema lưu trữ ở P6. Các phép xóa/reset và file JSON trong kiểm thử dùng hồ sơ trình duyệt tách biệt, dữ liệu tổng hợp; bản JSON được tải và đọc lại thật.

Các giới hạn từ giai đoạn trước còn nguyên: trình duyệt có thể thu hồi/quá hạn mức lưu trữ, lưu cục bộ không thay thế backup độc lập; người dùng phải giữ JSON ngoài trình duyệt. Chưa chạy tải lớn trên tài khoản cloud thật, thiết bị RAM thấp hoặc chứng nhận lưu trữ 30 năm. P6 không có cơ sở để cam kết dữ liệu tồn tại mãi mãi. Tab/client cũ và yêu cầu cloud đang bay vẫn cần quy trình rollout/đối soát đã báo cáo ở P2–P3.

## 6. Bước tiếp theo — dừng sau P6

Đề xuất người có quyền phù hợp duyệt PR #9, kiểm tra CHECKPOINT/CI của commit cuối, rồi thực hiện đợt triển khai được duyệt và kiểm tra Site hiện có với bản backup phù hợp. Không tự merge main: CONTRIBUTING.md mục “Code Review & Merge” yêu cầu ít nhất một approval; AGENTS.md giữ yêu cầu duyệt của con người. Nhánh được đẩy lên GitHub, chưa deploy P1–P6 trong lượt này.

ĐÃ XONG đến P6. Dừng theo quy trình từng giai đoạn của yêu cầu.
