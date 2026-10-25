# BÁO CÁO ĐỐI CHIẾU VÀ SỬA S1–S10

Ngày 25/10/2026. Baseline GitHub: `35614a6d8910bbdcab8c59387e1be4d26d0682a2` (web phiên bản 17). Bản sửa: `v6/index.html`, tải riêng dưới tên `index.html`. SHA-256 file tải: `413c79e0b6c6b6637770c07dea8b920298c266e0bc364d1a5c81f86c5d36f071`; 410,380 byte, 2804 dòng (baseline 403.677 byte, 2.781 dòng).

## Tài liệu và thứ tự đối chiếu

Đã đọc tệp 01 bên ngoài ZIP, toàn bộ blueprint/file 04/inventory và mã A/B trong ZIP; đọc 30 trang đặc tả định lượng và 3 trang PDF quyền truy cập. Có render kiểm tra trực quan trang 6, 7, 8, 22, 23 của đặc tả. A/B và inventory giống byte bản trước; blueprint cập nhật nhận định vốn/DD và bổ sung file 04. Tệp 01 ngoài ZIP mới hơn và có S1–S10; tệp 01 trong ZIP là phiên bản ngắn trước đó. Dùng yêu cầu của người dùng để triển khai; tài liệu không tự cấp quyền, không tự ghi đè chính sách kho hay kết quả kiểm thử.

Không xây lại P0–P7 từ đầu: kiểm tra lại 701 quyết định và giữ kiến trúc bản đã xuất bản, sửa phần thiếu theo tài liệu mới. Không có SRC_C trong ZIP. Key hợp nhất v17 vẫn giữ nguyên; không xóa/migrate đoán các key production không biết. Classic/Legacy/backend/D1/R2 giữ nguyên.

## Kết quả S1–S10

| Mục | Trước sửa | Sau sửa / giới hạn |
|---|---|---|
| S1 | Thiếu current_equity | Đã thêm current_equity từ snapshot RiskStore vào risk_profiles, JSON/SQL/IndexedDB. |
| S2 | open_time / planned_rr | Xuất entry_time / planned_rr_ratio; nhập vẫn hiểu open_time cũ và entry_time mới, payload gốc khôi phục từng trường. |
| S3 | Tên cột lệch, MC chưa chạy vẫn chụp ra null | Snapshot đợi MC thật, đủ 12 cột PDF. Không lưu nếu payoff/đầu vào không xác định; không lấp số giả. MDD và f* lưu theo tỷ lệ 0..1, UI đổi sang %. |
| S4 | Cache chỉ ở RAM, tải lại mất | SHA-256 khóa theo phiên bản tính toán, lệnh, dòng tiền, vốn, Risk Profile, giả định, lựa chọn và payload; kiểm checksum kết quả. Cache tối đa 8 trong extra.mcCache của cùng sổ, được IndexedDB phản chiếu. Snapshot có input_hash/cache_entry và cũng được dùng lại. Đổi dữ liệu/cấu hình làm cache hết hiệu lực. |
| S5 | Chưa giải thích xác suất chuỗi 3 lệnh | Dòng Tier 1 lấy (1−WR)^3 từ RiskStore; WR 50% cho 12,5%. Không đủ mẫu thì báo thiếu. |
| S6 | Chưa hiển thị số lệnh đệm | RiskStore tính khoảng vốn đến Tier 3 và rủi ro thực từ dailyBudget trước/sau Tier 2. Ví dụ 5→10; nếu trần ngày đã giới hạn thì không bịa số gấp đôi. Đây là xấp xỉ giữ vốn cố định. |
| S7 | Cứng 20 ngày/tháng | Tham số 1..31 ngày/tháng, mặc định 21; chu kỳ payout mặc định vẫn 10. Thay ngày tháng không đổi payout mỗi chu kỳ. |
| S8 | Xuất personal / prop | Đủ PERSONAL, FTMO, THE5ERS_HYPER, THE5ERS_HIGH_STAKES, THE5ERS_BOOTCAMP, TOPSTEP_TRAILING. Topstep có key nguồn top. Preset ngoài enum (Apex/MyFundedFX/FundedNext/quỹ tùy chỉnh cũ) giữ dữ liệu gốc và báo chưa xếp loại, account_type=null đến khi chọn đúng loại; tuyệt đối không đổi tên thành FTMO. SQL có CHECK sáu giá trị, giữ NULL cho trường chưa phân loại. |
| S9 | Nhãn Kaufman dùng drift/std; chưa có thẻ xấp xỉ riêng | Kaufman theo Edge=W−L đúng bộ số mới; Balsara giữ bộ giải gốc; thêm xấp xỉ từ Edge theo payoff và giữ thực nghiệm Worker. Ghi chú khác biệt giả định, chân trời và định cỡ; b không nguyên vẫn là mở rộng liên tục của phương trình. |
| S10 | Có ô tùy chỉnh, nhưng chuyển từ quỹ về cá nhân giữ 2/3,5 | Đổi loại tài khoản đặt lại 3/5 cá nhân, 2/3,5 quỹ; sửa thủ công được lưu. Không tự đoán ngưỡng Mở rộng. TODO: đối chiếu PDF trang 6 theo yêu cầu; bảng thực nằm trang 7–8 và số vẫn thiếu ngay trong bản render. |

## Lỗi RCK phát hiện thêm khi đối chiếu

Các trường nội bộ kế thừa rckAlpha/rckBeta và hai ID adv-rck-alpha/adv-rck-beta lần lượt đang lưu xác suất và sàn vốn. Bản trước truyền chúng thẳng theo thứ tự α/β vào solver nên λ bị đảo. Bản này giữ nguyên ý nghĩa dữ liệu người dùng đã lưu, truyền sàn vốn làm α và xác suất làm β. Nhãn Hy Lạp trên hai ô, đường β tham chiếu trên biểu đồ và rck_alpha/rck_beta khi xuất SQL đã đổi đúng nghĩa PDF. Không đổi key/giá trị cấu hình ngầm. Ví dụ xác suất 10%, sàn vốn 70% cho λ = 6,4556962358. Bộ giải vẫn là một RiskMath dùng chung Worker, không thêm bản sao công thức.

Các kỳ vọng cũ kiểm thử RiskStore λ theo thứ tự sai được thay bằng công thức đối chứng PDF; thêm test độc lập kiểm λ, ràng buộc và UI. Test bất đồng bộ trước đây giả định Worker khởi động ngay được sửa để chờ bước băm đầu vào, vẫn kiểm kết quả stale, không nới điều kiện an toàn.

## Lưu trữ và tương thích

Một state.trades, một state.cashflows và một key tuannhatky_pro_unified_v1. Cache chỉ chứa kết quả dẫn xuất, không chứa sổ lệnh thứ hai. Kết quả 10.000 đường được dùng lại qua runtime/trình duyệt mới và qua snapshot lưu; sửa Risk Profile/lệnh làm khóa khác. Kết quả cache bị sửa checksum bị bỏ, chạy thật lại. Không lưu được vì quota không ghi đè mất sổ. WebCrypto không có thì bỏ cache, vẫn tính được. JSON/raw payload giữ roundtrip; snapshot v17 thiếu trường được giữ nguyên trong payload, chỉ đổi đơn vị/cột có thể chứng minh khi chiếu ra DB, không tự chế giá trị thiếu.

SQL thêm cột bằng ADD COLUMN IF NOT EXISTS để tương thích bảng đã xuất trước. CHECK enum là NOT VALID để không phá bản ghi legacy chưa phân loại; các dòng mới phải đúng enum hoặc NULL khi chưa phân loại. SQL chưa chạy trên PostgreSQL/Supabase. IndexedDB là bản sao trên cùng thiết bị, không phải cloud; G7/G8 ngoài phạm vi theo yêu cầu mới (không thêm backend PostgreSQL/API, TypeScript hay WebAssembly).

## Kiểm thử thực tế

Tổng **138/138**: 62 kiểm tra lõi và 76 kiểm tra Chromium, gồm 121 kiểm tra trước được chạy lại và 17 kiểm tra mới. Toàn bộ 3 script qua node --check; ID trùng=0, hàm có tên trùng=0; không thiếu ID GIỮ; 6 chuỗi cấm đều=0. Những số lượng/timestamp đầy đủ nằm trong output JSON phía dưới.

Đã dùng Chart.js thật (không stub): fan chart Monte Carlo, RCK, Omega/đuôi, Prop, các trang phân tích được tải trong trình duyệt; xác nhận Chart.version/instances và có ảnh kết quả. Có test số Stressed ES/VaR với oracle nguồn, Ω tại mục tiêu Prop 0,25R, daily/trailing vi phạm giữa đường dù đường không giới hạn có thể phục hồi, và ROI/EV/chu kỳ Prop. Các preset quỹ vẫn là ví dụ nguồn, không xác minh điều khoản hiện hành.

Đã kiểm WCAG 2 A tự động trên 21 trang (0 vi phạm), focus/Tab/Escape, dark, viewport 360/768/1280 không tràn trang, Worker thật, sao lưu/xóa/khôi phục từng trường và chuyển SW V6 cũ giữ dữ liệu. Chưa kiểm màn hình đọc thủ công, Safari/Firefox, mọi tổ hợp thị trường/dữ liệu, hiệu năng trên thiết bị người dùng hay độ bền 30 năm. Không xóa dữ liệu production để thử.

## Đối chiếu PDF quyền truy cập và việc cần làm tay

Đã kiểm thật GitHub: repo public, phiên đăng nhập có quyền push/admin, main trả "Branch not protected", GitHub Pages trả 404 (chưa thấy cấu hình). Không thay quyền repo, cài App, tạo token, cấp Admin cho agent khác hay bật Pages chỉ vì tài liệu hướng dẫn. PDF nói "Codex không tự deploy" là mô tả workflow GitHub/host trong tài liệu; phiên này có công cụ Sites và người dùng đã yêu cầu deploy, nên xuất bản bằng Sites. Chưa có workflow GitHub→Sites tự deploy khi merge. Root không đổi thành site tĩnh vì Classic/API đang cần backend; bản tải index.html dùng riêng cho host tĩnh được.

Việc người dùng tự quyết/thực hiện:

1. Review PR và merge main sau ít nhất một approval theo CONTRIBUTING.md; không coi push lên nhánh là merge.
2. Bật branch protection nếu muốn GitHub cưỡng chế PR/review/cấm force-push. Hiện quy tắc có trong CONTRIBUTING nhưng chưa bật trên server.
3. Nếu cấp agent khác: chọn đúng repo và quyền tối thiểu trong tài khoản/App của bạn; không gửi mật khẩu/token vào chat. Quyền sửa PR của connector và Git đang dùng có thể khác nhau.
4. Chỉ cấu hình auto-deploy từ main nếu muốn workflow đó; phiên này deploy qua Sites. Không tự đổi host.
5. Đối chiếu số ngưỡng Mở rộng ở PDF trang 6 theo yêu cầu (bảng tại trang 7–8 bị thiếu số); chỉnh hai ô Tier trong Risk Profile nếu có bản PDF rõ hơn.
6. Chọn loại quỹ chuẩn cho preset legacy ngoài enum trước khi dùng dữ liệu xuất làm cấu hình thật. Sao lưu JSON định kỳ. Chỉ chạy SQL sau khi thay UUID chủ sở hữu và kiểm tra schema/RLS trên môi trường thử.

Đã thêm AGENTS.md ngắn ở gốc, giới hạn thay đổi trong V6/giữ Classic, một lõi toán, kiểm tra trước PR và không commit secrets/nhật ký thật. Không thêm thư viện ứng dụng.

## Mặc định và bố cục

Giữ mặc định §11: mẫu A, B chọn được, safeTierMax=1, key cũ hợp nhất, CDN, giữ pnlrisk/mapping. Giữ Zones là thẻ tóm tắt từ RiskStore theo D15; biểu đồ lớn nằm ở trang tương ứng, không nhân bản/dời DOM. Đây là cách giải mâu thuẫn giữa mô tả 4 vùng file 04 và quyết định chống trùng cụ thể D15.

## ID thêm/đổi tên

Không đổi/xóa thêm ID giữ lại. Thêm ror-approx cho chỉ số mới và pf-month-days cho tham số 21 ngày. Hai ID RCK cũ giữ nguyên để tương thích; chỉ sửa nhãn α/β và ánh xạ công thức. Những ID đã gộp/đổi trong P0–P7 vẫn được ghi bên dưới.

## Inventory đầy đủ

406 GIỮ / 256 GỘP / 39 BỎ, tổng 701.

| Nguồn | Loại | ID/hàm | Quyết định | Đích | Lý do |
|---|---|---|---|---|---|
| SRC_A_V3_Kiem_Toan.html | id-static | btn-gross | GIỮ | btn-gross | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | btn-theme | GIỮ | btn-theme | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | sidebar | GIỮ | sidebar | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-overview | GIỮ | side-overview | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-workspace | GIỮ | side-workspace | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-edge | GIỮ | side-edge | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-drilldown | GIỮ | side-drilldown | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-discipline | GIỮ | side-discipline | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-pnlrisk | GIỮ | side-pnlrisk | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-simulation | GIỮ | side-simulation | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-cockpit | GIỮ | side-cockpit | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-mapping | GIỮ | side-mapping | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | side-dictionary | GIỮ | side-dictionary | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | v3-safety | GIỮ | v3-safety | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | page-h1 | GIỮ | page-h1 | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | alerts-bar | GIỮ | alerts-bar | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | alert-disc | GIỮ | alert-disc | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-bar | GIỮ | filter-bar | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-summary | GIỮ | filter-summary | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-chips | GIỮ | filter-chips | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-clear | GIỮ | filter-clear | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-workspace | GIỮ | tab-workspace | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-date-range | GIỮ | filter-date-range | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-date-from | GIỮ | filter-date-from | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-date-to | GIỮ | filter-date-to | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-operator | GIỮ | filter-operator | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-market | GIỮ | filter-market | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-setup | GIỮ | filter-setup | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-side | GIỮ | filter-side | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-symbol | GIỮ | filter-symbol | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-discipline | GIỮ | filter-discipline | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-result | GIỮ | filter-result | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-review | GIỮ | filter-review | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filter-tag | GIỮ | filter-tag | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | custom-tags-container | GIỮ | custom-tags-container | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | saved-view-name | GIỮ | saved-view-name | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | saved-views-dropdown | GIỮ | saved-views-dropdown | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | filtered-count | GIỮ | filtered-count | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | workspace-table-body | GIỮ | workspace-table-body | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-edge | GIỮ | tab-edge | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | confidence-bar | GIỮ | confidence-bar | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | kpi-expectancy | GIỮ | kpi-expectancy | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | badge-expectancy | GIỮ | badge-expectancy | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | kpi-sqn | GIỮ | kpi-sqn | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | badge-sqn | GIỮ | badge-sqn | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | kpi-pf | GIỮ | kpi-pf | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | badge-pf | GIỮ | badge-pf | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | kpi-exit-eff | GIỮ | kpi-exit-eff | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | badge-exit-eff | GIỮ | badge-exit-eff | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | kpi-dd | GIỮ | kpi-dd | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | badge-dd | GIỮ | badge-dd | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | kpi-recovery | GIỮ | kpi-recovery | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | badge-recovery | GIỮ | badge-recovery | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-mfe | GIỮ | chart-mfe | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-mae | GIỮ | chart-mae | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-rdist | GIỮ | chart-rdist | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-drawdown | GIỮ | chart-drawdown | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | heatmap-container | GIỮ | heatmap-container | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | discipline-cost | GIỮ | discipline-cost | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | breakdown-dim | GIỮ | breakdown-dim | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | breakdown-container | GIỮ | breakdown-container | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | hold-wrap | GIỮ | hold-wrap | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-hold | GIỮ | chart-hold | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | hold-note | GIỮ | hold-note | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-simulation | GIỮ | tab-simulation | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-horizon | GỘP | adv-mc-h | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-runs | GỘP | adv-mc-n | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-risk | GỘP | risk-profile-fTier | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-dd | GIỮ | sim-dd | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-skip | GIỮ | sim-skip | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-cap | GIỮ | sim-cap | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-slip | GIỮ | sim-slip | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-sim | GỘP | adv-mc-chart | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-summary | GỘP | adv-mc-summary | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | sim-note | GỘP | mc-info | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-cockpit | GIỮ | tab-cockpit | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | ck-day | GỘP | dl-date-pick | D7: một ngày xét chung cho panel lỗ ngày |
| SRC_A_V3_Kiem_Toan.html | id-static | ck-daily | GỘP | risk-profile-dailyLossLimit | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | ck-personal | GỘP | risk-profile-personalDailyLimit | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | ck-maxdd | GỘP | risk-profile-maxDrawdown | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | ck-ddmode | GỘP | risk-profile-ddMode | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | ck-cards | GIỮ | ck-cards | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-pnlrisk | GIỮ | tab-pnlrisk | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-ratio-cards | GIỮ | risk-ratio-cards | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | chart-equity | GIỮ | chart-equity | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-note | GIỮ | risk-note | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-mapping | GIỮ | tab-mapping | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | mapping-demo-body | GIỮ | mapping-demo-body | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-dictionary | GIỮ | tab-dictionary | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | dict-search | GIỮ | dict-search | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | dict-cards-container | GIỮ | dict-cards-container | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-riskcapital | GIỮ | tab-riskcapital | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-gate-badge | GIỮ | risk-gate-badge | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-summary-cards | GIỮ | risk-summary-cards | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-quality | GIỮ | risk-quality | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-tier-stats | GIỮ | risk-tier-stats | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-recovery-chart | GIỮ | risk-recovery-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-pct | GỘP | risk-profile-fTier | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-k | GỘP | risk-profile-k | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-dd-limit | GỘP | risk-profile-maxDrawdown | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-ror-horizon | GIỮ | risk-ror-horizon | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-budget | GIỮ | risk-budget | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-ror-result | GIỮ | risk-ror-result | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-overlap | GIỮ | risk-overlap | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-detail-rows | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-riskedge | GIỮ | tab-riskedge | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edge-quality | GIỮ | risk-edge-quality | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-omega-l | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-omega-val | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-omega-chart | GIỮ | risk-omega-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-es-val | GỘP | es-stats | D13: một thẻ Tail Risk |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-tail-chart | GIỮ | risk-tail-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-roll-window | GIỮ | risk-roll-window | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-decay-stats | GIỮ | risk-decay-stats | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-drift-chart | GIỮ | risk-drift-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-tp-r | GIỮ | risk-tp-r | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-sl-r | GIỮ | risk-sl-r | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-whatif | GIỮ | risk-whatif | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-riskopt | GIỮ | tab-riskopt | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-alpha | GỘP | adv-rck-alpha | D14: bỏ optimizer quét riêng, dùng tham số bộ giải A |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-dd | GỘP | ror-floor | D14: một ngưỡng Drawdown cho phép kiểm chứng RoR |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-horizon | GỘP | risk-ror-horizon | D14: một horizon cho kiểm chứng RoR |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-max | GỘP | bud-f | D7/D14: trần rủi ro đọc Risk Profile, bỏ trần optimizer riêng |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-run | GIỮ | risk-opt-run | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-result | GIỮ | risk-opt-result | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-chart | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-opt-fan-note | GIỮ | risk-opt-fan-note | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-serial | GIỮ | risk-serial | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-prop-size | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-prop-target | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-prop-fee | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-prop-split | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-prop-out | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-detail-modal | GIỮ | risk-detail-modal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-detail-close | GIỮ | risk-detail-close | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-detail-title | GIỮ | risk-detail-title | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-open | GIỮ | risk-edit-open | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-close | GIỮ | risk-edit-close | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-entry | GIỮ | risk-edit-entry | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-sl | GIỮ | risk-edit-sl | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-tp | GIỮ | risk-edit-tp | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-exit | GIỮ | risk-edit-exit | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-lots | GIỮ | risk-edit-lots | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-edit-mae | GIỮ | adv-edit-mae | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-edit-mfe | GIỮ | adv-edit-mfe | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-edit-slip | GIỮ | adv-edit-slip | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-edit-tick | GIỮ | adv-edit-tick | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-edit-error | GIỮ | risk-edit-error | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-detail-cancel | GIỮ | risk-detail-cancel | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | risk-detail-save | GIỮ | risk-detail-save | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-risktools | GIỮ | tab-risktools | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-quality | GIỮ | adv-quality | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-symbol | GIỮ | adv-symbol | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-risk | GIỮ | adv-risk | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-entry | GIỮ | adv-entry | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sl | GIỮ | adv-sl | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-ptv | GIỮ | adv-ptv | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-step | GIỮ | adv-step | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-size-out | GIỮ | adv-size-out | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-price-quality | GIỮ | adv-price-quality | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-duration | GIỮ | adv-duration | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-hold-chart | GIỮ | adv-hold-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-trades | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-riskstress | GỘP | tab-simulation | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sw-label | GIỮ | adv-sw-label | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sw | GIỮ | adv-sw | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sp-label | GIỮ | adv-sp-label | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sp | GIỮ | adv-sp | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sf-label | GIỮ | adv-sf-label | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-sf | GIỮ | adv-sf | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-streak | GIỮ | adv-streak | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-degrade | GIỮ | adv-degrade | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-tail | GIỮ | adv-tail | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-stress-dd | GIỮ | adv-stress-dd | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-stress-reset | GIỮ | adv-stress-reset | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-stress-gates | GIỮ | adv-stress-gates | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-stress-out | GIỮ | adv-stress-out | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-stress-chart | GIỮ | adv-stress-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tab-riskprop | GIỮ | tab-riskprop | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-preset | GIỮ | adv-preset | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-size | GIỮ | adv-p-size | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-fee | GIỮ | adv-p-fee | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-target | GIỮ | adv-p-target | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-maxloss | GIỮ | adv-p-maxloss | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-daily | GIỮ | adv-p-daily | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-risk | GIỮ | adv-p-risk | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-split | GIỮ | adv-p-split | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-tpd | GIỮ | adv-p-tpd | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-horizon | GIỮ | adv-p-horizon | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-ddmode | GIỮ | adv-p-ddmode | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-runs | GIỮ | adv-p-runs | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-seed | GIỮ | adv-p-seed | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-run | GIỮ | adv-p-run | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-summary | GIỮ | adv-p-summary | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | adv-p-chart | GIỮ | adv-p-chart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | custom-option-modal | GIỮ | custom-option-modal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | custom-modal-title | GIỮ | custom-modal-title | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | custom-option-input | GIỮ | custom-option-input | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | custom-option-target-category | GIỮ | custom-option-target-category | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | tooltip-modal | GIỮ | tooltip-modal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | modal-title | GIỮ | modal-title | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | modal-function | GIỮ | modal-function | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | modal-formula | GIỮ | modal-formula | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | modal-scale | GIỮ | modal-scale | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | modal-action | GIỮ | modal-action | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | add-trade-modal | GỘP | risk-detail-modal | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | new-trade-symbol | GỘP | risk-edit-symbol | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | new-trade-pnl | GỘP | risk-edit-pnl | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | new-trade-risk | GỘP | risk-edit-risk | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | new-trade-hold | GỘP | risk-edit-hold | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-static | settings-drawer | GIỮ | settings-drawer | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | setting-initial-cap | GIỮ | setting-initial-cap | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | setting-default-1r | GIỮ | setting-default-1r | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | label-friction-val | GIỮ | label-friction-val | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | setting-friction | GIỮ | setting-friction | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-static | setting-sqn-cap | GIỮ | setting-sqn-cap | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-correlated | GIỮ | adv-correlated | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-exit-bounds | GIỮ | adv-exit-bounds | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-interlock | GỘP | interlock-banner | D9: một banner liên động |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-chart | GỘP | chart-sim | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-h | GỘP | sim-horizon | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-mode | GỘP | sel-mc-mode | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-n | GỘP | sim-runs | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-revenge | GỘP | chk-mc-revenge-mode | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-run | GỘP | runSimulation | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-seed | GỘP | sel-mc-seed | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-mc-summary | GỘP | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-rck | GIỮ | adv-rck | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-rck-alpha | GIỮ | adv-rck-alpha | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-rck-beta | GIỮ | adv-rck-beta | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-ror-analytics | GIỮ | adv-ror-analytics | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | adv-serial-complete | GIỮ | adv-serial-complete | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | breakdown-mode | GIỮ | breakdown-mode | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | cal-g | GIỮ | cal-g | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | cal-n | GIỮ | cal-n | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | cal-p | GIỮ | cal-p | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | cal-t | GIỮ | cal-t | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | cb-f | GIỮ | cb-f | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | cb-g | GIỮ | cb-g | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | ck-a | GIỮ | ck-a | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | ck-l | GIỮ | ck-l | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | ck-n | GIỮ | ck-n | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | ck-r | GIỮ | ck-r | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | dep-list | GỘP | cashflow-table-body | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-injected | dep-sum | GỘP | top-bar-cashflow | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-injected | dp-add | GỘP | cashflow-modal | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-injected | dp-t | GỘP | cf-amount | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-injected | gp-d | GIỮ | gp-d | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | gp-list | GIỮ | gp-list | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | gp-out | GIỮ | gp-out | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | gp-save | GIỮ | gp-save | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | im-g | GIỮ | im-g | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | im-o | GIỮ | im-o | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | im-p | GIỮ | im-p | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | im-t | GIỮ | im-t | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | kcfg | GIỮ | kcfg | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | kcfg-l | GIỮ | kcfg-l | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | rv-s | GIỮ | rv-s | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | rv-w | GIỮ | rv-w | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | side-riskcapital | GIỮ | side-riskcapital | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | side-riskedge | GIỮ | side-riskedge | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | side-riskopt | GIỮ | side-riskopt | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | side-riskprop | GIỮ | side-riskprop | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | side-riskstress | GỘP | side-simulation | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | id-injected | side-risktools | GIỮ | side-risktools | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | id-injected | sz-o | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-injected | v6-ext | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-injected | v6-ext2 | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | id-injected | v6-nav | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_A_V3_Kiem_Toan.html | function | weekdayOf | GIỮ | weekdayOf | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | netR | GIỮ | netR | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | fmtR | GIỮ | fmtR | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | toast | GIỮ | toast | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | snapshot | GIỮ | snapshot | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | persist | GIỮ | persist | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | applySaved | GIỮ | applySaved | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | restore | GIỮ | restore | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | exportBackup | GỘP | exportBackup | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | importBackup | GỘP | importBackup | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | syncSettingsUI | GIỮ | syncSettingsUI | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | rawTab | GIỮ | rawTab | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | hashTab | GIỮ | hashTab | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | switchSidebarTab | GIỮ | switchSidebarTab | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | route | GIỮ | route | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | applyEdgeView | GIỮ | applyEdgeView | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | showTab | GIỮ | showTab | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderHoldChart | GIỮ | renderHoldChart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | updateCockpitSettings | GIỮ | updateCockpitSettings | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderCockpit | GIỮ | renderCockpit | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbSel | GIỮ | cbSel | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbPool | GIỮ | cbPool | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbSet | GIỮ | cbSet | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbAdd | GIỮ | cbAdd | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbRender | GIỮ | cbRender | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbInit | GIỮ | cbInit | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbWriteUrl | GIỮ | cbWriteUrl | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | cbBuildForm | GIỮ | cbBuildForm | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | showTip | GIỮ | showTip | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | hideTip | GIỮ | hideTip | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | applyTheme | GIỮ | applyTheme | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | initTheme | GIỮ | initTheme | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | toggleTheme | GIỮ | toggleTheme | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | syncGrossBtn | GIỮ | syncGrossBtn | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | toggleGross | GIỮ | toggleGross | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderRiskRatios | GỘP | renderRiskRatios | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | buildPool | GỘP | RiskMath.scenarioPools | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | simulate | GỘP | RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | runSimulation | GIỮ | runSimulation | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | promptAddCustomOption | GIỮ | promptAddCustomOption | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | closeCustomOptionModal | GIỮ | closeCustomOptionModal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | confirmAddCustomOption | GIỮ | confirmAddCustomOption | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderCustomTagsPills | GIỮ | renderCustomTagsPills | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | removeCustomOption | GIỮ | removeCustomOption | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | getActiveConditions | GỘP | getActiveConditions | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | dateScope | GIỮ | dateScope | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderFilterChips | GIỮ | renderFilterChips | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | updateFilters | GIỮ | updateFilters | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | resetFilters | GIỮ | resetFilters | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | rebuildSavedViews | GIỮ | rebuildSavedViews | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | saveCurrentView | GIỮ | saveCurrentView | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | loadSavedView | GIỮ | loadSavedView | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderWorkspaceTable | GỘP | renderWorkspaceTable | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | recalculateAndRender | GIỮ | recalculateAndRender | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderMfeChart | GIỮ | renderMfeChart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderMaeChart | GIỮ | renderMaeChart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderRDistChart | GIỮ | renderRDistChart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderDrawdownChart | GIỮ | renderDrawdownChart | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | mulberry | GỘP | RiskMath.mulberry32 | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_A_V3_Kiem_Toan.html | function | bootstrapCI | GIỮ | bootstrapCI | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | sqnLabel | GIỮ | sqnLabel | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | groupStats | GIỮ | groupStats | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderConfidence | GIỮ | renderConfidence | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderDisciplineCost | GIỮ | renderDisciplineCost | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderBreakdown | GỘP | renderBreakdown | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | renderHeatmap | GIỮ | renderHeatmap | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderDictionaryCards | GIỮ | renderDictionaryCards | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | searchDictionary | GIỮ | searchDictionary | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | openTooltipModal | GIỮ | openTooltipModal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | closeTooltipModal | GIỮ | closeTooltipModal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | toggleSettingsDrawer | GIỮ | toggleSettingsDrawer | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | updateSettingsFromUI | GIỮ | updateSettingsFromUI | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | openAddTradeModal | GIỮ | openAddTradeModal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | closeAddTradeModal | GIỮ | closeAddTradeModal | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | submitNewTrade | GIỮ | submitNewTrade | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | runMappingDemo | GIỮ | runMappingDemo | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | toggleMobileSidebar | GIỮ | toggleMobileSidebar | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | go | GIỮ | go | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | window.renderRiskRatios | GỘP | renderRiskRatios | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | window.renderBreakdown | GỘP | renderBreakdown | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | window.renderWorkspaceTable | GỘP | renderWorkspaceTable | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | addTab | GỘP | route / DOM tĩnh | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | parse | GIỮ | parse | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | window.getActiveConditions | GỘP | getActiveConditions | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | kApply | GIỮ | kApply | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | ed | GIỮ | ed | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | createChart | GỘP | ChartRegistry.draw | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | getCashflow | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_A_V3_Kiem_Toan.html | function | nav | GỘP | route / sidebar tĩnh | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | capitalNAV | GỘP | RiskMath.capitalNAV | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | tier | GỘP | RiskMath.tierOf | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderCapital | GIỮ | renderCapital | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | renderDetails | GỘP | renderWorkspaceTable | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderExposure | GỘP | renderCapital / RiskMath.exposureStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | editorOpen | GIỮ | editorOpen | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | editorClose | GIỮ | editorClose | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | editorSave | GỘP | submitNewTrade | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderEdge | GỘP | renderRiskEdge | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderSerial | GỘP | renderRiskOpt / RiskMath.serialStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderProp | GỘP | renderPropResults | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | optimizer | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_A_V3_Kiem_Toan.html | function | renderOpt | GỘP | renderRiskOpt | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | refresh | GỘP | renderAll | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | exportUnifiedBackup | GỘP | exportBackup | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | importUnifiedBackup | GỘP | importBackup / Core.decodeBackup | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | attach | GỘP | boot / bindSourceEvents / bindRiskEvents | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | sampleRng | GỘP | RiskMath.mulberry32 | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_A_V3_Kiem_Toan.html | function | range | GỘP | RiskMath.range | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | card | GIỮ | card | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | selectedNav | GỘP | switchSidebarTab | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | riskGate | GỘP | RiskStore.read().gates | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | rckBernoulli | GỘP | RiskMath.rckBinary | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_A_V3_Kiem_Toan.html | function | rckEmpirical | GỘP | RiskMath.rckEmpirical | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | analyticRoR | GỘP | RiskMath.rorAnalytic | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_A_V3_Kiem_Toan.html | function | mount | GỘP | boot / DOM tĩnh | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | syncSizerSymbol | GIỮ | syncSizerSymbol | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | calcSizer | GIỮ | calcSizer | Giữ hợp đồng DOM/handler; chuyển nguyên khối ở P3. |
| SRC_A_V3_Kiem_Toan.html | function | timeMs | GỘP | RiskMath.capitalNAV (Date.parse) | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderTools | GỘP | renderSizer | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | interlocks | GỘP | renderRiskHeader | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | exitBounds | GỘP | RiskMath.exitStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | fullSerial | GỘP | RiskMath.serialStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | rckPanel | GỘP | renderRiskOpt | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | mcExtended | GỘP | RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | stress | GỘP | stress / RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | propSimulation | GỘP | propSimulation / RiskMath.propMulti | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_A_V3_Kiem_Toan.html | function | renderExtended | GỘP | renderAll | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_A_V3_Kiem_Toan.html | function | render | GỘP | renderVisiblePage | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | id-static | top-bar-equity | GIỮ | top-bar-equity | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | top-bar-cashflow | GIỮ | top-bar-cashflow | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | top-bar-dd | GIỮ | top-bar-dd | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | top-bar-status | GIỮ | top-bar-status | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | nav-tabs | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | btn-tab-overview | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | btn-tab-layer1 | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | btn-tab-layer2 | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | btn-tab-layer3 | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | btn-tab-cockpit | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | tab-overview | GỘP | tab-zones | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | cashflow-table-body | GỘP | cashflow-table-body | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | trade-count-badge | GỘP | filtered-count | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | trade-log-body | GỘP | workspace-table-body | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | tab-layer1 | GỘP | tab-riskcapital | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | input-dd-pct | GIỮ | input-dd-pct | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | output-recovery-pct | GIỮ | output-recovery-pct | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | chartAsymmetricRecovery | GỘP | risk-recovery-chart | P7/D8: giữ canvas A, thêm ô DD tự do của B |
| SRC_B_v9_Risk.html | id-static | simultaneous-exposure-summary | GIỮ | simultaneous-exposure-summary | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | chartSimultaneousExposure | GIỮ | chartSimultaneousExposure | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | ror-winrate | GIỮ | ror-winrate | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | ror-payoff | GIỮ | ror-payoff | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | ror-floor | GIỮ | ror-floor | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | chartRorCliff | GIỮ | chartRorCliff | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | bud-k | GỘP | risk-profile-k | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | bud-f | GỘP | risk-profile-fTier | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | daily-budget-max-risk | GIỮ | daily-budget-max-risk | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | daily-budget-detail | GỘP | risk-budget | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | tab-layer2 | GỘP | tab-riskedge | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | whatif-scenario-select | GIỮ | whatif-scenario-select | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | whatif-orig-exp | GỘP | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | whatif-orig-winrate | GỘP | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | whatif-new-exp | GỘP | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | whatif-new-winrate | GỘP | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | whatif-stopped-early | GỘP | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | whatif-pf-change | GỘP | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | chartWhatIfCompare | GIỮ | chartWhatIfCompare | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | sample-size-warning-tag | GIỮ | sample-size-warning-tag | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | half-compare-text | GỘP | risk-decay-stats | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | chartRollingDrift | GỘP | risk-drift-chart | P11: chỉ một Rolling Expectancy/SQN |
| SRC_B_v9_Risk.html | id-static | chartBaselTail | GỘP | risk-tail-chart | D13: một thẻ Tail Risk dùng canvas A |
| SRC_B_v9_Risk.html | id-static | omega-target-select | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-static | chartOmegaCurve | GỘP | risk-omega-chart | D12: UI Omega nâng cấp của B dùng canvas A hiện hữu |
| SRC_B_v9_Risk.html | id-static | tab-layer3 | GỘP | tab-riskopt | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | rck-alpha | GỘP | adv-rck-alpha | D14/§6: quy ước tham số và bisection của A thắng B |
| SRC_B_v9_Risk.html | id-static | rck-beta | GỘP | adv-rck-beta | D14/§6: quy ước tham số và bisection của A thắng B |
| SRC_B_v9_Risk.html | id-static | rck-winrate | GỘP | RiskStore.edge.winrate | D14: chế độ nhị phân dùng cùng dữ liệu R, bỏ ô W thứ hai |
| SRC_B_v9_Risk.html | id-static | rck-payoff | GỘP | RiskStore.edge.payoff | D14: chế độ nhị phân dùng cùng dữ liệu R, bỏ ô Payoff thứ hai |
| SRC_B_v9_Risk.html | id-static | out-full-kelly | GIỮ | out-full-kelly | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | out-half-kelly | GIỮ | out-half-kelly | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | out-quarter-kelly | GIỮ | out-quarter-kelly | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | out-rck-optimal | GIỮ | out-rck-optimal | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | out-final-rec | GIỮ | out-final-rec | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | chk-mc-revenge-mode | GIỮ | chk-mc-revenge-mode | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | chartMonteCarloFan | GỘP | adv-mc-chart | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | mc-p5-val | GỘP | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | mc-p25-val | GỘP | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | mc-p50-val | GỘP | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | mc-p75-val | GỘP | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | mc-p95-val | GỘP | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | id-static | tab-cockpit | GỘP | tab-cockpit | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | lbl-cockpit-winrate | GỘP | adv-sw-label | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | rng-cockpit-winrate | GỘP | adv-sw | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | lbl-cockpit-payoff | GỘP | adv-sp-label | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | rng-cockpit-payoff | GỘP | adv-sp | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | lbl-cockpit-risk | GỘP | adv-sf-label | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | rng-cockpit-risk | GỘP | adv-sf | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | chk-stress-streak | GỘP | adv-streak | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | chk-stress-degrade | GỘP | adv-degrade | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-static | cockpit-status-badge | GIỮ | cockpit-status-badge | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cockpit-exp-val | GIỮ | cockpit-exp-val | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cockpit-ror-val | GIỮ | cockpit-ror-val | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cockpit-rck-val | GIỮ | cockpit-rck-val | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cockpit-es-val | GIỮ | cockpit-es-val | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | chartCockpitSim | GỘP | adv-stress-chart | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | cockpit-warning-box | GIỮ | cockpit-warning-box | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | trade-modal | GỘP | risk-detail-modal | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | form-add-trade | GỘP | risk-detail-modal | D17: một modal thêm/sửa, không giữ form B thứ hai |
| SRC_B_v9_Risk.html | id-static | modal-symbol | GỘP | risk-edit-symbol | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-side | GỘP | risk-edit-side | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-lots | GỘP | risk-edit-lots | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-entry | GỘP | risk-edit-entry | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-sl | GỘP | risk-edit-sl | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-tp | GỘP | risk-edit-tp | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-exit | GỘP | risk-edit-exit | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-open-time | GỘP | risk-edit-open | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-close-time | GỘP | risk-edit-close | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-mae | GỘP | adv-edit-mae | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-mfe | GỘP | adv-edit-mfe | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-setup | GỘP | risk-edit-setup | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-exit-reason | GỘP | risk-edit-exit-reason | D17: chuyển trường B vào modal chung |
| SRC_B_v9_Risk.html | id-static | modal-asset | GỘP | risk-edit-asset | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | modal-risk-usd | GỘP | risk-edit-risk | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | id-static | cashflow-modal | GIỮ | cashflow-modal | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cf-type | GIỮ | cf-type | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cf-amount | GIỮ | cf-amount | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cf-time | GIỮ | cf-time | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-static | cf-note | GIỮ | cf-note | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | a-setup-datalist | GỘP | risk-edit-setup | D17/P3: selector rời rạc chung đã giới hạn chính xác A-Setup; không thêm datalist giả |
| SRC_B_v9_Risk.html | id-injected | as-lock-stress | GIỮ | as-lock-stress | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | as-rec-rule | GIỮ | as-rec-rule | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | as-safe-tier | GIỮ | as-safe-tier | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | as-tail-mode | GIỮ | as-tail-mode | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | as-tier-cap | GIỮ | as-tier-cap | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | assumptions-verify-drawer | GIỮ | assumptions-verify-drawer | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | btn-ror-zoom | GIỮ | btn-ror-zoom | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | btn-toggle-4zone | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-injected | chartRckFam | GIỮ | chartRckFam | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | chartVarBreachTimeline | GIỮ | chartVarBreachTimeline | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | daily-loss-tracker-panel | GIỮ | daily-loss-tracker-panel | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | db-schema-panel | GIỮ | db-schema-panel | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | db-schema-tables-view | GIỮ | db-schema-tables-view | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-date-pick | GIỮ | dl-date-pick | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-floating-input | GIỮ | dl-floating-input | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-progress-bar | GIỮ | dl-progress-bar | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-progress-label | GIỮ | dl-progress-label | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-realized-ovr | GIỮ | dl-realized-ovr | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-remaining-r | GIỮ | dl-remaining-r | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-status-pill | GIỮ | dl-status-pill | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | dl-stop-alert | GIỮ | dl-stop-alert | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | es-stats | GIỮ | es-stats | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | fb-l1 | GIỮ | fb-l1 | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | gate-cockpit | GIỮ | gate-cockpit | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | gate-l3 | GIỮ | gate-l3 | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | gate-strip | GIỮ | gate-strip | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | interlock-banner | GIỮ | interlock-banner | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | l2-planned-vs-actual-card | GIỮ | l2-planned-vs-actual-card | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | l2-tail-setup-alert | GIỮ | l2-tail-setup-alert | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | lbl-rr-drop | GIỮ | lbl-rr-drop | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | lbl-streak-len | GIỮ | lbl-streak-len | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | lbl-wr-drop | GIỮ | lbl-wr-drop | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | lh-table | GIỮ | lh-table | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | mc-info | GIỮ | mc-info | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | mc-mdd | GIỮ | mc-mdd | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | modal-setup-tier2-hint | GIỮ | modal-setup-tier2-hint | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | modal-tier-note | GIỮ | modal-tier-note | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | om-l-slider | GIỮ | om-l-slider | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | om-l-val | GIỮ | om-l-val | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | om-setup-1 | GIỮ | om-setup-1 | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | om-setup-2 | GIỮ | om-setup-2 | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | omega-controls-v9 | GIỮ | omega-controls-v9 | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | omega-quantile-grid | GIỮ | omega-quantile-grid | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | omega-stats | GIỮ | omega-stats | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | perf-grid | GIỮ | perf-grid | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | pf-actfee | GIỮ | pf-actfee | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | pf-comp | GIỮ | pf-comp | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | pf-out | GIỮ | pf-out | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | pf-pdays | GIỮ | pf-pdays | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | pf-stages | GỘP | adv-p-target | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-injected | rck-extra | GIỮ | rck-extra | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | risk-compare | GIỮ | risk-compare | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | rng-stress-rr-drop | GIỮ | rng-stress-rr-drop | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | rng-stress-streak-len | GIỮ | rng-stress-streak-len | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | rng-stress-wr-drop | GIỮ | rng-stress-wr-drop | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | ror-U | GIỮ | ror-U | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | ror-bal | GIỮ | ror-bal | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | ror-emp | GIỮ | ror-emp | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | ror-heat | GIỮ | ror-heat | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | ror-kau | GIỮ | ror-kau | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | sel-mc-h | GỘP | sim-horizon | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-injected | sel-mc-mode | GIỮ | sel-mc-mode | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | sel-mc-n | GỘP | sim-runs | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-injected | sel-mc-seed | GIỮ | sel-mc-seed | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | sz-out | GỘP | adv-size-out | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | id-injected | tc-live | GIỮ | tc-live | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | tc-sessout | GIỮ | tc-sessout | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | tier-action-protocol-box | GIỮ | tier-action-protocol-box | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | tier2-action-panel | GIỮ | tier2-action-panel | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | tier3-action-panel | GIỮ | tier3-action-panel | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | top-cockpit-gauges | GIỮ | top-cockpit-gauges | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | top-dd-gauge-bar | GIỮ | top-dd-gauge-bar | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | top-dd-gauge-txt | GIỮ | top-dd-gauge-txt | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | top-dl-bar | GIỮ | top-dl-bar | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | top-dl-txt | GIỮ | top-dl-txt | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | unified-import-msg | GIỮ | unified-import-msg | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | unified-import-text | GIỮ | unified-import-text | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | var-breach-badge | GIỮ | var-breach-badge | Port DOM/hành vi B vào trang đích Mục 2–3; chỉ một ID toàn tài liệu. |
| SRC_B_v9_Risk.html | id-injected | z4-heat | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-injected | z4-mc | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-injected | z4-prop | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-injected | z4-stress | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | id-injected | zone4-deck | BỎ | — | Bỏ node trùng/cũ theo quyết định blueprint; chức năng chuyển về trang duy nhất. |
| SRC_B_v9_Risk.html | function | switchTab | GỘP | showTab | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | recalculateMasterCapital | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | calcTradeMetrics | GỘP | RiskMath.calcTradeMetrics | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | renderTradeLogTable | GỘP | renderWorkspaceTable | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | renderCashflowTable | GỘP | renderCashflowTable | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | toggleCashflowModal | GIỮ | toggleCashflowModal | Port một định nghĩa vào Pages/UI kit; dữ liệu đọc từ RiskStore/state. |
| SRC_B_v9_Risk.html | function | saveCashflow | GỘP | saveCashflow | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | openTradeModal | GỘP | editorOpen | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | closeTradeModal | GỘP | editorClose | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | saveNewTrade | GỘP | submitNewTrade | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | analyzeSimultaneousExposure | GỘP | RiskMath.exposureStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | runWhatIfSimulation | GIỮ | runWhatIfSimulation | Port một định nghĩa vào Pages/UI kit; dữ liệu đọc từ RiskStore/state. |
| SRC_B_v9_Risk.html | function | calculateRollingDrift | GỘP | RiskMath.rollingStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | analyzeSerialPsychology | GỘP | RiskMath.serialStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | initAsymmetricRecoveryChart | GỘP | renderCapital / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | updateAsymmetricRecovery | GIỮ | updateAsymmetricRecovery | Port một định nghĩa vào Pages/UI kit; dữ liệu đọc từ RiskStore/state. |
| SRC_B_v9_Risk.html | function | initSimultaneousExposureChart | GỘP | renderCapital / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | initRorCliffChart | GỘP | renderCapital / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | updateRiskOfRuin | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | initWhatIfCompareChart | GỘP | renderRiskEdge / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | initRollingDriftChart | GỘP | renderRiskEdge / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | initBaselTailChart | GỘP | renderRiskEdge / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | initOmegaCurveChart | GỘP | renderRiskEdge / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | renderOmegaCurve | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | solveStanfordRCK | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | initMonteCarloFanChart | GỘP | renderSimulationResults / ChartRegistry.draw | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | runMonteCarloSim | GỘP | runSimulation / RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | updateCockpitAll | GỘP | renderCockpit / renderStressResults | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | generateCockpitSimPath | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | initCockpitSimChart | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | cum | GỘP | RiskMath.cumulativeBootstrap | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | boot | GỘP | RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | one | GỘP | RiskMath.propMulti | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | prop | GỘP | RiskMath.propMulti | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | mulberry | GỘP | RiskMath.mulberry32 | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | rorOnly | GỘP | RiskMath.rorEmpirical | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | fRor | GỘP | RiskMath.rorEmpirical | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | esW | GỘP | RiskMath.esW | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | varW | GỘP | RiskMath.varW | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | balsara | GỘP | RiskMath.rorAnalytic | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | rck | GỘP | RiskMath.rckBinary | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | window.recalculateMasterCapital | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | window.tierCfg | GỘP | tierCfg / state.riskProfile | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.budCfg | GỘP | budCfg / state.riskProfile | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.renderSess | GỘP | renderSess | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.calcSizer | GỘP | calcSizer | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.updateRiskOfRuin | GỘP | updateRiskOfRuin / renderCapital | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.fillFromLog | GỘP | fillFromLog | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.solveStanfordRCK | GỘP | renderRiskOpt / RiskMath.rckEmpirical | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.runMonteCarloSim | GỘP | runSimulation / RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.renderMetrics | GỘP | renderRiskRatios | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | window.updateES | GỘP | renderRiskEdge / RiskMath.tailAnalytics | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.renderOmegaCurve | GỘP | renderRiskEdge | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | window.propPreset | GỘP | propPreset | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.refreshAll | GỘP | renderAll | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.analyzeSerialPsychology | GỘP | RiskMath.serialStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.analyzeSimultaneousExposure | GỘP | RiskMath.exposureStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.evalGates | GỘP | RiskStore.read().gates | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.runMonteCarloSim | GỘP | runSimulation / RiskMath.simulate | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | renderRiskCompare | GIỮ | renderRiskCompare | Port một định nghĩa vào Pages/UI kit; dữ liệu đọc từ RiskStore/state. |
| SRC_B_v9_Risk.html | function | window.renderFeedback | GỘP | renderFeedback | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.applyFeedback | GỘP | applyFeedback | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | mulberry | GỘP | RiskMath.mulberry32 | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | mean | GỘP | RiskMath.mean | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | esW | GỘP | RiskMath.esW | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | varW | GỘP | RiskMath.varW | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | cum | GỘP | RiskMath.cumulativeBootstrap | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | tailMult | GỘP | RiskMath.tailMult | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | omegaCalc | GỘP | RiskMath.omega | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | esCalc | GỘP | RiskMath.tailAnalytics | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | rckEmpCalc | GỘP | RiskMath.rckEmpirical | Một hàm toán thuần; worker dựng từ cùng định nghĩa. |
| SRC_B_v9_Risk.html | function | propMulti | GỘP | RiskMath.propMulti | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.calcTradeMetrics | GỘP | RiskMath.calcTradeMetrics | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.calcSizer | GỘP | calcSizer | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.evaluatePlaybookSetups | GỘP | RiskMath.playbookStats | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.localDateStr | GỘP | todayISO | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.updateDailyLossTracker | GỘP | updateDailyLossTracker | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.runTierProtocolActions | GỘP | renderTierProtocol | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.tradeLockReason | GỘP | allowNewTrade / RiskStore.read().gates | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.saveNewTrade | GỘP | submitNewTrade | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.toggleRorZoom | GỘP | toggleRorZoom | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.renderRorHeatmap | GỘP | renderRorHeatmap | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.updateRiskOfRuin | GỘP | updateRiskOfRuin / renderCapital | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.renderMetrics | GỘP | renderRiskRatios | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | populateOmegaSetupSelectors | GIỮ | populateOmegaSetupSelectors | Port một định nghĩa vào Pages/UI kit; dữ liệu đọc từ RiskStore/state. |
| SRC_B_v9_Risk.html | function | getSetupRArray | GỘP | RiskMath.omegaCompare | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.renderOmegaCurve | GỘP | renderRiskEdge | Gộp trực tiếp vào thân hàm/module đích; không bọc-ghi-đè. |
| SRC_B_v9_Risk.html | function | ensureVarBreachChart | GỘP | renderRiskEdge | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.updateES | GỘP | renderRiskEdge / RiskMath.tailAnalytics | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.solveStanfordRCK | GỘP | renderRiskOpt / RiskMath.rckEmpirical | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.propPreset | GỘP | propPreset | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.runProp | GỘP | propSimulation / RiskMath.propMulti | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.assetClassOf | GỘP | RiskMath.assetClass | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.lhOfClass | GỘP | RiskMath.assetGroups / state.riskProfile.assumptions.lhByClass | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.effLH | GỘP | RiskMath.liquidity | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.lhVal | GỘP | RiskStore.read().liquidity.days | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.sessionTagOf | GỘP | StorageData.sessionTag | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.strategyIdOf | GỘP | StorageData.strategyId | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.omegaRange | GỘP | RiskMath.omegaCompare | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.snapshotQuant | GỘP | StorageData.snapshot | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.buildDatabaseTables | GỘP | buildDatabaseTables | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | saveToIndexedDB | GIỮ | saveToIndexedDB | Port một định nghĩa vào Pages/UI kit; dữ liệu đọc từ RiskStore/state. |
| SRC_B_v9_Risk.html | function | window.persistStateToStorage | GỘP | Core.commit / captureSimulationSnapshot | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.loadStateFromStorage | GỘP | Core.restore | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.resetDefaultStorage | GỘP | resetDefaultStorage | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.exportDatabaseJson | GỘP | exportDatabaseJson | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.renderSchemaExplorer | GỘP | renderSchemaExplorer | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.applyLayoutMode | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | window.toggleFourZoneLayout | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | window.switchTab | GỘP | showTab | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.evalGates | GỘP | RiskStore.read().gates | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.updateCockpitAll | GỘP | renderCockpit / renderStressResults | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | runCockpitStressLabV9 | GỘP | stress / renderStressResults | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.refreshAll | GỘP | renderAll | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.adaptUnifiedTrades | GỘP | adaptUnifiedTrades | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.importUnifiedTrades | GỘP | importUnifiedTrades | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.runUnifiedImport | GỘP | runUnifiedImport | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.exportSupabaseSql | GỘP | exportSupabaseSql | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.renderLhTable | GỘP | renderLhTable | Bỏ lớp patch và giữ một định nghĩa trực tiếp duy nhất. |
| SRC_B_v9_Risk.html | function | window.refreshAll | GỘP | renderAll | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |
| SRC_B_v9_Risk.html | function | window.applyLayoutMode | BỎ | — | Mã cũ, stub/gán cứng, đọc chéo storage hoặc thủ thuật dời DOM bị cấm. |
| SRC_B_v9_Risk.html | function | window.evalGates | GỘP | RiskStore.read().gates | Gộp vào một module/renderer gốc; không giữ wrapper patch hoặc tạo hàm rỗng. Theo D1–D22 và kiến trúc §7. |

## ID đã hợp nhất/đổi tên và lý do

| Nguồn | ID cũ | Đích | Lý do |
|---|---|---|---|
| SRC_A_V3_Kiem_Toan.html | sim-horizon | adv-mc-h | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | sim-runs | adv-mc-n | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | sim-risk | risk-profile-fTier | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | chart-sim | adv-mc-chart | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | sim-summary | adv-mc-summary | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | sim-note | mc-info | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | ck-day | dl-date-pick | D7: một ngày xét chung cho panel lỗ ngày |
| SRC_A_V3_Kiem_Toan.html | ck-daily | risk-profile-dailyLossLimit | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | ck-personal | risk-profile-personalDailyLimit | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | ck-maxdd | risk-profile-maxDrawdown | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | ck-ddmode | risk-profile-ddMode | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | risk-pct | risk-profile-fTier | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | risk-k | risk-profile-k | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | risk-dd-limit | risk-profile-maxDrawdown | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | risk-es-val | es-stats | D13: một thẻ Tail Risk |
| SRC_A_V3_Kiem_Toan.html | risk-alpha | adv-rck-alpha | D14: bỏ optimizer quét riêng, dùng tham số bộ giải A |
| SRC_A_V3_Kiem_Toan.html | risk-opt-dd | ror-floor | D14: một ngưỡng Drawdown cho phép kiểm chứng RoR |
| SRC_A_V3_Kiem_Toan.html | risk-opt-horizon | risk-ror-horizon | D14: một horizon cho kiểm chứng RoR |
| SRC_A_V3_Kiem_Toan.html | risk-opt-max | bud-f | D7/D14: trần rủi ro đọc Risk Profile, bỏ trần optimizer riêng |
| SRC_A_V3_Kiem_Toan.html | tab-riskstress | tab-simulation | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | add-trade-modal | risk-detail-modal | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | new-trade-symbol | risk-edit-symbol | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | new-trade-pnl | risk-edit-pnl | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | new-trade-risk | risk-edit-risk | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | new-trade-hold | risk-edit-hold | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | adv-interlock | interlock-banner | D9: một banner liên động |
| SRC_A_V3_Kiem_Toan.html | adv-mc-chart | chart-sim | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-h | sim-horizon | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-mode | sel-mc-mode | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-n | sim-runs | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-revenge | chk-mc-revenge-mode | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-run | runSimulation | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-seed | sel-mc-seed | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_A_V3_Kiem_Toan.html | adv-mc-summary | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_A_V3_Kiem_Toan.html | dep-list | cashflow-table-body | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | dep-sum | top-bar-cashflow | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | dp-add | cashflow-modal | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | dp-t | cf-amount | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_A_V3_Kiem_Toan.html | side-riskstress | side-simulation | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | tab-overview | tab-zones | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | trade-count-badge | filtered-count | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | trade-log-body | workspace-table-body | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | tab-layer1 | tab-riskcapital | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | chartAsymmetricRecovery | risk-recovery-chart | P7/D8: giữ canvas A, thêm ô DD tự do của B |
| SRC_B_v9_Risk.html | bud-k | risk-profile-k | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | bud-f | risk-profile-fTier | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | daily-budget-detail | risk-budget | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | tab-layer2 | tab-riskedge | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | whatif-orig-exp | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | whatif-orig-winrate | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | whatif-new-exp | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | whatif-new-winrate | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | whatif-stopped-early | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | whatif-pf-change | adv-exit-bounds / chartWhatIfCompare | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | half-compare-text | risk-decay-stats | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | chartRollingDrift | risk-drift-chart | P11: chỉ một Rolling Expectancy/SQN |
| SRC_B_v9_Risk.html | chartBaselTail | risk-tail-chart | D13: một thẻ Tail Risk dùng canvas A |
| SRC_B_v9_Risk.html | chartOmegaCurve | risk-omega-chart | D12: UI Omega nâng cấp của B dùng canvas A hiện hữu |
| SRC_B_v9_Risk.html | tab-layer3 | tab-riskopt | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | rck-alpha | adv-rck-alpha | D14/§6: quy ước tham số và bisection của A thắng B |
| SRC_B_v9_Risk.html | rck-beta | adv-rck-beta | D14/§6: quy ước tham số và bisection của A thắng B |
| SRC_B_v9_Risk.html | rck-winrate | RiskStore.edge.winrate | D14: chế độ nhị phân dùng cùng dữ liệu R, bỏ ô W thứ hai |
| SRC_B_v9_Risk.html | rck-payoff | RiskStore.edge.payoff | D14: chế độ nhị phân dùng cùng dữ liệu R, bỏ ô Payoff thứ hai |
| SRC_B_v9_Risk.html | chartMonteCarloFan | adv-mc-chart | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | mc-p5-val | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | mc-p25-val | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | mc-p50-val | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | mc-p75-val | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | mc-p95-val | sim-summary / chart-sim (RiskStore.mc.bands) | Gộp vào một điều khiển/kết quả chung, không tạo ID rỗng. Các phân vị MC nằm trong fan A; What-if MAE/MFE dùng cận, không suy ra WR/PF chính xác. |
| SRC_B_v9_Risk.html | lbl-cockpit-winrate | adv-sw-label | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | rng-cockpit-winrate | adv-sw | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | lbl-cockpit-payoff | adv-sp-label | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | rng-cockpit-payoff | adv-sp | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | lbl-cockpit-risk | adv-sf-label | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | rng-cockpit-risk | adv-sf | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | chk-stress-streak | adv-streak | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | chk-stress-degrade | adv-degrade | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | chartCockpitSim | adv-stress-chart | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | trade-modal | risk-detail-modal | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | form-add-trade | risk-detail-modal | D17: một modal thêm/sửa, không giữ form B thứ hai |
| SRC_B_v9_Risk.html | modal-symbol | risk-edit-symbol | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-side | risk-edit-side | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-lots | risk-edit-lots | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-entry | risk-edit-entry | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-sl | risk-edit-sl | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-tp | risk-edit-tp | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-exit | risk-edit-exit | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-open-time | risk-edit-open | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-close-time | risk-edit-close | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-mae | adv-edit-mae | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-mfe | adv-edit-mfe | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-setup | risk-edit-setup | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-exit-reason | risk-edit-exit-reason | D17: chuyển trường B vào modal chung |
| SRC_B_v9_Risk.html | modal-asset | risk-edit-asset | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | modal-risk-usd | risk-edit-risk | Hợp nhất vùng/ô cấu hình về một đích dùng chung. |
| SRC_B_v9_Risk.html | a-setup-datalist | risk-edit-setup | D17/P3: selector rời rạc chung đã giới hạn chính xác A-Setup; không thêm datalist giả |
| SRC_B_v9_Risk.html | pf-stages | adv-p-target | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | sel-mc-h | sim-horizon | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | sel-mc-n | sim-runs | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |
| SRC_B_v9_Risk.html | sz-out | adv-size-out | Gộp vào điều khiển/kết quả duy nhất theo blueprint. |

## Output thực tế

### S1_S10_STATIC_TESTS.json
```json
{
  "inventoryRows": 701,
  "inventoryCounts": {
    "GIỮ": 406,
    "GỘP": 256,
    "BỎ": 39
  },
  "missingRetainedIds": [],
  "duplicateIds": {},
  "duplicateNamedFunctions": {},
  "nodeCheck": [
    {
      "script": 2,
      "exitCode": 0,
      "stderr": ""
    },
    {
      "script": 3,
      "exitCode": 0,
      "stderr": ""
    },
    {
      "script": 4,
      "exitCode": 0,
      "stderr": ""
    }
  ],
  "forbiddenStrings": {
    "recalculateMasterCapital": 0,
    "zone4-deck": 0,
    "z4-": 0,
    "fourZoneActive": 0,
    "WK4_SRC": 0,
    "nav-tabs": 0
  },
  "bytes": 410380,
  "lines": 2804
}
```

### S1_S10_GITHUB_CONFIG_AUDIT.json
```json
{
  "repository": {
    "status": 200,
    "visibility": "public",
    "defaultBranch": "main",
    "permissions": {
      "admin": true,
      "maintain": true,
      "push": true,
      "triage": true,
      "pull": true
    }
  },
  "mainProtection": {
    "status": 404,
    "message": "Branch not protected"
  },
  "pages": {
    "status": 404,
    "message": "Not Found"
  }
}
```

### P7_CORE_TESTS.json
```json
{
  "phase": "P7",
  "passed": 23,
  "total": 23,
  "cases": [
    {
      "name": "Sample A: equity, NAV, expectancy, SQN, Omega, weighted ES",
      "pass": true,
      "metrics": {
        "sample": "A",
        "count": 15,
        "equity": 11850,
        "dd": 0,
        "maxdd": 0.01881467544684856,
        "tier": 1,
        "expectancy": 1.2333333333333334,
        "sqn": 2.228984997397465,
        "omega0": 4.083333333333333,
        "es975": -1,
        "rckRobust": 0.15794469902910171,
        "fStar": 0,
        "gate": false
      }
    },
    {
      "name": "Sample B: equity, NAV, expectancy, SQN, Omega, weighted ES",
      "pass": true,
      "metrics": {
        "sample": "B",
        "count": 15,
        "equity": 23250,
        "dd": 0,
        "maxdd": 0.02409638554216864,
        "tier": 1,
        "expectancy": 0.8666666666666667,
        "sqn": 2.115849992805015,
        "omega0": 3.1666666666666665,
        "es975": -1,
        "rckRobust": 0.13059399929648358,
        "fStar": 0,
        "gate": false
      }
    },
    {
      "name": "B conversion: side, MAE, discipline, PnL per trade; input immutable",
      "pass": true
    },
    {
      "name": "Cashflow-neutral NAV after loss: deposit and withdrawal",
      "pass": true,
      "baseDD": 0.09999999999999998
    },
    {
      "name": "Flow preceding PnL on same day; correct share issuance",
      "pass": true,
      "dd": 0.09999999999999998
    },
    {
      "name": "Mixed timestamp offsets sort by actual instant, not lexical text",
      "pass": true,
      "dd": 0.09999999999999998
    },
    {
      "name": "Tier thresholds, overrides, daily cap and three gates",
      "pass": true
    },
    {
      "name": "Invalid initialRisk / estimated risk excluded; gross missing fees excluded",
      "pass": true
    },
    {
      "name": "Fractional weighted ES vs floor/ceil; Omega(mu)=1",
      "pass": true
    },
    {
      "name": "Audited RCK and analytic RoR match actual source A",
      "pass": true
    },
    {
      "name": "Seeded Monte Carlo exactly matches A; permutation/revenge deterministic",
      "pass": true,
      "ddMedian": 0.039500049601000065,
      "ddP95": 0.0821678461320885
    },
    {
      "name": "Manual close has zero auto slip; explicit A price-unit override",
      "pass": true
    },
    {
      "name": "RiskStore cache computes once per commit and emits once",
      "pass": true
    },
    {
      "name": "Backup -> clear -> restore preserves every field",
      "pass": true,
      "fields": 16
    },
    {
      "name": "Atomic failed commit/restore/quota does not change current state",
      "pass": true
    },
    {
      "name": "Migrate A+B: backup before write, priority, dedupe, extra/ext2, no removed keys",
      "pass": true,
      "trades": 17,
      "flows": 3,
      "duplicates": 1
    },
    {
      "name": "B-only migration converts CF1 to initial capital once",
      "pass": true
    },
    {
      "name": "Malformed legacy / failed backup / quota: no unified write, no lost raw",
      "pass": true
    },
    {
      "name": "Empty existing ledger stays empty; fresh install samples only if no legacy",
      "pass": true
    },
    {
      "name": "Clear sample data preserves new user trades and edited sample records",
      "pass": true
    },
    {
      "name": "B manual Tier string migrates to canonical numeric override",
      "pass": true
    },
    {
      "name": "B sample floating position is separate from realized ledger; safe sample removal",
      "pass": true
    },
    {
      "name": "Generated Worker syntax + all four tasks equal main source functions",
      "pass": true,
      "tasks": [
        "mc",
        "ror",
        "prop",
        "analytics"
      ]
    }
  ],
  "samples": [
    {
      "sample": "A",
      "count": 15,
      "equity": 11850,
      "dd": 0,
      "maxdd": 0.01881467544684856,
      "tier": 1,
      "expectancy": 1.2333333333333334,
      "sqn": 2.228984997397465,
      "omega0": 4.083333333333333,
      "es975": -1,
      "rckRobust": 0.15794469902910171,
      "fStar": 0,
      "gate": false
    },
    {
      "sample": "B",
      "count": 15,
      "equity": 23250,
      "dd": 0,
      "maxdd": 0.02409638554216864,
      "tier": 1,
      "expectancy": 0.8666666666666667,
      "sqn": 2.115849992805015,
      "omega0": 3.1666666666666665,
      "es975": -1,
      "rckRobust": 0.13059399929648358,
      "fStar": 0,
      "gate": false
    }
  ],
  "timestamp": "2026-10-25T07:07:00.498Z"
}
```

### P7_RISK_CORE_TESTS.json
```json
{
  "phase": "P7",
  "passed": 11,
  "total": 11,
  "cases": [
    {
      "name": "Daily loss combines realized and floating losses; open profit cannot hide another position loss",
      "pass": true,
      "loss": 250,
      "remaining": 250,
      "remainingR": 2.5
    },
    {
      "name": "Daily limit stops today only; historical date stays inspectable; zero limit is unset",
      "pass": true
    },
    {
      "name": "Exposure sweep uses exact overlap; closing-before-opening at same timestamp",
      "pass": true,
      "peak": 200,
      "peakPct": 0.02
    },
    {
      "name": "Capital limit static/trailing follows realized PnL, unaffected by cashflows",
      "pass": true,
      "staticUsed": 200,
      "trailingUsed": 1200
    },
    {
      "name": "What-if keeps both-hit ambiguity and does not invent trailing outcomes",
      "pass": true,
      "both": 1,
      "lower": 0.26666666666666666,
      "upper": 1.1333333333333333
    },
    {
      "name": "Empirical robust weights match v9 haircut, applied inside audited A solver",
      "pass": true,
      "eta": 0.25,
      "original": 0.5267227679379669,
      "robust": 0.28900577097991087
    },
    {
      "name": "Omega: two playbooks, 100 thresholds, source P10–P90 endpoints, undefined flat point preserved",
      "pass": true,
      "all": 15,
      "comparison": 4,
      "omegaAtMean": 0.9999999999999997
    },
    {
      "name": "Seeded aggregate ES and expanding VaR backtest equal source B exactly",
      "pass": true,
      "aggregateES": -14.6648,
      "aggregateVaR": -12,
      "breaches975": 1,
      "counted": 5
    },
    {
      "name": "RiskStore RCK parameters, modes and gates invalidate one cached snapshot",
      "pass": true,
      "n": 30,
      "tier": 3
    },
    {
      "name": "Core rejects invalid profile k / nonfinite limit / invalid RCK without mutation",
      "pass": true
    },
    {
      "name": "Generated analytics Worker uses the same tail engine and seeded risk-cap solver",
      "pass": true,
      "tasks": [
        "tail analytics",
        "risk cap"
      ]
    }
  ],
  "timestamp": "2026-10-25T07:07:02.420Z"
}
```

### P7_MATH_TESTS.json
```json
{
  "phase": "P7",
  "passed": 12,
  "total": 12,
  "cases": [
    {
      "name": "Prop static: first-attempt probabilities exactly equal source A, independent of retry/funded RNG",
      "pass": true,
      "expected": {
        "win": 623,
        "fail": 377,
        "timeout": 0
      },
      "actual": {
        "pass": 0.623,
        "fail": 0.377,
        "timeout": 0
      }
    },
    {
      "name": "Prop trailing: first-attempt probabilities exactly equal source A, independent of retry/funded RNG",
      "pass": true,
      "expected": {
        "win": 621,
        "fail": 379,
        "timeout": 0
      },
      "actual": {
        "pass": 0.621,
        "fail": 0.379,
        "timeout": 0
      }
    },
    {
      "name": "Multi-stage unconditional success decreases at each stage; outcome probabilities and EV reconcile",
      "pass": true,
      "static": {
        "pass": 0.926,
        "fail": 0.073,
        "to": 0.001,
        "failPhase1": 0.024,
        "toPhase1": 0,
        "stPass": [
          0.976,
          0.948,
          0.926
        ],
        "medT": 34,
        "ev": 183.4,
        "evPay": 20015.34171759109,
        "campaignPay": 21684.54986203882,
        "evUsd": 19845.89171759109,
        "evPct": 11711.945540036053,
        "roiMed": 119.59457025235382,
        "expectedCostOneAttempt": 169.45,
        "roiPdfFunded": 11711.945540036053,
        "roiPdfCycle": 3647.249504700081,
        "theoCycleProfit": 6857.142857142859,
        "theoMonthlyProfit": 14400,
        "totalFeeIfPass": 175,
        "cyc": 0.025398017539376865
      },
      "trailing": {
        "pass": 0.887,
        "fail": 0.113,
        "to": 0,
        "failPhase1": 0.029,
        "toPhase1": 0,
        "stPass": [
          0.971,
          0.922,
          0.887
        ],
        "medT": 33,
        "ev": 188.6,
        "evPay": 18253.932508099602,
        "campaignPay": 20678.11827587077,
        "evUsd": 18087.4075080996,
        "evPct": 10861.676930250473,
        "roiMed": 109.62876772549758,
        "expectedCostOneAttempt": 166.525,
        "roiPdfFunded": 10861.676930250473,
        "roiPdfCycle": 3552.476033199649,
        "theoCycleProfit": 6857.142857142859,
        "theoMonthlyProfit": 14400,
        "totalFeeIfPass": 175,
        "cyc": 0.02736807533271691
      }
    },
    {
      "name": "Zero fees: ROI undefined, not 0%; positive payout retained",
      "pass": true,
      "payout": 25174.938524814814,
      "roi": null
    },
    {
      "name": "Only completed payout cycles paid; short horizon and unprofitable histories pay zero",
      "pass": true
    },
    {
      "name": "Sizer respects floor-to-step, Tier 2 reduction, budget, Tier 3 and missing conversion",
      "pass": true,
      "quantity": 3,
      "actual": 300
    },
    {
      "name": "Liquidity weights verified planned risk, excludes estimated/missing; extended symbols classify correctly",
      "pass": true,
      "effective": 47.5,
      "missing": 2
    },
    {
      "name": "What-if uses verified net R only; skip/cap/slip never modifies trade ledger",
      "pass": true,
      "base": 15,
      "alternative": 9
    },
    {
      "name": "Stress sliders degrade win rate/payoff and force an exact initial loss prefix",
      "pass": true,
      "expectancy": -0.08839999999999992,
      "streakDD": 0.13994164535871156
    },
    {
      "name": "Config restore rejects invalid simulation/stages/sizer atomically",
      "pass": true
    },
    {
      "name": "Generated Worker computes comparison and multi-stage Prop identically to main engine",
      "pass": true
    },
    {
      "name": "Pending data change rejects stale result; metadata-only change reuses deterministic cache safely",
      "pass": true
    }
  ],
  "timestamp": "2026-10-25T07:07:05.825Z"
}
```

### P7_STORAGE_CORE_TESTS.json
```json
{
  "phase": "P7",
  "passed": 6,
  "total": 6,
  "cases": [
    {
      "name": "UnifiedTrade aliases: no fabricated prices/risk; side, discipline, negative MAE and ActualR×1R",
      "pass": true,
      "imported": 2,
      "skipped": 1,
      "pnl": 180
    },
    {
      "name": "Schema dump roundtrip preserves every field, 20-year dates, duplicate snapshot IDs and custom metadata",
      "pass": true,
      "trades": 15,
      "snapshots": 3,
      "exact": true
    },
    {
      "name": "Legacy A and legacy B file preview are non-destructive and retain extra/ext2/cashflows",
      "pass": true,
      "A": 15,
      "B": 15
    },
    {
      "name": "Raw migration backup import previews known A/B keys, dedupes without changing existing state",
      "pass": true
    },
    {
      "name": "SQL escapes apostrophes, preserves JSON/raw cashflows and separates tenants; no undefined/NaN",
      "pass": true,
      "tables": 3,
      "policies": 3,
      "bytes": 42275,
      "databaseExecution": "NOT RUN"
    },
    {
      "name": "Malformed schema or rows rejected before restore, with current ledger unchanged",
      "pass": true
    }
  ],
  "timestamp": "2026-10-25T07:07:06.708Z"
}
```

### S1_S10_CORE_TESTS.json
```json
{
  "suite": "S1-S10 core",
  "passed": 10,
  "total": 10,
  "cases": [
    {
      "name": "PDF RCK lambda and exact weighted 97.5% tail oracle",
      "pass": true,
      "lambda": 6.455696235812881,
      "es": -13.599999999999996,
      "var975": -11
    },
    {
      "name": "Kaufman Edge .10 oracle and Balsara distinct from expected-edge approximation",
      "pass": true,
      "kaufmanPercent": [
        1.8071595021380356,
        66.94214876033057,
        81.81818181818181
      ],
      "balsaraPercent": 19.21101466862746,
      "approxPercent": 8.101311022241207
    },
    {
      "name": "Cash withdrawal preserves drawdown after $250 loss; Tier defaults and negative-edge gate",
      "pass": true,
      "dd": 0.025000000000000022,
      "withdrawalDD": 0.025000000000000022,
      "negativeEdgeRecommendation": 0
    },
    {
      "name": "S5/S6 real Tier probability and budget buffer; capped budgets are not assumed to double",
      "pass": true,
      "loss3": 0.125,
      "before": 5,
      "after": 10,
      "capped": {
        "before": 25,
        "after": 25
      }
    },
    {
      "name": "S1/S2/S8 canonical export names and all six account enum values; SQL upgrades prior schema",
      "pass": true,
      "currentEquity": 11850,
      "accountTypes": [
        "PERSONAL",
        "FTMO",
        "THE5ERS_HYPER",
        "THE5ERS_HIGH_STAKES",
        "THE5ERS_BOOTCAMP",
        "TOPSTEP_TRAILING"
      ]
    },
    {
      "name": "S3 snapshot requires completed MC, contains all 12 finite fields and preserves ratio units",
      "pass": true,
      "requiredColumns": 12,
      "nullColumns": 0,
      "snapshot": {
        "snapshot_schema": 2,
        "input_hash": "f7c084a2f2abb10cd750a19625ee09666d43fe5bd27a315367ac18f30f2738ec",
        "cache_entry": {
          "version": "pdf-s1-s10-v2",
          "input_hash": "f7c084a2f2abb10cd750a19625ee09666d43fe5bd27a315367ac18f30f2738ec",
          "result_hash": "95d327181fd95359b569fc09f8014d9ec90110cf40528d7ea51e4d7db42cac70",
          "result_json": "{\"bands\":[[0,-1.0000000000000009,-1.9900000000000029,-2.970100000000009,-1.5146515000000194,-2.019206979999999,-0.8434374637599995,-0.0961177828803117,0.4251198634699138,1.1811164409643027,2.29371894903303,2.5798159881436966,3.782075426803333,4.052856685668527,5.335992405583845,5.832880928802231,6.371275778714169,7.645644940322005,8.970217890228206,9.893435303961917,11.189341396891162,11.40277261761591,12.098988519358866,13.27377431972685,14.047455631649264,14.681215746047439,16.50942406520923,16.95752063584932,18.560036030557782,19.65013365690784,21.867901208661177,21.727081164637774,23.156433768466723,24.56578429184941,25.20923536122044,26.195643362362155,27.674880094381994,27.92853364434762,29.44720477253846,31.648402666021536,32.646525623146516,34.23828393062427,35.48997770124074,36.400325863721214,36.806184897281405,37.35048828817138,39.94071384769835,40.787928908716786,41.908994024163746,42.38022538059476,43.728909756294996,45.23006816450115,45.93696791741115,47.80354497237611,49.38410152876609,50.84135412044948,54.032430078643536,55.12687815887549,55.76046851887042,56.79794582206716,58.96566070321627,60.45565886650659,62.374882204236215,64.19927164696695,66.29186567613101,66.73296902458017,69.10863965183836,71.09301763438252,73.61908865194515,74.29921496713476,76.24048354154698,77.89978708583301,80.6455944220901,81.17033027251934,84.24571830106532,84.9205163947406,87.1395625914775,89.93148147592169,92.66599421143277,92.63800675844752,94.91563403997203,97.996519476906,99.095206159236,101.41814543224616,104.3241554571944,105.7824818653229,108.50841906956394,112.09858242086099,113.84578136901288,116.32194616534663,118.53379368632986,118.73438788204385,121.35920053662836,121.94077509331555,125.63282179350335,128.92485352191693,129.63103539568425,132.28761397560643,136.05848395285375,137.59888658458812,141.68666176875416],[0,-1.0000000000000009,0.4849999999999799,0.7542799999999961,1.9633313600000202,2.9171891824999685,3.8669411308760226,4.846653001474999,5.865701457448269,7.028806619311556,8.392206245334988,9.104482582063556,10.704050892397078,11.548063106489725,12.549598316920685,13.833615026898304,14.783723690808358,16.05050322301984,17.80088604755243,19.24469510368072,20.2823939201592,21.428312189612562,22.815780928709707,24.164692780542897,26.060426916092716,27.427892470856996,28.60978019182394,30.10182750339423,31.554847318580048,33.30470057721051,34.89717375761208,35.570311273903556,37.118055245009444,38.7706484480975,40.63072813404547,41.88293151166207,43.35776819259814,44.872595311585805,46.73393141430247,48.48443132326072,50.6572767377355,52.00710537478535,52.912280361608374,54.93532806304764,56.71724102574984,58.72552560747244,60.419938721505375,61.81769227714567,62.618200108914436,64.74433088363935,66.28589427599114,67.66622221225431,69.73025598501992,72.35516228704515,74.5777426103742,76.09867032089555,78.18648461351916,80.50781055896292,82.79363148041483,84.96393665027311,87.03115591940728,88.79439259870409,91.04762953237324,94.0241599361241,94.92364507854757,97.89226586285302,100.27978948696865,102.21114371218198,104.12180358233184,106.3592248146763,108.91407388427132,110.54198333575668,112.47825709326729,114.94125363958845,117.7321650171034,120.10504032756049,122.38462019830143,124.72394048851285,126.58039828846492,129.26098300336656,131.88927777333163,135.04497899318972,138.19996864819348,140.17046574930237,144.30827086450026,146.30464005418418,148.81145302245793,153.24903711482239,153.92879459528027,157.1326931941668,160.916452860447,163.4168600486065,165.69771886590212,169.38742805414452,172.54189390527657,174.68171201687568,179.41730497619136,182.4659755379556,187.59770486642248,190.51328862664,194.04714021783676],[0,1.4999999999999902,2.464999999999984,3.6038959999999953,4.853189672000013,6.436625372000027,7.548462695712477,8.951072430240647,10.09007295017248,11.633299489374815,13.103887912123756,14.354070136792574,16.128783491405983,17.325097727534676,18.786227351091654,20.3893343505851,21.767855624052366,23.396121280226257,24.806656240789504,26.010137370282038,27.647974772707705,28.659395678805822,30.45805409257416,32.14333524208055,33.990613707421936,35.487910744232586,37.09878044240376,38.61050783194149,40.45685953448355,42.46721662667958,44.16213063173791,46.391624444600076,48.09988277047941,49.57741323088782,51.71295401452307,53.398058387697866,55.48158872574833,57.51208153389757,59.616943570852165,61.51410442991296,63.480594766030094,65.54897348552578,68.30858989352168,69.93840631305281,71.87086373827927,73.91257600975389,76.85650481450999,79.0661608506501,80.49762441151704,81.85413320217954,83.7992521047461,85.92139269715835,87.69227689948877,90.37560122717963,91.85459868630306,93.9282720333506,96.4851659470262,98.90492181311996,102.37019195788947,104.74841510398107,107.31109973600113,109.27022309151843,112.04228721378149,114.72832043964804,116.9228319017991,119.01366047667166,122.17752644805655,125.36058378533087,127.39146483826902,130.61357982208207,134.2616538686981,135.67908290106575,139.3146366952398,141.93871156756163,145.02186404838605,148.2562123830143,150.67604773730517,154.56783898175587,158.25141456570552,160.50800827739326,163.439821892827,167.04273411588812,169.0560219193742,173.095835355328,177.8227450271064,181.21584997237997,183.5594575544048,187.46262951151004,190.7902539868581,194.91055768636704,196.66333245536936,201.86862657591055,205.47691790315895,209.1114808268895,212.95371819474093,217.06153489369916,220.36392838381653,222.759667528304,227.6010625412285,230.13240181036818,236.14126633272008],[0,2.8000000000000025,4.342000000000001,6.120799999999993,7.651368439999984,9.440642326399985,11.215156955348583,12.616601932661764,13.999516173615657,16.13900123482177,17.79228007671181,19.6902666301455,21.582726590664446,23.383205758241466,24.93318107011615,26.487064528097214,28.171149444385545,29.899610287399536,31.570924507407373,33.1178930987813,34.90889361301881,36.92151301398607,38.83512801406741,40.5796177122103,42.60045417604586,44.39407339797119,46.52333388317431,47.95771237417086,51.03935408212617,52.76210364103924,54.641700518049774,57.19991204043442,59.557910721040926,61.78864609186405,63.730109844966435,66.31536868994823,68.17590053813348,70.25808790243273,73.15008915605601,74.58155530737844,77.43365791676275,80.17007977679695,82.70832510887007,85.58137143247164,88.26022473532664,90.11898423426878,92.11870113071157,94.5972388042519,97.36414848528285,99.89209442998377,102.84417347768256,105.63010282272245,106.6911547877981,110.37987737349324,113.3881079434381,116.72132737239585,118.80018578553178,121.87390281544177,124.08320231345891,126.30113668583304,129.58527239791323,133.14223868413504,135.18594918089605,139.10910587099195,141.3531347608754,145.3299415270189,148.31032589947628,151.3837072582039,154.64385116531494,156.39925671275802,159.09425657672904,162.95197143989733,166.20375935540957,170.32972392920703,172.68865691819144,176.92525008511626,180.8623661205997,185.59043977883275,188.0676835811757,192.03414303568604,196.1107336785753,199.328024413539,203.88844568264832,206.961499572372,212.2269811116916,215.83345129139957,219.65563024244653,224.22786889694478,228.15660695218085,231.27583468368078,236.67771286128638,238.35802508663767,242.97570045666052,247.126880038965,251.89122473457917,258.34053024116565,262.18489467186106,266.1036838756411,273.0258255080034,278.793844751339,282.13981108426475],[0,5.000000000000004,7.425999999999999,9.882920000000016,11.765580696,13.92664268149999,16.198887094135994,17.940449886875022,20.724615648589673,23.043809101781033,24.58185671555324,27.2181945157389,29.510308960482433,31.182347358934305,34.20148000356953,36.453743300613375,38.33698741968243,40.63013689987998,43.13455718359638,45.6306601352787,47.90011530761971,50.46370967647924,52.521649703728215,55.84939026117781,58.26596397374255,60.18059139996532,64.36227190401583,65.7029151602954,68.39591559644333,71.32054500145495,73.89035317647676,75.50495333576998,78.75500015705083,79.24280617838086,83.0148850376932,86.21666128147932,88.59260808023781,92.20407990874423,96.0718398444,97.48318380188117,100.23296659987095,103.63856150417945,105.09484977277714,108.08248013737156,111.34344381786931,115.8558084663075,117.11845494579211,119.62722388559554,125.94911876932761,128.1357243490655,132.7661030886286,135.43265161173403,139.08105456321266,145.1324801726671,147.22035247079322,151.37836189289337,153.2091713948852,157.58847076375636,160.9373339631961,165.54164534659205,168.760332247318,171.37817762169973,174.75218274272217,178.66649759715872,182.66969412148123,188.30971678762282,193.49929168980003,199.3807519692039,203.95117124708517,207.83230795018096,209.83241410230718,214.47990031384174,217.25130033512764,223.5963263418302,226.30883267300365,232.18279406105128,237.35603884822024,242.9414542003588,245.23317360573085,247.4753705895114,253.51192368605388,257.7831271317448,260.129621772816,264.3181925014187,268.13533509483716,275.4931966844632,280.5191301692202,285.6618182529522,292.13916733634545,298.83568405725833,305.9816799433184,310.2676843935426,314.77235586245075,317.55821892906306,323.17838547490163,330.88956829621213,340.08702478353274,344.75114467217816,350.93516994444684,362.08550176307205,369.01663811269464]],\"med\":2.361412663327201,\"p5\":1.4168666176875417,\"p95\":3.6901663811269465,\"win\":1,\"ddMed\":0.04439764835798499,\"ddP95\":0.0733249068422287,\"ddProb\":0,\"seed\":2026}"
        },
        "account_id": "RP_MAIN_01",
        "sample_size_n": 15,
        "rck_optimal_fraction": 0,
        "snapshot_id": "ba93289b-c640-43d5-9437-dd1c3ee67a38",
        "created_at": "2026-10-25T13:49:34.409Z",
        "trades_count": 15,
        "expectancy_r": 1.2333333333333334,
        "win_rate_w": 0.6,
        "payoff_ratio_b": 2.7222222222222223,
        "es_975_r": -1,
        "var_975_r": -1,
        "var_990_r": -1,
        "rck_optimal_pct": 0,
        "tier_state": 1,
        "mc_p95_mdd": 0.0733249068422287,
        "mc_ror_prob": 0,
        "mc_p50_equity": 39832.74006042733,
        "omega_curve_json": [
          {
            "x": -1,
            "y": 20
          },
          {
            "x": -0.9545454545454546,
            "y": 20
          },
          {
            "x": -0.9090909090909091,
            "y": 20
          },
          {
            "x": -0.8636363636363636,
            "y": 20
          },
          {
            "x": -0.8181818181818181,
            "y": 20
          },
          {
            "x": -0.7727272727272727,
            "y": 20
          },
          {
            "x": -0.7272727272727273,
            "y": 18.97222222222222
          },
          {
            "x": -0.6818181818181819,
            "y": 16.047619047619047
          },
          {
            "x": -0.6363636363636364,
            "y": 13.854166666666664
          },
          {
            "x": -0.5909090909090908,
            "y": 12.148148148148142
          },
          {
            "x": -0.5454545454545454,
            "y": 10.783333333333333
          },
          {
            "x": -0.5,
            "y": 9.666666666666666
          },
          {
            "x": -0.4545454545454546,
            "y": 8.736111111111112
          },
          {
            "x": -0.40909090909090906,
            "y": 7.948717948717949
          },
          {
            "x": -0.36363636363636365,
            "y": 7.273809523809524
          },
          {
            "x": -0.31818181818181823,
            "y": 6.68888888888889
          },
          {
            "x": -0.2727272727272727,
            "y": 6.177083333333333
          },
          {
            "x": -0.2272727272727273,
            "y": 5.725490196078431
          },
          {
            "x": -0.18181818181818177,
            "y": 5.3240740740740735
          },
          {
            "x": -0.13636363636363635,
            "y": 4.964912280701754
          },
          {
            "x": -0.09090909090909094,
            "y": 4.641666666666667
          },
          {
            "x": -0.045454545454545414,
            "y": 4.349206349206348
          },
          {
            "x": 0,
            "y": 4.083333333333333
          },
          {
            "x": 0.045454545454545414,
            "y": 3.8405797101449286
          },
          {
            "x": 0.09090909090909083,
            "y": 3.6180555555555567
          },
          {
            "x": 0.13636363636363646,
            "y": 3.413333333333332
          },
          {
            "x": 0.18181818181818188,
            "y": 3.224358974358975
          },
          {
            "x": 0.2272727272727273,
            "y": 3.049382716049383
          },
          {
            "x": 0.2727272727272727,
            "y": 2.886904761904762
          },
          {
            "x": 0.3181818181818181,
            "y": 2.7356321839080455
          },
          {
            "x": 0.36363636363636354,
            "y": 2.594444444444445
          },
          {
            "x": 0.40909090909090917,
            "y": 2.462365591397849
          },
          {
            "x": 0.4545454545454546,
            "y": 2.338541666666666
          },
          {
            "x": 0.5,
            "y": 2.2222222222222223
          },
          {
            "x": 0.5454545454545454,
            "y": 2.112745098039216
          },
          {
            "x": 0.5909090909090908,
            "y": 2.00952380952381
          },
          {
            "x": 0.6363636363636365,
            "y": 1.912037037037037
          },
          {
            "x": 0.6818181818181819,
            "y": 1.8198198198198197
          },
          {
            "x": 0.7272727272727273,
            "y": 1.7324561403508774
          },
          {
            "x": 0.7727272727272727,
            "y": 1.6495726495726497
          },
          {
            "x": 0.8181818181818181,
            "y": 1.570833333333333
          },
          {
            "x": 0.8636363636363635,
            "y": 1.4959349593495934
          },
          {
            "x": 0.9090909090909092,
            "y": 1.4246031746031742
          },
          {
            "x": 0.9545454545454546,
            "y": 1.3565891472868215
          },
          {
            "x": 1,
            "y": 1.2916666666666667
          },
          {
            "x": 1.0454545454545454,
            "y": 1.2296296296296299
          },
          {
            "x": 1.0909090909090908,
            "y": 1.170289855072464
          },
          {
            "x": 1.1363636363636362,
            "y": 1.1134751773049645
          },
          {
            "x": 1.1818181818181817,
            "y": 1.059027777777778
          },
          {
            "x": 1.227272727272727,
            "y": 1.006788866259335
          },
          {
            "x": 1.272727272727273,
            "y": 0.9568965517241376
          },
          {
            "x": 1.3181818181818183,
            "y": 0.9092676604018144
          },
          {
            "x": 1.3636363636363638,
            "y": 0.8637515842839036
          },
          {
            "x": 1.4090909090909092,
            "y": 0.8202107873527588
          },
          {
            "x": 1.4545454545454546,
            "y": 0.7785194174757281
          },
          {
            "x": 1.5,
            "y": 0.738562091503268
          },
          {
            "x": 1.5454545454545454,
            "y": 0.7011027278003483
          },
          {
            "x": 1.5909090909090908,
            "y": 0.6653431650595577
          },
          {
            "x": 1.6363636363636362,
            "y": 0.6311702717692734
          },
          {
            "x": 1.6818181818181817,
            "y": 0.5984807379272925
          },
          {
            "x": 1.727272727272727,
            "y": 0.5671800318640469
          },
          {
            "x": 1.772727272727273,
            "y": 0.5371814872594902
          },
          {
            "x": 1.8181818181818183,
            "y": 0.5089058524173027
          },
          {
            "x": 1.8636363636363638,
            "y": 0.4825870646766169
          },
          {
            "x": 1.9090909090909092,
            "y": 0.4574209245742092
          },
          {
            "x": 1.9545454545454546,
            "y": 0.4333333333333333
          },
          {
            "x": 2,
            "y": 0.41025641025641024
          },
          {
            "x": 2.0454545454545454,
            "y": 0.38952164009111623
          },
          {
            "x": 2.090909090909091,
            "y": 0.3697104677060135
          },
          {
            "x": 2.1363636363636362,
            "y": 0.35076252723311546
          },
          {
            "x": 2.1818181818181817,
            "y": 0.3326226012793178
          },
          {
            "x": 2.227272727272727,
            "y": 0.31609674728940795
          },
          {
            "x": 2.272727272727273,
            "y": 0.30085609457806756
          },
          {
            "x": 2.3181818181818183,
            "y": 0.2862838915470494
          },
          {
            "x": 2.3636363636363638,
            "y": 0.2723371049551307
          },
          {
            "x": 2.409090909090909,
            "y": 0.25897631779984714
          },
          {
            "x": 2.4545454545454546,
            "y": 0.2461653572764684
          },
          {
            "x": 2.5,
            "y": 0.23387096774193547
          },
          {
            "x": 2.5454545454545454,
            "y": 0.2220625224577794
          },
          {
            "x": 2.590909090909091,
            "y": 0.2107117688513038
          },
          {
            "x": 2.6363636363636362,
            "y": 0.1997926028344279
          },
          {
            "x": 2.6818181818181817,
            "y": 0.18928086838534605
          },
          {
            "x": 2.727272727272727,
            "y": 0.1791541791541792
          },
          {
            "x": 2.772727272727273,
            "y": 0.1693917593198168
          },
          {
            "x": 2.8181818181818183,
            "y": 0.16051364365971102
          },
          {
            "x": 2.8636363636363638,
            "y": 0.152755905511811
          },
          {
            "x": 2.909090909090909,
            "y": 0.1452859350850077
          },
          {
            "x": 2.9545454545454546,
            "y": 0.1380880121396055
          },
          {
            "x": 3,
            "y": 0.13114754098360656
          },
          {
            "x": 3.045454545454546,
            "y": 0.1244509516837481
          },
          {
            "x": 3.090909090909091,
            "y": 0.11798561151079139
          },
          {
            "x": 3.1363636363636367,
            "y": 0.1117397454031117
          },
          {
            "x": 3.1818181818181817,
            "y": 0.10570236439499307
          },
          {
            "x": 3.2272727272727275,
            "y": 0.0998632010943912
          },
          {
            "x": 3.2727272727272725,
            "y": 0.0942126514131898
          },
          {
            "x": 3.3181818181818183,
            "y": 0.0887417218543046
          },
          {
            "x": 3.3636363636363633,
            "y": 0.08344198174706653
          },
          {
            "x": 3.409090909090909,
            "y": 0.07830551989730422
          },
          {
            "x": 3.454545454545454,
            "y": 0.0733249051833123
          },
          {
            "x": 3.5,
            "y": 0.0684931506849315
          }
        ],
        "parameters": {
          "sim": {
            "horizon": 100,
            "runs": 1000,
            "risk": 1,
            "dd": 25,
            "skip": false,
            "cap": null,
            "slip": 0,
            "mode": "boot",
            "seed": 2026,
            "revenge": false,
            "tailSlip": 1,
            "tailWindow": 25,
            "liquidity": "auto"
          },
          "stress": {
            "winrate": 53,
            "payoff": 1.6,
            "risk": 1,
            "dd": 20,
            "streak": false,
            "degrade": false,
            "tail": false,
            "streakLength": 12,
            "wrDrop": 7,
            "rrDrop": 25
          },
          "prop": {
            "preset": "custom",
            "size": 100000,
            "fee": 500,
            "stages": [
              8
            ],
            "ml": 10,
            "dl": 5,
            "risk": 0.5,
            "split": 80,
            "tpd": 2,
            "horizon": 120,
            "ddMode": "static",
            "runs": 1000,
            "seed": 42,
            "actFee": 0,
            "comp": true,
            "payoutDays": 10,
            "fundedH": 60,
            "tradingDays": 21
          },
          "profile": {
            "rckAlpha": 0.05,
            "rckBeta": 0.2,
            "acct": "personal",
            "propKey": "custom",
            "t2": 3,
            "t3": 5,
            "tierOverride": "auto",
            "k": 4,
            "fTier": 1,
            "dailyLossLimit": 1000,
            "personalDailyLimit": 500,
            "maxDrawdown": 2000,
            "ddMode": "static",
            "assumptions": {
              "tierCapMode": "ftier_mult",
              "tail25Mode": "losing_only",
              "safeTierMax": 1,
              "recRule": "min3",
              "lockStressLab": true,
              "rckMode": "empirical",
              "rorZoom": false
            }
          },
          "selectedIds": null
        },
        "results": {
          "mc": {
            "bands": [
              [
                0,
                -1.0000000000000009,
                -1.9900000000000029,
                -2.970100000000009,
                -1.5146515000000194,
                -2.019206979999999,
                -0.8434374637599995,
                -0.0961177828803117,
                0.4251198634699138,
                1.1811164409643027,
                2.29371894903303,
                2.5798159881436966,
                3.782075426803333,
                4.052856685668527,
                5.335992405583845,
                5.832880928802231,
                6.371275778714169,
                7.645644940322005,
                8.970217890228206,
                9.893435303961917,
                11.189341396891162,
                11.40277261761591,
                12.098988519358866,
                13.27377431972685,
                14.047455631649264,
                14.681215746047439,
                16.50942406520923,
                16.95752063584932,
                18.560036030557782,
                19.65013365690784,
                21.867901208661177,
                21.727081164637774,
                23.156433768466723,
                24.56578429184941,
                25.20923536122044,
                26.195643362362155,
                27.674880094381994,
                27.92853364434762,
                29.44720477253846,
                31.648402666021536,
                32.646525623146516,
                34.23828393062427,
                35.48997770124074,
                36.400325863721214,
                36.806184897281405,
                37.35048828817138,
                39.94071384769835,
                40.787928908716786,
                41.908994024163746,
                42.38022538059476,
                43.728909756294996,
                45.23006816450115,
                45.93696791741115,
                47.80354497237611,
                49.38410152876609,
                50.84135412044948,
                54.032430078643536,
                55.12687815887549,
                55.76046851887042,
                56.79794582206716,
                58.96566070321627,
                60.45565886650659,
                62.374882204236215,
                64.19927164696695,
                66.29186567613101,
                66.73296902458017,
                69.10863965183836,
                71.09301763438252,
                73.61908865194515,
                74.29921496713476,
                76.24048354154698,
                77.89978708583301,
                80.6455944220901,
                81.17033027251934,
                84.24571830106532,
                84.9205163947406,
                87.1395625914775,
                89.93148147592169,
                92.66599421143277,
                92.63800675844752,
                94.91563403997203,
                97.996519476906,
                99.095206159236,
                101.41814543224616,
                104.3241554571944,
                105.7824818653229,
                108.50841906956394,
                112.09858242086099,
                113.84578136901288,
                116.32194616534663,
                118.53379368632986,
                118.73438788204385,
                121.35920053662836,
                121.94077509331555,
                125.63282179350335,
                128.92485352191693,
                129.63103539568425,
                132.28761397560643,
                136.05848395285375,
                137.59888658458812,
                141.68666176875416
              ],
              [
                0,
                -1.0000000000000009,
                0.4849999999999799,
                0.7542799999999961,
                1.9633313600000202,
                2.9171891824999685,
                3.8669411308760226,
                4.846653001474999,
                5.865701457448269,
                7.028806619311556,
                8.392206245334988,
                9.104482582063556,
                10.704050892397078,
                11.548063106489725,
                12.549598316920685,
                13.833615026898304,
                14.783723690808358,
                16.05050322301984,
                17.80088604755243,
                19.24469510368072,
                20.2823939201592,
                21.428312189612562,
                22.815780928709707,
                24.164692780542897,
                26.060426916092716,
                27.427892470856996,
                28.60978019182394,
                30.10182750339423,
                31.554847318580048,
                33.30470057721051,
                34.89717375761208,
                35.570311273903556,
                37.118055245009444,
                38.7706484480975,
                40.63072813404547,
                41.88293151166207,
                43.35776819259814,
                44.872595311585805,
                46.73393141430247,
                48.48443132326072,
                50.6572767377355,
                52.00710537478535,
                52.912280361608374,
                54.93532806304764,
                56.71724102574984,
                58.72552560747244,
                60.419938721505375,
                61.81769227714567,
                62.618200108914436,
                64.74433088363935,
                66.28589427599114,
                67.66622221225431,
                69.73025598501992,
                72.35516228704515,
                74.5777426103742,
                76.09867032089555,
                78.18648461351916,
                80.50781055896292,
                82.79363148041483,
                84.96393665027311,
                87.03115591940728,
                88.79439259870409,
                91.04762953237324,
                94.0241599361241,
                94.92364507854757,
                97.89226586285302,
                100.27978948696865,
                102.21114371218198,
                104.12180358233184,
                106.3592248146763,
                108.91407388427132,
                110.54198333575668,
                112.47825709326729,
                114.94125363958845,
                117.7321650171034,
                120.10504032756049,
                122.38462019830143,
                124.72394048851285,
                126.58039828846492,
                129.26098300336656,
                131.88927777333163,
                135.04497899318972,
                138.19996864819348,
                140.17046574930237,
                144.30827086450026,
                146.30464005418418,
                148.81145302245793,
                153.24903711482239,
                153.92879459528027,
                157.1326931941668,
                160.916452860447,
                163.4168600486065,
                165.69771886590212,
                169.38742805414452,
                172.54189390527657,
                174.68171201687568,
                179.41730497619136,
                182.4659755379556,
                187.59770486642248,
                190.51328862664,
                194.04714021783676
              ],
              [
                0,
                1.4999999999999902,
                2.464999999999984,
                3.6038959999999953,
                4.853189672000013,
                6.436625372000027,
                7.548462695712477,
                8.951072430240647,
                10.09007295017248,
                11.633299489374815,
                13.103887912123756,
                14.354070136792574,
                16.128783491405983,
                17.325097727534676,
                18.786227351091654,
                20.3893343505851,
                21.767855624052366,
                23.396121280226257,
                24.806656240789504,
                26.010137370282038,
                27.647974772707705,
                28.659395678805822,
                30.45805409257416,
                32.14333524208055,
                33.990613707421936,
                35.487910744232586,
                37.09878044240376,
                38.61050783194149,
                40.45685953448355,
                42.46721662667958,
                44.16213063173791,
                46.391624444600076,
                48.09988277047941,
                49.57741323088782,
                51.71295401452307,
                53.398058387697866,
                55.48158872574833,
                57.51208153389757,
                59.616943570852165,
                61.51410442991296,
                63.480594766030094,
                65.54897348552578,
                68.30858989352168,
                69.93840631305281,
                71.87086373827927,
                73.91257600975389,
                76.85650481450999,
                79.0661608506501,
                80.49762441151704,
                81.85413320217954,
                83.7992521047461,
                85.92139269715835,
                87.69227689948877,
                90.37560122717963,
                91.85459868630306,
                93.9282720333506,
                96.4851659470262,
                98.90492181311996,
                102.37019195788947,
                104.74841510398107,
                107.31109973600113,
                109.27022309151843,
                112.04228721378149,
                114.72832043964804,
                116.9228319017991,
                119.01366047667166,
                122.17752644805655,
                125.36058378533087,
                127.39146483826902,
                130.61357982208207,
                134.2616538686981,
                135.67908290106575,
                139.3146366952398,
                141.93871156756163,
                145.02186404838605,
                148.2562123830143,
                150.67604773730517,
                154.56783898175587,
                158.25141456570552,
                160.50800827739326,
                163.439821892827,
                167.04273411588812,
                169.0560219193742,
                173.095835355328,
                177.8227450271064,
                181.21584997237997,
                183.5594575544048,
                187.46262951151004,
                190.7902539868581,
                194.91055768636704,
                196.66333245536936,
                201.86862657591055,
                205.47691790315895,
                209.1114808268895,
                212.95371819474093,
                217.06153489369916,
                220.36392838381653,
                222.759667528304,
                227.6010625412285,
                230.13240181036818,
                236.14126633272008
              ],
              [
                0,
                2.8000000000000025,
                4.342000000000001,
                6.120799999999993,
                7.651368439999984,
                9.440642326399985,
                11.215156955348583,
                12.616601932661764,
                13.999516173615657,
                16.13900123482177,
                17.79228007671181,
                19.6902666301455,
                21.582726590664446,
                23.383205758241466,
                24.93318107011615,
                26.487064528097214,
                28.171149444385545,
                29.899610287399536,
                31.570924507407373,
                33.1178930987813,
                34.90889361301881,
                36.92151301398607,
                38.83512801406741,
                40.5796177122103,
                42.60045417604586,
                44.39407339797119,
                46.52333388317431,
                47.95771237417086,
                51.03935408212617,
                52.76210364103924,
                54.641700518049774,
                57.19991204043442,
                59.557910721040926,
                61.78864609186405,
                63.730109844966435,
                66.31536868994823,
                68.17590053813348,
                70.25808790243273,
                73.15008915605601,
                74.58155530737844,
                77.43365791676275,
                80.17007977679695,
                82.70832510887007,
                85.58137143247164,
                88.26022473532664,
                90.11898423426878,
                92.11870113071157,
                94.5972388042519,
                97.36414848528285,
                99.89209442998377,
                102.84417347768256,
                105.63010282272245,
                106.6911547877981,
                110.37987737349324,
                113.3881079434381,
                116.72132737239585,
                118.80018578553178,
                121.87390281544177,
                124.08320231345891,
                126.30113668583304,
                129.58527239791323,
                133.14223868413504,
                135.18594918089605,
                139.10910587099195,
                141.3531347608754,
                145.3299415270189,
                148.31032589947628,
                151.3837072582039,
                154.64385116531494,
                156.39925671275802,
                159.09425657672904,
                162.95197143989733,
                166.20375935540957,
                170.32972392920703,
                172.68865691819144,
                176.92525008511626,
                180.8623661205997,
                185.59043977883275,
                188.0676835811757,
                192.03414303568604,
                196.1107336785753,
                199.328024413539,
                203.88844568264832,
                206.961499572372,
                212.2269811116916,
                215.83345129139957,
                219.65563024244653,
                224.22786889694478,
                228.15660695218085,
                231.27583468368078,
                236.67771286128638,
                238.35802508663767,
                242.97570045666052,
                247.126880038965,
                251.89122473457917,
                258.34053024116565,
                262.18489467186106,
                266.1036838756411,
                273.0258255080034,
                278.793844751339,
                282.13981108426475
              ],
              [
                0,
                5.000000000000004,
                7.425999999999999,
                9.882920000000016,
                11.765580696,
                13.92664268149999,
                16.198887094135994,
                17.940449886875022,
                20.724615648589673,
                23.043809101781033,
                24.58185671555324,
                27.2181945157389,
                29.510308960482433,
                31.182347358934305,
                34.20148000356953,
                36.453743300613375,
                38.33698741968243,
                40.63013689987998,
                43.13455718359638,
                45.6306601352787,
                47.90011530761971,
                50.46370967647924,
                52.521649703728215,
                55.84939026117781,
                58.26596397374255,
                60.18059139996532,
                64.36227190401583,
                65.7029151602954,
                68.39591559644333,
                71.32054500145495,
                73.89035317647676,
                75.50495333576998,
                78.75500015705083,
                79.24280617838086,
                83.0148850376932,
                86.21666128147932,
                88.59260808023781,
                92.20407990874423,
                96.0718398444,
                97.48318380188117,
                100.23296659987095,
                103.63856150417945,
                105.09484977277714,
                108.08248013737156,
                111.34344381786931,
                115.8558084663075,
                117.11845494579211,
                119.62722388559554,
                125.94911876932761,
                128.1357243490655,
                132.7661030886286,
                135.43265161173403,
                139.08105456321266,
                145.1324801726671,
                147.22035247079322,
                151.37836189289337,
                153.2091713948852,
                157.58847076375636,
                160.9373339631961,
                165.54164534659205,
                168.760332247318,
                171.37817762169973,
                174.75218274272217,
                178.66649759715872,
                182.66969412148123,
                188.30971678762282,
                193.49929168980003,
                199.3807519692039,
                203.95117124708517,
                207.83230795018096,
                209.83241410230718,
                214.47990031384174,
                217.25130033512764,
                223.5963263418302,
                226.30883267300365,
                232.18279406105128,
                237.35603884822024,
                242.9414542003588,
                245.23317360573085,
                247.4753705895114,
                253.51192368605388,
                257.7831271317448,
                260.129621772816,
                264.3181925014187,
                268.13533509483716,
                275.4931966844632,
                280.5191301692202,
                285.6618182529522,
                292.13916733634545,
                298.83568405725833,
                305.9816799433184,
                310.2676843935426,
                314.77235586245075,
                317.55821892906306,
                323.17838547490163,
                330.88956829621213,
                340.08702478353274,
                344.75114467217816,
                350.93516994444684,
                362.08550176307205,
                369.01663811269464
              ]
            ],
            "med": 2.361412663327201,
            "p5": 1.4168666176875417,
            "p95": 3.6901663811269465,
            "win": 1,
            "ddMed": 0.04439764835798499,
            "ddP95": 0.0733249068422287,
            "ddProb": 0,
            "seed": 2026
          },
          "stress": null,
          "prop": null
        }
      }
    },
    {
      "name": "S4 10,000-run result reused across fresh runtime; trade/profile changes invalidate SHA-256 cache",
      "pass": true,
      "runs": 10000,
      "firstComputations": 1,
      "freshRuntimeComputations": 0,
      "cacheHit": true,
      "profileRerun": 1,
      "inputHash": "d02e94e0336fa8276f6ed9167ae328385081de3ca7be33529bffe34131202dbc"
    },
    {
      "name": "S4 corrupted cache falls back to real computation; cache write quota failure preserves journal",
      "pass": true,
      "corruptResultUsed": false,
      "quotaFailurePreservedLedger": true
    },
    {
      "name": "PDF target Omega and mid-path Daily/Trailing violations beat later recovery",
      "pass": true,
      "omegaTarget": 0.25,
      "omega": 1.4,
      "dailySeed": 8,
      "dailyStopFail": 1,
      "ignoringDailyPass": 1,
      "trailingSeed": 1,
      "staticPass": 1,
      "trailingStopFail": 1
    },
    {
      "name": "S7 21-day default and configurable monthly profit; payout interval stays 10 days",
      "pass": true,
      "monthly21": 20720.000000000004,
      "monthly20": 19733.33333333334,
      "payoutDays": 10
    }
  ],
  "timestamp": "2026-10-25T13:49:46.937Z"
}
```

### P7_BROWSER_TESTS.json
```json
{
  "phase": "P7",
  "passed": 24,
  "total": 24,
  "cases": [
    {
      "name": "Boot: 15 A trades, common header and audited KPIs",
      "pass": true,
      "equity": 11850,
      "expectancy": 1.2333333333333334,
      "sqn": 2.228984997397465,
      "maxDDR": 2
    },
    {
      "name": "Multi-select AND/OR filters preserve global equity",
      "pass": true,
      "and": 3,
      "or": 9
    },
    {
      "name": "Advanced R/weekday/session/MAE filters and saved views",
      "pass": true,
      "restoredAll17Fields": true
    },
    {
      "name": "Sort all columns; keyboard inline PnL edit updates storage/header",
      "pass": true,
      "editedPnl": 500,
      "inlineRNotRounded": true
    },
    {
      "name": "One shared modal: add missing-R trade then verified trade and edit",
      "pass": true,
      "rows": 17,
      "verifiedR": 16,
      "missingRExcluded": true
    },
    {
      "name": "Tier3 prevents manual add; existing journal remains readable",
      "pass": true
    },
    {
      "name": "Gameplan save and conversion writes one canonical trade",
      "pass": true,
      "pnl": 200
    },
    {
      "name": "Calendar totals and month navigation",
      "pass": true
    },
    {
      "name": "Three-step weekly Review persists all notes",
      "pass": true,
      "notes": {
        "r1": "Quy tắc kiểm thử",
        "r2": "Quan sát tuần trước",
        "r3": "Một hành động"
      }
    },
    {
      "name": "Chartbook upload/delete retains original source UI",
      "pass": true
    },
    {
      "name": "Checklist additions, check-all gate, and deletion",
      "pass": true
    },
    {
      "name": "CSV partial closes merge; dedupe; estimated risk stays unverified",
      "pass": true,
      "imported": 1,
      "pnl": 120,
      "deduped": true
    },
    {
      "name": "Creatable combobox + rename/color metadata share storage",
      "pass": true,
      "option": {
        "l": "Breakout P3",
        "c": "#123456"
      }
    },
    {
      "name": "KPI visibility/order controls preserve preferences",
      "pass": true,
      "order": [
        "kpi-expectancy",
        "kpi-sqn",
        "kpi-pf",
        "kpi-exit-eff",
        "kpi-dd",
        "kpi-recovery"
      ],
      "hidden": [
        "kpi-pf"
      ],
      "mouseDrag": true
    },
    {
      "name": "Custom option apostrophe/HTML stays literal and removable",
      "pass": true,
      "literalLabel": "P3's <literal>, comma",
      "urlRoundTrip": true
    },
    {
      "name": "R/$/%/Pips-Ticks units share unchanged R statistics",
      "pass": true,
      "expectancyR": 1.3235294117647058,
      "pipsPerR": 8
    },
    {
      "name": "Help search, tooltip hover/pin/Escape, and mapping simulator",
      "pass": true
    },
    {
      "name": "Settings capital baseline updates shared equity atomically",
      "pass": true
    },
    {
      "name": "Backup download -> clear -> file restore matches every field",
      "pass": true,
      "restoredEveryField": true,
      "trades": 19
    },
    {
      "name": "Reload persists trades, Review, units, KPI and metadata",
      "pass": true,
      "persisted": true
    },
    {
      "name": "Empty / one-row view; unavailable R displays a dash; no NaN KPIs",
      "pass": true,
      "zeroAndOneRows": true
    },
    {
      "name": "Sample B selection downloads backup and preserves Review/metadata",
      "pass": true,
      "backupPrepared": true,
      "sampleB": 15
    },
    {
      "name": "Generated Worker still matches main thread for four P3 tasks",
      "pass": true,
      "tasks": [
        {
          "task": "mc",
          "execution": "worker",
          "equal": true
        },
        {
          "task": "ror",
          "execution": "worker",
          "equal": true
        },
        {
          "task": "analytics",
          "execution": "worker",
          "equal": true
        },
        {
          "task": "prop",
          "execution": "worker",
          "equal": true
        }
      ]
    },
    {
      "name": "21 routes; runtime IDs unique; dark/mobile layouts",
      "pass": true,
      "routes": 21,
      "runtimeDuplicateIds": 0,
      "mobileOverflow": false
    }
  ],
  "pageErrors": [],
  "consoleErrors": [],
  "timestamp": "2026-10-25T07:07:59.499Z"
}
```

### P7_RISK_BROWSER_TESTS.json
```json
{
  "phase": "P7",
  "passed": 12,
  "total": 12,
  "cases": [
    {
      "name": "A sample: risk pages render from same cached numbers; no illustrative values",
      "pass": true,
      "equity": 11850,
      "expectancy": 1.2333333333333334,
      "omega0": 4.083333333333333,
      "n": 15,
      "recommendation": 0
    },
    {
      "name": "Risk Profile is reachable inside settings; k, f, capital limits and Prop thresholds persist",
      "pass": true,
      "budget": 60,
      "k": 5,
      "propTier2": 2,
      "propTier3": 3.5
    },
    {
      "name": "Cashflow modal: deposit and withdrawal preserve NAV drawdown while updating all shared values",
      "pass": true,
      "dd": 0.04219409282700426,
      "equityChange": 2000,
      "rows": 2
    },
    {
      "name": "B open positions: floating loss enters daily budget, persists edits, locks at limit, keeps historical view usable",
      "pass": true,
      "initialFloating": -100,
      "editedFloating": -700,
      "stopAndRelease": true
    },
    {
      "name": "Tier 2 permits only A-Setup, halves cap; Tier3 locks new trades but history editing works",
      "pass": true,
      "tier2Budget": 116.25,
      "aSetups": [
        "Liquidity Sweep",
        "FVG Retest",
        "Breakout",
        "Session Open Sweep"
      ],
      "historyEditable": true
    },
    {
      "name": "Complete trade editor derives PnL, actual/planned R, pips, duration and manual-vs-SL slippage",
      "pass": true,
      "manualPnl": -50,
      "slPnl": -120,
      "slippageR": 0.2
    },
    {
      "name": "One journal table switches basic/price/risk columns; editing and original sorting survive roundtrip",
      "pass": true,
      "tableCount": 1,
      "rows": 16
    },
    {
      "name": "Omega comparison, quantile grid, rolling window, exit bounds and expanding VaR render with source math",
      "pass": true,
      "n2": 4,
      "points": 100,
      "mu": 0.9999999999999997,
      "breaches": 0,
      "count": 5
    },
    {
      "name": "RoR inputs and zoom use actual W/b; empirical result runs in real Worker",
      "pass": true,
      "W": 0.6,
      "payoff": 2,
      "execution": "worker"
    },
    {
      "name": "RCK 30 verified trades: gates open, parameters and modes persist, MC verification bounds recommendation",
      "pass": true,
      "verifiedN": 30,
      "recommendation": 0.009124087591240875,
      "worker": "worker"
    },
    {
      "name": "Capital stop is enforced at Tier1; settings does not lose original saved data",
      "pass": true,
      "tier": 1,
      "maxDrawdown": 10,
      "stop": true
    },
    {
      "name": "Risk routes: no duplicate runtime IDs, dark/mobile cards usable, profile scrolls inside drawer",
      "pass": true,
      "runtimeDuplicateIds": 0,
      "mobileOverflow": false,
      "routes": 4
    }
  ],
  "pageErrors": [],
  "timestamp": "2026-10-25T07:08:29.547Z"
}
```

### P7_PAGES_BROWSER_TESTS.json
```json
{
  "phase": "P7",
  "passed": 12,
  "total": 12,
  "cases": [
    {
      "name": "MC auto-runs in real Worker; original A fan/summary and N<30 warning",
      "pass": true,
      "median": 2.361412663327201,
      "p95DD": 0.0733249068422287,
      "execution": "worker"
    },
    {
      "name": "Seed/mode/what-if updates persist and never modify journal",
      "pass": true,
      "seed": 77,
      "mode": "perm",
      "reloadDeterministic": true
    },
    {
      "name": "Stress locked for small sample and Tier 3; explicit assumption unlock is respected",
      "pass": true
    },
    {
      "name": "Stress sliders persist atomically, force loss prefix and share stressed ES with L2",
      "pass": true,
      "forcedStreak": 15,
      "sharedES": 4.379409099867242,
      "summary": "ES stressed (20 lệnh, trượt giá ×2, thanh khoản √(69.3/10)): 4.38R · 2,5% nhóm lệnh thua · 1/6 lệnh · ES 97,5% lệnh đơn -1.00R"
    },
    {
      "name": "Sizer uses union product specs and A US30 step; USDJPY requires conversion; Tier3 gives zero",
      "pass": true,
      "symbols": 20,
      "US30Step": 0.1
    },
    {
      "name": "Liquidity group overrides and shared selector update one stressed ES",
      "pass": true,
      "effective": 98.66666666666667,
      "override": 20
    },
    {
      "name": "Prop multi-stage, activation, payout and compounding controls feed one seeded Worker result",
      "pass": true,
      "staticPass": 1,
      "trailingPass": 1
    },
    {
      "name": "Named Prop presets are source examples; zero fee ROI is dash; invalid stages do not overwrite state",
      "pass": true,
      "preset": "ftmo",
      "zeroFeeRoi": null
    },
    {
      "name": "Comparison table and Zones read exact cached MC/Prop/Equity/Edge; no duplicate charts",
      "pass": true,
      "sharedEquity": 11850,
      "sharedDD": 0,
      "sharedOmega": 4.083333333333333,
      "summaryCanvases": 0
    },
    {
      "name": "Verified recommendation survives UI-only save; MC feedback applies only to personal account",
      "pass": true,
      "recommendation": 0.009124087591240875,
      "appliedTier2": 4.5,
      "appliedTier3": 6.9,
      "propProtected": true
    },
    {
      "name": "Trade changes while Worker pending cannot show stale MC; metadata-only change recovers",
      "pass": true,
      "seed": 817,
      "staleOverwrites": 0
    },
    {
      "name": "P7 routes: unique runtime IDs, dark/mobile no horizontal overflow, Zones links route correctly",
      "pass": true,
      "routes": 5,
      "runtimeDuplicateIds": 0,
      "mobileOverflow": false
    }
  ],
  "pageErrors": [],
  "consoleErrors": [],
  "timestamp": "2026-10-25T07:08:55.561Z"
}
```

### P7_STORAGE_BROWSER_TESTS.json
```json
{
  "phase": "P7",
  "passed": 11,
  "total": 11,
  "cases": [
    {
      "name": "Boot mirrors one canonical ledger in real IndexedDB; schema explorer retains three source cards",
      "pass": true,
      "trades": 15,
      "exact": true
    },
    {
      "name": "UnifiedTrade import: alias/risk conversion, skip missing money, dedupe and ID collision preserve original",
      "pass": true,
      "imported": 2,
      "skipped": 1,
      "collision": "1-import-1",
      "duplicateReimport": 0
    },
    {
      "name": "Snapshot stores available shared Worker results and original parameters; no synthetic Monte Carlo",
      "pass": true,
      "snapshotId": "0fcedadc-e5e6-4aad-a6ff-b693a8394dd7",
      "verifiedR": 16
    },
    {
      "name": "JSON schema and SQL download contain full state; SQL escaped and ownership explicitly required",
      "pass": true,
      "jsonTrades": 17,
      "sqlBytes": 87359,
      "databaseExecution": "NOT RUN"
    },
    {
      "name": "Schema explorer treats stored HTML/apostrophes as text",
      "pass": true
    },
    {
      "name": "Backup → clear isolated storage and IndexedDB → restore file matches every field, including P5 config and snapshots",
      "pass": true,
      "fields": 16,
      "trades": 17,
      "snapshots": 1,
      "archivedBeforeRestore": true,
      "exact": true
    },
    {
      "name": "Missing localStorage recovers IndexedDB before fresh sample boot; existing localStorage remains priority",
      "pass": true,
      "recovered": 17,
      "noSampleOverwrite": true
    },
    {
      "name": "IndexedDB failed write aborts whole transaction and keeps previous mirror",
      "pass": true,
      "error": "DataError",
      "rollbackExact": true
    },
    {
      "name": "Mirror failure is visible while local data survives; failed pre-restore archive does not mutate state",
      "pass": true,
      "failureReported": true,
      "localDataIntact": true
    },
    {
      "name": "Legacy A file restore normalizes data and keeps notes/ext2; raw invalid file has no side effects",
      "pass": true,
      "legacyTrades": 1,
      "metadataPreserved": true
    },
    {
      "name": "Mapping schema on dark/mobile has unique IDs and no page overflow; other A mapping UI remains",
      "pass": true,
      "runtimeDuplicateIds": 0,
      "mobileOverflow": false
    }
  ],
  "pageErrors": [],
  "consoleErrors": [],
  "timestamp": "2026-10-25T07:09:06.321Z"
}
```

### P7_RECOVERY_BROWSER_TESTS.json
```json
{
  "phase": "P7",
  "passed": 1,
  "total": 1,
  "cases": [
    {
      "name": "Tier3 automatically runs shared Worker recovery; PF10/15 and P50/P95 display, live risk stays zero",
      "pass": true,
      "execution": "worker",
      "tier": 3,
      "recommendation": 0,
      "recovery": {
        "bands": [
          [
            0,
            -0.5000000000000004,
            -0.9974999999999956,
            -1.4925124999999984,
            -0.5074376250000068,
            -1.0049004368750003,
            -0.014949441243761186,
            -0.514874694037537,
            0.47997655902207725,
            -0.02242332377301315,
            -0.2760793042015486,
            0.4724656807743255,
            0.46561735597341336,
            1.219729644275036,
            0.9629221618854933,
            1.7207673060142037,
            1.4626886265868277,
            2.22428510417898,
            2.217317373247041,
            2.7302953154446863,
            2.7232930942446387,
            3.2388102772561433,
            3.231773395061177,
            4.0066489286931795,
            4.256984362433647,
            4.521481840890251,
            4.7730564350277005,
            5.038863176002684,
            5.291683064381103,
            5.5588055487239,
            6.088552760279997,
            6.343899164992495,
            6.877586371434563,
            6.870301465859274,
            7.6724884200720656,
            7.665149333011545,
            8.205467237751463,
            8.46590888117571,
            9.010245400332174,
            9.002815130137654,
            9.549846115063865
          ],
          [
            0,
            -0.5000000000000004,
            0.495000000000001,
            -0.007474999999990128,
            0.9924502500000099,
            0.7362194046875103,
            1.4923628787375076,
            1.2348636907407284,
            1.9947500749872615,
            1.9877979894405984,
            2.7533360286699615,
            3.5246203287369937,
            3.261965042011883,
            4.037067199364275,
            4.029975907011862,
            4.8108428866595165,
            4.803698852820237,
            5.329656558948526,
            5.583176363038089,
            6.113045879605683,
            6.909548742504379,
            6.902261658335207,
            7.438751008779865,
            7.431427853544026,
            8.237826719407625,
            8.230449098204783,
            9.042845555633194,
            9.575860379617772,
            9.5826076411337,
            10.40515363429173,
            10.397628285464577,
            10.951659144781578,
            11.218710645837726,
            11.776862109670883,
            12.323241142420226,
            12.6082025216115,
            13.173327154976477,
            13.445726027866023,
            14.015053775691655,
            14.289478615198291,
            14.863040738148348
          ],
          [
            0,
            1.0000000000000009,
            0.495000000000001,
            1.4999500000000054,
            1.2424315625000126,
            2.254855878124995,
            3.022398500025014,
            2.761017414721745,
            3.7886275888689314,
            3.7815532304608768,
            4.302381295433855,
            5.085292997009461,
            5.078130256318625,
            5.866864863674692,
            5.859648850100019,
            6.654249671098267,
            7.454814903197371,
            7.447490653027056,
            8.254010089039898,
            8.246631364758983,
            9.059149289077117,
            9.60646298716461,
            9.870276711914627,
            10.421661055631692,
            10.96141569915492,
            11.24292215973297,
            12.077930760635592,
            12.347693104665435,
            12.911510370667823,
            13.463435703498018,
            13.751289729049665,
            14.322150949311041,
            14.597314946409522,
            15.172421946996595,
            15.73539889334401,
            16.316217371948085,
            16.611308836435,
            17.18131923865198,
            17.76939407324729,
            18.34506533836191,
            18.64530394166708
          ],
          [
            0,
            1.0000000000000009,
            2.0100000000000007,
            1.7511875000000066,
            2.7686993749999944,
            3.5400989950000072,
            3.533041576601592,
            4.3101784812753285,
            5.353280266088056,
            5.346099259060799,
            6.136845288067083,
            6.93352679343926,
            6.926238074897095,
            7.728844898965459,
            8.537476228577457,
            8.530078182901523,
            9.344723708027502,
            10.165484103267985,
            10.430643345780656,
            11.259554841511953,
            11.527347422139368,
            12.08704778064571,
            12.928392534357226,
            13.200201869797713,
            13.768297453831524,
            14.339244027415443,
            14.614449166144428,
            15.474765031490278,
            16.05427551820464,
            16.33360859641204,
            17.206828769580085,
            17.488935948492212,
            18.078554558553872,
            18.67113217154226,
            19.251211243251575,
            19.8496738376549,
            20.451139818549247,
            21.039919786294693,
            21.647359020382794,
            21.95597546386199,
            22.552111253096907
          ],
          [
            0,
            1.2499999999999956,
            2.2624999999999895,
            3.285125,
            4.317976250000011,
            5.361156012499979,
            5.353974468652356,
            6.144779610342965,
            7.206227406446386,
            8.010935878830594,
            8.270909301303542,
            9.083609460009633,
            9.902409886573693,
            10.727356370660557,
            10.993867993422146,
            11.827007150706127,
            12.666399994504008,
            12.937578735489463,
            13.785307721553375,
            14.639399907907746,
            15.199771377051352,
            15.777901807209727,
            16.646950749170042,
            17.23234385374981,
            17.514512445367036,
            18.396596686932277,
            19.28530200527363,
            19.572411897996254,
            20.46994308853922,
            21.37421130332724,
            21.666349028602472,
            22.579597673162798,
            23.194763785771542,
            23.796954924497783,
            24.418230348461513,
            25.352135089842463,
            25.964871724516094,
            26.59702684604488,
            27.232354440122574,
            27.854281817948024,
            28.495918950222144
          ]
        ],
        "med": 0.1864530394166708,
        "p5": 0.09549846115063865,
        "p95": 0.28495918950222143,
        "win": 0.9997,
        "ddMed": 0.01499875934690642,
        "ddP95": 0.029772555911866228,
        "ddProb": 0,
        "seed": 202603
      },
      "p50": 27585.033166437595,
      "p95": 29875.30115592665,
      "pf10": 5,
      "pf15": 3.1666666666666665
    }
  ],
  "pageErrors": [],
  "timestamp": "2026-10-25T07:09:11.065Z"
}
```

### P7_ACCEPTANCE_TESTS.json
```json
{
  "phase": "P7",
  "passed": 9,
  "total": 9,
  "cases": [
    {
      "name": "Slow IndexedDB boot keeps UI inert until defaults and data are ready",
      "pass": true,
      "pendingProtected": true,
      "ready": true
    },
    {
      "name": "WCAG 2 A automated checks: all routes and visible source widgets",
      "pass": true,
      "routes": [
        {
          "route": "gameplan",
          "violations": []
        },
        {
          "route": "cockpit",
          "violations": []
        },
        {
          "route": "workspace",
          "violations": []
        },
        {
          "route": "calendar",
          "violations": []
        },
        {
          "route": "review",
          "violations": []
        },
        {
          "route": "chartbook",
          "violations": []
        },
        {
          "route": "overview",
          "violations": []
        },
        {
          "route": "edge",
          "violations": []
        },
        {
          "route": "drilldown",
          "violations": []
        },
        {
          "route": "discipline",
          "violations": []
        },
        {
          "route": "pnlrisk",
          "violations": []
        },
        {
          "route": "riskcapital",
          "violations": []
        },
        {
          "route": "riskedge",
          "violations": []
        },
        {
          "route": "riskopt",
          "violations": []
        },
        {
          "route": "simulation",
          "violations": []
        },
        {
          "route": "riskprop",
          "violations": []
        },
        {
          "route": "zones",
          "violations": []
        },
        {
          "route": "risktools",
          "violations": []
        },
        {
          "route": "import",
          "violations": []
        },
        {
          "route": "mapping",
          "violations": []
        },
        {
          "route": "dictionary",
          "violations": []
        }
      ]
    },
    {
      "name": "Dark theme: shared headings and gain/loss labels remain readable; light palette unchanged",
      "pass": true,
      "headingContrast": [
        {
          "route": "zones",
          "contrast": 13.399258849587758
        },
        {
          "route": "riskcapital",
          "contrast": 13.399258849587758
        },
        {
          "route": "riskedge",
          "contrast": 13.399258849587758
        },
        {
          "route": "simulation",
          "contrast": 13.399258849587758
        },
        {
          "route": "mapping",
          "contrast": 13.399258849587758
        }
      ],
      "scope": "WCAG 2 A automated; no claim of full WCAG AA certification"
    },
    {
      "name": "Responsive routing: 360, 768, 1280px, all pages, no document-level overflow",
      "pass": true,
      "widths": [
        360,
        768,
        1280
      ],
      "routes": 21
    },
    {
      "name": "Trade modal traps Tab, closes on Escape, returns focus to opener",
      "pass": true,
      "focusTrap": true,
      "escape": true,
      "returnFocus": true
    },
    {
      "name": "Settings and cashflow dialogs support keyboard focus and Escape",
      "pass": true,
      "dialogs": 2
    },
    {
      "name": "Malformed UI preferences and prototype-key payload rejected before mutation",
      "pass": true,
      "errors": [
        "Cấu hình giao diện không hợp lệ: chk",
        "Trường dữ liệu không an toàn"
      ],
      "unchanged": true,
      "polluted": false
    },
    {
      "name": "Cache cleanup keeps unrelated Classic cache and canonical user data",
      "pass": true,
      "removed": true,
      "classic": true,
      "unchanged": true
    },
    {
      "name": "Existing V6 service worker updates to retirement worker and opens new UI without losing data",
      "pass": true,
      "marker": "DO NOT LOSE",
      "caches": [
        "classic-retain"
      ],
      "registrations": 0
    }
  ],
  "pageErrors": [],
  "timestamp": "2026-10-25T07:10:16.876Z"
}
```

### S1_S10_BROWSER_TESTS.json
```json
{
  "suite": "S1-S10 browser",
  "passed": 7,
  "total": 7,
  "cases": [
    {
      "name": "Tier probability and real buffer; account changes reset defaults and custom thresholds survive reload",
      "pass": true,
      "bufferBefore": 5,
      "bufferAfter": 10,
      "prop": [
        2,
        3.5
      ],
      "personal": [
        3,
        5
      ],
      "customAfterReload": [
        4,
        6
      ]
    },
    {
      "name": "All six account enum options export; unsupported legacy preset is flagged, not relabeled FTMO",
      "pass": true,
      "accountTypes": [
        "PERSONAL",
        "FTMO",
        "THE5ERS_HYPER",
        "THE5ERS_HIGH_STAKES",
        "THE5ERS_BOOTCAMP",
        "TOPSTEP_TRAILING"
      ],
      "legacyUnsupportedNotGuessed": true
    },
    {
      "name": "Snapshot button completes real MC first; all 12 canonical fields populated, backup roundtrip exact",
      "pass": true,
      "fields": 12,
      "missing": [],
      "worker": "worker",
      "currentEquity": 11850,
      "columns": [
        "trade_id",
        "profile_id",
        "seq_no",
        "symbol",
        "side",
        "lots",
        "entry_time",
        "close_time",
        "entry_price",
        "sl_price",
        "tp_price",
        "exit_price",
        "planned_rr_ratio",
        "realized_r_multiple",
        "mae_r",
        "mfe_r",
        "slippage_r",
        "asset_class",
        "liquidity_horizon_days",
        "holding_hours",
        "strategy_id",
        "session_tag",
        "rule_adherence_tags",
        "setup_playbook",
        "discipline_tag",
        "planned_risk_usd",
        "realized_pnl_usd",
        "payload_json"
      ],
      "same": true
    },
    {
      "name": "10,000-run browser cache reload uses zero new MC Worker messages and real Chart.js",
      "pass": true,
      "runs": 10000,
      "reloadMcWorkerMessages": 0,
      "cacheHits": 1,
      "realChartJs": "4.6.1",
      "charts": 6
    },
    {
      "name": "Changing Risk Profile invalidates persisted cache on reload",
      "pass": true,
      "messages": 1,
      "misses": 1
    },
    {
      "name": "21 trading days default, monthly parameter changes result while payout remains 10 days",
      "pass": true,
      "days": 22,
      "payoutDays": 10,
      "monthly22": 21706.66666666667
    },
    {
      "name": "RoR numerical explanation and RCK semantic mapping match PDF; hard stops remain active",
      "pass": true,
      "lambda": 6.455696235812881,
      "tier3Locked": true
    }
  ],
  "pageErrors": [],
  "consoleErrors": [],
  "timestamp": "2026-10-25T07:10:34.756Z"
}
```
