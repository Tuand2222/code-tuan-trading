# Nghiệm thu Sprint S1 — 20/10/2026

S1 (QT05, 5F.3–5F.5) đã hoàn tất trong phạm vi core/data/trang kiểm chứng. Đây chưa phải toàn bộ sản phẩm v6.

## Bản phát hành

- GitHub source: `2c56e20542aca1423b175ee2dfde356f13dd0d19`, nhánh `sprint/S1-core-storage`.
- PR: https://github.com/Tuand2222/code-tuan-trading/pull/6 — base S0, chưa merge main.
- CI: https://github.com/Tuand2222/code-tuan-trading/actions/runs/39389306523 — cả foundation và v3-reference SUCCESS.
- Sites: https://tuannhatky-v6.fabledcoot2.chatgpt.site — version 1, deployment succeeded.
- Site ID: `appgprj_6ad65abceff481918a89e3658fd048e8`.
- Native source: `8616ff7658559c3636eece0250e017cb3abadd20`.
- Saved version: `appgprj_6ad65abceff481918a89e3658fd048e8~appgver_357fb0cc26708191beaffddb0c469398`.
- Deployment: `appgdep_6ad71e0a9fc8819194e48b70a6b6e763`.
- Native manifest ở checkout riêng `work/trading-v6-preview/.openai/hosting.json`; dùng lại ID này, không tạo Site khác khi sửa v6.

Native source và GitHub có cùng mã ứng dụng; native checkout có manifest Sites riêng. Báo cáo này được bổ sung sau phát hành, không thay đổi mã chạy.

## Bằng chứng

- Lint, TypeScript strict, 20 unit/golden tests và build v6 PASS.
- Golden 4.1–4.9 bằng core v6 PASS theo dung sai 4.10. Không thay fixture/timestamps/giá trị tài chính gốc.
- E2E trên CI: nhập v3, xác nhận trước lưu, reload, xuất backup và axe serious/critical ở 360/768/1280 PASS.
- Hồi quy v3: 89 Vitest + 20 kiểm thử native PASS.
- Trên URL đã deploy: nhập fixture v3, lưu, reload, xuất `tuan-trader-v4.json`, chọn lại file v4 và khôi phục thành công; golden vẫn Đạt.
- 30 lệnh, 18 thắng/12 thua; Net 3.302.290đ; PF 1,7581; review 24/30; kỷ luật 85; holding 234,333 phút.
- Ảnh bằng chứng: `evidence/s1-restored.png`.

## Phạm vi còn lại

S2–S9 chưa triển khai. S1 không thay website v3, Tổng quan cũ hoặc các chế độ MetriX/Theo dõi hệ thống. Migration chỉ nhận cấu trúc có thể bảo toàn và đối chiếu chính xác; các giới hạn FX/P&L báo cáo/số dư đầu kỳ/cash event/ảnh Blob ghi trong README. Không dùng thông báo PASS fixture để tuyên bố hỗ trợ mọi file lịch sử.

Winrate bỏ hòa vốn theo quyết định trực tiếp của chủ dự án. Bước kế tiếp: S2, theo `PROMPT_BAN_GIAO_S2.md`. Merge main vẫn cần human review theo CONTRIBUTING.
