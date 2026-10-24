Tiếp quản Trading Plan Pro từ S1. Đọc README, CHANGELOG, checkpoint v8 và báo cáo phát hành S1. Repo nhánh sprint/S1-core-storage, dựa trên sprint/S0-foundation. S1 có core/data/debug; không được gọi là sản phẩm v6 hoàn chỉnh.

Giữ quyết định: Winrate bỏ hòa vốn khỏi mẫu số; thời gian mẫu 234,333 phút; không sửa timestamps/golden; closedAt ở chỉ mục phụ. Giữ Tổng quan cũ, MetriX/Theo dõi hệ thống có lựa chọn; không xóa v3 hay dữ liệu. Migration chỉ nhận cấu trúc đối chiếu chính xác và giữ nguồn v3 trong backup v4.

Chặng kế tiếp S2 (UI01–UI06, ND01, ND02, ND05, F04, V1, N01): layout, bộ lọc, KpiCard, Chart, StateFrame, định dạng; theo cổng 5H.1. Không đổi giao diện Tổng quan theo bản mới trái yêu cầu trực tiếp. Nêu kế hoạch file/test theo quy trình, tiếp tục trong phạm vi chủ dự án đã ủy quyền; chỉ hỏi khi thiếu quyết định thực sự.

Chạy npm run verify tại v6; kiểm tra CI/E2E 360/768/1280 và hồi quy v3. Preview v6 tách production v3, không cutover trước S3. Main yêu cầu human approval, không force push.
