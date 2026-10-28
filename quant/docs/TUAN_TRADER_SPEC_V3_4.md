# TUAN TRADER — ĐẶC TẢ KỸ THUẬT v3.4

Ngày thực thi: 28/10/2026. Mã tham chiếu: `tuan_trader_v3_4.py`.
Phạm vi bàn giao: Python tham chiếu, đặc tả đầy đủ, pytest, CHANGELOG và báo cáo kiểm chứng.
Các yêu cầu giao diện Classic/V6 trong Mục 13–14 là kiến trúc đích; gói này không tuyên bố đã triển khai giao diện hay đưa lên website.

## Mở đầu: Thứ tự ưu tiên nguồn và trạng thái kiểm chứng

1. Yêu cầu trực tiếp kèm tệp đã chốt D1–D5 và Q1–Q4. Áp dụng các quyết định đó trước nội dung lịch sử.
2. Hai tệp đầu vào đọc toàn bộ: `original_v3.4.py` và `original_v3.4.md`, được lưu nguyên byte ngoài bộ 5 tệp bàn giao. Hash thực tính có trong báo cáo.
3. Không có mã engine gốc, bộ chạy `run_125_vectors.py`, các PDF hay DOCX lịch sử trong gói yêu cầu hiện tại. Mọi số liệu về những tệp đó là **[LỊCH SỬ — CHƯA TÁI KIỂM]**. Không dùng các đoạn hash rút gọn hoặc số dòng tự khai để xác nhận nguồn.
4. Bộ kiểm thử hiện tại dựng 125 vector từ nội dung đặc tả theo đúng 13 số lượng nhóm, công khai từng input, kỳ vọng và nguồn ở Mục 15. Không khẳng định đây là đúng 125 vector của bộ chạy lịch sử không được cung cấp.
5. `[LỊCH SỬ — CHƯA TÁI KIỂM]` chỉ dùng cho kết quả trong log hiện tại. `[TOÁN]` chỉ nguồn kỳ vọng độc lập. `[GIẢ ĐỊNH]`, `[CẦN XÁC MINH]` và `[ĐỀ XUẤT]` không biến thành quy tắc chính thức của quỹ.
6. Q1: DD_R có mốc 0; Q2: giữ cả `entry_avg` và `entry_avg_closed`; Q3: ô rỗng trả None; Q4: giữ bộ số Topstep 55% / Standard không Consistency / Consistency 40%, với phạm vi xác minh thực tế tại Mục 12.2.
7. Không đổi công thức để làm xanh kiểm thử. Công thức có nghi vấn được phân tích riêng trong CHANGELOG, chưa tự áp dụng đề xuất.

## Mục 0. Hướng dẫn cho người cài đặt (Lập trình viên / AI Agent)

1. Bạn cài đặt các thay đổi trong đặc tả này vào codebase Tuan Trader hiện có (hai giao diện **Classic** và **V6**). Bảo toàn tech stack và quy ước đặt tên sẵn có, ánh xạ các interface kiểu TypeScript và hàm tham chiếu trong `tuan_trader_v3_4.py` sang cấu trúc thật của dự án.
2. Thực hiện tuần tự theo lộ trình **P0 → P3** tại Mục 16. Mỗi bước triển khai phải đi kèm kiểm thử tự động.
3. **Không tự ý thay đổi công thức.** Nếu nghi ngờ công thức có vấn đề, phải báo cáo kèm chứng minh và chờ xác nhận. Riêng 19 lỗi đã được chứng minh ở Mục 2.2 và 4 quyết định nghiệm thu Q1–Q4 thì áp dụng trực tiếp theo bản v3.4 này.
4. **Bắt buộc dùng `Decimal(prec = 40)` (hoặc số nguyên scaled) cho tiền, giá, khối lượng, drawdown và ghép FIFO.** Chỉ dùng `float` cho các chỉ số thống kê không thứ nguyên (`R`, Kelly, Monte Carlo) và nơi chuyển đổi phải tường minh. Ví dụ: trong `float` nhị phân, `1.0850 − 1.0830 = 0.00200000000000000178` làm lệnh EURUSD bị làm tròn xuống `0,49` lot thay vì `0,50` lot.
5. **Không bao giờ trả `0`, `NaN` hay giá trị mặc định âm thầm khi thiếu dữ liệu.** Bắt buộc trả trạng thái tường minh (`needs_confirm`, `error`, `null + reason`). Ô trống ở trường số bắt buộc không bao giờ được tự biến thành `0` (xem quyết định Q3 tại Mục 9.3).
6. **Không bao giờ chặn nhập liệu vì lý do rủi ro** (Mục 4.1).
7. **Quy ước đơn vị thống nhất:** `risk_pct` là **phần trăm** (`1 = 1%`). Tỷ lệ phí và thuế (`fee_buy_rate`, `fee_sell_rate`, `tax_sell_rate`) là **phân số** (`0,0015 = 0,15%`); mọi giá trị `> 0,05` bị chặn ngay là lỗi nhập nhầm đơn vị.
8. **Biên JSON API:** Không được serialize `Infinity` hoặc `NaN` ra JSON (`JSON.stringify` sẽ biến thành `null`). Phải bọc qua cấu trúc `{ value: null, status: 'infinite_no_losses', display: '∞' }`; chỉ tầng UI mới hiển thị ký hiệu `∞`.
9. Các mục ghi **`[GIẢ ĐỊNH]`** hoặc **`[CẦN XÁC MINH]`** phải nằm trong file cấu hình, có trường `lastVerified`.
10. Chạy toàn bộ **125 Test Vectors tại Mục 15** và báo cáo đạt/sai theo từng ca trước khi đóng việc.
11. Không triển khai (deploy) lên dữ liệu thật của người dùng trước khi có cơ chế sao lưu (backup), chạy thử chuyển đổi dữ liệu (dry-run migration) và kịch bản hoàn tác (rollback).


12. **D1:** `PhaseRule.profit_target_pct: Optional[float]`; hai phase XFA đặt `None`. `simulate_path` và `prop_pass_probability` trả `status='error', reason='phase_khong_co_muc_tieu'`; phase funded dùng `simulate_funded_phase`.
13. **D2:** Hậu tố `_pct` = phần trăm (`1 = 1%`); `_frac` / `_rate` = phân số (`0.04 = 4%`). `eod_floor_series(b0, l_frac, closes, lock_at_initial)`; keyword cũ `l_pct` giữ ngữ nghĩa phân số và phát `DeprecationWarning`. Truyền cả hai trả lỗi.
14. **D3:** `DL_START = DL_FIXED` là bí danh tương thích, không phải định nghĩa độc lập. **[CẦN XÁC MINH định nghĩa chính thức]**.
15. **D4:** Các tuyên bố kết quả lịch sử thiếu tệp chứng cứ dùng nhãn lịch sử. Không mượn kết quả lịch sử để đóng nghiệm thu hiện tại.
16. **D5:** Mọi preset mặc định `verified=False`, `last_verified=None` vì chỉ đối chiếu được một phần điều kiện và còn sai khác phạm vi gói/phí/payout. Ngày truy cập và URL thật ở Mục 12.2, không gán thành ngày xác minh toàn bộ.

## Mục 1. Tám nguyên tắc bất biến của hệ thống

1. **Nhật ký là System of Record, không phải hệ thống khớp lệnh:** Không có bất kỳ cơ chế `"Khóa tạo lệnh mới"` nào khi tài khoản chạm ngưỡng rủi ro.
2. **Một kho trạng thái duy nhất (`UnifiedJournalStore`):** Classic và V6 chỉ là hai cách trình bày khác nhau cùng đọc từ một tập selector memoized và một nguồn dữ liệu duy nhất.
3. **Một cổng nhập liệu duy nhất nằm ở Classic:** Giao diện V6 chỉ đọc và phân tích chuyên sâu.
4. **Đơn vị tiền tệ minh bạch:** Mọi số tiền (`Money`) luôn gắn kèm `currency`. Các chỉ số định lượng không thứ nguyên (`R`, Win Rate, PF theo R, SQN, `Ω`, `ES`, Kelly) tính trực tiếp từ chuỗi `R_i` từng lệnh nên độc lập với tiền tệ tài khoản. Đổi tiền cần tỷ giá có nguồn và timestamp, không viết lại kết quả lịch sử bằng tỷ giá mới.
5. **Không đoán âm thầm:** Khi hệ thống tự suy luận theo quy tắc (`XAU → XAUUSD`, `BTC → BTCUSDT` (ví dụ minh họa)), phải hiện nhãn `"Đã tự suy"` (`auto_notice`) kèm nút đổi lại. Khi dữ liệu mơ hồ thì hỏi người dùng đúng một lần rồi lưu vào `InstrumentRegistry`.
6. **Không ghi đè dữ liệu người dùng:** Ghi chú (`notes`), ảnh chụp (`screenshots`), nhãn kỷ luật (`disciplineTags`), `setupId`, `isReviewed` và mọi trường nằm trong `userEditedFields` không bao giờ bị quá trình import lại ghi đè.
7. **Truy vết nguồn gốc (Provenance):** Bảo toàn bản ghi gốc, chuỗi thời gian gốc (`rawOpenTime`), mã băm `importFingerprint` bất biến và lịch sử chỉnh sửa. Giá ngoại lai chỉ bị gắn cờ cảnh báo (`price_out_of_range`), không bị sửa hộ.
8. **Cô lập dữ liệu mô phỏng:** Dữ liệu mô phỏng/demo tách biệt hoàn toàn khỏi dữ liệu giao dịch thật bằng cờ `isSimulation`, không bao giờ cộng trộn vào KPI thực tế.

## Mục 2. Sổ cái kiểm toán lỗi: 24 lỗi lịch sử (v1 → v2) và 19 lỗi nâng cấp (v2 → v3)

### 2.1 Bảng 24 lỗi lịch sử của Báo cáo gốc (Đầy đủ từ Spec v2 §2 kèm trạng thái mã thật)

Cột engine gốc là mô tả **[LỊCH SỬ — CHƯA TÁI KIỂM]**, vì tệp gốc không có trong gói.
Cột tham chiếu mới mô tả tính năng theo yêu cầu; ký hiệu không thay thế kết quả test.
Trạng thái đã chạy hiện tại tra ID cụ thể ở Mục 15 và log trong báo cáo; `n/a` là phần giao diện không được cài bởi Python.

| # | Lỗi trong báo cáo gốc (v1) | Vấn đề thực tế | Bản sửa chuẩn hóa (Mục) | `v3.py` gốc [LỊCH SỬ — CHƯA TÁI KIỂM] | `v3_4.py` mới |
|---:|---|---|---|:---:|:---:|
| **1** | `^[A-Z]{3}$` ⇒ cổ phiếu VN | `BTC`, `XAU`, `EUR` bị coi là cổ phiếu, vàng sai khối lượng **100×** | Từ điển alias + ngữ cảnh thị trường (§7) | ✔ | ✔ |
| **2** | Regex chồng lấn, `XAUUSD` khớp cả Crypto | Vàng bị nhận nhầm thành tiền mã hóa tùy thứ tự duyệt | Thứ tự ưu tiên 9 bước cố định (§7.2) | ✔ | ✔ |
| **3** | Cắt hậu tố `m`/`c` sau khi đã viết hoa | `BTC → BT`, `VNM → VN` | Chỉ cắt hậu tố chữ thường khi phần gốc là mã đã biết (§7.1) | [LỊCH SỬ — CHƯA TÁI KIỂM] | [LỊCH SỬ — CHƯA TÁI KIỂM] |
| **4** | Dùng `float` nhị phân cho giá và lot | `1.0850 − 1.0830` bị sai số làm EURUSD ra `0,49` lot thay vì `0,50` | Bắt buộc `Decimal(prec=40)` (§0, §8) | ✔ | ✔ |
| **5** | `max(V_min, floor( (ví dụ minh họa)))` | Tự nâng lên lot tối thiểu làm vượt ngân sách rủi ro | Trả `status = 'below_min'`, `volume = 0`, kèm `minLotRisk` (§8.2) | ✔ | ✔ |
| **6** | Dấu thập phân: `"sau dấu . có ≠ 3 chữ số"` | Nhận diện sai với tỷ giá `1.085` hoặc `155.123` | Bỏ phiếu theo cả cột (`column_decimal_sep`) + gợi ý locale (§9.2) | ✘ | ✔ |
| **7** | Gán cứng `b` ⇒ Sell, `m` ⇒ Buy | Trong tiếng Anh `B` = Buy, làm đảo ngược chiều lệnh | Ánh xạ hướng theo hồ sơ nguồn (`map_direction`, §9.3) | ✘ | ✔ |
| **8** | `Net = Gross − \|Comm\| + Swap − \|Fee\|` | Sai khi có rebate/hoàn phí; MT4/MT5 đã mang sẵn dấu | Chuẩn hóa dấu theo nguồn rồi cộng đại số (`compute_net_pnl`, §9.3) | [LỊCH SỬ — CHƯA TÁI KIỂM] | ✔ (đủ A/B/C) |
| **9** | Net tự tính khi thiếu phí vẫn gọi `"sau phí"` | Đánh lừa người dùng khi file không có cột phí | Nhãn `"Gross ước tính (chưa phí)"`, `feeKnown = false` (§9.3) | ✘ | ✔ |
| **10** | Auto-tag Tier 3 theo thời điểm **nhập file** | Nhập lại lịch sử cũ gắn nhãn vi phạm sai hàng loạt | Replay tại `openTime` (`replay_tier_tags`, §4.5) | ✘ | ✔ |
| **11** | DD tính trên equity thô có nạp/rút | Rút tiền bị tính nhầm thành sụt giảm vốn (rút 50% báo DD 50%) | Chỉ số NAV trung lập dòng tiền (`drawdown`, §4.2) | ✔ | ✔ |
| **12** | Chưa có vốn mà có lệnh ⇒ trả DD `0%` | Che giấu hoàn toàn chuỗi thua khi chưa nhập vốn | Chế độ `CHƯA CÓ VỐN — DD tính theo R` (`drawdown_r`, §4.4) | ✘ (trả STANDBY) | ✔ (`DD_R` có mốc 0) |
| **13** | Fallback 1R `avg_loss` trộn lẫn 1R chuẩn | Lệnh thua TB ≡ `−1R` (lý luận vòng tròn), làm méo SQN | Tách 1R chuẩn / ước lượng, chuỗi 4 chế độ (`resolve_fallback_1r`, §5.5) | ◐ | ✔ |
| **14** | Heuristic `"giá < 500 ⇒ tự nhân 1.000"` | Làm sai giá cổ phiếu penny/chứng quyền; đoán âm thầm | `priceUnit` theo nguồn, tự phát hiện chỉ để đề xuất (§7.4) | ✘ | ✔ |
| **15** | Hash theo phút, mất lệnh scalping giống hệt | Hai lệnh khớp cùng phút/giây cùng giá bị nuốt mất | Multiset + `occurrenceIndex` + `importFingerprint` bất biến (§10) | ◐ (chỉ có hash) | ✔ |
| **16** | Bỏ qua dòng `balance` / `deposit` | Mất lịch sử nạp/rút, không tính được vốn điều chỉnh | Chuyển thành bản ghi `CashFlow` (§9.3) | ◐ | ✔ |
| **17** | `"Tính lại < 50 ms"` gồm cả Monte Carlo | Bất khả thi với 10.000–60.000 kịch bản | Chỉ số nhẹ `O(N)` đồng bộ; Monte Carlo chạy trong Web Worker (§14) | n/a | n/a |
| **18** | Thang SQN bị dịch lệch một bậc | `1,6–1,9` bị gọi nhầm là `"Trung bình"` thay vì `"Dưới trung bình"` | Thang Van Tharp 7 bậc (`sqn_grade`, §6.2) | ✘ | ✔ |
| **19** | Công thức EV dùng *median* payout | Kỳ vọng toán học (EV) bắt buộc phải dùng *mean* | `prop_ev_roi` dùng `mean` payout (§12.4) | ✘ | ✔ |
| **20** | Prop: Topstep/Apex lấy `"6% = $3.000"` làm Max Loss | `$3.000` là mục tiêu lãi; Max Loss của gói 50K là `4% ($2.000)` | Kho `DEFAULT_PROP_PRESETS` chuẩn hóa kèm nguồn và ngày (§12.2) | ◐ (chỉ có schema) | ✔ |
| **21** | Intraday trailing chỉ xét số dư sau đóng lệnh | Bỏ sót chạm sàn trong phiên, thổi phồng tỷ lệ đậu | Dùng `maeR`/`mfeR`; khi thiếu chạy 2 nhánh chặn trên/dưới (§12.4) | ✔ | ✔ |
| **22** | Bootstrap i.i.d. phá chuỗi thắng/thua | Không giữ được tương quan chuỗi lệnh hoặc ngày | Thêm `block` bootstrap (`b = 5`) và `day` bootstrap (§12.3) | ✘ (thiếu block/day) | ✔ |
| **23** | `f_slippage` là % của R, trừ vào ngân sách | Lệch bản chất với phí mỗi lot và trượt giá | Trượt giá tính theo giá (`slip`), cộng vào `lossPerLot` (§8.2) | ✔ | ✔ |
| **24** | Typo (`SP100`, `USOLIU`) rơi vào custom | Dùng contract size mặc định làm sai khối lượng | Gợi ý Levenshtein `<= 2` (`suggest`), không tự áp dụng (§7.3) | ✘ | ✔ |

### 2.2 Sổ 19 lỗi của Spec v2 (Báo cáo Kiểm toán + PDF v3) và 3 lỗi biên của `v3.py`

> **Giải trình con số 19 lỗi:** Báo cáo kiểm toán `.docx` đếm `8 lỗi công thức + 5 lỗi logic + 5 lỗi runtime = 18 lỗi`, còn tiêu đề PDF v3 ghi `19 lỗi`. Nếu tính `L5` (thứ tự `classify` đặt `ctx_market == 'stock_vn'` ở bước 1 trong v2 §7.2 làm nuốt `XAU`/`BTC`, tức dòng `12a` trong PDF v3) là lỗi logic thứ sáu thì khớp chính xác **`8 + 6 + 5 = 19 lỗi`**, và mục chuẩn hóa quy tắc Prop (`Q1_prop`) nằm riêng. Ngoài ra, quá trình chạy 125 test vectors trên `tuan_trader_v3.py` phát hiện thêm `parse_number` rỗng trả `0`, thiếu `entry_avg_closed` và `metrics()` trả `inf` trần — tất cả là nội dung kiểm toán lịch sử; kết quả hiện tại chỉ xác nhận bằng test trong gói:

| Mã | Phân loại | Lỗi trong Spec v2 / Phụ lục A cũ | Bản sửa chuẩn hóa trong v3.4 (`tuan_trader_v3_4.py`) | `v3.py` gốc [LỊCH SỬ — CHƯA TÁI KIỂM] | `v3_4.py` mới |
|---|---|---|---|---|---|
| **F1** | Công thức (1/8) | Kelly nhị phân `p − q/b` sai khi có lệnh hòa hoặc lỗ TB khác `−1R` | Kelly thực nghiệm giải `g'(f) = 0` bằng chia đôi 200 vòng (§6.1) | ✔ | ✔ |
| **F2** | Công thức (2/8) | `R = sample() − feeDragR` trừ phí hai lần | Chỉ trừ `fee_drag_R` khi `sample_mode == 'parametric'` hoặc `fee_known == False` (§12.4) | ✔ | ✔ |
| **F3** | Công thức (3/8) | `lowest/B <= floorDaily` lệch thứ nguyên | So sánh trực tiếp cùng đơn vị số dư `low <= fl_daily` và `low <= floor` (§12.4) | ✔ | ✔ |
| **F4** | Mô hình (4/8) | Bootstrap 1 tầng trên mẫu nhỏ (`N = 10`) tạo ảo giác chắc chắn (`≈ 98%`) | Bootstrap 2 tầng (`prop_pass_probability`) báo phân vị `[p5, p50, p95]` (§12.4) | ✔ | ✔ |
| **F5** | Mô hình (5/8) | `N_90` và `(1 − P)^5` giả định các lần thi độc lập | Tính kỳ vọng qua vòng ngoài `E[(1 − P_b)^5]` (`fail_streak_risk`, §12.4) | ✔ | ✔ |
| **F6** | Công thức (6/8) | DD phụ thuộc thứ tự lệnh khi file chỉ có ngày (`dateOnly`) | Gộp EOD (`_eod_aggregate`) + gắn cờ `intraday_order_unknown` (§4.7) | ✔ | ✔ |
| **F7** | Công thức (7/8) | Công thức lỗ ngày mơ hồ (chỉ cộng lệnh thua hay tổng ròng) | Tổng ròng realized trong ngày chia vốn đầu ngày (`daily_loss_pct`, §4.6) | ✔ | ✔ |
| **F8** | Công thức (8/8) | Sizer cổ phiếu VN thiếu phí môi giới `%` và thuế bán `0,1%` | `lossPerShare` tính đủ phí mua, phí bán và thuế bán (`700 CP` FPT, §8.2) | ✔ | ✔ |
| **L1** | Logic (1/6) | `R = netPnl / Risk1R` lệch thang do tỷ giá tĩnh | `implied_vpoint` khi `\|grossPnl\| >= 1,00` + fallback có cờ (§5.3) | ✔ | ✔ |
| **L2** | Logic (2/6) | Fingerprint băm trên giờ đã đổi UTC, đổi múi giờ/DST sinh bản trùng | Băm trên chuỗi giờ gốc `canonical_raw_time` (§10.1) | ✔ | ✔ |
| **L3** | Logic (3/6) | File chỉ-ngày và file có-giờ sinh hai hash khác nhau | `find_merge_candidates` gợi ý gộp có giám sát (§10.4) | ✔ | ✔ |
| **L4** | Logic (4/6) | Khoảng giá cố định `[500; 10.000]` bỏ lọt `XAUUSD = 587,02` | `robust_z_log` trên `ln(P)` với sàn `10^-3` (`Z = 539,33 > 3,5`, §9.5) | ✔ | ✔ |
| **L5** | Logic (5/6 — 12a) | `ctx_market == 'stock_vn'` đặt đầu `classify` nuốt `XAU`/`BTC` | Thứ tự ưu tiên 9 bước cố định (§7.2) | ✔ | ✔ |
| **L6** | Logic (6/6 — 12b) | FIFO xuất 1 dòng mỗi lệnh `SELL`; thiếu `1R` cho scale-in | Chu kỳ phẳng → phẳng `fifo_cycles` + `cycle_oneR` + thêm `entry_avg_closed` (Q2, §5.4, §9.4) | ◐ (thiếu `entry_avg_closed`) | ✔ |
| **R1** | Runtime (1/5) | `parse_number('100 USDT')` ném lỗi `'100T'`; chuỗi rỗng trả `0` | Xếp mã tiền tệ dài trước ngắn; chuỗi rỗng trả `(None, 'empty')` (Q3, §9.3) | ◐ (rỗng trả `0`) | ✔ |
| **R2** | Runtime (2/5) | `BTCUSDT` trên TK `USDT` báo lỗi `fx_missing` | Lấy `quote` từ hậu tố thực, coi stablecoin = `1 USD` kèm cờ (§8.1) | ✔ | ✔ |
| **R3** | Runtime (3/5) | `metrics()` chia `0` khi thiếu lệnh thắng/thua; trả `inf` trần ra API | Guard biên + `metrics_to_json_safe` trả `{value: null, status: 'infinite_no_losses'}` (§6.4) | ◐ (trả `inf` trần) | ✔ |
| **R4** | Runtime (4/5) | Dùng `float` cho đọc số, drawdown và FIFO trong Phụ lục A v2 | Chuyển toàn bộ sang `Decimal(prec = 40)` (§0) | ✔ | ✔ |
| **R5** | Runtime (5/5) | `ES_5%` dùng `math.ceil(N * (1 - 0.95))` nhảy sai `k` do float | Tính `k` nguyên: `k = max(1, (5 * N + 99) // 100)` (§6.1) | ✔ | ✔ |
| **P1** | Quy tắc Prop | Topstep nhầm target thành max loss; thiếu khóa sàn sau rút; The5ers 2 bản | `PropPresetV3` + `DEFAULT_PROP_PRESETS` cập nhật Topstep 17/09/2026 [ngày do đầu vào tự khai; xem kiểm tra hiện tại ở Mục 12.2] (Q4, §12.2) | ◐ (chỉ có schema) | ✔ |

## Mục 3. Mô hình dữ liệu chuẩn hóa (`UnifiedJournalStore`)

```ts
type Money = Decimal;               // Luôn đi kèm currency ở cấp bản ghi hoặc tài khoản
type Currency = 'USD' | 'VND' | 'USDT' | 'USDC' | 'EUR' | 'GBP' | 'JPY' | string;

interface Fallback1RConfig {
  mode: 'equity_pct' | 'notional_pct' | 'fixed_amount' | 'empirical_avg_loss';
  equityPct: Decimal;               // Mặc định 1.0 (1,0% vốn thực tế trước lệnh; cho chỉnh 0.1–5.0%)
  notionalPct: Decimal | null;      // Cho cổ phiếu/crypto spot (vd 5–7% giá trị danh nghĩa)
  fixedAmount: Money | null;        // Số tiền > 0 theo baseCurrency; cấm tuyệt đối giá trị cứng "₫100"
  minEmpiricalLosses: number;       // Mặc định >= 5 lệnh thua
}

interface AccountProfile {
  id: string;
  name: string;
  baseCurrency: Currency;
  initialCapital: Money | null;     // null = chưa khai báo (kích hoạt chế độ DD theo R tại §4.4)
  broker?: string;
  serverTimeZone: string;           // IANA timezone hỗ trợ DST: 'Europe/Athens', 'UTC', 'Asia/Ho_Chi_Minh'
  dailyResetTime: string;           // Mặc định '00:00' theo múi giờ tài khoản
  tiers: {
    t1: number;                     // % DD. Mặc định 2.5 [GIẢ ĐỊNH / CẦN XÁC MINH]
    t2: number;                     // % DD. Mặc định 4.0 [GIẢ ĐỊNH / CẦN XÁC MINH]
    t3: number;                     // % DD. Mặc định 5.00 (có nguồn từ báo cáo gốc)
  };
  dailyLossLimitPct: number | null;
  fallback1R: Fallback1RConfig;     // Xem §5.5
  fxRates: Record<string, { rate: Decimal; asOf: string }>; // vd 'USD/VND' -> { rate: 25400, asOf: '2026-10-28T00:00:00Z' }
  vnStockFees: {                    // Tỷ lệ PHÂN SỐ (chặn cứng > 0.05)
    feeBuyRate: Decimal;            // Mặc định 0.0015 (0,15%)
    feeSellRate: Decimal;           // Mặc định 0.0015 (0,15%)
    taxSellRate: Decimal;           // Mặc định 0.0010 (0,10%)
  };
  costBasis: 'FIFO' | 'AVERAGE';    // Mặc định 'FIFO'
  strictMode: boolean;              // false: chỉ cảnh báo; true: hiện hộp xác nhận mềm khi THÊM TAY lệnh lúc Tier 3
}

interface InstrumentSpec {          // InstrumentRegistry, khóa (accountId | broker, symbol)
  symbol: string;
  cls: 'forex' | 'metal' | 'oil' | 'index' | 'crypto_linear' | 'stock_vn' | 'stock_intl' | 'futures_vn';
  quoteCurrency: Currency;
  baseCurrency?: Currency;
  contractSize: Decimal;
  volumeStep: Decimal;
  volumeMin: Decimal;
  volumeMax?: Decimal;
  tickSize?: Decimal;
  priceUnit?: 'full' | 'thousand';  // Cổ phiếu VN (§7.4)
  confirmedByUser: boolean;
  source: 'builtin' | 'user';
}

interface Trade {
  id: string;
  accountId: string;
  uidPrimary?: string;              // SHA256('T|' + source + '|' + accountId + '|' + externalTicketId)
  importFingerprint: string;        // BẤT BIẾN: sinh ở lần nhập đầu từ canonical_raw_time, không tính lại khi sửa tay
  occurrenceIndex: number;          // Thứ tự 0..m-1 trong nhóm bản ghi giống hệt (§10.2)
  externalTicketId?: string;
  market: string;
  symbol: string;
  rawSymbol: string;
  direction: 'buy' | 'sell';
  volume: Decimal;                  // Khối lượng đã đóng (hoặc khối lượng lệnh)
  entryQty?: Decimal;               // Tổng khối lượng các chân mở trong chu kỳ
  openQty?: Decimal;                // Khối lượng còn đang mở (nếu status == 'open')
  entryPrice: Decimal;              // entry_avg toàn chu kỳ (vd 105)
  entryAvgClosed?: Decimal | null;  // [ĐÃ CHỐT Q2] entry_avg_closed của phần đã đóng theo FIFO (vd 103,3333)
  exitPrice: Decimal | null;
  rawOpenTime: string | null;       // Chuỗi gốc trong file, không đổi múi giờ
  openTime: string | null;          // ISO 8601 có timezone, lưu UTC
  closeTime: string | null;         // ISO 8601 có timezone, lưu UTC
  dateOnly: boolean;
  slPrice: Decimal | null;
  tpPrice: Decimal | null;
  slMayBeModified: boolean;
  commission: Money | null;
  swap: Money | null;
  fee: Money | null;
  feeCurrency?: Currency;
  grossPnl: Money | null;
  netPnl: Money | null;
  netPnlSource: 'file' | 'derived_A' | 'derived_B' | 'derived_C' | 'manual';
  feeKnown: boolean;
  status: 'open' | 'closed' | 'orphan_sell';
  oneR: Money | null;
  oneRSource: 'exact' | 'fallback_equity_pct' | 'fallback_notional_pct' | 'fallback_fixed' | 'fallback_avg_loss' | null;
  rMultiple: Decimal | null;
  mfeR?: Decimal | null;
  maeR?: Decimal | null;
  legs?: Fill[];                    // Các lần khớp (scale-in / scale-out)
  // Trường người dùng: KHÔNG BAO GIỜ bị import ghi đè (§10.3)
  setupId?: string;
  disciplineTags: string[];
  notes?: string;
  screenshots?: string[];
  isReviewed: boolean;
  userEditedFields: string[];
  autoTags: string[];               // vd 'tier3_breach_at_open'
  flags: string[];                  // 'orphan_sell', 'price_out_of_range', 'pnl_sign_mismatch', 'time_inversion',
                                    // 'no_time_for_tier_check', 'intraday_order_unknown', 'vpoint_fallback', 'fee_missing_as_zero'
  importBatchId: string;
  isSimulation: boolean;
}

interface CashFlow {
  id: string;
  accountId: string;
  time: string;
  dateOnly?: boolean;
  amount: Money;
  kind: 'deposit' | 'withdrawal' | 'credit' | 'adjustment';
  importBatchId: string;
}
```

- **Quy tắc lưu trữ:** `importFingerprint` (kèm `occurrenceIndex`) và `uidPrimary` là duy nhất theo từng tài khoản. Không xóa các bản ghi `Fill` gốc sau khi ghép chu kỳ FIFO. Thao tác sửa lệnh dùng cơ chế kiểm soát đồng thời lạc quan (optimistic concurrency) và ghi nhận toàn bộ lịch sử vào audit log.


### 3.1 Dataclass Python và validation

`Fallback1RConfig`, `AccountProfile`, `InstrumentSpec`, `Trade`, `CashFlow` có tên trường camelCase tương ứng interface ở trên; Money/price/volume/R ở bản ghi được ép bằng `Decimal`. Mọi trường bắt buộc bị thiếu, bool hoặc số không hữu hạn trả `ValueError` có lý do. `t1 < t2 < t3`, tier thuộc (0,100], `initialCapital` dương hoặc None; phí/thuế phân số không vượt 0.05. Timezone IANA và dailyResetTime HH:MM phải hợp lệ. Hai instance không dùng chung list/dict mặc định.
`Trade.currency` và `CashFlow.currency` bổ sung tiền tệ bản ghi; `rawTime` cho cashflow dateOnly bảo toàn thời gian gốc.

## Mục 4. Safety Gate (Lớp 1): Drawdown NAV, DD theo R (Q1), Tier và Replay tại `openTime`

### 4.1 Hành vi bắt buộc (Không bao giờ khóa nhập liệu)

- Không bao giờ vô hiệu hóa nút thêm lệnh, nhập file, sửa, xóa hoặc đồng bộ. Xóa mọi logic `"Đã khóa tạo lệnh mới"`.
- Khi chạm ngưỡng Tier 2 hoặc Tier 3, hệ thống chỉ: đổi màu banner, hiển thị cảnh báo, gắn nhãn tự động `tier3_breach_at_open` và tăng bộ đếm `"Lệnh vi phạm kỷ luật"`.
- Nếu `strictMode = true` (người dùng tự bật): khi **thêm tay** một lệnh lúc đang ở Tier 3 thì hiện hộp xác nhận mềm. Không áp dụng cho luồng nhập file và không làm mất khả năng lưu nhật ký.
- Các mức Tier là mặc định cấu hình, không phải quy tắc cứng của quỹ hay bảo đảm an toàn. Khi người dùng đổi ngưỡng Tier, lịch sử cũ không bị âm thầm sửa đổi nếu không có xác nhận tính lại theo phiên bản cấu hình.

### 4.2 Công thức Drawdown trung lập dòng tiền (Chỉ số NAV)

Mục tiêu: nạp tiền hoặc rút tiền không được làm Drawdown tăng hay giảm.

```text
Khởi tạo: E_0 = initialCapital ; I_0 = 1 ; Peak = 1 ; MaxDD = 0
Duyệt sự kiện theo thời gian (lệnh đóng dùng closeTime):
  - CashFlow a : E += a                                              # KHÔNG thay đổi chỉ số I
  - Trade p    : nếu E <= 0 thì dừng (tài khoản đã cháy 100%)
                 r = p / E ; E += p
                 I = max(I * (1 + r), 0) ; Peak = max(Peak, I)
                 MaxDD = max(MaxDD, (1 - I / Peak) * 100)
DD%    = clamp((1 - I / Peak) * 100, 0, 100)
maxDD% = clamp(MaxDD, 0, 100)
```

- Chỉ tính trên các lệnh đã đóng (`status = 'closed'`, realized).
- **Vốn hiển thị** = `E` (đã gồm nạp/rút). **DD hiển thị** = `DD%` theo công thức NAV ở trên.
- Với mô phỏng quỹ Prop (Mục 12), giới hạn lỗ tối đa tính theo tiền tuyệt đối và quy tắc sàn của từng preset, không dùng chỉ số NAV thay thế.

### 4.3 Bảng trạng thái Safety Gate

| Điều kiện | Trạng thái hiển thị | Màu sắc | DD hiển thị |
|---|---|---|---|
| `N_trades = 0` hoặc chưa đủ dữ liệu | **CHƯA KHỞI TẠO VỐN (STANDBY)** | Xám | `0,00%` |
| Có lệnh nhưng `initialCapital = null` và không suy ra được | **CHƯA CÓ VỐN — DD tính theo R** (§4.4) | Xám / Vàng | `"DD: x.xR"` |
| `DD < t1` | **An toàn** | Xanh lá | Giá trị `%` |
| `t1 <= DD < t2` | **Tier 1** | Vàng | Giá trị `%` |
| `t2 <= DD < t3` | **Tier 2** | Cam | Giá trị `%` |
| `DD >= t3` | **CẢNH BÁO RỦI RO CẤP 3 (TIER 3 BREACH)** | Đỏ | Giá trị `%` |

- **Banner Tier 3:** *"Drawdown hiện tại vượt ngưỡng an toàn. Khuyến nghị dừng giao dịch thực tế để rà soát hệ thống."* (Vẫn cho phép nhập liệu). Với `C_0 = 1.000` và một lệnh `−1.000`, `DD = 100%` (cháy thật, vẫn nhập tiếp được).

### 4.4 Chế độ DD theo R khi chưa có vốn (`[ĐÃ CHỐT Q1 — Thay đổi duy nhất so với Spec v2]`)

Khi tài khoản đã có lệnh đóng nhưng chưa khai báo vốn ban đầu (`initialCapital = null`), hệ thống tính sụt giảm theo bội số `R` trên chuỗi các lệnh có `R_i != null` **và tính cả mốc khởi đầu `0`**:

```text
cumR_t  = Σ_{i=1..t} R_i                  (chỉ tính các lệnh có R hợp lệ)
PeakR_t = max(0, max_{1 <= k <= t} cumR_k) # [ĐÃ CHỐT Q1] Tính cả mốc 0
DD_R(t) = PeakR_t - cumR_t                # Đơn vị: R, hiển thị "DD: x.xR"
```

- **Hệ quả tường minh (Quyết định Q1):** Với chuỗi bắt đầu bằng một lệnh thua `R = [−1]`, `cumR_1 = −1`, `PeakR_1 = max(0, −1) = 0`, nên **`DD_R = 1,0R`** (trong khi công thức không có mốc `0` của Spec v2 cho `0R`). Đây là quy tắc duy nhất bản v3.4 chủ động thay đổi so với Spec v2 để phản ánh ngay mức sụt giảm ngay từ lệnh thua đầu tiên.
- Không áp dụng ngưỡng Tier `%` trong chế độ này và hiển thị gợi ý nhắc người dùng khai báo vốn ban đầu.
- Các lệnh có `R = null` không được tự biến thành `0` mà đếm riêng vào `missing_r_count` (số lệnh thiếu 1R).

### 4.5 Auto-tag vi phạm kỷ luật bằng Replay tại `openTime`

- Với mỗi lệnh, tính trạng thái Tier tại thời điểm mở lệnh **`openTime`** bằng cách replay chỉ các lệnh đã đóng có `closeTime <= openTime` (và `dateOnly = false`) cùng các dòng tiền `time <= openTime`.
- Nếu `DD(openTime) >= t3` (Tier = 3) thì tự động gắn `autoTags += 'tier3_breach_at_open'` và cộng vào bộ đếm `"Lệnh vi phạm kỷ luật"`. Nhãn này không bị xóa nếu lệnh đó sau này đóng có lãi.
- Tự động chạy lại khi: import file, sửa lệnh, đổi vốn ban đầu hoặc đổi ngưỡng Tier (dùng bảng vốn theo thời gian tính sẵn một lượt `O(N log N)`).
- Các lệnh chỉ có ngày (`dateOnly = true`) hoặc thiếu `openTime` thì bỏ qua kiểm tra Tier và ghi cờ `no_time_for_tier_check`.

### 4.6 Ngân sách lỗ ngày (Daily Loss Budget)

```text
DailyLoss%       = max(0, -Σ_{lệnh đóng trong ngày} netPnl) / vốn_đầu_ngày * 100
Thanh tiến trình = DailyLoss% / dailyLossLimitPct
```

- Tính trên **tổng ròng realized** của các lệnh đóng trong ngày (lệnh thắng trong ngày bù trừ với lệnh thua trong ngày), không dùng equity thả nổi hiện tại.
- Ngày kế toán lấy theo `serverTimeZone` (IANA, có DST) và `dailyResetTime`, không lấy giờ trình duyệt máy khách. Nếu thiếu vốn đầu ngày hoặc chưa bật `dailyLossLimitPct` thì trả `null` kèm lý do.

### 4.7 File chỉ có ngày (`dateOnly`)

Khi `dateOnly = true`, thứ tự khớp lệnh trong ngày không xác định (ví dụ `C_0 = 10.000`, hai lệnh `+1.000` và `−1.000` cùng ngày sẽ cho DD `0%` hoặc `9,09%` tùy thứ tự). Hệ thống bắt buộc gộp lãi/lỗ ròng theo từng ngày (EOD), đặt dòng tiền ròng của ngày ở cuối ngày, và gắn cờ `intraday_order_unknown`. Chỉ kết luận EOD Drawdown, không khẳng định `"intraday DD = 0"`. `[LỊCH SỬ — CHƯA TÁI KIỂM]`


### 4.8 Hợp đồng replay và lỗi dữ liệu

`replay_tier_tags` đổi timestamp có offset về datetime UTC, sắp xếp sự kiện một lần rồi quét các openTime theo thứ tự; O(N log N), O(N) bộ nhớ. Trade đóng và cashflow phải có giờ xác định; dateOnly không được giả giờ. Thiếu/không hợp lệ gắn `no_time_for_tier_check` hoặc `replay_incomplete_invalid_event`. Với cùng thời điểm, giữ thứ tự ổn định: trade đóng trước cashflow, rồi mới truy vấn openTime, tương thích quy tắc `<=`.
`drawdown` và gate vật hóa iterator một lần. NAV thiếu vốn dương trả DD=None + reason; STANDBY không lệnh vẫn hiển thị 0 với reason `no_trades`. Lệnh có vốn E<=0 dừng mô hình với cờ `nonpositive_equity_stop`.

## Mục 5. Chuẩn hóa 1R, Tỷ giá Ngầm định, Chu kỳ Scale-in và Chuỗi Fallback

### 5.1 Quy tắc chung và cấm giá trị 1R cố định `"₫100"`

- `R_i = netPnl_i / Risk1R_i`, cả hai tính bằng tiền tệ tài khoản (`baseCurrency`). `Risk1R_i` bắt buộc `> 0`; nếu không có hoặc `<= 0` thì `R_i = null`.
- **Cấm tuyệt đối mọi giá trị 1R cố định kiểu `"₫100"`:** Xóa tùy chọn đó khỏi UI và code. (Lưu ý: `"₫100"` trong báo cáo cũ là giá trị tiền cố định gán cho `1R`, không phải mức giá SL).

### 5.2 1R chuẩn (`exact`)

Khi có SL gốc hợp lệ (`Buy: SL < entry`; `Sell: SL > entry`; `SL != entry`):
```text
Risk1R = |entry - SL| * volume * Vpoint_acct       (oneRSource = 'exact')
```
Nếu file MT4/MT5 chỉ có cột `S/L` hiện tại lúc đóng lệnh (có thể đã dời về hòa vốn hoặc trailing stop), hệ thống vẫn tính nhưng gắn `slMayBeModified = true` và hiện biểu tượng cảnh báo.

### 5.3 Tỷ giá ngầm định `implied_vpoint` (Sửa lỗi L1)

Với báo cáo MT4/MT5, `grossPnl` đã ở tiền tệ tài khoản và làm tròn đến đơn vị `0,01`. Khi `|exit − entry| > 0` và `volume > 0`:
```text
Vpoint_acct = |grossPnl| / (|exit - entry| * volume)        (source = 'implied')
Sai số tương đối tối đa = (0,01 / 2) / |grossPnl| <= 0,5%   <=>   |grossPnl| >= 1,00
```
Khi không đủ điều kiện (`|grossPnl| < 1,00` hoặc lệnh đóng hòa vốn `exit == entry`) thì quay về `fxRates` tĩnh và gắn cờ `vpoint_fallback`. Không áp dụng cho lệnh scale-out nhiều chân chưa tách gross hoặc hợp đồng nghịch đảo. `[LỊCH SỬ — CHƯA TÁI KIỂM]` `gross = 96,15`, `155 → 156`, `0,15` lot cho `vpoint = 641,0`, sai số `5,2e-5`.

### 5.4 1R của chu kỳ Scale-in (`cycle_oneR` — Sửa lỗi L6)

```text
OneR_cycle = Σ_{j ∈ entry_legs} |entry_j - sl_j| * qty_j * Vpoint_acct
```
Chỉ gán `oneRSource = 'exact'` khi **mọi chân mở lệnh** trong chu kỳ đều có SL hợp lệ. Nếu thiếu SL ở bất kỳ chân mở nào thì toàn bộ chu kỳ chuyển sang dùng Fallback 1R, không lặng lẽ bỏ qua chân thiếu SL. `[LỊCH SỬ — CHƯA TÁI KIỂM]` hai chân có SL cho `5 + 6 = 11` (`exact`); thiếu SL một chân chuyển sang `fallback`.

### 5.5 Chuỗi Fallback 1R khi khuyết SL (`resolve_fallback_1r`)

| Chế độ (`mode`) | Công thức tính `Risk1R` | Điều kiện áp dụng |
|---|---|---|
| `equity_pct` (mặc định `1,0%`, chỉnh `0,1%–5,0%`) | `E_before_entry × pct` | Biết vốn thực tế tại lúc mở lệnh (replay equity) |
| `notional_pct` (cổ phiếu/crypto spot, vd `5%–7%`) | `\|entry × volume × contractSize\| × pct` (quy đổi tiền TK) | Đã cấu hình `notionalPct` |
| `fixed_amount` | Số tiền người dùng nhập theo tiền tệ tài khoản | `> 0`; cảnh báo nếu `< 0,01%` hoặc `> 20%` vốn |
| `empirical_avg_loss` | `\|mean(netPnl các lệnh thua)\|` | Có `>= 5` lệnh thua cùng phạm vi |

- **Chuỗi suy giảm tự động:** `equity_pct → notional_pct (nếu đã cấu hình) → fixed_amount (nếu đã cấu hình) → empirical_avg_loss (nếu >= 5 lệnh thua) → unavailable` (`R = null`, loại khỏi thống kê R và hiển thị rõ số lệnh bị loại kèm lý do).

### 5.6 Chống nhiễm mẫu và đồng bộ mẫu `N`

- Mọi chỉ số R có hai chế độ: **"Chỉ 1R chuẩn"** và **"Gồm 1R ước lượng"**. UI ghi rõ: `Đang phân tích N lệnh (X% 1R chuẩn, Y% 1R nội suy)` kèm công tắc lọc.
- Mẫu `empirical_avg_loss` mang tính vòng tròn (lệnh thua trung bình ≡ `−1R`) nên phải gắn nhãn `"ước lượng"` và **không đưa vào xếp hạng SQN**.
- Classic và V6 dùng chung một selector: chỉ số tiền (Net P&L, Win Rate tiền, PF tiền) tính trên toàn bộ lệnh đã đóng; chỉ số R tính trên các lệnh có `R != null` theo công tắc lọc. Mỗi thẻ KPI ghi rõ `N`.


### 5.7 Hàm nối `compute_r_multiple`

Giữ chữ ký hàm cũ; `risk1r` chỉ thêm `direction=None, side=None`. Khi biết hướng, SL Buy phải dưới entry và SL Sell phải trên entry. SL sai phía trở thành thiếu SL, kích hoạt fallback. Không cung cấp hướng vẫn giữ phép trị tuyệt đối để tương thích lời gọi cũ. Price/SL/volume/vpoint phải dương.
`compute_r_multiple` nhận one_r trực tiếp hoặc các chân entry; giữ `oneRSource`, trả `rMultiple = netPnl / oneR`. Thiếu net hoặc 1R khả dụng trả None + reason. Khi chọn mode fallback, đi từ mode đã chọn xuống các mode thấp hơn. Empirical có `exclude_from_sqn=True`; metrics dùng danh sách trades để loại mẫu này khỏi xếp hạng SQN, vẫn giữ các mẫu tiền đã đóng.

## Mục 6. Công thức chỉ số định lượng (Dùng chung Classic và V6)

Gọi `R` là dãy các giá trị `rMultiple` hợp lệ, `N = len(R)`. Lệnh hòa vốn (`R = 0`) nằm trong `N`.

| # | Chỉ số | Công thức chuẩn | Điều kiện biên & hiển thị |
|---:|---|---|---|
| **1** | **Expectancy** | Theo R: `mean(R)` · Theo tiền: `mean(netPnl)` | `N = 0` ⇒ `"Chưa có dữ liệu"` (`status = 'empty'`) |
| **2** | **Win Rate & Payoff** | `p = N_win / N`, `q = N_loss / N`, `b = avgWinR / \|avgLossR\|` | `p + q <= 1` do có lệnh hòa. Thiếu thắng hoặc thiếu thua thì `b = null` |
| **3** | **Profit Factor (PF)** | `Σ thắng / \|Σ thua\|` | Không thua mà có lãi ⇒ UI hiện `∞`, JSON API trả `{ value: null, status: 'infinite_no_losses', display: '∞' }`; cả hai `0` ⇒ `"—"` |
| **4** | **SQN** | `√min(N, 100) × mean(R) / σ_R`, với `σ_R` là độ lệch chuẩn mẫu (`N − 1`) | `N < 2` hoặc `σ_R = 0` ⇒ `null`; `N < 30` kèm nhãn `"Chưa đủ mẫu"` |
| **5** | **Omega Ratio `Ω(θ)`** | `Σ max(R − θ, 0) / Σ max(θ − R, 0)` (với `θ = 0` thì `Ω(0) = PF_R`) | Mẫu số `0` và tử số `> 0` ⇒ `∞` (JSON-safe như PF) |
| **6** | **Expected Shortfall `ES_5%`** | `k = max(1, (5 * N + 99) // 100)` ; `ES_5% = −(1/k) Σ k giá trị R nhỏ nhất` (số dương) | Dùng phép chia nguyên, không dùng `1 − 0.95`. `N < 20` ⇒ `k = 1` `"ước tính thô"`. Cảnh báo nếu `ES_5% > esWarnR` (mặc định `2,0R`, `[GIẢ ĐỊNH]`) |
| **7** | **Kelly Thực nghiệm** | Xem Mục 6.1 bên dưới | Không có lệnh thua ⇒ `undefined_no_losses`, `f = null`; kỳ vọng `<= 0` ⇒ `no_edge`, `f = 0` |
| **8** | **Vốn điều chỉnh** | `E_t = C_0 + Σ netPnl + Σ cashflow` | Nạp/rút cập nhật `E_t` nhưng không làm méo NAV DD (§4.2) |

### 6.1 Kelly thực nghiệm (`empirical_kelly` & `kelly_ci`)

```text
f* = argmax_{0 <= f < 1/|min(R)|} g(f),   với g(f) = (1/N) Σ_{i=1..N} ln(1 + f * R_i)
```
Vì `g(f)` lõm chặt nên đạo hàm `g'(f) = (1/N) Σ R_i / (1 + f * R_i)` đơn điệu giảm; giải phương trình `g'(f) = 0` bằng phương pháp chia đôi (`bisection`) 200 vòng lặp trên `[0; 0,9999 / |min(R)|]`.
- Trạng thái biên tường minh: không có lệnh thua ⇒ `status = 'undefined_no_losses'`, `f = null`; kỳ vọng `<= 0` ⇒ `status = 'no_edge'`, `f = 0.0`.
- `Half-Kelly (0,5 * f*)` và `Quarter-Kelly (0,25 * f*)` chỉ là mức tham khảo, không tự động đặt lệnh; khi `N < 30` gắn nhãn `tham_khao_N_nho`. Khoảng tin cậy 90% (`kelly_ci90`) bằng bootstrap ghi rõ `seed`, số mẫu bị loại do không bốc trúng lệnh thua (`n_excluded`) và phân vị.
- **Giá trị chuẩn nghiệm thu `[LỊCH SỬ — CHƯA TÁI KIỂM]`:**
  - Mẫu chuẩn `[2, −1, −1, 1.5, −1, 3, −1, 0.5, −1, 2]` ⇒ **`f* = 0,2053489069`** (v2 nhị phân ra `0,2222`; PDF v3 in `0,210238` do lặp 80 vòng golden-section).
  - Mẫu có 2 lệnh hòa `[2, −1, −1, 1.5, −1, 3, 0, 0.5, 0, 2]` ⇒ **`f* = 0,3956162848`** (v2 nhị phân ra `0,3333`; PDF v3 in `0,395576`).
  - Mẫu lỗ TB `−0,5R` `[2, −0.5, −0.5, 1.5, −0.5, 3, −0.5, 0.5, −0.5, 2]` ⇒ **`f* = 0,6816059592`** (v2 nhị phân ra `0,3611`; PDF v3 in `0,681554`).
  - Mẫu toàn thắng `[1, 2]` ⇒ `kelly = None` (`undefined_no_losses`), `pf_api = { value: None, status: 'infinite_no_losses', display: '∞' }`.

### 6.2 Thang phân loại SQN 7 bậc của Van Tharp (`[CẦN XÁC MINH với nguồn gốc]`)

- Dưới `1,6`: **Khó giao dịch**
- `1,6 – 1,9`: **Dưới trung bình**
- `2,0 – 2,4`: **Trung bình**
- `2,5 – 2,9`: **Tốt**
- `3,0 – 5,0`: **Xuất sắc**
- `5,1 – 6,9`: **Rất xuất sắc**
- Từ `7,0` trở lên: **Holy Grail**

### 6.3 Thời gian nắm giữ (`holdTime`) và Phiên giao dịch UTC

- `holdTime = closeTime − openTime`, bắt buộc `>= 0`; nếu `< 0` thì đặt `holdTime = null` và gắn cờ `time_inversion`.
- Lệnh `dateOnly = true`: `holdTime = null`, `session = null` (không tự bịa là lệnh `"trong ngày"`).
- Phiên giao dịch theo giờ UTC của `openTime` (`[GIẢ ĐỊNH, cấu hình được]`): **Á (`Asia`)** `00:00–07:00` · **Âu (`Europe`)** `07:00–13:00` · **Mỹ (`US`)** `13:00–22:00` · **Khác (`Other`)** `22:00–24:00`.


### 6.4 Hợp đồng metrics mở rộng và JSON-safe đệ quy

`metrics(R, with_kelly_ci=False, theta=0.0, esWarnR=2.0, money_pnls=None, trades=None)` giữ mọi khóa cũ và thêm `omega`, `theta`, `median`, `es_k`, `es_warning`, `es_rough`, `sample_label`, `sqn_sample_label`, `sqn_N` khi có trades, cùng `money` (N, missing, expectancy Decimal, win_rate, PF tiền Decimal). N<30 hiện đúng nhãn “Chưa đủ mẫu”. Mẫu tiền độc lập với mẫu R, kể cả R rỗng. Đầu vào R không hữu hạn bị đếm vào dropped; cấu hình sai trả lỗi.
`metrics_to_json_safe` đi qua dataclass/dict/list/tuple/set ở mọi tầng, Decimal hữu hạn thành chuỗi thập phân, datetime thành ISO; NaN và Infinity được bọc value/status/display. `json.dumps(result, allow_nan=False)` phải chạy được, kể cả kelly_ci90 lồng nhau.
Các số tiền truyền vào metrics phải đã cùng currency/phạm vi tài khoản; adapter tham chiếu không tự đoán FX giữa nhiều tài khoản.
**[ĐỀ XUẤT — KHÔNG ĐỔI CÔNG THỨC]:** Công thức ES gốc cho R=[1,2], k=1 là -1R, trái mô tả “số dương” trong bảng. Bản này bảo toàn dấu theo công thức, không tự lấy abs hoặc clamp. Cần quyết định riêng nếu muốn đổi cách hiển thị.

## Mục 7. Nhận diện sản phẩm, Gợi ý Levenshtein và Quy ước Hợp đồng

### 7.1 Chuẩn hóa chuỗi 6 bước (`normalize` — đúng thứ tự)

1. `trim()`, xóa toàn bộ khoảng trắng.
2. Cắt hậu tố hợp đồng vĩnh cửu (perpetual): `-PERP`, `_PERP`, `PERP`, `.P`.
3. Cắt hậu tố broker: `.pro`, `.raw`, `.r`, `.a`, `.std`, `.ecn`, `.mini`, `.cash`, `.cfd`, `_i`, `#`, dấu `.` cuối chuỗi.
4. Xóa các ký tự phân tách `/`, `-`, `_`.
5. **Chỉ cắt hậu tố 1 ký tự chữ thường** `m`, `c`, `z`, `i` khi chuỗi dài `> 3` ký tự **và** phần gốc còn lại (sau khi viết hoa) là mã đã biết (`known`). Tuyệt đối không cắt `m`/`c` trên chuỗi đã viết hoa.
6. Chuyển sang chữ in hoa (`UPPERCASE`).
- Kết quả bắt buộc `[LỊCH SỬ — CHƯA TÁI KIỂM]`: `XAUUSDm → XAUUSD`, `EURUSDc → EURUSD`, `BTC → BTC`, `VNM → VNM`, `BTCUSDT.P → BTCUSDT`, `ETHUSDT-PERP → ETHUSDT`, `BTC/USDT → BTCUSDT`.

### 7.2 Thứ tự phân loại tất định (`classify` — Khớp đầu tiên thắng)

Bước 1 cũ của Spec v2 (`ctxMarket = stock_vn` và `^[A-Z]{3}$` ⇒ cổ phiếu VN) bị loại bỏ khỏi đầu hàm vì làm nuốt `XAU` và `BTC` (lỗi L5 / 12a). Thứ tự chuẩn hóa:
1. Tra bảng `ALIAS` ⇒ trả mã chính và nhóm (`metal`, `oil`, `index`). Nếu mã sau chuẩn hóa đổi tên (vd `XAU → XAUUSD`) thì trả `status = 'auto_notice'` kèm nút đổi.
2. Khớp `^VN30F\d+[A-Z0-9]*$` ⇒ `cls = 'futures_vn'`, `status = 'auto'`.
3. Cặp Forex 6 ký tự, cả hai nửa 3 ký tự thuộc danh sách tiền tệ ISO (không gồm `XAU`/`XAG`) và khác nhau ⇒ `cls = 'forex'`, nhóm con `sub = 'quote_usd' | 'usd_base' | 'cross'`.
4. Khớp `^([A-Z0-9]{2,10})(USDT|USDC|BUSD|FDUSD)$` ⇒ `cls = 'crypto_linear'`, giữ đúng `quote` thực tế từ hậu tố.
5. Khớp `^([A-Z0-9]{2,10})USD$` với `base` thuộc `CRYPTO_BASES` ⇒ `cls = 'crypto_usd'`, `status = 'needs_confirm'` (hỏi rõ CFD tuyến tính hay hợp đồng nghịch đảo; bản này chỉ hỗ trợ tuyến tính).
6. Mã tiền tệ ISO đơn lẻ (`EUR`, `GBP`, `JPY` (ví dụ minh họa)) ⇒ `status = 'needs_confirm'`, gợi ý `EURUSD` (ví dụ minh họa)
7. Mã trần thuộc `CRYPTO_BASES` (`BTC`, `ETH` (ví dụ minh họa)): nếu đồng thời thuộc danh sách cổ phiếu VN hoặc đang ở `ctxMarket == 'stock_vn'` ⇒ `status = 'needs_confirm'` (gợi ý `['BTCUSDT', 'BTC']`); ngược lại ⇒ tự động chuyển thành `BASE + 'USDT'`, `status = 'auto_notice'`.
8. Thuộc danh sách niêm yết VN (`VN_TICKERS`: HOSE/HNX/UPCoM) hoặc (`ctxMarket == 'stock_vn'` và khớp `^[A-Z]{3}$`) ⇒ `cls = 'stock_vn'`. Nếu `ctxMarket == 'stock_intl'` và khớp `^[A-Z]{1,5}$` ⇒ `cls = 'stock_intl'` (hợp đồng 1 cổ phiếu, quote `USD`, bước `1`).
9. Còn lại ⇒ `status = 'unknown'` kèm danh sách gợi ý `suggest = suggest(s)` từ thuật toán Levenshtein (§7.3).

### 7.3 Gợi ý bằng khoảng cách Levenshtein khi `unknown` (`suggest`)

Tính khoảng cách chỉnh sửa Levenshtein tới mọi mã chuẩn và alias đã biết, trả về tối đa 3 mã có khoảng cách **`<= 2`**. Tuyệt đối không tự động áp dụng:
- `USOLIU` ⇒ gợi ý `['USOIL']`.
- `SP100` ⇒ gợi ý `['SP500', 'SPX500', 'UK100']` (S&P 100 là chỉ số khác S&P 500 nên chỉ hỏi người dùng).
- Khi người dùng chọn gợi ý hoặc tự khai báo thông số hợp đồng thì lưu vào `InstrumentRegistry` để lần sau không hỏi lại. `[LỊCH SỬ — CHƯA TÁI KIỂM]`

### 7.4 Bảng quy ước hợp đồng mặc định

`Vpoint` = giá trị theo đồng tiền `quote` cho mỗi `1,0` đơn vị biến động giá trên `1` lot:

| Nhóm sản phẩm | `contractSize` | Bước lot / Min lot | Đồng tiền `quote` | Ghi chú & quy tắc xác nhận |
|---|---|---|---|---|
| **Forex (`forex`)** | `100.000` base | `0,01` / `0,01` | Nửa sau của cặp | Pip chuẩn `0,0001` (cặp JPY `0,01`) |
| **Vàng (`XAUUSD`)** | `100` oz | `0,01` / `0,01` | `USD` | Alias `GOLD`, `XAU` → `XAUUSD` |
| **Bạc (`XAGUSD`)** | `5.000` oz | `0,01` / `0,01` | `USD` | Alias `SILVER`, `XAG` → `XAGUSD` |
| **Dầu (`USOIL`/`UKOIL`)** | `1.000` thùng | `0,01` / `0,01` | `USD` | Tùy sàn có thể là `100` thùng; hỏi xác nhận 1 lần/sàn |
| **Chỉ số CFD (`index`)** | `1` | `0,01` / `0,01` | `US30, NAS100, SPX500`: `USD` · `GER40`: `EUR` · `UK100`: `GBP` · `JPN225`: `JPY` | Hỏi 1 lần/sàn hệ số nhân: `×1, ×5, ×10, ×20` |
| **Crypto Linear** | `1` coin | `BTC`: `0,001` · `ETH`: `0,01` · Khác: `0,01` (cờ `crypto_step_default`) | Hậu tố thực (`USDT`, `USDC` (ví dụ minh họa)) | Coi stablecoin = `1 USD` kèm cờ `stablecoin_usd_peg_assumed` |
| **Cổ phiếu VN (`stock_vn`)** | `1` cổ phiếu | Lô chẵn `100` / `100` (lô lẻ bước `1`) | `VND` | Chỉ cho phép `Buy`; bước giá `[CẦN XÁC MINH]`: HOSE `<10.000₫`: `10₫` · `10.000–49.950₫`: `50₫` · `>=50.000₫`: `100₫`; HNX/UPCoM: `100₫` |
| **Phái sinh VN (`futures_vn`)** | `100.000` ₫/điểm | `1` / `1` hợp đồng | `VND` | Bước giá `0,1` điểm `[CẦN XÁC MINH]`; cho phép cả `Buy` và `Sell` |

- Đơn vị giá cổ phiếu VN (`priceUnit = 'full' | 'thousand'`) là cài đặt theo nguồn. Nếu trong file mọi giá `< 500` và không có giá nào `>= 1.000`, hệ thống chỉ đề xuất `"Nâng lên đơn vị nghìn đồng (×1.000)"` và bắt xác nhận, không tự nhân ngầm.

## Mục 8. Động cơ định cỡ vị thế (Trade Engine và Position Sizer)

### 8.1 Quy đổi tiền tệ `Vpoint_acct`

```text
Vpoint_acct = contractSize * FX(quote -> accountCurrency)
  - FX = 1                        nếu quote == accountCurrency
  - FX = 1 (kèm cờ peg)           nếu quote là stablecoin và tài khoản là USD hoặc stablecoin
  - FX = 1 / P_conv               nếu base == accountCurrency (vd USDJPY trên TK USD);
                                  P_conv = giá SL khi lập kế hoạch định cỡ, giá RA khi tính PnL Cấp B
  - FX = fxRates[quote -> account] trong các trường hợp còn lại (cặp chéo, GER40 trên TK USD, TK VND (ví dụ minh họa))
  - Nếu thiếu tỷ giá              => trả status = 'error', why = 'thieu ty gia quote->account' (KHÔNG trả 0 hay mặc định 1)
```

### 8.2 Công thức định cỡ vị thế dùng `Decimal`

```text
R_budget   = E_base * (risk_pct / 100)
ΔP         = |entry - SL|                                              (bắt buộc > 0)
lossPerLot = (ΔP + slipPrice) * Vpoint_acct + commissionRoundTurnPerLot # Forex, CFD, futures, crypto
Cổ phiếu VN (mỗi CP): lossPerShare = (ΔP + slipPrice) + entry * feeBuy + SL * (feeSell + taxSell)
V_raw      = R_budget / lossPerLot
V_final    = floor(V_raw / step) * step                                # LÀM TRÒN XUỐNG bằng Decimal
```

- Khi `V_final < volumeMin`: trả `status = 'below_min'`, `volume = 0`, kèm `minLotRisk = volumeMin * lossPerLot`. Không bao giờ tự nâng lên lot tối thiểu.
- **Bất biến an toàn:** `riskActual <= R_budget` với mọi ca trả về `status = 'ok'`.
- **Kiểm tra hướng & phí:** `Buy` cần `SL < entry`, `Sell` cần `SL > entry` (sai trả `error`). Cổ phiếu cơ sở VN chỉ cho phép `Buy`. Tỷ lệ phí/thuế là phân số, nếu `> 0,05` trả `error` ngay.
- **Ví dụ chuẩn `[LỊCH SỬ — CHƯA TÁI KIỂM]`:** Cổ phiếu `FPT`, TK `500.000.000 ₫`, rủi ro `1%` (`5.000.000 ₫`), mua `120.000`, SL `114.000`, phí mua/bán `0,15%`, thuế bán `0,10%`: `lossPerShare = 6.000 + 180 + 285 = 6.465 ₫`, `vRaw = 773,395 (ví dụ minh họa)`, làm tròn xuống **`700 CP`**, `riskActual = 4.525.500 ₫` (bản không tính phí ra `800 CP`, nếu giữ `800 CP` khi có phí sẽ lỗ `5.172.000 ₫` vượt ngân sách).

### 8.3 Cấu trúc trả về và Bảng ánh xạ tên trường Spec ↔ Python

```ts
interface SizeResult {
  status: 'ok' | 'below_min' | 'error' | 'needs_confirm';
  volume?: Decimal;
  vRaw?: Decimal;
  vpointAcct?: Decimal;
  lossPerLot?: Decimal;
  riskActual?: Money;
  riskPctActual?: Decimal;
  minLotRisk?: Money;
  assumptions: string[];
  warnings: string[];
  why?: string;
}
```

| Tên trường chuẩn Spec (camelCase) | Tên khóa trong `tuan_trader_v3.py` / `v3_4.py` (snake_case) |
|---|---|
| `vRaw` | `vraw` (trong `v3_4.py` xuất đồng thời cả hai khóa) |
| `vpointAcct` | `vpoint` |
| `lossPerLot` | `loss_lot` |
| `riskActual` | `risk_actual` |
| `riskPctActual` | `risk_pct_actual` |
| `minLotRisk` | `min_lot_risk` |
| `warnings` | `flags` (mã cờ) + `assumptions` (diễn giải) |
| `why` | `why` |

## Mục 9. Nhập file đa nguồn, Đọc số (Q3), Net P&L 3 cấp và Ghép FIFO (Q2)

### 9.1 Kiến trúc hai lớp và Ánh xạ cột đa nguồn

- **Lớp hiển thị 8 cột:** `NGÀY`, `THỊ TRƯỜNG`, `SẢN PHẨM`, `HƯỚNG`, `KHỐI LƯỢNG`, `GIÁ VÀO`, `GIÁ RA`, `NET SAU PHÍ`.
- **Lớp lưu chuẩn:** Toàn bộ trường của `Trade` (Mục 3), giữ `importBatchId`, `rawOpenTime`, `importFingerprint` và `netPnlSource`.

| Trường chuẩn | Báo cáo MT4 / MT5 | Sàn Crypto | Chứng khoán VN / Khác |
|---|---|---|---|
| **Ngày** | `Open Time, Close Time, Time, Thời gian` | `Date(UTC), UTC_Time, Trade Time` | `Ngày GD, Ngày khớp, Date` |
| **Sản phẩm** | `Symbol, Item, Instrument` | `Pair, Symbol, Market, Contract` | `Mã CK, Mã GD, Ticker` |
| **Hướng** | `Type, Direction, Action` | `Side, Position Side` | `Loại lệnh, Mua/Bán, Side` |
| **Khối lượng** | `Volume, Size, Lots` | `Executed, Quantity, Qty, Filled` | `KL khớp, Khối lượng` |
| **Giá vào** | `Open Price, Price (cột 1)` | `Price, Entry Price, Avg Entry` | `Giá mua, Giá vào` |
| **Giá ra** | `Close Price, Price (cột 2)` | `Exit Price, Avg Close Price` | `Giá bán, Giá ra` |
| **Net P&L** | `Profit + Commission + Swap + Fee` | `Realized Profit − Fee` | `Lãi/Lỗ ròng, Net P&L` |

- **Cột trùng tên trong MT4/MT5 Positions:** Ánh xạ theo vị trí cột (`Time` đầu = mở, `Time` sau = đóng; `Price` đầu = giá vào, `Price` sau = giá ra). Ưu tiên đọc bảng `Positions`; nếu chỉ có `Deals` thì ghép FIFO (§9.4). Khối lượng dạng `1.50 / 1.50` lấy số trước dấu `/`.

### 9.2 Đọc số an toàn, Bỏ phiếu dấu thập phân theo cột và Quyết định Q3

1. **File `.xlsx`:** Đọc giá trị số gốc của ô (`cell.v`, `raw: true`), không bao giờ đọc chuỗi đã định dạng (`cell.w`).
2. **Xóa ký hiệu tiền tệ (`_clean`):** Bỏ khoảng trắng, NBSP, `'`, ký hiệu tiền. Regex tiền tệ xếp dài trước ngắn: `USDT|USDC|BUSD|FDUSD|VND|USD|EUR|GBP|JPY`. Dạng `(1,250.50)` và dấu `-` phía trước là số âm.
3. **Bỏ phiếu dấu thập phân theo cả cột (`column_decimal_sep`):**
   - Ô có cả `.` và `,` ⇒ ký tự đứng sau cùng là dấu thập phân.
   - Ô có đúng một loại dấu xuất hiện 1 lần và phần sau dấu có `!= 3` chữ số ⇒ phiếu cho dấu đó là thập phân.
   - Ô có một loại dấu xuất hiện nhiều lần (`1.234.567`) ⇒ dấu đó là phân cách hàng nghìn.
   - Phiếu hòa hoặc mơ hồ (cả cột chỉ có `1,234`, `2,500`, `1,000`) ⇒ dùng gợi ý locale nguồn, đánh dấu `ambiguous = True` và yêu cầu người dùng xác nhận trên màn hình Preview.
4. **Xử lý chuỗi rỗng (`[ĐÃ CHỐT Q3]`):**
   - Hàm `parse_number('')`, `parse_number('   ')`, `parse_number('-')` bắt buộc trả về `None` (và `parse_number_with_reason` trả `(None, 'empty')`), tuyệt đối không trả `Decimal(0)` như lỗi trong `tuan_trader_v3.py` gốc.
   - Chỉ nơi gọi ở các cột chi phí tùy chọn (`Commission`, `Swap`, `Fee`, `Tax`) mới tự quyết định gán mặc định `0` qua `parse_optional_cost()` và ghi cờ `fee_missing_as_zero`.

### 9.3 Ánh xạ hướng, Dòng tiền `CashFlow` và Net P&L 3 cấp (A / B / C)

- **Hướng theo hồ sơ nguồn (`map_direction`):** Chung `buy, long, mua → Buy`; `sell, short, bán → Sell`. Nguồn môi giới VN (`vn_broker`): `M → Buy`, `B → Sell`. Nguồn tiếng Anh (`en_broker`): `B → Buy`, `S → Sell`. Nếu không rõ nguồn mà gặp chữ cái đơn `B / M / S` thì trả `needs_confirm`.
- **Dòng tiền & Lệnh không khớp:** Dòng `balance, credit, deposit, withdrawal` tạo bản ghi `CashFlow`. Lệnh `pending, cancelled` bỏ qua và đếm vào báo cáo.
- **Ba cấp tính Net P&L (`compute_net_pnl`):**
  - **Cấp A (`file` / `derived_A`):** Có cột `Profit` / `Realized Profit` ⇒ `Net = Gross + Σ costs` (sau khi chuẩn hóa dấu: MT4/MT5 cộng đại số trực tiếp; Binance/Spot/Chứng khoán VN trừ phí dương).
  - **Cấp B (`derived_B`):** Chỉ có giá vào, giá ra, khối lượng ⇒ `Net_gross_est = sign * (P_exit − P_entry) * volume * Vpoint_acct(exit) − fee_estimated`. Nếu thiếu phí ⇒ đặt `feeKnown = false` và hiển thị nhãn **`"Gross ước tính (chưa phí)"`**.
  - **Cấp C (`derived_C`):** Từng lệnh khớp `BUY`/`SELL` đơn lẻ ⇒ ghép chu kỳ FIFO (§9.4).

### 9.4 Ghép FIFO chu kỳ phẳng → phẳng và Quyết định Q2 (`entry_avg` & `entry_avg_closed`)

- Một `Trade` tương ứng với một chu kỳ vị thế `0 → khác 0 → 0`; các lệnh mở thêm (`scale-in`) và đóng từng phần (`scale-out`) lưu trong `entry_legs` và `legs`.
- **Đảo chiều trong một lệnh (`Flip`):** Phần đóng hết vị thế cũ khép lại chu kỳ `closed` cũ; phần khối lượng dư mở ngay chu kỳ mới ngược chiều.
- **Spot / Cổ phiếu cơ sở VN (`allow_short = false`):** Lệnh bán không có vị thế mua đang mở ⇒ tạo bản ghi `status = 'orphan_sell'`, gắn cờ cảnh báo và không tính vào lợi nhuận.
- **Giá vào trung bình của chu kỳ mở (`[ĐÃ CHỐT Q2]`):**
  - Giữ trường **`entry_avg`** là giá vào trung bình gia quyền của **toàn bộ các chân đã mở trong chu kỳ** (`entry_cost / entry_qty`).
  - Thêm trường **`entry_avg_closed`** là giá vốn trung bình gia quyền của **phần khối lượng đã đóng theo FIFO** (`entry_cost_closed / exit_qty`).
  - Ví dụ chuẩn `[LỊCH SỬ — CHƯA TÁI KIỂM]`: Với `BUY 1 @100 (phí 0,10)`, `BUY 1 @110 (phí 0,11)`, `SELL 1,5 @120 (phí 0,18)`, bản ghi `open` có `gross = 25`, `net_price_units = 24,665`, `open_qty = 0,5`, **`entry_avg = 105`** và **`entry_avg_closed = 103,333333 (ví dụ minh họa)`** (`155 / 1,5`). Khi đóng nốt `SELL 0,5 @130`, cả hai trường hội tụ về `105`.

### 9.5 Kiểm toán giá ngoại lai bằng Robust Z-Score trên log giá (`robust_z_log`)

Với dãy giá `P_1 .. P_n > 0` cùng mã (`n >= 5`), đặt `y_i = ln(P_i)`, `M = median(y)`, `MAD = median(|y_i − M|)`:
```text
Z_i = 0,6745 * |y_i - M| / max(MAD, 10^-3)
```
Gắn cờ `price_out_of_range` khi `Z_i > 3,5` (giá bị cờ không tự sửa; giá `<= 0` không lấy log). `[LỊCH SỬ — CHƯA TÁI KIỂM]` Dãy `[2650, 2655, 2640, 2660, 2648, 2652, 587.02]` bắt đúng dòng cuối với `Z = 539,33`.


### 9.6 Hợp đồng Cấp C, đơn vị phí và dữ liệu chu kỳ

`compute_net_pnl('C', fills=fills, vpoint_exit=vpoint)` gọi FIFO rồi `cycle_to_trade`. Một fill phải thuộc đúng một account/symbol; pipeline phân nhóm trước FIFO. Chu kỳ giữ `entryPrice=entry_avg`, `entryAvgClosed=entry_avg_closed`, toàn bộ legs, khối lượng còn mở, trạng thái và nguồn `derived_C`.
`cycle_net_account = gross_price_units * vpoint - realized_entry_fee - exit_fee` nếu `fees_in_account=True`; nếu phí cùng đơn vị quote-price thì nhân tổng phí với vpoint (`fees_in_account=False`). `net_price_units` chỉ được dùng như tiền khi vpoint=1. Với vpoint khác 1, Trade.net_price_units=None và có cờ `net_price_units_not_account_money`; dùng `netPnl` bằng tiền tài khoản.
Fee ngoại tệ được nhân `fee_fx_rate` trước chuẩn hóa dấu ở A/B. Thiếu FX hiện gross ước tính với feeKnown=False; không tuyên bố net sau phí. Dữ liệu phí bắt buộc sai không được âm thầm thành 0; phí thiếu tùy chọn được gán 0 kèm cờ.
Ở Cấp C, feeCurrency được giữ theo fill, phí ngoại tệ được đổi trước ghép FIFO và chuyển sang tiền tài khoản; rawFill và rawRow được lưu để truy vết. Thiếu FX báo fee_unconverted, feeKnown=False, chỉ gross ước tính. Cycle đã ghép nhưng khai phí ngoại tệ phải cấp original fills để quy đổi, nếu không trả needs_confirm, không giả phí là tiền tài khoản.

### 9.7 Thời gian UTC, DST và pipeline Preview

`source_to_utc(raw, serverTimeZone, date_order='YMD', fold=None, date_only=False)` trả utc datetime aware, iso, status, reason, flags. Timestamp đã có offset dùng đúng offset đó. Giờ gốc chưa có offset cần timezone IANA. Không tồn tại do DST trả `dst_nonexistent`; giờ lặp trả `dst_ambiguous` đến khi chỉ định fold=0 hoặc fold=1. DateOnly giữ None và cờ date_only, không giả định 00:00. Fingerprint chỉ đọc canonical giờ gốc, không hash sau đổi UTC. `trading_day_key` đổi về múi giờ tài khoản rồi trừ dailyResetTime trước khi lấy ngày.
`COLUMN_ALIASES` và `map_columns` ánh xạ theo vị trí, giữ được Time/Price trùng tên; volume lấy phần trước dấu /. `detect_header` quét tìm dòng header. `read_import_rows` nhận CSV, HTML, sequence/dict hoặc Path XLSX; XLSX dùng raw v, không dùng formatted w. Adapter XLSX tham chiếu đọc worksheet đầu; số serial ngày không tự đoán thành timestamp, sẽ yêu cầu chuẩn hóa trước khi import.
`import_pipeline` nối parse → mapping → direction/cashflow → classify → P&L → R → fingerprint → multiset → audit. Mặc định Preview thuần, trả NEW/ENRICH/SKIP/cashflow/cashflow_NEW/ignored/rejected, quyết định số theo từng cột, trades/cashflows/cờ cảnh báo. Cột mơ hồ phải được cấp decimal_choices; dòng sai/giờ DST mơ hồ không được commit. `price_unit='thousand'` là lựa chọn tường minh cho cổ phiếu VN; mặc định full, tuyệt đối không tự nhân 1000.
FIFO pipeline sắp thứ tự theo datetime UTC trước khi ghép, xử lý được file xuất mới nhất trước. Nếu chỉ có ngày, trả needs_confirm/fifo_order_confirmation_required; chỉ dùng thứ tự dòng khi caller đã cấp confirm_fifo_order=True, kèm fifo_intraday_order_unknown. Không giả biết thứ tự khớp trong ngày.
Muốn commit phải truyền db_records; có cashflow còn cần db_cashflows để commit chung hai sổ. Preview, kiểm tra toàn bộ và dựng working copy trước khi ghi, không có ghi nửa batch. Equity hiện tại không được giả làm equity tại openTime cho fallback lịch sử; khi không biết vốn tại entry, trả thiếu 1R hoặc dùng mode cấu hình thấp hơn thay vì bịa.

## Mục 10. Chống trùng, So khớp Multiset, `ENRICH` và Gợi ý gộp

### 10.1 Khóa chống trùng (`import_fingerprint`)


   - Có mã lệnh gốc: `SHA256('T|' + source + '|' + accountId + '|' + externalTicket)`.
   - Không có mã gốc: `SHA256('F|' + source + '|' + accountId + '|' + canonicalTime + '|' + normalize(symbol) + '|' + direction + '|' + normDec(volume) + '|' + normDec(entryPrice))`. `canonicalTime` lấy từ chuỗi giờ gốc trong file (`canonical_raw_time`), không đổi múi giờ trước khi hash (sửa lỗi L2).
### 10.2 So khớp Multiset (`upsert_multiset_batch`)

 Với mỗi nhóm cùng khóa `importFingerprint`, gọi `k` là số bản ghi trong DB, `m` là số dòng trong file. Nếu `m > k` thì thêm đúng `m − k` bản ghi `NEW` (`occurrenceIndex = k .. m−1`); nếu `m <= k` thì `0 NEW` và thực hiện `ENRICH` / `SKIP`.
### 10.3 Quy tắc cập nhật `ENRICH` và Hoàn tác (`enrich_trade_record`, `undo_import_batch`)


   - Chỉ điền các trường đang trống (`null`) hoặc cập nhật thông tin đóng lệnh khi bản ghi chuyển trạng thái từ `open → closed`.
   - Không bao giờ ghi đè `userEditedFields`, `notes`, `screenshots`, `setupId`, `disciplineTags`, `isReviewed`.
   - Mỗi lần nhập có `importBatchId`, commit nguyên tử theo giao dịch và hỗ trợ hoàn tác lần nhập gần nhất.
### 10.4 Gợi ý gộp (`find_merge_candidates`)

 Gợi ý trên màn hình Preview khi hai bản ghi cùng mã, hướng, khối lượng, ngày lịch, giá vào `± price_tol` và đúng một bên có `dateOnly = true`.


### 10.5 Receipt hoàn tác và bảo vệ chỉnh sửa sau import

`upsert_multiset_batch(db_records, incoming_records, import_batch_id, batch_journal=None)` dựng bản sao rồi commit vào list; trả khóa cũ cộng `undo={batch,before,after}`. ID bản ghi NEW bị trùng được sinh từ fingerprint + occurrenceIndex, không đổi ID cũ. `undo_import_batch(db,batch,undo_record=None,batch_journal=None,db_cashflows=None)` có receipt khôi phục cả NEW lẫn ENRICH và kiểm tra mọi chỉnh sửa về sau; xung đột trả ValueError thay vì xóa dữ liệu mới. Receipt từ pipeline có cash_before/cash_after và yêu cầu cùng kho cashflow khi hoàn tác. API hai tham số cũ chỉ xóa NEW như trước, không đủ để khôi phục ENRICH; ứng dụng phải lưu receipt để bảo đảm hoàn tác đầy đủ.

## Mục 11. Kiểm toán dữ liệu 5 bước và Quy tắc Sao lưu / Đồng bộ Trình duyệt

| Bước | Kiểm tra | Hành vi bắt buộc |
|---:|---|---|
| **1** | Mỗi `Trade` gắn với `accountId` và `currency`. Báo cáo gộp nhiều tài khoản chỉ dùng `fxRates` cho số tiền; chỉ số R tính trực tiếp từ `rMultiple` từng lệnh | Cảnh báo nếu thiếu tỷ giá hoặc tỷ giá cũ hơn 7 ngày |
| **2** | Zero-Missing-1R: SL hợp lệ ⇒ 1R chuẩn; khuyết SL ⇒ chuỗi Fallback (§5.5) | Không chặn lệnh thiếu SL; hiển thị tỷ lệ chuẩn / ước lượng |
| **3** | Hợp lệ giá và chiều (`audit_trade_record`): `Buy` mà `P_exit > P_entry` thì `Gross >= 0` và `SL < P_entry`; `Sell` ngược lại (chỉ xét dấu trên `Gross`) | Gắn cờ `pnl_sign_mismatch`, `invalid_sl_side` trên Preview |
| **4** | `closeTime >= openTime`; tính `holdTime`; nếu `dateOnly = true` thì `holdTime = session = null` | Gắn cờ `time_inversion` nếu `closeTime < openTime` |
| **5** | Mọi thay đổi (thêm/sửa/nhập/đổi vốn/đổi SL) kích hoạt tính lại qua selector memoized | Đồng bộ tức thời giữa Classic và V6 (§14) |

- **Sao lưu & Ranh giới Storage trình duyệt:** Một `UnifiedJournalStore` có `schemaVersion` và kiểm thử chuyển đổi dữ liệu (migration dry-run); hỗ trợ soft-delete + audit log; định kỳ xuất file backup có checksum, phiên bản định dạng và kiểm thử khôi phục (restore test). Storage trình duyệt khác origin hoặc khác profile (ví dụ Chrome thường và Chrome Incognito) không mặc định tự đồng bộ ngầm: người dùng chủ động import/restore file sao lưu, không đọc ngầm cross-origin và không xóa tài khoản demo khi cập nhật.

## Mục 12. Prop Firm Simulator v3.4 (Đã cập nhật Q4 Topstep 17/09/2026 [ngày do đầu vào tự khai; xem kiểm tra hiện tại ở Mục 12.2])

### 12.1 Nguyên tắc vận hành

- Dùng tiền tệ của gói quỹ (mặc định `USD`), độc lập với tiền tệ nhật ký.
- Bỏ khóa cứng `"Cần >= 10 lệnh"`: `N = 0` ⇒ chỉ chạy chế độ tham số (`Parametric`); `1 <= N < 30` ⇒ cho chạy kèm cảnh báo đỏ `small_sample_warning = true`.

### 12.2 Lược đồ `PropPresetV3` và Bảng Quy tắc Quỹ (Cập nhật Q4 từ Topstep Help Center 17/09/2026 [ngày do đầu vào tự khai; xem kiểm tra hiện tại ở Mục 12.2])

| Quỹ / Chương trình | Mục tiêu Lãi (`profitTargetPct`) | Giới hạn Lỗ Tối đa (`maxLoss`) | Giới hạn Lỗ Ngày (`dailyLoss`) | Quy tắc Đặc thù & Nguồn Xác minh (`[ĐÃ CHỐT Q4]`) |
|---|---|---|---|---|
| **Topstep 50K Trading Combine** (`topstep_50k_combine`) | **6%** (`$3.000`) | **4%** (`$2.000`), `EOD_TRAILING`, khóa sàn tại vốn gốc (`$50.000`) | Tùy chọn | **[CẦN XÁC MINH TOÀN BỘ PRESET]:** Trading Combine áp dụng Consistency **`55%`** (`INCREASE_TARGET_SOFT`: nếu ngày thắng lớn nhất `bestDay` vượt `55%` tổng lãi thì mục tiêu lợi nhuận mới tự động tăng thành **`bestDay / 0,55`**). Các bài review thứ cấp ghi `50%` là bản cũ. |
| **Topstep 50K XFA — Standard Path** (`topstep_50k_xfa_standard`) | — (Tài khoản cấp vốn) | **4%** (`$2.000`), `EOD_TRAILING`, sau lần rút đầu: `LOCK_AT_INITIAL` (`$0`) | Tùy chọn | **[CẦN XÁC MINH TOÀN BỘ PRESET]:** Đường **Standard** của XFA **không có quy tắc Consistency** (`enabled = false`). Sau lần rút tiền đầu tiên trên XFA, sàn lỗ tối đa khóa ở `$0`. |
| **Topstep 50K XFA — Consistency Path** (`topstep_50k_xfa_consistency`) | — (Tài khoản cấp vốn) | **4%** (`$2.000`), `EOD_TRAILING`, sau lần rút đầu: `LOCK_AT_INITIAL` (`$0`) | Tùy chọn | **[CẦN XÁC MINH TOÀN BỘ PRESET]:** Đường **Consistency** của XFA áp dụng ngưỡng **`40%`** (`max_day_share = 0,40`, mục tiêu rút điều chỉnh theo `bestDay / 0,40`). |
| **The5ers 100K High Stakes (Bản mới)** | V1: **10%**, V2: **5%** | **10%**, `STATIC` (sàn `$90.000`) | **5%** theo `max(Balance, Equity)` cuối ngày trước | Tối thiểu **3 ngày lãi**, mỗi ngày lãi `>= 0,5%` vốn gốc (`$500`), tính riêng từng vòng (`verified = false`). |
| **The5ers 100K High Stakes (Cổ điển)** | V1: **8%**, V2: **5%** | **10%**, `STATIC` | **5%** | Tối thiểu 3 ngày lãi `>= 0,5%` vốn gốc/ngày (`verified = false`). |
| **FTMO 100K 2-Step** | V1: **10%**, V2: **5%** | **10%**, `STATIC` | **5%** (`$5.000`) từ số dư đầu ngày (`00:00 CE(S)T`) | Tối thiểu **4 ngày giao dịch** mỗi vòng; hoàn phí thi ở lần chia lợi nhuận đầu tiên (`refundOnFunded = true`, `verified = false`). |
| **Apex 50K Intraday / PA** | **6%** (`$3.000`) | **4%** (`$2.000`), `INTRADAY_TRAILING` hoặc `EOD` | Không áp dụng cho gói Intraday chuẩn | Tài khoản PA: sàn trailing khóa tại vốn gốc cộng **`+$100`** (`lockOffsetAmount = 100`, `LOCK_AT_BUFFER`), Consistency `30%` khi rút (`verified = false`). |


**Kiểm tra nguồn chính thức ngày 28/10/2026:**

- [Topstep Consistency](https://help.topstep.com/en/articles/8284208-consistency-at-topstep): xác nhận Combine 55%, XFA Consistency 40%; Standard không có Consistency theo [XFA Parameters](https://help.topstep.com/en/articles/8284215-express-funded-account-parameters).
- [Topstep Payout Policy](https://help.topstep.com/en/articles/8284233-topstep-payout-policy): ngoài tỷ lệ chia còn có số ngày, giới hạn tiền rút và điều kiện theo cửa sổ. Preset đầu vào thiếu các trường này, nên không xác nhận toàn bộ preset.
- [The5ers High Stakes](https://the5ers.com/high-stakes/): trang hiện tại có 10%/5%, daily 5%, max loss 10%, 3 ngày có lãi và ngưỡng 0.5%; chưa xác minh toàn bộ bản Classic, phí và chế độ sau payout.
- [FTMO Trading Objectives](https://ftmo.com/en/trading-objectives/): đối chiếu yêu cầu 4 ngày của 2-Step; chưa xác minh toàn bộ phí, hoàn phí và điều kiện theo phiên bản đơn hàng.
- Apex: truy cập bài quy tắc chính thức không thành công trong lần này; không có căn cứ cập nhật tham số.

Tất cả `DEFAULT_PROP_PRESETS` có `verified=False`, `last_verified=None`. Bộ số được giữ để tương thích theo D5; ngày effective_from/program_version từ đầu vào là lịch sử tự khai, không phải chứng nhận hiện hành. XFA target=None đúng D1. Bảng ở trên là cấu hình mô phỏng, không phải toàn bộ điều kiện hợp đồng.

### 12.3 Lấy mẫu R và Thuật toán mô phỏng một kịch bản (`simulate_path`)

- **Ba chế độ lấy mẫu thực nghiệm:** `iid` (mặc định cho người mới) · `block` (độ dài khối `b = 5`, giữ chuỗi thắng/thua) · `day` (lấy nguyên ngày giao dịch).
- **Quy tắc trong vòng lặp kịch bản (`simulate_path`):**
  - Không trừ phí hai lần (lỗi F2): chỉ trừ `fee_drag_R` khi `sample_mode == 'parametric'` hoặc `fee_known == False`.
  - So sánh chạm sàn cùng đơn vị số dư (lỗi F3): `low <= fl_daily` và `low <= floor`.
  - Với `INTRADAY_TRAILING` khi thiếu `mfeR`/`maeR`: chạy song song hai kịch bản `optimistic` (chặn trên) và `pessimistic` (chặn dưới, giả định lệnh thắng vọt cao hơn điểm đóng `mfe_extra_R = 0,5R` kéo sàn lên trước khi kiểm đáy) với cùng hạt giống `seed * 1_000_003 + b` để đảm bảo `lower <= upper`.
  - Với `Consistency` (`check_consistency_rule`): nếu `behavior == 'INCREASE_TARGET_SOFT'` thì `need = max(target, best_day / max_day_share)`; nếu `FAIL_HARD` và `best_day > max_day_share * total` thì đánh rớt.

### 12.4 Bootstrap Hai Tầng, Chuỗi trượt tương quan và Công thức `EV_attempt` / `ROI`

- **Bootstrap hai tầng (`prop_pass_probability`):** Vòng ngoài `b = 1 .. B_outer` (mặc định `200`, Bayesian Dirichlet `Exp(1)` hoặc Efron/Block) sinh lợi thế tiềm ẩn; vòng trong `m = 1 .. M_inner` (mặc định `300`) ước lượng `P_b`. Trả về `[p5, p50, p95]`, `mean`, khoảng tin cậy Wilson 95% (`wilson_ci95`) ở một world; nhiều world dùng `wilson_ci95_by_world`, không gộp tương quan thành Bernoulli độc lập; cùng cờ `small_sample_warning`.
- **Ngân sách dự phòng 90% (`N_90`) và Rủi ro chuỗi trượt (`fail_streak_risk`):**
  - Độc lập (`n_attempts_independent`): `N_90 = ceil(ln(0,10) / ln(1 − P))`.
  - Tương quan qua vòng ngoài (`attempts_for_confidence`): `n` nhỏ nhất sao cho `E_b[1 − (1 − P_b)^n] >= 0,90`; rủi ro trượt `k` lần liên tiếp `= E_b[(1 − P_b)^k] >= (1 − E[P])^k`.
- **Kỳ vọng tài chính (`prop_ev_roi` — bắt buộc dùng `mean`, không dùng `median`):**
  ```text
  EV_attempt = E[Σ payout * profitSplit] + P(Funded) * refund - challengeFee - P(Funded) * activationFee
  ROI (%)    = EV_attempt / (challengeFee + P(Funded) * activationFee) * 100
  ```


### 12.5 Lấy mẫu ngày, funded và vòng đời đầy đủ (B8)

`resample='day'` yêu cầu mỗi mẫu dạng `{R, day, fee_known, mae_R, mfe_R}`. Nhóm theo khóa day, bốc nguyên nhóm ngày với replacement, giữ thứ tự lệnh trong ngày; cả outer và inner đều dùng nhóm ngày. Thiếu khóa ngày trả lỗi/warning `day_keys_required`, không rơi về Efron. Chuỗi ngày [+2,-2] luôn đóng ròng 0; không được tách thành hai ngày +2 độc lập để vượt mục tiêu cuối ngày.
`N=0, sample_mode='parametric'`: phải cung cấp parametric_mean và parametric_sd; thiếu trả needs_confirm/parametric_distribution_required. Phân phối normal được cấu hình tường minh, parametric_n mặc định 200, seed cố định để sinh population; sd=0 là đường tất định. Không có tham số thì không tự giả lợi thế. Empirical N=0 trả empty. Fee drag chỉ trừ cho mẫu tham số hoặc mẫu chưa có phí.
`simulate_funded_phase` không có profit target. Input là sample population/cumulative weights cùng preset; hoặc daily_returns là đường P&L tiền tệ tường minh dùng kiểm chứng. Mọi số dư/sàn/payout bằng Decimal, risk theo phần trăm vốn gốc. Tính MAE/MFE, max loss, daily loss, EOD/intraday trailing; `<=` sàn là breach như mô hình cũ.
Payout theo số ngày giao dịch đã mô phỏng kể từ payout trước (giả định tường minh, không phải lịch nghỉ thị trường), chỉ rút khi đạt `min_payout` và điều kiện Consistency ở cửa sổ hiện tại. `payout_fraction` mặc định 1, `payout_cap` tùy chọn; rút gross khỏi balance, người dùng nhận gross × profit_split. Đây là chính sách rút giả định để cấu hình, không tự áp dụng giới hạn từng quỹ chưa được mô hình hóa.
Sau payout đầu: KEEP_FLOOR giữ sàn và tiếp tục trailing; LOCK_AT_INITIAL khóa B0; LOCK_AT_BUFFER khóa B0+offset; FULL_RESET đưa peak=B0 và floor=B0−lossBudget, không thay số dư còn lại. Nếu balance sau rút <= sàn mới thì trả reason `post_payout_floor_reached`, không giả tài khoản vẫn an toàn. Reset Consistency chỉ gồm lợi nhuận các ngày sau rút.
`prop_full_lifecycle` bốc cùng một world latent cho các phase evaluation và funded; mỗi phase reset về vốn gốc như engine tham chiếu. Trả phase_pass_counts, P(Funded), gross/net mean payout **vô điều kiện theo mỗi lần thi**, EV và ROI gọi `prop_ev_roi`. Lần thi rớt có payout=0, activation chỉ tính khi funded, refund theo boolean cấu hình. Không dùng median và không nhân P(Funded) hai lần vào mean đã vô điều kiện. Phase target=None phải gọi trực tiếp funded simulator; lifecycle evaluation không nhận phase đó.
Wilson nhiều-world chỉ báo khoảng có điều kiện theo từng world; pooled Wilson không có giá trị (None), vì các lần thi trong cùng world tương quan qua lợi thế latent. Các seed và cấu hình đều được trả/ghi trong kiểm thử.
**[ĐỀ XUẤT — CHƯA ÁP DỤNG]:** Topstep quy định chi tiết cửa sổ/ngày thắng/payout cap và FTMO thời điểm hoàn phí; cần cấu hình riêng theo hợp đồng thực trước khi coi simulator như bản sao quy tắc quỹ. Không tự sửa bộ số hoặc công thức Q4 trong gói này.

## Mục 13. Kiến trúc Giao diện Hợp nhất Classic – V6

- **Trung tâm nhập liệu duy nhất tại Classic (`Ctrl+N` — `Unified Ingestion Drawer` 3 tab):** (1) Điền lệnh trực tiếp tích hợp Sizer & nút lưu bản nháp Pre-trade Plan; (2) Tải lên & cập nhật file đa nguồn có Preview, Column Mapper, gợi ý gộp và nút Hoàn tác lần nhập; (3) Kết nối, cấu hình `AccountProfile`, sao lưu JSON và nút `"Nạp dữ liệu mẫu"`. Xóa toàn bộ các nút nhập trùng lặp và mục nhập riêng ở V6.
- **Executive Cockpit 3 tầng (Đầu trang Classic):**
  - *Tầng 1:* Thẻ Vốn thực tế · Lợi nhuận ròng · Drawdown hiện tại/tối đa (`NAV DD` / `DD theo R`) · Expectancy · Profit Factor · Win Rate & Payoff · SQN (7 bậc) / `Ω(0)` · Thanh Daily Loss · Đồng hồ Safety Gate · Tỷ lệ bao phủ 1R chuẩn/ước lượng.
  - *Tầng 2:* Bên trái (`≈65%`) đường cong vốn + underwater drawdown chart (có công tắc bật/tắt đường `"không phí"`); bên phải (`≈35%`) histogram phân phối R kèm `Ω(0)`, median R, `ES_5%`.
  - *Tầng 3:* Ma trận lợi thế theo Thị trường · Sản phẩm · Setup · Phiên · Tuân thủ kỷ luật.
- **Liên kết dữ liệu 6 nhóm trên một `UnifiedJournalStore`:** Rủi ro & vốn · Định cỡ vị thế · Lợi thế thống kê · Hành vi & chuỗi · Prop Simulator · Review & lịch (`isReviewed = true` giảm ngay bộ đếm `"Chờ review"`).

## Mục 14. Kiến trúc Tính toán, Hiệu năng, Cross-Browser và Bảo mật Log

1. **`UnifiedJournalStore` + Selector Memoization:** Mọi chỉ số là selector thuần hàm phụ thuộc `(trades, cashflows, accountProfile, bộ lọc)`, có nút rebuild từ dữ liệu thô và đối chiếu checksum.
2. **Phân tách luồng đồng bộ và Web Worker:**
   - *Chỉ số nhẹ* (`R`, Win Rate, PF, SQN, `Ω`, `ES_5%`, NAV DD, `DD_R`, Kelly chia đôi): `O(N)`, chạy đồng bộ (`< 50 ms` cho `<= 5.000` lệnh).
   - *Chỉ số nặng* (Monte Carlo 2 tầng, quét lưới rủi ro, replay nhiều nghìn lệnh): chạy bất đồng bộ trong **Web Worker** theo từng khối (`500` kịch bản/khối), có thanh tiến độ và nút hủy.
3. **Tương thích trình duyệt (Cross-Browser) & PWA Offline:** Kiểm thử đầy đủ trên Chrome, Chrome Incognito, Samsung Internet, Edge và Firefox; kiểm tra phiên bản bundle, migration storage và trạng thái cache/service worker. Chế độ PWA offline phải hiển thị rõ trạng thái `local-only` hay đã đồng bộ.
4. **Bảo mật nhật ký lỗi (Error Log Sanitization):** Tuyệt đối không ghi bot token, API key hoặc thông tin xác thực (credentials) vào error log; chỉ lưu mã băm định danh (`ID hash / trace ID`).

## Mục 15. Danh sách 125 vector và kiểm thử mở rộng v3.4

### 15.1 Nguồn kỳ vọng và giới hạn tái lập lịch sử

Không có run_125_vectors.py, tệp engine gốc hoặc PDF/DOCX lịch sử trong gói hiện tại.
Tuyên bố cũ “105/125”, “125/125” và các hash/số dòng liên quan được phân loại **[LỊCH SỬ — CHƯA TÁI KIỂM]**; không coi là kết quả của lượt này.
125 vector dưới đây được dựng lại từ giá trị chuẩn cụ thể của đặc tả, hoặc phép tính độc lập công khai.
Mỗi ID là một ca pytest parameter. Những ca composite được ghi `scenario` với mô tả đầu vào trong bảng bổ sung; không đếm từng assertion thành ca riêng.
Không có ca SNAPSHOT. `decimal` là so sánh Decimal chính xác; `fraction` là oracle Fraction độc lập tại prec=40;
`approx` dùng dung sai tuyệt đối công khai, không nới sau khi chạy; `contains` kiểm tra cờ.
125 ca này đã được chạy trên cả tệp đầu vào nguyên trạng và bản vá để kiểm tra hồi quy.

### 15.2 Số lượng bắt buộc theo nhóm

| Nhóm | Nội dung | Số ca |
|---:|---|---:|
| 1 | Chuẩn hóa symbol | 11 |
| 2 | Phân loại & Levenshtein | 20 |
| 3 | Sizer | 25 |
| 4 | Đọc số / bỏ phiếu / giá ngoại lai | 20 |
| 5 | Implied vpoint & scale-in 1R | 4 |
| 6 | NAV & DD_R | 6 |
| 7 | Metrics / Kelly / ES | 15 |
| 8 | FIFO / flip / Q2 | 5 |
| 9 | Prop / EOD / Consistency | 10 |
| 10 | Fingerprint / multiset | 4 |
| 11 | Replay Tier3 | 1 |
| 12 | UTC / ENRICH / Net A-B | 3 |
| 13 | JSON-safe API | 1 |

### 15.3 Toàn bộ input, kỳ vọng và nguồn của 125 ca


**Nhóm 1: Chuẩn hóa symbol**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G01-01 | `normalize` {"args":["XAUUSDm"],"kwargs":{}} | "XAUUSD" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-02 | `normalize` {"args":["EURUSDc"],"kwargs":{}} | "EURUSD" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-03 | `normalize` {"args":["BTC"],"kwargs":{}} | "BTC" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-04 | `normalize` {"args":["VNM"],"kwargs":{}} | "VNM" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-05 | `normalize` {"args":["BTCUSDT.P"],"kwargs":{}} | "BTCUSDT" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-06 | `normalize` {"args":["ETHUSDT-PERP"],"kwargs":{}} | "ETHUSDT" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-07 | `normalize` {"args":["BTC/USDT"],"kwargs":{}} | "BTCUSDT" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-08 | `normalize` {"args":[" eur_usd.pro "],"kwargs":{}} | "EURUSD" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-09 | `normalize` {"args":["USDJPY_i"],"kwargs":{}} | "USDJPY" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-10 | `normalize` {"args":["GOLD#"],"kwargs":{}} | "GOLD" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |
| G01-11 | `normalize` {"args":["EURUSD."],"kwargs":{}} | "EURUSD" | Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp |

**Nhóm 2: Phân loại & Levenshtein**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G02-01 | `classify` {"args":["XAU"],"kwargs":{"ctx_market":null}} | {"symbol":"XAUUSD","cls":"metal","status":"auto_notice"} | Đặc tả §7.2, thứ tự phân loại |
| G02-02 | `classify` {"args":["XAGUSD"],"kwargs":{"ctx_market":null}} | {"cls":"metal","status":"auto"} | Đặc tả §7.2, thứ tự phân loại |
| G02-03 | `classify` {"args":["WTI"],"kwargs":{"ctx_market":null}} | {"symbol":"USOIL","cls":"oil"} | Đặc tả §7.2, thứ tự phân loại |
| G02-04 | `classify` {"args":["NAS100"],"kwargs":{"ctx_market":null}} | {"cls":"index"} | Đặc tả §7.2, thứ tự phân loại |
| G02-05 | `classify` {"args":["VN30F1M"],"kwargs":{"ctx_market":null}} | {"cls":"futures_vn"} | Đặc tả §7.2, thứ tự phân loại |
| G02-06 | `classify` {"args":["EURUSD"],"kwargs":{"ctx_market":null}} | {"cls":"forex","sub":"quote_usd"} | Đặc tả §7.2, thứ tự phân loại |
| G02-07 | `classify` {"args":["USDJPY"],"kwargs":{"ctx_market":null}} | {"cls":"forex","sub":"usd_base"} | Đặc tả §7.2, thứ tự phân loại |
| G02-08 | `classify` {"args":["EURGBP"],"kwargs":{"ctx_market":null}} | {"cls":"forex","sub":"cross"} | Đặc tả §7.2, thứ tự phân loại |
| G02-09 | `classify` {"args":["BTCUSDT"],"kwargs":{"ctx_market":null}} | {"cls":"crypto_linear","quote":"USDT"} | Đặc tả §7.2, thứ tự phân loại |
| G02-10 | `classify` {"args":["ETHUSDC"],"kwargs":{"ctx_market":null}} | {"cls":"crypto_linear","quote":"USDC"} | Đặc tả §7.2, thứ tự phân loại |
| G02-11 | `classify` {"args":["BTCUSD"],"kwargs":{"ctx_market":null}} | {"status":"needs_confirm"} | Đặc tả §7.2, thứ tự phân loại |
| G02-12 | `classify` {"args":["EUR"],"kwargs":{"ctx_market":null}} | {"status":"needs_confirm"} | Đặc tả §7.2, thứ tự phân loại |
| G02-13 | `classify` {"args":["BTC"],"kwargs":{"ctx_market":null}} | {"symbol":"BTCUSDT","status":"auto_notice"} | Đặc tả §7.2, thứ tự phân loại |
| G02-14 | `classify` {"args":["BTC"],"kwargs":{"ctx_market":"stock_vn"}} | {"status":"needs_confirm"} | Đặc tả §7.2, thứ tự phân loại |
| G02-15 | `classify` {"args":["FPT"],"kwargs":{"ctx_market":null}} | {"cls":"stock_vn"} | Đặc tả §7.2, thứ tự phân loại |
| G02-16 | `classify` {"args":["ABC"],"kwargs":{"ctx_market":"stock_vn"}} | {"cls":"stock_vn"} | Đặc tả §7.2, thứ tự phân loại |
| G02-17 | `classify` {"args":["AAPL"],"kwargs":{"ctx_market":"stock_intl"}} | {"cls":"stock_intl"} | Đặc tả §7.2, thứ tự phân loại |
| G02-18 | `classify` {"args":["XAU"],"kwargs":{"ctx_market":"stock_vn"}} | {"cls":"metal","symbol":"XAUUSD"} | Đặc tả §7.2, thứ tự phân loại |
| G02-19 | `suggest` {"args":["USOLIU"],"kwargs":{}} | ["USOIL"] | Đặc tả §7.3 |
| G02-20 | `suggest` {"args":["SP100"],"kwargs":{}} | ["SP500","SPX500","UK100"] | Đặc tả §7.3 |

**Nhóm 3: Sizer**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G03-01 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"1.085","sl":"1.083","direction":"buy","sym":"EURUSD"}} | {"status":"ok","volume":{"decimal":".50"},"loss_lot":{"decimal":"200"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-02 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"155","sl":"154","direction":"buy","sym":"USDJPY"}} | {"volume":{"decimal":".15"},"risk_actual":{"approx":97.4025974025974,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-03 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"155","sl":"156","direction":"sell","sym":"USDJPY"}} | {"volume":{"decimal":".15"},"risk_actual":{"approx":96.15384615384615,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-04 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"2650","sl":"2640","direction":"buy","sym":"XAUUSD"}} | {"volume":{"decimal":".10"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-05 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"2650","sl":"2640","direction":"buy","sym":"XAU"}} | {"volume":{"decimal":".10"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-06 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"31","sl":"30.5","direction":"buy","sym":"XAGUSD"}} | {"volume":{"decimal":".04"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-07 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"70","sl":"69.5","direction":"buy","sym":"USOIL"}} | {"volume":{"decimal":".20"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-08 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"20000","sl":"19900","direction":"buy","sym":"NAS100"}} | {"volume":{"decimal":"1.00"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-09 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"20000","sl":"19900","direction":"buy","sym":"NAS100","csize_override":10}} | {"volume":{"decimal":".10"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-10 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"60000","sl":"59000","direction":"buy","sym":"BTCUSDT","account":"USDT"}} | {"volume":{"decimal":".100"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-11 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"60000","sl":"59000","direction":"buy","sym":"BTCUSDT"}} | {"volume":{"decimal":".100"},"flags":{"contains":"stablecoin_usd_peg_assumed"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-12 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":".86","sl":".858","direction":"buy","sym":"EURGBP","fx":{"('GBP', 'USD')":"1.30"}}} | {"volume":{"decimal":".38"},"vpoint":{"decimal":"130000"},"loss_lot":{"decimal":"260"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-13 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":".86","sl":".858","direction":"buy","sym":"EURGBP"}} | {"status":"error"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-14 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"1.085","sl":"1.083","direction":"buy","sym":"EURUSD","comm_lot":7}} | {"volume":{"decimal":".48"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-15 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"1.085","sl":"1.083","direction":"buy","sym":"EURUSD","slip":".0002"}} | {"volume":{"decimal":".45"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-16 | `size_position` {"args":[],"kwargs":{"equity":7000,"risk_pct":"1","entry":"1.085","sl":"1.084","direction":"buy","sym":"EURUSD"}} | {"volume":{"decimal":".70"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-17 | `size_position` {"args":[],"kwargs":{"equity":500,"risk_pct":".5","entry":"1.085","sl":"1.080","direction":"buy","sym":"EURUSD"}} | {"status":"below_min","volume":{"decimal":"0"},"minLotRisk":{"decimal":"5"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-18 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"1.085","sl":"1.09","direction":"buy","sym":"EURUSD"}} | {"status":"error"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-19 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"100","sl":"90","direction":"buy","sym":"SP100"}} | {"status":"needs_confirm"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-20 | `size_position` {"args":[],"kwargs":{"equity":"10000","risk_pct":"1","entry":"100","sl":"90","direction":"buy","sym":"EUR"}} | {"status":"needs_confirm"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-21 | `size_position` {"args":[],"kwargs":{"equity":500000000,"risk_pct":"1","entry":"120000","sl":"114000","direction":"buy","sym":"FPT","account":"VND"}} | {"volume":{"decimal":"800"},"risk_actual":{"decimal":"4800000"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-22 | `size_position` {"args":[],"kwargs":{"equity":500000000,"risk_pct":"1","entry":"120000","sl":"114000","direction":"buy","sym":"FPT","account":"VND","fee_buy_rate":".0015","fee_sell_rate":".0015","tax_sell_rate":".001"}} | {"volume":{"decimal":"700"},"loss_lot":{"decimal":"6465"},"risk_actual":{"decimal":"4525500"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-23 | `size_position` {"args":[],"kwargs":{"equity":500000000,"risk_pct":"1","entry":"120000","sl":"114000","direction":"buy","sym":"FPT","account":"VND","fee_buy_rate":".15"}} | {"status":"error"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-24 | `size_position` {"args":[],"kwargs":{"equity":500000000,"risk_pct":"1","entry":"1300","sl":"1295","direction":"buy","sym":"VN30F1M","account":"VND"}} | {"volume":{"decimal":"10"},"loss_lot":{"decimal":"500000"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G03-25 | `size_position` {"args":[],"kwargs":{"equity":500000000,"risk_pct":"1","entry":"120000","sl":"124000","direction":"sell","sym":"FPT","account":"VND"}} | {"status":"error"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |

**Nhóm 4: Đọc số / bỏ phiếu / giá ngoại lai**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G04-01 | `parse_number` {"args":["1,250.50","."],"kwargs":{}} | {"decimal":"1250.50"} | Đặc tả §9.2 / Q3 |
| G04-02 | `parse_number` {"args":["1.250,50",","],"kwargs":{}} | {"decimal":"1250.50"} | Đặc tả §9.2 / Q3 |
| G04-03 | `parse_number` {"args":["(1,250.50)","."],"kwargs":{}} | {"decimal":"-1250.50"} | Đặc tả §9.2 / Q3 |
| G04-04 | `parse_number` {"args":["100 USDT","."],"kwargs":{}} | {"decimal":"100"} | Đặc tả §9.2 / Q3 |
| G04-05 | `parse_number` {"args":[" 1 250 ₫","."],"kwargs":{}} | {"decimal":"1250"} | Đặc tả §9.2 / Q3 |
| G04-06 | `parse_number` {"args":["","."],"kwargs":{}} | null | Đặc tả §9.2 / Q3 |
| G04-07 | `parse_number` {"args":["   ","."],"kwargs":{}} | null | Đặc tả §9.2 / Q3 |
| G04-08 | `parse_number` {"args":["-","."],"kwargs":{}} | null | Đặc tả §9.2 / Q3 |
| G04-09 | `parse_number` {"args":["$","."],"kwargs":{}} | null | Đặc tả §9.2 / Q3 |
| G04-10 | `parse_number` {"args":[true,"."],"kwargs":{}} | null | Đặc tả §9.2 / Q3 |
| G04-11 | `column_decimal_sep` {"args":[["1.25","2.50"],"."],"kwargs":{}} | [".",false] | Đặc tả §9.2, bỏ phiếu tay |
| G04-12 | `column_decimal_sep` {"args":[["1,25","2,50"],"."],"kwargs":{}} | [",",false] | Đặc tả §9.2, bỏ phiếu tay |
| G04-13 | `column_decimal_sep` {"args":[["1.234.567"],"."],"kwargs":{}} | [",",false] | Đặc tả §9.2, bỏ phiếu tay |
| G04-14 | `column_decimal_sep` {"args":[["1,234,567"],"."],"kwargs":{}} | [".",false] | Đặc tả §9.2, bỏ phiếu tay |
| G04-15 | `column_decimal_sep` {"args":[["1,234","2,500","1,000"],"."],"kwargs":{}} | [".",true] | Đặc tả §9.2, bỏ phiếu tay |
| G04-16 | `is_likely_ticket_id_column` {"args":[["123456789","987654321"]],"kwargs":{}} | true | §9.2: nguyên >=9 chữ số, duy nhất |
| G04-17 | `flag_price_outliers` {"args":[[2650,2655,2640,2660,2648,2652,587.02]],"kwargs":{}} | [false,false,false,false,false,false,true] | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G04-18 | `parse_number` {"args":["",".","0"],"kwargs":{}} | {"decimal":"0"} | Q3: default explicit ở nơi gọi |
| G04-19 | `parse_optional_cost` {"args":[""],"kwargs":{}} | [{"decimal":"0"},"fee_missing_as_zero"] | Đặc tả §9.2 |
| G04-20 | `parse_number` {"args":["NaN"],"kwargs":{}} | null | §0: số không hữu hạn không hợp lệ |

**Nhóm 5: Implied vpoint & scale-in 1R**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G05-01 | `implied_vpoint` {"args":["96.15",155,156,".15"],"kwargs":{}} | {"ok":true,"vpoint":{"decimal":"641"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G05-02 | `implied_vpoint` {"args":[".5",155,156,".15"],"kwargs":{}} | {"ok":false,"reason":"gross_qua_nho_so_voi_do_lam_tron"} | §5.3: .005/.5=.01>.005 |
| G05-03 | `cycle_oneR` {"args":[[{"price":100,"sl":95,"qty":1},{"price":110,"sl":104,"qty":1}],1],"kwargs":{}} | {"oneR":{"decimal":"11"},"oneRSource":"exact"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G05-04 | `cycle_oneR` {"args":[[{"price":100,"sl":95,"qty":1},{"price":110,"qty":1}],1,50],"kwargs":{}} | {"oneR":{"decimal":"50"},"oneRSource":"fallback"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |

**Nhóm 6: NAV & DD_R**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G06-01 | `drawdown` {"args":[10000,[["trade",1000],["trade",-500],["trade",-1000]]],"kwargs":{}} | {"dd":{"approx":13.636363636363635,"abs":1e-10},"equity":{"decimal":"9500"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G06-02 | `drawdown` {"args":[10000,[["trade",1000],["cash",-5000],["trade",-500]]],"kwargs":{}} | {"dd":{"approx":8.333333333333332,"abs":1e-10},"equity":{"decimal":"5500"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G06-03 | `drawdown` {"args":[1000,[["trade",-1000]]],"kwargs":{}} | {"dd":{"decimal":"100"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G06-04 | `drawdown` {"args":[10000,[["trade",1000,"2026-01-01"],["trade",-1000,"2026-01-01"]],true],"kwargs":{}} | {"dd":{"decimal":"0"},"flags":{"contains":"intraday_order_unknown"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G06-05 | `evaluate_safety_gate` {"args":[null,[]],"kwargs":{}} | {"state":"STANDBY","can_input":true} | Đặc tả §4.3 |
| G06-06 | `drawdown_r` {"args":[[-1]],"kwargs":{}} | {"dd_r":{"decimal":"1"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |

**Nhóm 7: Metrics / Kelly / ES**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G07-01 | `empirical_kelly` {"args":[[2,-1,-1,1.5,-1,3,-1,0.5,-1,2]],"kwargs":{}} | {"f":{"approx":0.2053489069,"abs":5e-11}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G07-02 | `empirical_kelly` {"args":[[2,-1,-1,1.5,-1,3,0,0.5,0,2]],"kwargs":{}} | {"f":{"approx":0.3956162848,"abs":5e-11}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G07-03 | `empirical_kelly` {"args":[[2,-0.5,-0.5,1.5,-0.5,3,-0.5,0.5,-0.5,2]],"kwargs":{}} | {"f":{"approx":0.6816059592,"abs":5e-11}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G07-04 | `metrics` {"args":[[-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":10.0,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=1, ES=10.0 |
| G07-05 | `metrics` {"args":[[-20,-19,-18,-17,-16,-15,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":20.0,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=1, ES=20.0 |
| G07-06 | `metrics` {"args":[[-21,-20,-19,-18,-17,-16,-15,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":20.5,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=2, ES=20.5 |
| G07-07 | `metrics` {"args":[[-40,-39,-38,-37,-36,-35,-34,-33,-32,-31,-30,-29,-28,-27,-26,-25,-24,-23,-22,-21,-20,-19,-18,-17,-16,-15,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":39.5,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=2, ES=39.5 |
| G07-08 | `metrics` {"args":[[-60,-59,-58,-57,-56,-55,-54,-53,-52,-51,-50,-49,-48,-47,-46,-45,-44,-43,-42,-41,-40,-39,-38,-37,-36,-35,-34,-33,-32,-31,-30,-29,-28,-27,-26,-25,-24,-23,-22,-21,-20,-19,-18,-17,-16,-15,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":59.0,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=3, ES=59.0 |
| G07-09 | `metrics` {"args":[[-100,-99,-98,-97,-96,-95,-94,-93,-92,-91,-90,-89,-88,-87,-86,-85,-84,-83,-82,-81,-80,-79,-78,-77,-76,-75,-74,-73,-72,-71,-70,-69,-68,-67,-66,-65,-64,-63,-62,-61,-60,-59,-58,-57,-56,-55,-54,-53,-52,-51,-50,-49,-48,-47,-46,-45,-44,-43,-42,-41,-40,-39,-38,-37,-36,-35,-34,-33,-32,-31,-30,-29,-28,-27,-26,-25,-24,-23,-22,-21,-20,-19,-18,-17,-16,-15,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":98.0,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=5, ES=98.0 |
| G07-10 | `metrics` {"args":[[-200,-199,-198,-197,-196,-195,-194,-193,-192,-191,-190,-189,-188,-187,-186,-185,-184,-183,-182,-181,-180,-179,-178,-177,-176,-175,-174,-173,-172,-171,-170,-169,-168,-167,-166,-165,-164,-163,-162,-161,-160,-159,-158,-157,-156,-155,-154,-153,-152,-151,-150,-149,-148,-147,-146,-145,-144,-143,-142,-141,-140,-139,-138,-137,-136,-135,-134,-133,-132,-131,-130,-129,-128,-127,-126,-125,-124,-123,-122,-121,-120,-119,-118,-117,-116,-115,-114,-113,-112,-111,-110,-109,-108,-107,-106,-105,-104,-103,-102,-101,-100,-99,-98,-97,-96,-95,-94,-93,-92,-91,-90,-89,-88,-87,-86,-85,-84,-83,-82,-81,-80,-79,-78,-77,-76,-75,-74,-73,-72,-71,-70,-69,-68,-67,-66,-65,-64,-63,-62,-61,-60,-59,-58,-57,-56,-55,-54,-53,-52,-51,-50,-49,-48,-47,-46,-45,-44,-43,-42,-41,-40,-39,-38,-37,-36,-35,-34,-33,-32,-31,-30,-29,-28,-27,-26,-25,-24,-23,-22,-21,-20,-19,-18,-17,-16,-15,-14,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]],"kwargs":{}} | {"es5":{"approx":195.5,"abs":1e-09}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); independent k=10, ES=195.5 |
| G07-11 | `metrics` {"args":[[2,-1,-1,1.5,-1,3,-1,0.5,-1,2]],"kwargs":{}} | {"N":10,"mean":{"approx":0.4,"abs":1e-09},"pf":{"approx":1.8,"abs":1e-09},"omega0":{"approx":1.8,"abs":1e-09},"es5":{"approx":1,"abs":1e-09},"p":{"approx":0.5,"abs":1e-09},"q":{"approx":0.5,"abs":1e-09},"b":{"approx":1.8,"abs":1e-09},"sqn_grade":"Khó giao dịch"} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G07-12 | `metrics` {"args":[[1,2]],"kwargs":{}} | {"kelly":null,"kelly_status":"undefined_no_losses","pf_api":{"status":"infinite_no_losses"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G07-13 | `metrics` {"args":[[0,0]],"kwargs":{}} | {"pf":null,"sqn":null,"kelly":0.0} | §6: zero expectation, zero deviation |
| G07-14 | `metrics` {"args":[[1]],"kwargs":{}} | {"N":1,"sqn":null} | §6: sample SD unavailable N=1 |
| G07-15 | `metrics` {"args":[[]],"kwargs":{}} | {"N":0,"status":"empty"} | §6: empty data |

**Nhóm 8: FIFO / flip / Q2**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G08-01 | `scenario` {"args":["fifo_open"],"kwargs":{}} | {"status":"open","gross":{"decimal":"25"},"net_price_units":{"decimal":"24.665"},"open_qty":{"decimal":".5"},"entry_avg":{"decimal":"105"},"entry_avg_closed":{"fraction":[310,3]}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G08-02 | `scenario` {"args":["fifo_closed"],"kwargs":{}} | {"status":"closed","qty":{"decimal":"2"},"entry_avg":{"decimal":"105"},"entry_avg_closed":{"decimal":"105"},"exit_avg":{"decimal":"122.5"},"gross":{"decimal":"35"},"net_price_units":{"decimal":"34.55"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G08-03 | `scenario` {"args":["fifo_flip"],"kwargs":{}} | {"statuses":["closed","open"],"directions":["long","short"],"open_qty":{"decimal":"1"}} | Tính độc lập từ công thức đặc tả; không lấy output engine làm kỳ vọng; Buy1@100 Sell2@110 |
| G08-04 | `scenario` {"args":["fifo_short"],"kwargs":{}} | {"status":"closed","gross":{"decimal":"10"}} | Tính độc lập từ công thức đặc tả; không lấy output engine làm kỳ vọng; Sell1@110 Buy1@100 |
| G08-05 | `scenario` {"args":["fifo_orphan"],"kwargs":{}} | {"net":{"decimal":"19.9"},"orphan":{"decimal":"1"}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); Buy1@100 fee .05, Sell2@120 fee .10 |

**Nhóm 9: Prop / EOD / Consistency**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G09-01 | `n_attempts_independent` {"args":[0.3],"kwargs":{}} | 7 | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-02 | `n_attempts_independent` {"args":[0.45],"kwargs":{}} | 4 | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-03 | `n_attempts_independent` {"args":[0.6],"kwargs":{}} | 3 | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-04 | `n_attempts_independent` {"args":[0],"kwargs":{}} | null | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-05 | `n_attempts_independent` {"args":[1],"kwargs":{}} | 1 | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-06 | `eod_floor_series` {"args":[50000,".04",[51000,52500,54000]],"kwargs":{}} | [{"decimal":"49000"},{"decimal":"50000"},{"decimal":"50000"}] | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-07 | `check_consistency_rule` {"args":[[2200,800],3000,".55"],"kwargs":{}} | {"effective_target":{"decimal":"4000"},"passed":false} | Đặc tả §15.3 (giá trị chuẩn được cung cấp) |
| G09-08 | `check_consistency_rule` {"args":[[350,325,325],1000,".30","FAIL_HARD"],"kwargs":{}} | {"breached":true,"passed":false} | §12.2: 350/1000=.35>.30 |
| G09-09 | `fail_streak_risk` {"args":[[0,1],5],"kwargs":{}} | {"correlated":{"approx":0.5,"abs":1e-09},"naive_independent":{"approx":0.03125,"abs":1e-09}} | Tính độc lập từ công thức đặc tả; không lấy output engine làm kỳ vọng; .5*(1^5+0^5)=.5 |
| G09-10 | `scenario` {"args":["monte_carlo"],"kwargs":{}} | {"p5":{"approx":0.02666666666666667,"abs":1e-12},"p50":{"approx":0.9866666666666667,"abs":1e-12},"p95":{"approx":1,"abs":1e-12}} | Đặc tả §15.3 (giá trị chuẩn được cung cấp); seed42 Bayesian B200 M300 target8 static10 |

**Nhóm 10: Fingerprint / multiset**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G10-01 | `scenario` {"args":["fingerprint_equivalence"],"kwargs":{}} | true | §10: canonical raw formatting & normalized Decimal |
| G10-02 | `scenario` {"args":["fingerprint_ticket"],"kwargs":{}} | true | §10: ticket wins over mutable price/time |
| G10-03 | `scenario` {"args":["multiset"],"kwargs":{}} | {"new_count":1,"skip_count":2,"occurrence":2} | Đặc tả §15.2 |
| G10-04 | `scenario` {"args":["merge_candidate"],"kwargs":{}} | 1 | §10: same day, exactly one dateOnly, equal qty and entry |

**Nhóm 11: Replay Tier3**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G11-01 | `scenario` {"args":["replay"],"kwargs":{}} | {"count":1,"breach":true,"date_flag":true} | Đặc tả §4.5 |

**Nhóm 12: UTC / ENRICH / Net A-B**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G12-01 | `hold_time_and_session` {"args":["2026-01-01T06:30:00Z","2026-01-01T07:00:00Z"],"kwargs":{}} | {"session":"Asia","holdTimeSeconds":1800} | Đặc tả §6.3; 30*60 seconds |
| G12-02 | `scenario` {"args":["enrich"],"kwargs":{}} | {"changed":true,"notes":"mine","status":"closed","exitPrice":{"decimal":"110"}} | §10: open→closed update, notes protected |
| G12-03 | `scenario` {"args":["net_ab"],"kwargs":{}} | {"A":{"decimal":"98"},"B":{"decimal":"98"}} | §9.3: gross100 + MT comm(-2) =98 |

**Nhóm 13: JSON-safe API**

| ID | Hàm và đầu vào | Kỳ vọng | Nguồn kỳ vọng |
|---|---|---|---|
| G13-01 | `scenario` {"args":["json_api"],"kwargs":{}} | {"value":null,"status":"infinite_no_losses","display":"∞"} | Đặc tả §0, §6.4 |

**Đầu vào chi tiết cho các scenario composite:**

- fifo_open: Buy1@100 fee .10 SL95 2026-01-01T00:00Z; Buy1@110 fee .11 SL104 01:00Z; Sell1.5@120 fee .18 02:00Z.
- fifo_closed: cùng ba fill trên, thêm Sell0.5@130 fee .06.
- fifo_flip: Buy1@100 fee0; Sell2@110 fee0; phải có chu kỳ long đóng và short mở 1.
- fifo_short: Sell1@110 fee0; Buy1@100 fee0; gross10.
- fifo_orphan: Buy1@100 fee.05; Sell2@120 fee.10; allow_short=False; phí chân đóng SELL phân bổ .05, net19.90, dư bán1.
- monte_carlo: R=[2,-1,-1,1.5,-1,3,-1,.5,-1,2], target8%, maxLoss10% STATIC, risk1%, 1 trade/day, day_cap250, Bayesian outer200/inner300 seed42; kỳ vọng phân vị từ bảng chuẩn. Không kiểm định một mean tự sinh làm oracle.
- fingerprint_equivalence: nguồn csv, account a, raw `2026.01.01 01:02:03` so với `2026-01-01T01:02:03`, XAUUSDm so với XAUUSD, buy, qty1.00/1, entry2650.0/2650; hash phải bằng nhau, không tự khai giá trị hash.
- fingerprint_ticket: nguồn csv, account a, ticket77; sửa mọi giờ/giá/mã/chiều vẫn cùng khóa ticket.
- multiset: DB2 bản ghi fingerprint f, occ0/1, notes mine; incoming3 fingerprint f, notes incoming; NEW1, SKIP2, occ mới2, notes bảo vệ.
- merge_candidate: EURUSD buy qty1, entry100, day20260101, một bên dateOnly=True một bên False, tol.01; đúng1 gợi ý.
- replay: C0=1000, trade đóng -60 lúc01:00Z mở00:00Z, lệnh mở02:00Z, một lệnh dateOnly; chỉ lệnh mở02:00 bị tag.
- enrich: cũ status=open, notes=mine, exit=None; mới closed, notes=bad, exit=110; giữ notes mine, cập nhật exit/status.
- net_ab: A gross100 commission-2; B Buy100→110 qty1 vpoint10 commission-2, nguồn MT; cả hai net98.
- json_api: metrics([1,2]) đưa qua metrics_to_json_safe; pf là value=None/status=infinite_no_losses/display=∞.

### 15.4 Kiểm thử mới B1–B8 và ca biên

Tệp pytest chứa các tên test bắt đầu B1–B8 tương ứng Mục 9.6, 5.7, 9.7, 3.1, 6.4, 4.8 và 12.5.
Ca biên bao gồm None, bool, rỗng, NaN/Infinity, phí .15, SL sai phía, dateOnly, DST gap/fold, DB rỗng,
multiset trùng thật, ENRICH + undo bảo vệ chỉnh sửa sau, FX phí, JSON lồng và Decimal rất lớn, mẫu N=0/1,
MAE, daily loss, fee drag, từng chính sách sau payout và EV mean vô điều kiện.
Log nguyên văn, tổng số thực chạy và thời lượng nằm trong VERIFICATION_REPORT_V3_4.md.

## Mục 16. Thứ tự triển khai P0 → P3 và Tiêu chí đóng việc

| Mức ưu tiên | Hạng mục công việc | Điều kiện hoàn thành (Exit Criteria) |
|---|---|---|
| **P0** | Safety Gate (§4.1–4.7), NAV DD, `DD_R` có mốc `0` [Q1], bỏ khóa cứng nhập liệu; bỏ 1R cố định `"₫100"`, thêm `implied_vpoint`, `cycle_oneR` và chuỗi Fallback 1R; đọc `cell.v` + bỏ phiếu dấu thập phân `column_decimal_sep` + sửa `parse_number` rỗng trả `null` [Q3]; Net P&L 3 cấp A/B/C; bọc JSON-safe cho `inf` API | Vượt qua toàn bộ các nhóm kiểm thử 4, 5, 6, 11, 13; có backup + dry-run trước khi chạm dữ liệu thật |
| **P1** | Một `AccountProfile` / `UnifiedJournalStore` duy nhất; cổng nhập `Ctrl+N` tại Classic; so khớp multiset + `importFingerprint` bất biến; `ENRICH` bảo vệ `userEditedFields` + hoàn tác theo `importBatchId`; công tắc 1R chuẩn/ước lượng; FIFO `scale-in/out/flip` kèm `entry_avg_closed` [Q2] | Vượt qua nhóm kiểm thử 8, 10, 12; hai giao diện Classic và V6 hiển thị cùng `N`, cùng Net P&L và R sau khi reload |
| **P2** | `InstrumentRegistry` + gợi ý Levenshtein `suggest`; Sizer `Decimal` toàn phần + `below_min` + biểu phí/thuế cổ phiếu VN | Vượt qua nhóm kiểm thử 1, 2, 3; bảo toàn bất biến `riskActual <= R_budget` |
| **P3** | Prop Simulator (Topstep 55% / XFA Standard / XFA 40% [Q4], `block`/`day` bootstrap, Wilson CI, `EV_attempt`/`ROI`), chạy trong Web Worker; Executive Cockpit 3 tầng; hiển thị Kelly / `ES_5%` / `Ω(0)` | Vượt qua nhóm kiểm thử 7, 9; đạt bộ 125 vector được công khai ở Mục 15, kèm ca mới và tái lập chính xác Monte Carlo theo `seed` |

## Mục 17. Trạng thái 4 câu hỏi mở (Q1–Q4) và Danh mục xác minh vận hành

### 17.1 Bốn câu hỏi mở (Q1–Q4) đã được chốt chính thức trong bản v3.4

1. **Q1 (`DD theo R` có tính mốc `0` không?) — ĐÃ CHỐT:** Tính cả mốc `0`, tức `DD_R = max(0, max_k cumR_k) − cumR_t`. Với `R = [−1]` cho kết quả `1R` (còn v2 cho `0R`). Đây là chỗ duy nhất v3.4 đổi một quy tắc của v2 (đã cập nhật tại Mở đầu B, §4.4 và `drawdown_r` trong `tuan_trader_v3_4.py`).
2. **Q2 (`entry_avg_closed` trong FIFO) — ĐÃ CHỐT:** Giữ `entry_avg` cho toàn chu kỳ (`105`) và thêm trường `entry_avg_closed` (`103,3333`) cho phần khối lượng đã đóng (đã cập nhật tại §3, §9.4 và `fifo_cycles` trong `tuan_trader_v3_4.py`).
3. **Q3 (`parse_number` với chuỗi rỗng) — ĐÃ CHỐT:** `parse_number` rỗng trả `null` kèm `reason = 'empty'`; nơi gọi tự quyết định mặc định `0` cho các cột chi phí tùy chọn qua `parse_optional_cost` (đã cập nhật tại §9.2 và `tuan_trader_v3_4.py`).
4. **Q4 (Quy tắc Consistency của Topstep) — ĐÃ CHỐT:** Theo trang Topstep Help Center cập nhật ngày `17/09/2026 [ngày do đầu vào tự khai; xem kiểm tra hiện tại ở Mục 12.2]`: Trading Combine dùng **`55%`** (`INCREASE_TARGET_SOFT`: nếu ngày thắng lớn nhất vượt ngưỡng thì mục tiêu thành `bestDay / 0,55`); đường **Standard** của XFA không có Consistency; đường **Consistency** của XFA dùng **`40%`**. Các bài review thứ cấp ghi `50%` là bản cũ (đã cập nhật tại §12.2 và `DEFAULT_PROP_PRESETS` trong `tuan_trader_v3_4.py`).

### 17.2 Các hạng mục vận hành thực tế cần kiểm tra định kỳ khi đưa vào Production

1. **Quy tắc các quỹ Prop khác ngoài Topstep (The5ers, FTMO, Apex):** Tiếp tục đối chiếu trang quy tắc chính thức của từng quỹ theo gói và ngày mua thực tế, cập nhật `lastVerified`.
2. **Hệ số hợp đồng của sàn đang dùng:** Dầu thô (`1.000` hay `100` thùng), chỉ số CFD (`×1, ×5, ×10, ×20`), bước giá HOSE/HNX/UPCoM và danh sách mã niêm yết.
3. **Kiểm định 5 file sao kê gốc thật (Golden Files):** MT5 HTML Positions, MT4 Statement, Excel SSI/VPS, CSV Binance Spot/Futures và kiểm tra `cell.v` của file mẫu `trade_import_data.xlsx` để thay thế dữ liệu giả lập bị lỗi bằng bộ 30 lệnh chuẩn (Golden Set).
4. **Hợp đồng nghịch đảo (Inverse Contracts như `BTCUSD` Bybit/BitMEX):** Hiện tại chặn kèm giải thích; chỉ mở khi có yêu cầu nghiệp vụ.


## Phụ lục A. Ánh xạ hạng mục B sang API / test / đoạn đặc tả

| Hạng mục | Hàm / mô hình | Kiểm thử | Đặc tả |
|---|---|---|---|
| B1 | compute_net_pnl C, cycle_to_trade, cycle_net_account | test_B1_* | §9.6 |
| B2 | risk1r, cycle_oneR, compute_r_multiple | test_B2_* | §5.7 |
| B3 | source_to_utc, trading_day_key | test_B3_* | §9.7 |
| B4 | COLUMN_ALIASES, map_columns, detect_header, read_import_rows, import_pipeline | test_B4_* | §9.7, §10.5 |
| B5 | Fallback1RConfig, AccountProfile, InstrumentSpec, Trade, CashFlow | test_B5_* | §3.1 |
| B6 | metrics, metrics_to_json_safe | test_B6_* | §6.4 |
| B7 | replay_tier_tags, drawdown iterator | test_B7_* | §4.8 |
| B8 | day bootstrap, simulate_funded_phase, prop_full_lifecycle | test_B8_* | §12.5 |

## Phụ lục B. Tệp bàn giao thực sự tạo trong lượt này

1. `tuan_trader_v3_4.py` — engine tham chiếu vá trực tiếp.
2. `test_tuan_trader_v3_4.py` — pytest, tự chứa 125 vector và các ca mới, không cần file dữ liệu ngoài.
3. `TUAN_TRADER_SPEC_V3_4.md` — đặc tả đầy đủ và toàn bộ danh sách vector.
4. `CHANGELOG_V3_4.md` — quyết định, ánh xạ tham chiếu, lỗi và thay đổi API.
5. `VERIFICATION_REPORT_V3_4.md` — log pytest nguyên văn, nguồn, phạm vi chạy và giới hạn.

Không tạo PDF hoặc các tài liệu Master Prompt mới trong lượt này.
