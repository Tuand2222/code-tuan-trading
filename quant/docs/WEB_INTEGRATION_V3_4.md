# Tích hợp bộ tham chiếu v3.4 vào Classic/V6

Ngày ghi nhận: 29/10/2026 (Asia/Saigon). Nhánh: fix/audit-missing-net, PR #9.

## Thay đổi đã thực hiện

- Thêm engine Python v3.4, toàn bộ 214 pytest và bộ đặc tả/CHANGELOG/báo cáo. GitHub CI chạy Python trước cổng kiểm tra bắt buộc.
- Một module browser `src/core/quant-v34.js` dùng Decimal 40 chữ số; V6 và Worker được dựng từ chính module đó, Classic gọi cùng module. Không thêm thư viện ứng dụng; khai báo rõ esbuild 0.28.0 là công cụ build đã có trong dependency tree.
- Q1 DD_R có đỉnh ban đầu 0; [-1] => 1R. NAV trung lập dòng tiền, EOD khi chỉ có ngày. Classic tính net bằng Decimal trước khi đổi sang số để hiển thị.
- Thêm API SL đúng phía, fallback R có nguồn và cờ loại empirical khỏi SQN; FIFO flat-to-flat, partial closes, flip và đơn vị phí tiền tài khoản; đồng hồ IANA có DST gap/fold tường minh; UTC replay sắp thứ tự O(N log N). Các API browser này có kiểm thử đối chiếu vector chuẩn.
- Metrics thêm Omega(theta), median, ES warning, nhãn N<30 và JSON-safe; giữ các phân tích ES97.5/RCK đã kiểm toán ở các trang chuyên sâu.
- Preview nhập file Classic dùng giá trị Excel raw và quyết định dấu số theo cột; bắt xác nhận trước commit khi còn mơ hồ. Bản ghi thiếu phí/1R không tự được đánh dấu xác minh.
- Giới hạn vốn/rủi ro vẫn cảnh báo và giới hạn đề xuất định cỡ. Thêm/ghi nhận nhật ký không bị Tier2/Tier3 hoặc floating P&L chặn. Daily loss dùng realized, floating chỉ hiển thị thông tin. Bộ kiểm thử cũ về khóa nhập được cập nhật theo chính sách đã chốt, không sửa kỳ vọng công thức để che lỗi.
- Replay được tính trong selector chung, không ghi đè autoTags lịch sử hoặc fingerprint của người dùng trong lần cập nhật này.

## Kiểm tra thực tế trên mã chuẩn bị xuất bản

- Python: 214/214, không skip/xfail.
- Vitest ứng dụng: 220/220, gồm 67 ca module định lượng/biên tích hợp mới.
- V6 core: 116/116; ID trùng=0; function declaration trùng=0; script hợp lệ; source/generated HTML khớp.
- Mutation guards: 3/3, công thức ES/RCK sai có chủ ý vẫn bị chặn.
- Node/backend/architecture: 27/27.
- V6 browser: 103/103 qua 12 suite; không page error trong các JSON kết quả. Chạy nối tiếp sau khi cập nhật các expectation cũ về khóa nhập.
- Classic/V6 hai tab: 18/18, cả BroadcastChannel và storage fallback; thêm/sửa/xóa có JSON download kiểm tra thật, khôi phục ID và reset/stale-write.
- Classic lifecycle: 4/4; cloud sync safety: 5 nhóm đạt.
- Root production build và typecheck đã đạt. Lỗi fixture architecture thiếu dependency trong thư mục tạm được sửa bằng liên kết dependency đã cài; ca stale-artifact vẫn phải thất bại đúng lý do, không bị nới điều kiện.
- Đã kiểm tra ảnh giao diện mobile, dark mode và không tràn ngang. Kiểm thử chỉ dùng fixture tổng hợp và API local; 0 lần ghi dữ liệu production.

## Phạm vi chưa nên tuyên bố hoàn tất

Đây là lần đưa bộ tham chiếu và phần lõi dùng chung vào mã ứng dụng, không phải xác nhận mọi màn hình đã hoàn thành toàn bộ P0–P3.
Báo cáo này ghi nhận trạng thái PR #9. Phần Prop sau đó đã được bổ sung funded lifecycle/day-cluster trên web; xem [WEB_PROP_V3_4.md](WEB_PROP_V3_4.md) để biết phạm vi và giả định hiện tại.
Các preset giao diện vẫn là ví dụ nguồn chưa xác minh; không coi các mức phí/payout là hợp đồng quỹ hiện hành.
Dataclass AccountProfile và pipeline đầy đủ trong Python là hợp đồng tham chiếu; phần ứng dụng giữ schema/ledger hiện có, chưa chuyển toàn bộ cấu hình UI sang dataclass này.
Tệp sao kê thật, cloud nhiều thiết bị 50k và mọi trình duyệt/thiết bị vật lý không được kiểm thử ở lượt này; 18 ca hai tab không thay thế kiểm thử cloud quy mô lớn.
Các tính năng phân tích/ghi nhật ký cũ và backend được bảo toàn. Không có migration phá dữ liệu hay thay Site identity/audience.

## GitHub và publication

Nguồn được cập nhật qua nhánh/PR #9. Main yêu cầu human review theo CONTRIBUTING.md và branch protection; không tự merge hoặc bypass.
Kết quả CI từ GitHub và publication được ghi vào báo cáo triển khai riêng sau khi có ID thực tế.
