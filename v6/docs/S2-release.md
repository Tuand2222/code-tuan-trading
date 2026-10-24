# Nghiệm thu S2 — 21/10/2026

S2 đã dựng khung và các thành phần dùng chung. Bản v6 chạy song song; nghiệp vụ các trang, Quick Add/Inline Edit/sao lệnh tiếp tục ở S3.

- PR: https://github.com/Tuand2222/code-tuan-trading/pull/7 — base S1, chưa merge main.
- Mã ứng dụng được CI kiểm tra: `c86219cd4814c7249c24a9c013caafc80fb2cb8b`.
- CI: https://github.com/Tuand2222/code-tuan-trading/actions/runs/39532413967 — foundation và v3-reference SUCCESS.
- 24 unit/golden tests; lint + typecheck + build PASS. 6 E2E (S1 import + S2 UI ở 360/768/1280) PASS; axe không có serious/critical, không tràn ngang.
- Hồi quy v3 PASS (89 Vitest + 20 native).
- Responsive evidence artifact: https://github.com/Tuand2222/code-tuan-trading/actions/runs/39532413967/artifacts/12315373666.
- Website: https://tuannhatky-v6.fabledcoot2.chatgpt.site/#workspace — Sites version 3, succeeded.
- Site ID: `appgprj_6ad65abceff481918a89e3658fd048e8`.
- Native SHA: `a040cc1d372ebb757043107aea025d923d6ab92c`.
- Saved version: `appgprj_6ad65abceff481918a89e3658fd048e8~appgver_ae6fea4d0b408191a411cc8b493a30fd`.
- Deployment: `appgdep_6ad821a73da481919b0c45293d50388e`.
- Bản S2 version 2 được lưu trước sửa nhãn, chưa triển khai; không dùng để rollback thay bản S1 version 1.

## Cổng S2

UI01: KPI đủ nhãn/giá trị/đơn vị/mẫu/badge/trợ giúp; test thiếu phần sẽ đỏ. ND05: đủ 4 dòng cho 24 chỉ số. UI02/F04: số tiền, âm/dương, R/%, ngày múi giờ và thời gian đúng chuẩn, dữ liệu gốc không đổi.

UI03: biểu đồ có trục, tooltip ID/ngày, chú giải, n, MINH HỌA, Shadow nét đứt GIẢ ĐỊNH, tiền/%/R, zoom >100 điểm, PNG, bảng thay thế. % so với vốn đầu kỳ cố định; chưa phải TWR điều chỉnh nạp/rút. UI04/ND02: sáu trạng thái có trang mẫu.

UI05/V1: 4 nhóm, sổ/thêm lệnh luôn thấy, trạng thái dữ liệu bấm đến backup; lọc AND/OR + hash + View đặt tên. Sổ và khoảng ngày luôn là giới hạn, không OR chéo sổ. Views lưu DB phụ, chưa nằm trong backup ledger; chia sẻ URL để giữ cấu hình lọc.

UI06 khung: responsive sáng/tối, chạm 44px, thanh di động 5 mục, N và / bỏ qua input, dialog có focus trap native. Inline Edit, sao lệnh, chip 1–9, R và [ ] nối hành vi ở S3/S6; không tuyên bố có bảng nghiệp vụ trước chặng đó. ND01: thuật ngữ có giải thích và giới hạn. N01: mạch đọc 5 tầng, Q1–Q7.

## Phát hiện và sửa

E2E phát hiện nhãn select góc nhìn thay đổi khi thêm option. Thêm tên truy cập cố định, giữ nguyên bài test và chạy lại CI xanh. VCB là 5 lệnh trong fixture gốc; không sửa dữ liệu để khớp giả định 10 lệnh (10 là mẫu theo setup).

Trình duyệt trên bản deploy xác nhận 24 KPI, Net +3.302.290đ và trợ giúp. Bộ lọc VCB, tải lại và chọn View đã kiểm tra. Tổng quan cũ vẫn link về v3; giữ nguyên các chế độ MetriX/System Tracker để nối theo yêu cầu trong S3.

Báo cáo/ảnh và định dạng test được commit sau CI; không đổi mã ứng dụng đã deploy. Chưa cutover site v3. Kế tiếp đọc PROMPT_BAN_GIAO_S3.md.
