# UI07 — Rà soát bản tham chiếu v3, 19/10/2026

Nguồn: https://tuannhatky.fabledcoot2.chatgpt.site/ · native Sites version 4 · source b101b421cb54450510d9e8c33dd587c9108b0951 · GitHub 966e76f. Dữ liệu nhìn thấy: 30 lệnh minh họa, Net 3.302.290 đ. Các ảnh này là bằng chứng của **bản tham chiếu v3**, không phải giao diện v6.

- **Định giá doanh nghiệp:** mở được, mô hình và tham số hiện; giữ công cụ độc lập, không đưa công thức định giá vào core journal S0. [Ảnh](evidence/valuation-1280.png).
- **Kết nối dữ liệu:** 5 tab Nguồn/Tài khoản/Lịch sử nhập/Mẫu ánh xạ/Sức khỏe; 8 connector file, dán Excel, CSV mẫu; không API key ở Mode L. [Ảnh](evidence/connections-1280.png). Chưa chứng nhận export broker thật.
- **Cài đặt & sao lưu:** cấu hình múi giờ/tỷ giá/ngưỡng, phiên, xuất JSON, quyền lưu bền, restore preview, migration legacy. Đã xuất thật file v3 dùng làm fixture gốc. [Ảnh](evidence/settings-1280.png).
- **Thêm giao dịch:** 3 khối tài khoản/giao dịch, phí/rủi ro, nhật ký/review. Hiện có giá, volume, multiplier, phí, funding, 1R/SL, setup, lỗi và notes. Chưa có legs nhập nhiều phần, chip ba khâu, ảnh/OTP/MAE/MFE (các Sprint sau). [1280](evidence/manual-1280.png), [768](evidence/manual-768.png), [360](evidence/manual-360.png). Mobile xếp một cột, cần cuộn modal; chưa có tab dưới theo thiết kế v6. Date/time picker dùng locale thiết bị; v6 phải chuẩn hóa giờ theo sổ, không nhầm giờ thiết bị với timezone sổ.
- **Phân nhóm:** Setup, Thị trường, Sản phẩm, Chiều lệnh, Nguồn, Thứ, Thời gian giữ, Phiên giao dịch. Hiện có nhiều hơn Setup nhưng vẫn một cấp; drill-down nhiều cấp thuộc S7. [Ảnh](evidence/analytics-1280.png).
- **MetriX/đường vốn:** mục tiêu và giới hạn, hai trục có đơn vị, zoom/pan, readout thay đổi theo điểm. Đã chọn điểm 29/09/2026 → +0,93%, 201.851.040 đ; tooltip chưa chứa ID lệnh như chuẩn v6. [Ảnh](evidence/metrix-chart-readout.png).
- **Tổng quan:** vừa được giữ lại giao diện gốc theo yêu cầu riêng của người dùng; MetriX/System Tracker có hai chế độ. S0 không đổi các màn hình này. Khi triển khai bố cục v6 ở S2/S3 phải chốt việc khác biệt với F08, không âm thầm bỏ giao diện đã yêu cầu giữ.

UI07 là kiểm kê phạm vi cần mang sang v6, không phải chứng nhận WCAG/responsive hoàn chỉnh của bản v6. S0 chưa có UI sản phẩm; S2 phải kiểm thử sáng/tối và cả ba breakpoint, S3 mới nghiệm thu F01–F10.
