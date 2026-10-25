# BÁO CÁO HỢP NHẤT — bản cuối P0–P7

Ngày: 2026-10-25. Sản phẩm: `Tuannhatky_Pro_HopNhat.html` / mã GitHub `v6/index.html`. SHA-256: `d5f4ed1058cc1c000d8abd948fbfbd8e357cc9a3fd86d8504e1ca64dd81a79e4`. File 403,677 byte, 2781 dòng. A gốc 265.621 byte/2.321 dòng; B gốc 275.872 byte/3.983 dòng.

Đã thực hiện tuần tự P0–P7. 121/121 kiểm tra chức năng/giao diện bản hợp nhất đạt; 118/118 kiểm tra Classic và 22/22 kiểm tra backend đạt. Bản HTML đơn dùng Tailwind CDN, Chart.js CDN, Inter và JetBrains Mono, không thêm thư viện ứng dụng. Thư viện trong devDependencies chỉ phục vụ kiểm thử.

## Phạm vi và giới hạn thực tế

- Giữ phần A theo DOM/class/nhãn gốc trong phạm vi giữ; gộp các điều khiển Risk trùng và B độc nhất đúng blueprint. Giữ thiết kế sáng; sửa override dark để đọc được, bổ sung nhãn truy cập, focus, menu và layout ở 768px. Có liên kết thật tới `/classic`.
- Classic, `/legacy`, API, D1/R2 và backend hiện có được giữ. 209 tệp V6 cũ được bỏ khỏi nhánh nguồn/build; lịch sử vẫn truy xuất trong Git. Thư mục build được làm sạch để không đóng gói asset React cũ. Hai fixture golden của Classic vẫn giữ để chạy đối chiếu độc lập.
- Một `state.trades`, một `state.cashflows`, một RiskMath, Worker sinh từ các phương thức đó, một RiskStore tính số liệu chung. Mọi trang đọc snapshot chung. Mã wrapper patch và mã chết/gán cứng D23 không được mang sang.
- **Không có SRC_C.** Không đoán key hay schema production cũ. Migrate hỗ trợ key/file A/B đã biết và không xóa các key cũ. Không tuyên bố dữ liệu production V6 cũ đã được tự chuyển. Mẫu mặc định là A theo §11.
- **IndexedDB chưa phải cloud.** Đây là bản phản chiếu cùng origin/thiết bị, có thể mất cùng localStorage khi xóa dữ liệu trang. Có sao lưu JSON, archive trước khôi phục và file SQL ba bảng; SQL CHƯA chạy trên PostgreSQL/Supabase, chưa nối cloud cho kho hợp nhất và không cam kết lưu vĩnh viễn. Backend cloud Classic vẫn giữ nguyên.
- Giữ `pnlrisk` Classic vs V6 và mapping simulator A; mapping là minh họa, không phải đồng bộ hai chiều với dữ liệu Classic thật.

## Quyết định công thức và dữ liệu

Vốn/NAV/DD theo A: chạy theo thời gian, phát hành/thu hồi đơn vị khi nạp/rút, nên cashflow không tự thay DD. Tier/override và trần ngày cùng Risk Profile; ngân sách min(Equity × fTier × hệ số Tier, hạn mức/ngưỡng k). Lỗ floating được cộng riêng, không để lãi vị thế khác che lỗ. Dừng tạo lệnh mới không cản sửa/nhập lịch sử.

R chỉ đủ chuẩn khi initialRisk > 0, không estimated và hữu hạn; thiếu phí không bịa Gross R. BUY/SELL→Long/Short, MAE âm, discipline chuẩn hóa. P&L suy ra từ Actual R × initialRisk khi bật tính từ giá/nhập R; P&L thủ công A được giữ. `realizedR` khi sửa tại dòng không làm tròn trước khi lưu. Trượt giá MANUAL tự động = 0; SL/TP tính theo độ lệch giá và nhập tay A vẫn ghi đè.

ES/VaR dùng trọng số phân đoạn B, giữ dấu lợi suất và cảnh báo N<40. ES lệnh đơn khác ES gộp/stressed; cả hai đều có đơn vị/chân trời rõ ràng. LH có trọng số 1R xác minh, không gán $250 giả. RCK dùng solver A, haircut B trong cùng solver; mặc định f* = min các trần sau kiểm chứng MC/RoR, cổng Safety∧Edge∧N≥30. UI giả lập không tự mở đề xuất thực tế. MAE/MFE không biết thứ tự chạm TP/SL: What-if hiển thị cận, không bịa WR/PF/trailing chính xác.

MC có một lõi seeded bootstrap/hoán vị; revenge theo A mở rộng (sau lỗ, xác suất 25% lệnh sau nhận thêm −0,5R). Stress có một trang/phân đoạn với chuỗi 10–15, WR giảm 5–10 điểm %, payoff giảm 20–30%, tail25Mode và khóa cổng. Sizer một bản, hợp 20 sản phẩm, A thắng xung đột (US30 step 0,1), floor theo bước lượng và ngân sách; USDJPY cần point value chuyển đổi thật.

Prop dùng sàn trailing và daily floor A: max(1−ml,peak−ml), dayStart×(1−dl), chạm ngưỡng là vi phạm. Tính lượt đầu độc lập RNG funded/retry: bộ oracle 1.000 lượt cho 623/377 Static, 621/379 Trailing, khớp A. Giữ 1–3 giai đoạn, phí kích hoạt, chu kỳ payout, tuyến tính/lãi kép của B. EV một lượt dùng cùng population (phí thi + P(pass) × phí kích hoạt); chi phí/ROI chiến dịch retry tối đa 10 lượt tách riêng. Chỉ trả ở chu kỳ hoàn tất, mang lỗ qua chu kỳ, chỉ trả phần vượt vốn gốc theo split; rút tiền điều chỉnh đỉnh/ngày theo tỷ lệ để không tạo DD giả. Funded mặc định 60 lệnh; lợi nhuận tháng lý thuyết giả định 20 ngày. Phí 0 ⇒ ROI chưa xác định, không hiển thị 0% giả. Preset quỹ là tham số nguồn minh họa, chưa xác minh điều khoản hiện hành.

Migrate/restore không phá hủy: preview kiểm tra trước khi ghi; dedupe date|symbol|side|netPnl, ID va chạm khác giao dịch được đổi hậu tố, không ghi đè lệnh cũ. Không dựng giá từ 1% entry và không tự gán rủi ro mặc định. Thiếu dữ liệu tiền có thể suy ra thì báo từng dòng. Khôi phục UI tạo JSON bản trước và IndexedDB archive trước khi thay. JSON Schema có metadata/payload gốc để roundtrip mọi trường, kể cả notes, cashflows và snapshot cũ trùng ID. SQL có schema riêng, khóa ghép user/profile, RLS và yêu cầu UUID chủ sở hữu; không tự xóa hàng cloud khác.

Worker cache theo payload, coalesce và loại kết quả stale; fingerprint kiểm chứng chỉ phụ thuộc dữ liệu/tham số liên quan. Feedback Tier chỉ lấy MC đúng mức khuyên dùng đã kiểm chứng; phải bấm áp dụng, tài khoản Prop khóa nút. Boot chờ dữ liệu/default UI sẵn sàng, có thử IndexedDB chậm. Worker/cache V6 cũ được retire riêng; không xóa localStorage, IndexedDB hay cache Classic.

## Kiểm tra đã chạy và chưa chạy

Đã chạy Node cho từng script, Acorn, quét ID trong DOM và chuỗi HTML, regex tên hàm, kiểm tra các chuỗi cấm; khóa B chỉ xuất hiện một lần trong migrateLegacy. Đã chạy Chromium thật với CSP giống Worker production: 21 routes, dữ liệu A/B, modal thêm/sửa, cashflows, Net/Gross, R/$/%/Pips, các bộ lọc, Review, Chartbook, import/dedupe, preset, Worker, MC/Prop/stress/sizer, cache-stale, khôi phục file thật và IndexedDB rollback. Cùng dữ liệu: Equity/DD/Tier/Expectancy/SQN/Ω/ES/f* dùng chung và đối chiếu các trang. Có thử nâng từ service worker cũ và giữ marker dữ liệu/cache Classic.

Đã chạy axe tự động các rule WCAG 2 A trên 21 routes: 0 vi phạm; thử bàn phím Tab/Escape/return-focus và viewport 360/768/1280, không tràn trang. Heading dark có tỷ lệ tương phản ~13,40. Đây không phải chứng nhận WCAG AA toàn diện; chưa kiểm thử trình đọc màn hình thủ công, Safari/Firefox, điều khoản quỹ hiện hành, SQL trên server thật hay độ bền lưu trữ qua 30 năm. Không kiểm thử bằng cách xóa kho production thật.

Root typecheck đạt. Test Classic lúc đầu có một timeout Miniflare 5 giây khi máy chạy nhiều việc; chạy lại toàn bộ 1 worker/timeout 15 giây đạt 118/118. Không đổi công thức hay test kỳ vọng để vượt lỗi. Backend Node 22/22 đạt. Bundle backend có cảnh báo kích thước chunk hiện có, build thành công.

## Mặc định §11

Giữ pnlrisk/mapping; mẫu A (B nạp được trong Cài đặt); safeTierMax=1; key `tuannhatky_pro_unified_v1`; không yêu cầu offline, giữ CDN. Không hỏi lại các mục này. Các giả định payout/retry/LH/thiếu giá bổ sung được ghi ở trên.

## Inventory đầy đủ — 701 mục

Trạng thái cuối: 406 GIỮ, 256 GỘP, 39 BỎ. Một số GIỮ quá rộng tại P0 được chỉnh thành GỘP theo các quyết định D cụ thể; không dựng ID/hàm rỗng. Tên hàm chuyển vào namespace RiskMath/Core hoặc renderer chung được ghi đúng đích dưới đây.

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

## ID đổi tên/hợp nhất và lý do

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

## Output kiểm tra thực tế

### Static
```json
{
  "phase": "P7",
  "duplicateStaticIds": {},
  "duplicateLiteralHtmlIdsAcrossStaticAndScripts": {},
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
  "legacyKeyOccurrences": 1,
  "legacyKeyOutsideMigration": 0,
  "bytes": 403677,
  "lines": 2781
}
```

### Đối chiếu
```json
{
  "inventoryRows": 701,
  "inventoryCounts": {
    "GIỮ": 406,
    "GỘP": 256,
    "BỎ": 39
  },
  "missingRetainedIds": [],
  "unresolvedRetainedFunctions": []
}
```

### Classic/backend
```json
{
  "typecheckExitCode": 0,
  "classicUnitTests": {
    "passed": 118,
    "total": 118
  },
  "backendNodeTests": {
    "passed": 22,
    "total": 22,
    "exitCode": 0
  },
  "note": "Lần đầu một test Miniflare quá timeout 5 giây khi chạy đồng thời; chạy lại toàn bộ với maxWorkers=1, timeout 15 giây: 118/118 đạt."
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
        "rckRobust": 0.2312196072635187,
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
        "rckRobust": 0.1887780599390037,
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
      "rckRobust": 0.2312196072635187,
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
      "rckRobust": 0.1887780599390037,
      "fStar": 0,
      "gate": false
    }
  ],
  "timestamp": "2026-10-25T06:27:57.490Z"
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
  "timestamp": "2026-10-25T06:27:59.203Z"
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
        "theoMonthlyProfit": 13714.285714285717,
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
        "theoMonthlyProfit": 13714.285714285717,
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
  "timestamp": "2026-10-25T06:28:02.658Z"
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
      "bytes": 34405,
      "databaseExecution": "NOT RUN"
    },
    {
      "name": "Malformed schema or rows rejected before restore, with current ledger unchanged",
      "pass": true
    }
  ],
  "timestamp": "2026-10-25T06:28:03.566Z"
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
  "timestamp": "2026-10-25T06:23:52.916Z"
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
  "timestamp": "2026-10-25T06:21:47.449Z"
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
  "timestamp": "2026-10-25T06:22:10.683Z"
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
      "snapshotId": "386ca112-b739-4afd-997f-cc7e4e7d81ff",
      "verifiedR": 16
    },
    {
      "name": "JSON schema and SQL download contain full state; SQL escaped and ownership explicitly required",
      "pass": true,
      "jsonTrades": 17,
      "sqlBytes": 59630,
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
  "timestamp": "2026-10-25T06:22:21.015Z"
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
  "timestamp": "2026-10-25T06:22:25.973Z"
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
  "timestamp": "2026-10-25T06:23:26.209Z"
}
```

## Xuất bản P7 — phiên bản 17

- Web: https://tuannhatky.fabledcoot2.chatgpt.site/v6/
- Native source commit: `909035e4d091cf59869db814a8b0d3109e404b56`.
- Deployment `appgdep_6adda1dfa3b881919f3f90715e3a0a16`: `succeeded`, phiên bản 17, 2026-10-25T06:30:18Z.
- Kiểm tra trực tiếp web: HTTP 200; nhận diện 21 route, boot sẵn sàng, 15 lệnh mẫu A; RoR chạy trong Worker thật; /classic và /legacy HTTP 200; pageErrors=0, consoleErrors=0.
- Cloudflare chèn thêm một script challenge vào HTML công khai. Sau khi bỏ đúng script này để đối chiếu, SHA-256 khớp file nguồn `d5f4ed1058cc1c000d8abd948fbfbd8e357cc9a3fd86d8504e1ca64dd81a79e4`. Không coi khác biệt do hạ tầng là thay đổi mã ứng dụng.
- GitHub dùng nhánh `fix/audit-missing-net`, PR https://github.com/Tuand2222/code-tuan-trading/pull/9. Không merge `main`: CONTRIBUTING.md §Code Review & Merge yêu cầu “Đợi ít nhất 1 approval” và cấm commit trực tiếp main. Bản web đã xuất bản qua kho nguồn Sites riêng.

Output nghiệm thu production thực tế:
```json
{
  "pass": true,
  "url": "https://tuannhatky.fabledcoot2.chatgpt.site/v6/",
  "status": 200,
  "responseSha256": "96a983599b6cbd22a1ad15da37c8640810b8aaebc6377a894041bedc63dd4d29",
  "sourceSha256": "d5f4ed1058cc1c000d8abd948fbfbd8e357cc9a3fd86d8504e1ca64dd81a79e4",
  "htmlIdentical": false,
  "identicalAfterRemovingCloudflareScript": true,
  "cloudflareScripts": 1,
  "initial": {
    "title": "Giao dịch và bộ lọc – Tuan Trader V6",
    "trades": 15,
    "routes": [
      "gameplan",
      "cockpit",
      "workspace",
      "calendar",
      "review",
      "chartbook",
      "overview",
      "edge",
      "drilldown",
      "discipline",
      "pnlrisk",
      "riskcapital",
      "riskedge",
      "riskopt",
      "simulation",
      "riskprop",
      "zones",
      "risktools",
      "import",
      "mapping",
      "dictionary"
    ],
    "header": "$11,850.00",
    "classicHref": "/classic",
    "workerAvailable": true,
    "ready": "true"
  },
  "worker": {
    "execution": "worker",
    "result": "0.00%"
  },
  "legacy": [
    {
      "path": "/classic",
      "status": 200,
      "bytes": 48876
    },
    {
      "path": "/legacy",
      "status": 200,
      "bytes": 31623
    }
  ],
  "pageErrors": [],
  "consoleErrors": [],
  "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "timestamp": "2026-10-25T06:32:09.918Z"
}
```
