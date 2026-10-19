Bạn tiếp quản Trading Plan Pro. Đọc NHAT_KY_SUA_LOI_Trading_Plan_Pro_v7.md và DAC_TA_KY_THUAT_Trading_Plan_Pro_v6.md trong v6/docs/.

S0 đã được người dùng duyệt và triển khai trên nhánh sprint/S0-foundation, dựa trên feature/multi-broker-quant-engine. Website v3 tại https://tuannhatky.fabledcoot2.chatgpt.site/ đã deploy version4, giữ Tổng quan cũ; MetriX/System Tracker có chế độ gốc/v3, giữ 30 lệnh demo. S0 v6 không có UI và không thay production.

Đọc README v6 và UI07-reference-audit.md; chạy npm ci trong v6, npm run verify; root npm test cho hồi quy v3; xem CI Verify v6 foundation. Fixture là file xuất gốc schemaVersion3, không tái dựng; không sửa timestamps/checksum để khớp số. 3 TODO v6 là cổng S1 công khai, không tính là test đã đạt.

Trước khi viết S1, hỏi người dùng xác nhận: (1) sửa giả định trong đặc tả: trung bình thực 234,333 PHÚT ≈ 3,906 giờ; (2) winrate khi có hòa vốn dùng mẫu số mọi chu kỳ theo v3 hay chỉ thắng+thua theo công thức v6; (3) closedAt dùng derived index/repository metadata thế nào khi schema không lưu derived. Không tự đổi số mốc hay định nghĩa. Trình danh sách file và test S1 để duyệt theo 10.1.

SPRINT S1 — chỉ QT05 và 5F.3–5F.5: core thuần + Dexie + migration v3→v4 giữ bản gốc + backup/restore + trang debug. Mọi số từ core, không React/DB trong core; không làm S2–S9. Dùng fixture v3 thật để viết test migration/roundtrip trước, rồi toàn bộ golden 4.1–4.9 theo dung sai 4.10. Đừng gọi test tham chiếu v3 là golden core v6.

Giữ yêu cầu trực tiếp: Tổng quan cũ không bị bỏ; MetriX và theo dõi hệ thống giữ các chức năng cũ/chọn giao diện. Nếu thiết kế F08 v6 xung đột, hỏi trước S2/S3. Không tự xóa website/dữ liệu. Sau S1: báo từng ID đạt/chưa đạt và bằng chứng, cập nhật checkpoint, PR + CI, deploy preview có UI thích hợp; main cần human approval theo CONTRIBUTING.
