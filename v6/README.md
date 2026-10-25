# Tuannhatky Pro hợp nhất

`index.html` là mã ứng dụng duy nhất: HTML + Tailwind CDN + Chart.js CDN. Core sở hữu một sổ lệnh và một sổ dòng tiền; Worker được sinh từ RiskMath. Không dùng ứng dụng React V6 cũ để build. Lịch sử mã cũ vẫn còn trong Git.

`npm run verify` kiểm tra cấu trúc và công thức. `npm run build` chép file HTML và worker dọn cache V6 cũ vào dist. Root build tiếp tục giữ Classic, API, D1/R2 và các chức năng hiện có; chỉ thay giao diện tại /v6/.

Sao lưu JSON gồm toàn bộ dữ liệu. IndexedDB là bản phản chiếu cùng trình duyệt, có thể mất cùng localStorage khi xóa dữ liệu trang. Xuất SQL chưa phải kết nối cloud. Không tự xóa key dữ liệu của các phiên bản trước. Source C không được cung cấp nên không đoán key/schema production cũ.

Chi tiết đối chiếu và kiểm thử: docs/BAO_CAO_HOP_NHAT.md.
