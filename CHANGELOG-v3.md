# Thay đổi nghiệp vụ v3 (R1/R2 — chưa kích hoạt trên giao diện)

Các quyết định dưới đây được duyệt sau Round 0. Giữ đủ 24 thẻ, ghi rõ những thay
đổi có thể làm kết quả khác bản cũ:

1. Expectancy R và Net/Tổng rủi ro chỉ dùng cùng tập có R hợp lệ; R batch-fixed
   chỉ được tính khi bật tùy chọn. Không coi thiếu R là 0R.
2. Kỷ luật chỉ lấy lệnh đã review. Legacy giữ điểm đã lưu, import mới không tự chấm.
3. Không có dữ liệu/không xác định trả MetricResult, không trả 0, NaN hoặc Infinity.
   PF chỉ có lãi trả no-losses; recovery DD=0 và độ lệch chuẩn=0 trả undefined.
4. Lệnh hòa vốn ngắt cả chuỗi hiện tại lẫn chuỗi dài nhất.
5. Net/đường vốn/Lịch theo RealizedEvent, bao gồm chốt từng phần ở đúng kỳ và cash
   costs đúng ngày; win rate theo chu kỳ đóng. Không cộng nạp/rút vào lợi nhuận.
6. Giá trị `avgLoss`/`grossLoss` trong selector mang dấu âm để đúng hiển thị cũ.
   Nhãn Tổng lãi/Tổng lỗ vẫn tính trên Net từng lệnh, không phải Gross trước phí.
7. Chỉ số ổn định giữ mean(P&L)/population stdev(P&L), không đổi thành Sharpe năm.
8. Thời gian giữ lệnh chỉ tính các chu kỳ có thời gian; hiện n/N. Không bịa giờ mở
   cho báo cáo chỉ có phía bán. Legacy có thời gian quy ước được đánh dấu rõ.
9. Không dùng khoảng phủ thời gian như bằng chứng đủ để tự loại báo cáo chéo.
10. Không tự bật migration, không xóa localStorage, không sửa dữ liệu cloud cũ.
