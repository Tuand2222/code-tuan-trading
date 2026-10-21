S2 hiện ở nhánh sprint/S2-interface, dựa trên S1. Đọc checkpoint v9, README và S2-release. Các component/filter/format/chart đã có; không coi menu các trang tương lai là nghiệp vụ S3 hoàn chỉnh.

Chặng tiếp theo S3 theo 5H.1: nối các trang lõi, form thêm/sửa và sao lệnh với repository chung; giữ Tổng quan cũ theo yêu cầu trực tiếp, MetriX và Theo dõi hệ thống cho chọn/gộp nhưng giữ chức năng cũ. Không dùng trang overview mới thay overview cũ. 30 lệnh mẫu gốc giữ nguyên, winrate bỏ hòa vốn đã chốt, holding mẫu 234,333 phút. Bắt buộc golden, test T-R1 và cảnh báo/ID theo đặc tả.

Dữ liệu v6 tại origin tuannhatky-v6.fabledcoot2.chatgpt.site. Site ID trong work/trading-v6-preview/.openai/hosting.json, dùng lại khi deploy. Website v3 chính chưa cutover. Core/data không đổi schema hay số mốc tùy tiện. Views nằm ở DB phụ; sau S3 cần đưa vào backup nếu coi là cấu hình người dùng.

Cần kiểm tra CI trên PR, chạy test đủ phạm vi; main cần human approval. Không force push/xóa dữ liệu v3. Đừng hỏi lại các quyết định đã được chủ dự án chốt.
