# Sổ chung, phân tích V6 và lưu trữ dài hạn

## Phạm vi đã triển khai

Classic giữ nguyên giao diện và luồng nhập liệu. V6 chọn **Sổ chung với Classic** để đọc cùng bản ghi D1; màn hình đối chiếu cho phép sửa Gross, phí, Swap/Funding, 1R, MAE/MFE, phương pháp, ghi chú và thời điểm đóng thực. PATCH dùng đúng ID và version, từ chối ghi đè khi nơi khác vừa sửa. Classic đọc lại nguồn khi trở về trang hoặc theo chu kỳ; không thay bản trên thiết bị bằng một phản hồi cloud rỗng. Hàng đợi cục bộ và phiên sửa đang mở được ưu tiên bảo vệ.

Các giao dịch V6 cũ chứa khớp lệnh thật, ảnh và cấu trúc tham chiếu riêng được giữ nguyên. Không dựng giá hoặc chân khớp giả để biến một phiếu Classic chỉ có P&L thành giao dịch có execution. Hai giao diện cùng sửa các phiếu thuộc sổ chung; dữ liệu execution V6 trước đây vẫn là nguồn phân tích riêng, có lưu cloud và lịch sử.

Đơn vị trên tổng quan gồm R, tiền của sổ, % vốn tham chiếu ban đầu, Pips và Ticks. Các đồ thị, giá trị, chú giải và bảng đối chiếu đổi theo cùng đơn vị. SQN và Sharpe/Sortino luôn theo R, ghi nhãn rõ; % ở đây không phải TWR/CAGR. Pips/Ticks cần khối lượng và bước giá/hệ số nhân đúng mã; thiếu thông tin giữ trống. Không tự chuyển VND thành USD/USDT khi dùng vốn chung.

Vốn ban đầu, rủi ro mỗi lệnh, lỗ ngày, ngưỡng phòng thủ/dừng, sụt giảm tối đa, Static/Trailing, loại tài khoản và nạp/rút được lưu có version theo cùng tài khoản. Dòng tiền vốn không được cộng vào lợi nhuận giao dịch. Phí và 1R thực được bổ sung qua hồ sơ; baseline và ma sát giả định vẫn chỉ tạo kết quả mô phỏng.

## Loại bỏ chức năng trùng

Gỡ bảng 24 KPI và biểu đồ equity tiền mặt, các bản sao MetriX, theo dõi hệ thống, định giá doanh nghiệp, lịch, trang review vận hành, playbook và CSS chỉ dành cho các bản sao khỏi bundle V6. Các đường dẫn cũ đưa đến liên kết chức năng tương ứng trong Classic. Gỡ các mục điều hướng chưa có màn hình thật. Giữ phòng định lượng, phân tích nâng cao, mô phỏng, dữ liệu đối chiếu, kiểm tra chất lượng và khôi phục. Header và phím N đưa người dùng về Classic để thêm giao dịch; hồ sơ execution V6 cũ vẫn có thể hiệu chỉnh trong dữ liệu phân tích.

## Dữ liệu thực sự lưu ở đâu

Website hiện tại đã có Cloudflare D1 (`DB`) và R2 riêng (`BUCKET`) do Sites cung cấp. Không lưu nhật ký người dùng trong GitHub.

- D1: phiếu Classic đang sử dụng, quyền sở hữu, cấu hình chỉ mục, revision, dấu xóa, hàng đợi lưu trữ và lịch sử đối chiếu.
- R2: nội dung từng bản ghi/ảnh, dữ liệu gốc và các phiên bản riêng, khóa theo chủ sở hữu và SHA-256. Sửa bản ghi tạo đối tượng nội dung mới; không ghi đè nội dung cũ.
- IndexedDB: bản làm việc/offline cùng các bản trước khi nhận hoặc khôi phục dữ liệu. Đây không còn là nơi duy nhất lưu V6 khi bật cloud.
- NDJSON: bản sao di động có checksum, tải về theo nhiều gói giới hạn thay vì một phản hồi khổng lồ. Mỗi bộ được cố định tại một revision; gói sau dùng cùng revision và con trỏ.

Không có TTL hoặc tác vụ dọn các phiên bản trong ứng dụng. Dấu xóa không xóa ảnh/bản gốc trong kho khôi phục. Đây là chính sách ứng dụng, **không phải bucket lock chống quản trị viên hoặc bảo đảm nhà cung cấp tồn tại vĩnh viễn**.

## Đồng bộ và bảo vệ dữ liệu

1. Chủ nhật ký bật lưu cloud cho tài khoản đang đăng nhập. Workspace cũ được gắn với chủ sở hữu; đổi tài khoản không tự tải dữ liệu của người trước lên tài khoản sau.
2. Toàn bộ 13 tập dữ liệu V6 được bảo toàn, cùng góc nhìn và cài đặt phân tích. Bản ghi lớn được chia phần; không dồn hàng chục năm vào một row D1.
3. So sánh ba bản: lần đã xác nhận, bản trên thiết bị và bản cloud. Chỉ bên thay đổi một phía được tự chuyển. Cùng sửa thì giữ cả hai và yêu cầu chọn bản; lựa chọn chỉ tác động những mục xung đột, không xóa các mục mới không liên quan.
4. Ghi D1 theo CAS, tối đa 16 bản ghi mỗi giao dịch máy chủ. Tất cả thay đổi trong một lô được chặn bởi cùng revision và mutation ID. Đối tượng R2 phải được lưu trước khi chỉ mục chuyển sang bản mới.
5. Mỗi lần gọi ghi mang `expectedOwner`; server so với danh tính đã xác thực. Header chủ sở hữu chỉ là điều kiện chống đổi phiên, không được dùng làm chứng cứ đăng nhập.
6. Trigger D1 ghi hàng đợi cho thay đổi Classic và ảnh. Hàng đợi bền, có token mỗi lần thay đổi; giao dịch lưu trữ chỉ được chấp nhận khi token còn khớp ngay trong transaction, rồi mới xác nhận hàng đợi. Nếu xung đột, đọc lại sổ thay vì gửi lại nội dung cũ. Sổ chính không bị xóa khi sao lưu lỗi. Đọc lại dữ liệu Classic trước đây có phân trang và con trỏ để không cắt ở 5.000 dòng.
7. Ảnh gỡ khỏi Classic được cất metadata vào audit, giữ byte R2 và sao chép vào bộ lưu trữ theo phần. Không thể giữ 30 năm một ảnh chỉ có URL bên ngoài nếu máy chủ bên ngoài xóa ảnh; nên tải ảnh trực tiếp lên nhật ký.

Đồng bộ V6 tự chạy khi trang đang mở và có mạng; mất mạng vẫn lưu cục bộ. Hàng đợi Classic được xử lý khi trang Classic/V6 hoạt động. Không tuyên bố đã có lịch chạy máy chủ lúc website đóng: lịch hosting hiện chưa được xác nhận. Dữ liệu đã được máy chủ xác nhận vẫn lưu khi đóng trang.

## Thiết kế cho 30 năm

Ví dụ quy hoạch, không phải số liệu sử dụng thực: 100 lệnh/ngày × 365 × 30 = 1.095.000 lệnh. Giả sử dữ kiện 4 KB/lệnh là khoảng 4,4 GB trước chỉ mục và lịch sử; hai ảnh 200 KB/lệnh khoảng 438 GB. Mô hình hiện tại còn giữ ảnh gốc và bản sao theo phần base64: riêng hai lớp này có thể cần khoảng 1,02 TB cho ví dụ trên, chưa tính lịch sử sửa. Cần tính cả overhead này khi chọn quota; khi tăng quy mô nên chuyển bộ lưu trữ ảnh sang binary trực tiếp và chỉ mã hóa khi xuất gói. Bởi vậy ảnh và lịch sử thuộc object storage; D1 chỉ nên giữ chỉ mục gọn và phần vận hành cần thiết.

Chỉ mục có chủ sở hữu, loại dữ liệu, năm/tháng và khóa tiếp tục; API hỗ trợ truy xuất theo kỳ, không đòi trả cả 30 năm trong một request. Gói xuất có tối đa 100 mục và dừng sau ngưỡng dung lượng; stream tôn trọng backpressure. Lịch sử phiên bản có con trỏ để xem qua 50 phiên bản đầu.

Giới hạn hiện tại cần giữ rõ: workspace/offline vẫn dùng mô hình snapshot và bản khôi phục trong trình duyệt tối đa 100 MB. Không quảng cáo rằng điện thoại có thể tải cả hàng trăm GB ảnh hoặc tính ngay mọi thống kê 30 năm. Khi dữ liệu lớn, dùng truy vấn theo kỳ và quy trình khôi phục máy chủ theo lô; trước khi đạt ngưỡng quota phải bổ sung phân vùng chỉ mục, tác vụ tổng hợp và kiểm thử quy mô tương ứng. Quota/gói Sites thực tế chưa được cung cấp, nên không coi hạn mức Cloudflare trực tiếp là cam kết của website này.

Theo tài liệu hiện hành, D1 có trần mỗi database và Time Travel hữu hạn (7 ngày free/30 ngày paid). Nó không thay thế bản sao dài hạn. R2 có thiết kế độ bền cao nhưng không bảo vệ khỏi việc mất tài khoản, xóa có quyền hoặc ngừng dịch vụ. Kế hoạch vận hành cần:

- Duy trì tài khoản, dung lượng và thanh toán hosting.
- Giữ bản sao độc lập tại một nhà cung cấp/tài khoản khác do chủ nhật ký kiểm soát, có lịch kiểm tra khôi phục.
- Khi được cấp quyền quản trị bucket, xem xét khóa giữ bản sao, quyền chống xóa và cảnh báo quota. Chưa bật bucket lock trên tài khoản hiện tại.
- Mỗi lần đổi nhà cung cấp, kiểm tra checksum, số lượng, liên kết và khôi phục thử trước khi ngừng kho cũ.

Kho độc lập ở nhà cung cấp thứ hai chưa được kết nối. Tính năng tải bản sao và kiểm tra/khôi phục đã có; việc lập lịch sao chép sang tài khoản thứ hai cần một đích lưu trữ và quyền vận hành thực tế.

## Nguồn kỹ thuật chính thức

- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- R2 durability: https://developers.cloudflare.com/r2/reference/durability/
- R2 Workers API: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- Bucket locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/

## Nghiệm thu

Kiểm thử số học và đơn vị, CAS, chống đổi tài khoản, xung đột có mục mới ở cả hai phía, dấu xóa và bản cũ, checksum với khóa số, xuất đúng revision, hàng đợi Classic, byte ảnh đã gỡ, nạp/rút không thành P&L, khôi phục trên trình duyệt mới và bộ dữ liệu 30 lệnh. Kiểm tra giao diện ở 360/768/1280px cùng các luồng Classic trước khi xuất bản.

Kết quả trước xuất bản: root 118 unit/Miniflare tests, V6 83 unit tests, 22 kiểm tra runtime/artifact; TypeScript cả hai ứng dụng và lint V6 đạt. Bộ 69 kiểm thử trình duyệt: 66 đạt, 2 ca hiệu năng bỏ qua theo viewport, một ca bảng lệnh bị chậm; kiểm tra lại độc lập ba lần đều đạt. Bảng lệnh đã được sửa để xử lý Enter theo giá trị đang nhập thay vì trạng thái có thể chưa render. Dùng bộ 10 kiểm thử Classic để kiểm tra bản triển khai cuối.
