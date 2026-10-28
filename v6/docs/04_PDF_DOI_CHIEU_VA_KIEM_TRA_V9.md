# 04 — Đối chiếu PDF "Thiết Kế Quản Trị Vốn" với v9 và kết quả chạy thử

## 1. Kết quả chạy thử file v9 (bản `_1`)
Bản `_1` **giống hệt byte-by-byte** bản v9 trước đó (275.872 byte, 3.982 dòng, 0 dòng khác).

Chạy trong Chromium headless (Chart.js và Tailwind thay bằng stub vì không có mạng, nên **chưa kiểm được phần vẽ biểu đồ thật**):

| Kiểm tra | Kết quả |
|---|---|
| `node --check` 6 khối `<script>` | Đạt |
| ID tĩnh trùng | 0 / 98 |
| Lỗi console/pageerror khi tải, đổi 5 tab, bật/tắt bố cục Four-Zone | 0 |
| Thêm 1 lệnh qua modal | 15 → 16 lệnh, Equity $23.250 → $23.000, DD −1,08% (đúng 250/23.250) |
| Rút vốn $1.000 | Equity → $22.000, **DD không đổi −1,08%** |
| Tải lại trang | Giữ đủ 16 lệnh, 4 dòng nạp/rút, Equity $22.000 |
| Ép Tier 3 | Header "TIER 3 (HARD STOP)", nút thêm lệnh khóa, Lớp 3 bị khóa và rủi ro khuyên dùng = 0% |
| Chọn tài khoản Prop | Ngưỡng Tier tự đổi 2% / 3,5% (đúng PDF); cá nhân 3% / 5% |
| Monte Carlo 10.000 đường × 30 lệnh | Chạy được, 326 ms trong môi trường test (PDF đặt mục tiêu < 150 ms; đây không phải máy thật nên không kết luận) |

**Kết luận về độ ổn định:** v9 chạy ổn định về chức năng. Nhưng **chưa sạch về cấu trúc**: vẫn là patch chồng patch (22 hàm định nghĩa lại/bọc ghi đè, mã chết ở dòng 1082, 1550, 1638, 1640). Vì vậy việc hợp nhất theo blueprint vẫn cần.

**Đính chính blueprint trước đó:** hàm vốn/drawdown **bản cuối** của v9 (dòng 1812) đã dùng đỉnh chạy và co đỉnh theo tỷ lệ khi rút vốn, nên hành vi đúng. Chỉ bản gốc dòng 1082 là sai và đã bị ghi đè. Do đó "công thức vốn v9 kém V3" là nhận định quá tay; hai bên tương đương, chọn `capitalNAV()` của A chỉ để có **một** bản duy nhất.

## 2. Đối chiếu công thức v9 với PDF (đã chạy bằng code trích từ chính file v9)

| Mục PDF | Kết quả v9 | Kết luận |
|---|---|---|
| λ = log β / log α với α=0,70, β=0,10 | 6,456 (PDF: 6,46) | Khớp |
| Xác suất chia đôi vốn (0,5^λ) | 1,1% theo công thức | Khớp |
| ES 97,5% ví dụ 1.000 kịch bản (5×18, 10×14, 10×11) | ES = 13,60; VaR = 11 | Khớp |
| η = min(0,25; 1/√N) khi N < 100 | Có (N=50 → η=0,141) | Khớp |
| Daily Loss Budget = min(Equity×f_tier×hệ số, DLL/k) | Có ở dòng 1823 | Khớp |
| Tier cá nhân 3%/5%, Prop 2%/3,5% | Có | Khớp |
| Omega 100 điểm L từ P10–P90, điểm Ω(μ)=1 | Có (lưới phân vị 10–90) | Khớp |
| Bộ đếm vi phạm VaR 97,5% / 99% | Có | Khớp |
| Hệ số thanh khoản √(LH/LH_base) | Có | Khớp |
| Prop Firm: Median ROI, chu kỳ hoàn phí, static vs trailing, 1-2-3 giai đoạn | Có | Khớp |
| Bộ chẩn đoán 15 lệnh, khóa nút lưu kế hoạch ở Tier 3, A-Setup, cờ "Setup Rủi Ro Đuôi Cao" | Có | Khớp |
| Sharpe, Sortino, STARR, Rachev, PF, BE-WR, Planned vs Actual R | Có | Khớp |

## 3. Điểm lệch cần xử lý khi hợp nhất

| # | Vấn đề | Quyết định |
|---|---|---|
| L1 | **Ví dụ Kaufman trong PDF sai nội bộ.** PDF định nghĩa Edge = W−L = 0,10 (cơ số (1−E)/(1+E) = 0,818) nhưng lại tính bằng cơ số 0,290 (tương ứng E = 0,55). Theo đúng công thức: U=20 → 1,81%; U=2 → 66,9%; U=1 → 81,8%. PDF ghi 1,8×10⁻⁹%, 8,4%, 29,0% | **Giữ công thức**. Không dùng số PDF làm kết quả kỳ vọng khi test. Ghi chú trong báo cáo |
| L2 | **Biểu đồ Balsara trong PDF dùng xấp xỉ** ((1−A)/(1+A))^U với A=0,125 (cho 8,1% tại rủi ro 10%), không phải nghiệm đa thức. Nghiệm đa thức đúng của v9 (W=45%, b=1,5, sàn 100%) cho ≈19,2% tại 10% | **Giữ nghiệm đa thức**. Hiển thị đủ 3 chỉ số như PDF yêu cầu: xấp xỉ giải tích, nghiệm Balsara, thực nghiệm Monte Carlo |
| L3 | Lợi nhuận tháng lý thuyết: PDF dùng 21 ngày giao dịch, v9 dùng 20 ngày (2 chu kỳ × 10 ngày) | Đưa "số ngày giao dịch/tháng" thành tham số, **mặc định 21**; chu kỳ trả thưởng giữ 10 ngày |
| L4 | Tên trường DB: PDF `planned_rr_ratio`, v9 `planned_rr` | Đổi theo PDF khi xuất SQL/JSON (`planned_rr_ratio`); tên nội bộ giữ nguyên |
| L5 | `account_type` PDF: PERSONAL, FTMO, THE5ERS_HYPER, THE5ERS_HIGH_STAKES, THE5ERS_BOOTCAMP, TOPSTEP_TRAILING | Dùng đúng tập giá trị này làm enum của Risk Profile (kiểm tra v9 đã đủ chưa, thiếu thì thêm) |
| L6 | Văn bản bảng Tier 1/Tier 2/Tier 3 trong PDF bị mất số khi trích (cột "Chuẩn/Mở rộng" cá nhân) | **Không suy đoán.** Giữ ngưỡng đã thấy rõ (3%/5% cá nhân, 2%/3,5% quỹ) và nhờ người dùng mở PDF trang 6 đối chiếu số "Mở rộng" |

## 4. Quy định cho trang `zones` (Bảng 4 vùng) theo PDF
Giữ đúng bố cục Command Center của PDF, nhưng chỉ là **thẻ tóm tắt đọc từ `RiskStore`**:
- **Zone 1 (banner trên):** đồng hồ Drawdown so với Tier 1/2/3, thanh Daily Loss Budget (đơn vị $ và số R còn lại), thẻ cảnh báo Risk of Ruin. Tier 2 → giao diện chuyển hổ phách, ô lot mặc định giảm 50%, mở Chẩn đoán 15 lệnh. Tier 3 → nút "Lưu Kế Hoạch Lệnh" khóa đỏ.
- **Zone 2 (trái, Lớp 2):** đường cong Omega có thanh trượt L; phân phối đuôi P&L với vạch VaR 97,5% và vùng ES; thẻ điểm Sharpe/Sortino/PF/Planned vs Actual R; cờ "Setup Rủi Ro Đuôi Cao" khi Ω(0) < 1 hoặc khoảng ES−VaR quá rộng.
- **Zone 3 (phải, Lớp 3):** 2 thanh trượt (mức sụt giảm tối đa chấp nhận 1−α, xác suất tối đa β), bảng 4 cột Full / Half / Quarter Kelly / Stanford RCK, họ đường cong xác suất drawdown α^λ, nối với Position Size Calculator.
- **Zone 4 (dưới, toàn chiều rộng):** Fan Chart P5–P95, Heatmap RoR (Toàn cảnh / Phóng đại), thẻ Prop Firm ROI (Pass %, Blowout %, Median Take-Home, Break-Even Payout Cycles), công tắc Stress Testing.

Mỗi vùng chỉ hiển thị **một** bản của biểu đồ; trang đầy đủ của từng lớp mới là nơi vẽ biểu đồ lớn (đúng D15 trong blueprint).

## 5. Bài test bắt buộc bổ sung (ChatGPT phải chạy và in kết quả thật)
1. `rck(W=0,533; R=1,6; α=0,70; β=0,10; N=1000)` → λ = 6,456.
2. ES 97,5% với mảng 1.000 giá trị (5×−18, 10×−14, 10×−11, 975×0) → ES = −13,60, VaR = −11.
3. Kaufman với Edge = 0,10: U=20 → 1,81%; U=2 → 66,9%; U=1 → 81,8%.
4. Thêm lệnh lỗ 250$ → DD = 250 / đỉnh vốn; rút 1.000$ → DD **không đổi**.
5. Chọn Prop → Tier 2/3 = 2% / 3,5%; Ép Tier 3 → khóa nút thêm lệnh, khóa Lớp 3.
6. Tải lại trang giữ nguyên lệnh và nạp/rút.
Nếu có môi trường chạy trình duyệt, thay Chart.js bằng stub chỉ để bắt lỗi logic, và nêu rõ biểu đồ thật **chưa** được kiểm.

---

## 6. Độ phủ PDF của v9 — các chỗ CHƯA đủ (bổ sung sau khi quét sâu)

| # | PDF yêu cầu | v9 hiện có | Việc phải làm khi hợp nhất |
|---|---|---|---|
| G1 | `risk_profiles.current_equity` | Không thấy trường này (chỉ có các trường còn lại) | Thêm `current_equity` vào xuất DB/SQL |
| G2 | `trades_journal.entry_time`, `planned_rr_ratio` | Đặt tên `open_time`, `planned_rr` | Đổi tên khi xuất (giữ tên nội bộ) |
| G3 | `simulation_snapshots`: `account_id`, `sample_size_n`, `rck_optimal_fraction` | Đặt `profile_id`, `trades_count`, `rck_optimal_pct`; nhiều cột (`win_rate_w`, `payoff_ratio_b`, `es_975_r`, `var_975_r`, `var_990_r`, `omega_curve_json`, `mc_p95_mdd`, `mc_ror_prob`) phụ thuộc `snapshotQuant()` có điền hay không | Chuẩn hóa đủ 12 cột theo PDF; test: sau 1 lần chạy, không cột nào `null` |
| G4 | Snapshot dùng để tải Dashboard nhanh, **không chạy lại 10.000 kịch bản** khi dữ liệu đầu vào không đổi | Có lưu snapshot (tối đa 20) nhưng **không thấy logic dùng cache để bỏ qua mô phỏng** | Thêm khóa băm dữ liệu đầu vào; trùng khóa thì nạp snapshot |
| G5 | Giải thích Tier 1: xác suất thua 3 lệnh liên tiếp ≈ 12,5% (WR 50%) | Chỉ có câu "Biến động bình thường…" | Thêm dòng giải thích, tính theo WR thực của người dùng |
| G6 | Tier 2: tăng số lệnh đệm 5 → 10 lệnh trước Tier 3 | Có giảm 50% size và chẩn đoán 15 lệnh; chưa xác nhận có hiển thị "số lệnh đệm" | Hiển thị số lệnh đệm còn lại theo ngân sách sau khi giảm size |
| G7 | Backend PostgreSQL/Supabase + API | Không có (file HTML đơn). Chỉ có xuất SQL + IndexedDB + localStorage | **Ngoài phạm vi** bản HTML đơn. Giữ xuất SQL/JSON; ghi rõ trong báo cáo |
| G8 | TypeScript/WebAssembly | JavaScript thuần trong Web Worker | Chấp nhận (cùng hành vi) |
| G9 | Bisection 25–30 vòng | v9 dùng 100 vòng | Chấp nhận, không ảnh hưởng kết quả |

**Chưa kiểm được bằng số (mới xác nhận có mã):** độ chính xác của Stressed ES (cửa sổ trượt), đường cong Omega với L = Target_Prop, phát hiện vỡ tài khoản giữa đường (daily limit + trailing DD) trong Monte Carlo, các số Prop Firm ROI, và toàn bộ phần vẽ biểu đồ. ChatGPT phải viết test số cho các mục này, in kết quả thật.
