# Tuannhatky Pro hợp nhất

`index.html` là mã ứng dụng duy nhất: HTML + Tailwind CDN + Chart.js CDN. Core sở hữu một sổ lệnh và một sổ dòng tiền; Worker được sinh từ RiskMath. Không dùng ứng dụng React V6 cũ để build. Lịch sử mã cũ vẫn còn trong Git.

`npm run verify` kiểm tra cấu trúc và công thức. `npm run build` chép file HTML và worker dọn cache V6 cũ vào dist. Root build tiếp tục giữ Classic, API, D1/R2 và các chức năng hiện có; chỉ thay giao diện tại /v6/.

Sao lưu JSON gồm toàn bộ dữ liệu. IndexedDB là bản phản chiếu cùng trình duyệt, có thể mất cùng localStorage khi xóa dữ liệu trang. Xuất SQL chưa phải kết nối cloud. Không tự xóa key dữ liệu của các phiên bản trước. Source C không được cung cấp nên không đoán key/schema production cũ.

Chi tiết đối chiếu và kiểm thử: docs/BAO_CAO_HOP_NHAT.md.

Bản đối chiếu PDF S1–S10: trường xuất dùng current_equity, entry_time, planned_rr_ratio và đủ 12 trường snapshot. Cache SHA-256 nằm trong metadata của cùng sổ, được phản chiếu IndexedDB; có thể tái dùng từ snapshot đã lưu. Đổi lệnh/Risk Profile/giả định làm cache hết hiệu lực. Cache không phải cloud và không thay bản sao lưu.

Tên trường nội bộ rckAlpha/rckBeta kế thừa có nghĩa lần lượt là xác suất và sàn vốn; bộ giải và trường SQL rck_alpha/rck_beta đã ánh xạ theo ký hiệu PDF (α=sàn vốn, β=xác suất). Preset ngoài sáu loại chuẩn được báo chưa xếp loại, không gán nhầm sang FTMO. SQL thêm cột thiếu khi chạy lại; vẫn cần UUID chủ sở hữu và chưa được thực thi trên server trong kiểm thử.
