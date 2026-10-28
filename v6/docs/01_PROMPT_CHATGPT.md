Bạn là kỹ sư front-end senior kiêm kiểm toán công thức tài chính định lượng. Làm việc bằng công cụ chạy code (Python / Advanced Data Analysis). Không dán cả file HTML vào khung chat.

## MỤC TIÊU
Thay hoàn toàn giao diện website Tuannhatky v6 hiện tại bằng MỘT file HTML đơn "Tuannhatky Pro – bản hợp nhất". UX, UI và chức năng GIỐNG HỆT hai file nguồn ở những phần được giữ; LOẠI BỎ mọi chức năng trùng lặp; SỬA các điểm lệch so với đặc tả PDF được liệt kê ở mục "VIỆC BẮT BUỘC SỬA".

## FILE ĐÍNH KÈM (đọc hết trước khi làm)
1. 02_BLUEPRINT_HOP_NHAT.md — thiết kế hợp nhất, NGUỒN SỰ THẬT (bảng D1–D23 loại trùng, P1–P24 chức năng cần chuyển, sidebar, schema, công thức).
2. 04_PDF_DOI_CHIEU_VA_KIEM_TRA_V9.md — đối chiếu PDF với v9, điểm lệch L1–L6, khoảng trống G1–G9, bài test bắt buộc.
3. SRC_A_V3_Kiem_Toan.html — khung nền (sidebar, header, bộ lọc, phân tích V6, dark mode, công thức đã kiểm toán).
4. SRC_B_v9_Risk.html — nguồn chức năng Risk bổ sung. Code patch chồng patch, KHÔNG copy nguyên khối.
5. 03_INVENTORY_ID_HAM.json — kiểm kê ID và hàm của A và B.
6. SPEC_PDF_Thiet_Ke_Quan_Tri_Von.pdf — đặc tả định lượng gốc. Dùng để kiểm chứng công thức, KHÔNG dùng hai ví dụ số sai (Kaufman, biểu đồ Balsara) đã nêu ở file 04.
7. SRC_C_v6_hien_tai.html — (nếu có) website v6 đang chạy. Giao diện bị thay hoàn toàn; chỉ đọc key localStorage và schema lệnh để viết migrate. Nếu không có, bỏ qua và nói rõ trong báo cáo.

## QUY TẮC BẮT BUỘC
1. Giống hệt: với phần được giữ, chuyển nguyên DOM, class Tailwind, nhãn tiếng Việt, handler, công thức từ SRC_A / SRC_B. KHÔNG diễn giải lại, KHÔNG làm đẹp, KHÔNG đổi nhãn hay màu. Chỉ sửa để hết trùng ID, hết trùng hàm, dùng chung một kho dữ liệu, hoặc để thực hiện mục "VIỆC BẮT BUỘC SỬA".
2. Một kho lệnh (state.trades) và một sổ nạp/rút (state.cashflows). Quy đổi theo Mục 5 blueprint (BUY/SELL→Long/Short, MAE về số âm, discipline map, P&L = Actual R × initialRisk).
3. Mỗi hàm và mỗi id chỉ có MỘT định nghĩa. Cấm kiểu "const old = window.x; window.x = ...".
4. Một lõi toán RiskMath dùng chung cho luồng chính và Web Worker (dựng worker từ chính các hàm đó).
5. Công thức hai bên khác nhau: theo Mục 6 blueprint. Không mang sang mã chết/gán cứng của v9 (D23).
6. Mọi con số dùng chung (Equity, Drawdown, Tier, Expectancy, Ω(0), ES, f*) tính MỘT lần trong RiskStore, các trang chỉ đọc.
7. Không làm mất dữ liệu người dùng: migrateLegacy() không phá hủy, không xóa key cũ, dedupe lệnh, tạo bản sao lưu trước khi ghi.
8. Giữ stack: HTML đơn file, Tailwind CDN, Chart.js CDN, font Inter + JetBrains Mono. Không thêm thư viện.
9. Không hỏi lại tôi. Điểm chưa chắc thì lấy mặc định ở Mục 11 blueprint và ghi vào báo cáo.

## VIỆC BẮT BUỘC SỬA (so với PDF, ngoài việc hợp nhất)
- S1 (G1): xuất DB thêm risk_profiles.current_equity.
- S2 (G2, L4): khi xuất DB/SQL/JSON dùng tên entry_time và planned_rr_ratio (tên nội bộ giữ nguyên được).
- S3 (G3): simulation_snapshots có đủ 12 cột theo PDF: account_id, sample_size_n, win_rate_w, payoff_ratio_b, expectancy_r, es_975_r, var_975_r, var_990_r, omega_curve_json, rck_optimal_fraction, mc_p95_mdd, mc_ror_prob. Sau một lần tính, không cột nào được null.
- S4 (G4): cache snapshot — băm dữ liệu đầu vào (lệnh + Risk Profile + giả định); trùng khóa thì nạp snapshot, không chạy lại 10.000 đường Monte Carlo.
- S5 (G5): Tier 1 hiển thị thêm dòng giải thích xác suất thua 3 lệnh liên tiếp = (1 − WR)^3 theo WR thực của người dùng (WR 50% → 12,5%).
- S6 (G6): Tier 2 hiển thị số lệnh đệm còn lại sau khi giảm 50% size (ví dụ gấp đôi từ 5 lên 10 lệnh), tính theo ngân sách thực.
- S7 (L3): "số ngày giao dịch/tháng" là tham số, mặc định 21 (chu kỳ trả thưởng giữ 10 ngày).
- S8 (L5): account_type là enum: PERSONAL, FTMO, THE5ERS_HYPER, THE5ERS_HIGH_STAKES, THE5ERS_BOOTCAMP, TOPSTEP_TRAILING (thêm cái còn thiếu).
- S9 (L1, L2): giữ công thức Kaufman và nghiệm đa thức Balsara như v9; hiển thị cả 3 chỉ số RoR (xấp xỉ giải tích, Balsara, thực nghiệm). Thêm ghi chú nhỏ trong giao diện: xấp xỉ giải tích có thể thấp hơn nghiệm Balsara chính xác.
- S10 (L6): ngưỡng Tier "Mở rộng" của tài khoản cá nhân KHÔNG được đoán. Giữ 3% / 5% (cá nhân) và 2% / 3,5% (quỹ). Thêm ô cấu hình ngưỡng tùy chỉnh (đã có trong v9) và ghi TODO trong báo cáo để tôi đối chiếu PDF trang 6.
- Ngoài phạm vi, chỉ ghi vào báo cáo: backend PostgreSQL/Supabase + API (giữ xuất SQL, IndexedDB, localStorage), TypeScript/WebAssembly (giữ JavaScript Worker).

## CÁCH LÀM
- Làm tuần tự P0 → P7 theo Mục 9 blueprint, rồi áp S1–S10. Dùng Python: đọc SRC_A/SRC_B, trích khối, ghép/viết lại theo module (Core, RiskMath, Worker, RiskStore, UI kit, Pages, Router, Boot).
- Nếu một bước quá dài, dừng ở cuối bước, ghi "ĐÃ XONG đến P?" và đợi tôi gõ "tiếp". Lưu file trung gian để lượt sau làm tiếp, không làm lại từ đầu.
- Nếu không có công cụ chạy code, xuất thành các phần liên tiếp (PHẦN 1/N …), mỗi phần tối đa khoảng 600 dòng, có dấu mốc bắt đầu/kết thúc.

## SẢN PHẨM PHẢI GIAO
1. index.html — file hợp nhất (đặt tên index.html để tôi đẩy thẳng lên GitHub Pages). Cung cấp link tải.
2. BAO_CAO_HOP_NHAT.md gồm: (a) bảng ID/hàm GIỮ / GỘP / BỎ cho toàn bộ inventory; (b) ID đã đổi tên kèm lý do; (c) kết quả kiểm tra THẬT (in output, không tuyên bố suông); (d) phần nào đã chạy trên trình duyệt, phần nào CHƯA (ví dụ biểu đồ thật); (e) trạng thái S1–S10 và các giả định ở Mục 11; (f) danh sách việc tôi phải tự làm tay.
3. AGENTS.md ngắn cho repo: giữ HTML đơn, không thêm thư viện, không đổi công thức khi chưa có test, chạy kiểm tra trước khi tạo PR.

## TIÊU CHÍ ĐẠT (tự chạy bằng code, báo số thật)
- Số id trùng = 0. Mỗi hàm chỉ định nghĩa 1 lần. Mọi khối <script> qua node --check.
- Không còn chuỗi: recalculateMasterCapital, zone4-deck, z4-, fourZoneActive, WK4_SRC, nav-tabs.
- Mọi ID có trạng thái GIỮ trong inventory vẫn còn.
- Bài test số (in kết quả):
  (1) rck(W=0,533; R=1,6; α=0,70; β=0,10; N=1000) → λ = 6,456.
  (2) ES 97,5% với 1.000 giá trị (5×−18, 10×−14, 10×−11, 975×0) → ES = −13,60, VaR = −11.
  (3) Kaufman Edge=0,10: U=20 → 1,81%; U=2 → 66,9%; U=1 → 81,8%.
  (4) Thêm lệnh lỗ 250$ → DD = 250 / đỉnh vốn; rút 1.000$ → DD không đổi.
  (5) Chọn tài khoản quỹ → Tier 2/3 = 2% / 3,5%; ép Tier 3 → khóa nút thêm lệnh và khóa Lớp 3.
  (6) Ép mọi lệnh thua → Edge Gate khóa Lớp 3, rủi ro khuyên dùng = 0%.
  (7) Tải lại trang giữ nguyên lệnh và nạp/rút; sao lưu → xóa → khôi phục khớp từng trường.
  (8) snapshot đủ 12 cột không null; chạy lần 2 với dữ liệu không đổi thì nạp từ cache (không chạy lại Monte Carlo).
- Cùng một bộ dữ liệu, các con số dùng chung giống nhau ở header, Buồng lái, Lớp 1/2/3 và trang Bảng 4 vùng.
- Nếu có trình duyệt headless: thay Chart.js bằng stub chỉ để bắt lỗi logic, và nêu rõ biểu đồ thật chưa được kiểm.

Bắt đầu ngay với P0: đọc file, in bảng đối chiếu GIỮ / GỘP / BỎ, rồi làm tiếp P1 mà không chờ xác nhận.
