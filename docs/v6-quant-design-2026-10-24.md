# Thiết kế V6 theo báo cáo tối ưu UI/UX

Nguồn: PDF “Tối Ưu Giao Diện V6”, 24 trang. Đối chiếu toàn bộ nội dung, hai hình minh họa trang 14/16, bảng phân công Classic/V6 và từ điển chú giải trang 17–22. Ưu tiên yêu cầu trực tiếp của chủ dự án: giữ nguyên giao diện và chức năng Classic.

## Quyết định kiến trúc

Không sửa `app/classic`, `lib/`, database hoặc migration. Không thay hai kho dữ liệu bằng một mảng localStorage: V6 đang dùng IndexedDB có kiểm tra phiên bản, ảnh, ghi chú, bản sao và các lần khớp. Thay mô hình này sẽ làm mất bảo đảm hiện có mà không cần thiết cho mục tiêu giao diện.

V6 có nguồn phân tích Classic chỉ đọc. Adapter lấy tài khoản đang đăng nhập, ưu tiên GET `/api/trades`, sau đó chỉ đọc cache đúng tài khoản đó; thiết bị ẩn danh chỉ đọc key thiết bị. Không duyệt kho của tài khoản khác. Không POST/PATCH/DELETE, không hợp nhất hoặc ghi ngược vào Classic. Khi có thay đổi storage/focus, nguồn được đọc lại. Đây là đồng bộ góc nhìn phân tích một chiều, không phải cơ chế sửa hai chiều. Phiếu execution thô chưa ghép và dòng không hợp lệ được loại khỏi số lệnh đóng, có số lượng đối soát.

Mô hình V6 hiện đã có bảy lớp tài sản, multiplier, long/short và chi phí funding/swap. Giữ nguyên lõi tính giao dịch, không dùng regex mã để tự khẳng định thị trường hay tạo hai chân khớp giả. MAE/MFE từ V6 chỉ dùng extrema của một lần vào/ra thực; scale-in/out thiếu running-P&L không được giả làm dữ liệu excursion đầy đủ.

## Phân công màn hình

`/v6/#overview` thành phòng phân tích R. Sáu thẻ: Expectancy, SQN, PF theo R, Capture Rate, Max DD theo R và Recovery theo R. Bỏ hero kế toán, biểu đồ tròn thắng/thua và cột P&L ngày khỏi trang này. Các trang nhật ký, lịch, MetriX, workspace 24 KPI, cấu hình vốn/nạp-rút, kế hoạch, importer và mô phỏng hiện có vẫn truy cập theo đường dẫn cũ.

Ba góc nhìn giúp tránh dồn tất cả biểu đồ lên một màn hình: phân phối R + heatmap thời điểm; MFE + MAE; underwater + SQN trượt 30 lệnh và tỷ số Sharpe/Sortino theo R. Cột histogram, điểm scatter, ô heatmap và số mẫu mở bảng lệnh đối chiếu; lệnh V6 mở được hồ sơ gốc. Giới hạn 900 điểm khi mẫu lớn chỉ áp dụng việc vẽ, các thống kê và bảng đối soát vẫn dùng toàn bộ mẫu.

Toolbar gồm nguồn, thị trường, phương pháp, ngày và nút cài đặt; bộ lọc nâng cao mở khi cần. Dùng font đang tự lưu trữ, số dạng bảng; nhãn tối thiểu 12px, dữ liệu 14px, giá trị KPI 24–28px. Chữ trên trục là HTML theo pixel, không co chữ theo SVG. Có giao diện sáng/tối, hai cột biểu đồ trên desktop, một cột trên điện thoại. Bộ chọn Classic/v6 giữ nguyên.

Ngăn cài đặt thay đổi Net/Gross, ma sát giả định, ba chế độ SQN, ngày vào/ra, khung 15/30/60 phút và mẫu số tỷ lệ thắng. Cho phép ẩn, kéo hoặc dùng nút sắp xếp KPI. Cài đặt được lưu riêng theo sổ trên thiết bị; chưa đưa vào định dạng sao lưu sổ giao dịch. Các hạn mức vốn thực vẫn thuộc Classic; vốn trong ngăn V6 là tham chiếu cho phép thử 1R, không thay cấu hình tài khoản.

Mỗi thẻ/biểu đồ có nút `?`: hover 150ms, bấm/chạm để ghim, Escape hoặc bấm ngoài để đóng. Chú giải gồm chức năng, công thức, cách đọc và điều cần đối chiếu. Các thang điểm là mô tả mẫu, không tự đưa ra khuyến nghị tăng khối lượng hay thu hẹp stop-loss.

## Các điều chỉnh để giữ tính đúng của dữ liệu

- Thiếu 1R: mặc định loại riêng khỏi mẫu R; chỉ khi người dùng bật mô phỏng mới dùng baseline giả định. Luôn ưu tiên 1R ghi nhận. Dữ liệu gốc không bị điền lại.
- Thiếu phí: Net không biết; Gross có thể xem nếu giá trị gross được ghi nhận. Ma sát thêm là kịch bản riêng, không sửa hoặc lấp khoản phí thực đang thiếu.
- MAE/MFE thiếu: giữ trống riêng scatter/capture, các thống kê còn đủ dữ liệu vẫn hoạt động.
- PF trên phòng phân tích dùng tổng R dương/tổng R âm, nên có thể khác PF theo tiền trong Classic. SQN dùng SD mẫu, có trần √min(N,100), không trần, hoặc chỉ 100 lệnh cuối. Không có variance/downside/drawdown thì tỷ số tương ứng không xác định.
- Underwater dừng ở khoảng thiếu R hoặc thứ tự đóng chính xác đầu tiên và không báo Max DD toàn mẫu như đã đầy đủ. SQN trượt cũng bỏ cửa sổ không có thứ tự đáng tin cậy. Các trường hợp baseline/ma sát được gắn nhãn MÔ PHỎNG.
- Không tự suy giờ từ ngày; dữ liệu Classic chỉ có ngày không được đưa vào heatmap giờ. Đổi sang cơ sở ngày vào sẽ loại dòng không có thời điểm vào. Múi giờ lấy từ sổ V6.
- Calmar không được suy từ tổng R; cần chuỗi lợi suất vốn, nạp/rút và drawdown phần trăm đầy đủ. Sharpe/Sortino tại đây theo R mỗi lệnh với Rf/MAR=0, không thường niên hóa.

## Nguồn đối chiếu kỹ thuật

Định nghĩa và biến thể SQN: https://www.tradesviz.com/glossary/system-quality-number/ . MAE/MFE và lưu ý phép đo running-P&L: https://www.tradesviz.com/glossary/maximum-favorable-excursion/ . Dashboard, MAE/MFE và điều kiện Calmar: https://journalit.co/docs/dashboard . Không sử dụng các điểm đánh giá, giá thuê bao hay số sàn trong PDF làm dữ kiện sản phẩm đã xác minh.

## Nghiệm thu

Kiểm tra số học Net/Gross, SD mẫu/SQN/cap, ma sát, baseline giả định, gap drawdown, timestamp/timezone, long/short/multiplier và adapter Classic chỉ đọc. Kiểm tra trình duyệt ở 360/768/1280px, bàn phím/chú giải, ngăn cài đặt, lưu thiết lập, các biểu đồ và bản sao dữ liệu trước/sau mô phỏng. Chạy lại các luồng v6 và công cụ Classic. Đối chiếu Git để bảo đảm không có tệp Classic/backend thay đổi.
