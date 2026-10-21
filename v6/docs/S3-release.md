# S3 — Nhật ký và các trang lõi

Đã triển khai trên nhánh `sprint/S3-journal`, dựa trên S2. Trạng thái hiện tại: đang nghiệm thu CI và giao diện trước khi phát hành lên site v6.

- QT02: thêm/sửa lệnh có đối chiếu Gross → chi phí → Net → R; sửa nhanh 1R/setup/ghi chú; sao lệnh; hồ sơ cơ bản, chip lỗi, review. CAS ngăn ghi đè khi dữ liệu đã đổi ở tab khác. Lệnh nhiều khớp giữ nguyên legs trong form S3; biên tập legs thuộc S5.
- QT03: hàng đợi cân bằng và cảnh báo thiên lệch 15 điểm %, kiểm thử T-R1. Điểm kỷ luật legacy giữ nguyên; checklist không ghi đè điểm cũ.
- F01–F03: placeholder hai dòng, thời gian nhập gần nhất định dạng giờ Việt Nam, thời gian giữ có đơn vị và nhãn chuỗi thắng/thua.
- F05–F07/F10: cấu hình cảnh báo; MWG 15/10 kèm ID duy nhất; phân bố R tăng dần; drawdown theo tiền, lịch tổng tháng/tuần theo realized events, bấm ngày lọc nhật ký.
- F08: ngoại lệ theo chỉ đạo trực tiếp của chủ dự án — giữ Tổng quan cũ với 24 KPI, bộ chọn thị trường, biểu đồ hai trục, donut, lãi/lỗ thứ trong tuần, vòng kỷ luật. MetriX và Theo dõi hệ thống giữ giao diện/điều khiển cũ, chọn được chế độ chi tiết, dùng chung ledger. Bảng setup chỉ ở Lợi thế thống kê.
- ND03/ND04: mẫu lệnh/ngày/tuần-tháng; ba setup và chín lỗi mặc định; ẩn danh mục giữ lịch sử và báo cần gắn lại.
- N02: yêu cầu lưu bền, nhắc sao lưu, xuất/kiểm tra/khôi phục workspace gồm ledger v4 + Views + dấu mốc sao lưu. Có checksum và bản sao trước thay đổi. Dữ liệu và Views ở hai DB: có recovery nhưng không hứa giao dịch nguyên tử xuyên hai DB.

Giữ nguyên fixture 30 lệnh gốc: Net 3.302.290 VND, 18 thắng/12 thua, tháng 10 là 1.389.630, tuần 42 là 143.950, kỷ luật legacy 85%. Thời gian thực 234,333 phút (đã chốt), winrate loại hòa vốn.

V6 chạy song song tại https://tuannhatky-v6.fabledcoot2.chatgpt.site. Không tự chuyển dữ liệu thật giữa origin, không tắt v3 trong S3 khi chưa nghiệm thu đủ và chưa có bản sao dữ liệu thật. `main` theo quy định repo vẫn cần người duyệt.

S4 kế tiếp: đa sổ đầy đủ, vốn và nạp/rút, hồ sơ thị trường và mở rộng đơn vị. S5–S9 chưa được tuyên bố hoàn thành.
