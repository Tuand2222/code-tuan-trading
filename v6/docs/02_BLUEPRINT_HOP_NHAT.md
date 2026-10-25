# BLUEPRINT HỢP NHẤT — Tuannhatky Pro (giao diện mới thay thế v6)

> Tài liệu này là **nguồn sự thật** cho việc hợp nhất. Mọi quyết định "GIỮ / BỎ / GỘP" ở đây đã được đối chiếu trực tiếp với code của 2 file nguồn (số dòng trích theo đúng 2 file đính kèm).
> Phương pháp: đọc tĩnh cấu trúc HTML/JS của 2 file. **Chưa chạy thử trên trình duyệt** — vì vậy phần nghiệm thu ở Mục 10 là bắt buộc.

---

## 0. Ba file và vai trò

| Ký hiệu | File | Vai trò |
|---|---|---|
| **A** | `SRC_A_V3_Kiem_Toan.html` (2.320 dòng) | **Khung nền (shell)**: sidebar + header + thanh bộ lọc + dark mode + settings drawer + toàn bộ phân tích V6 + 6 trang Risk đã port một phần từ v9 + công thức đã "kiểm toán". |
| **B** | `SRC_B_v9_Risk.html` (3.982 dòng) | **Nguồn chức năng bổ sung**: các chức năng Risk chỉ có ở v9 mà A chưa có (Mục 3). Code bị "patch chồng patch" nên **không copy nguyên khối**. |
| **C** | `SRC_C_v6_hien_tai.html` (người dùng đính kèm thêm, nếu có) | Website v6 đang chạy. **Giao diện bị thay hoàn toàn**. Chỉ dùng để: (1) đọc key localStorage + schema lệnh để viết hàm migrate dữ liệu, (2) đối chiếu không làm mất chức năng nghiệp vụ. |

**Phát hiện quan trọng:** A *đã* chứa một phần v9 (nhóm sidebar "Risk Management Pro V9" và "Risk Pro · Bổ sung V9"). Vì vậy việc hợp nhất = **lấy A làm nền, bổ sung phần v9 còn thiếu, và gộp các cụm trùng** — không phải ghép hai giao diện song song.

---

## 1. Nguyên tắc cứng

1. **UX/UI/chức năng giống hệt A và B** ở những phần được giữ: chuyển nguyên DOM, class Tailwind, nhãn tiếng Việt, handler, công thức — **không diễn giải lại, không "làm đẹp", không đổi nhãn**. Chỉ sửa khi bắt buộc để (a) hết trùng ID, (b) hết trùng hàm, (c) dùng chung 1 kho dữ liệu.
2. **Một kho dữ liệu lệnh duy nhất** (`state.trades`). Cấm tạo mảng lệnh thứ hai (v9 có `tradeData`, A có `state.trades` — chỉ giữ một).
3. **Một định nghĩa duy nhất cho mỗi hàm / mỗi ID.** Không dùng kiểu "bọc hàm cũ rồi ghi đè" (`const old=window.x; window.x=...`). Gộp vào thân hàm gốc.
4. **Một lõi toán học duy nhất** (`RiskMath`) dùng chung cho luồng chính và Web Worker.
5. **Công thức đã kiểm toán của A thắng v9** khi hai bên khác nhau (Mục 6).
6. **Không làm mất dữ liệu người dùng**: không xóa key localStorage cũ; migrate không phá hủy (Mục 5.4).
7. Giữ stack: HTML đơn file, Tailwind CDN, Chart.js CDN, font Inter + JetBrains Mono, không thêm thư viện mới.

---

## 2. Kiến trúc thông tin đích (sidebar)

Giữ nguyên shell của A (header sticky + sidebar `w-60` + `<main>` + thanh bộ lọc chung + alerts-bar + hash routing + `TABS/TAB_ALIAS/TITLES`). Sắp xếp lại sidebar thành **6 nhóm** (hiện A có 8 nhóm rải rác vì các add-on tự chèn):

| Nhóm | Mục sidebar (id trang) | Nguồn | Trạng thái |
|---|---|---|---|
| **HÔM NAY** | Kế hoạch & lệnh dự kiến (`gameplan`) | A | giữ nguyên |
| | **Buồng lái rủi ro** (`cockpit`) | A `tab-cockpit` + B `top-cockpit-gauges`, `daily-loss-tracker-panel`, `tier-action-protocol-box`, `openPositionsData`, `interlock-banner`, `gate-strip`, `assumptions-verify-drawer` | **GỘP** |
| **NHẬT KÝ** | Giao dịch & bộ lọc (`workspace`) | A + cột/trường giá–thời gian của B | **GỘP** |
| | Lịch giao dịch (`calendar`), Ghi chú & Review (`review`), Chartbook (`chartbook`) | A | giữ nguyên |
| **PHÂN TÍCH** | Tổng quan / Lợi thế thống kê / Khoan sâu / Kỷ luật (`overview`, `edge`, `drilldown`, `discipline` → cùng `tab-edge` như A) | A | giữ nguyên |
| | Lợi nhuận & rủi ro (`pnlrisk`) | A + `perf-grid` của B (Sharpe, Sortino, STARR, Rachev, PF, Break-even WR) | **GỘP** |
| **RỦI RO 3 LỚP** | Lớp 1 · Bảo vệ vốn & phơi nhiễm (`riskcapital`) | A `tab-riskcapital` + B `tab-layer1` | **GỘP** |
| | Lớp 2 · Lợi thế, Omega & ES (`riskedge`) | A `tab-riskedge` + B `tab-layer2` | **GỘP** |
| | Lớp 3 · Tối ưu vốn & hành vi chuỗi (`riskopt`) | A `tab-riskopt` + B `tab-layer3` (bỏ phần Monte Carlo & Prop → chuyển trang riêng) | **GỘP + TÁCH** |
| | Mô phỏng & Stress Lab (`simulation`) | A `tab-simulation` + `tab-riskstress` + B Monte Carlo + B stress sliders | **GỘP 4→1** |
| | Prop Firm Simulator (`riskprop`) | A `tab-riskprop` + preset mở rộng của B | **GỘP 3→1** |
| | Bảng 4 vùng (`zones`) *(mới, thay Four-Zone của B)* | B ý tưởng Four-Zone, **không** dùng thủ thuật dời DOM | **MỚI** (Mục 4, D15) |
| **CÔNG CỤ** | Trade Engine & Sizer (`risktools`) + checklist trước lệnh | A `tab-risktools` + `tab-sizer`(checklist) + B `calcSizer` | **GỘP 3→1** |
| | Nhập nâng cao MT4/MT5 (`import`) | A | giữ nguyên |
| **HỆ THỐNG** | Dữ liệu & kết nối (`mapping`) | A + B Database Schema Explorer, xuất SQL Supabase, IndexedDB | **GỘP** |
| | Trợ giúp & thuật ngữ (`dictionary`) | A + thuật ngữ mới từ B (Rachev, STARR, RCK, λ, Ω…) | **GỘP** |
| (drawer) | Cài đặt (`settings-drawer`) | A + "Risk Profile" (Mục 5.3) | **GỘP** |

Bỏ hoàn toàn: thanh `nav-tabs` 5 tab của B, huy hiệu "REDESIGN V6", tiêu đề `Tuannhatky Risk Management Pro` ở header B (dùng brand của A).

**Header/thanh trạng thái** (giữ khung A, thêm từ B, đặt trong `alerts-bar` + header, sticky):
- Vốn thực tế (Adjusted), Nạp/Rút ròng, Drawdown thực tế, Huy hiệu Tier (B: `top-bar-equity/cashflow/dd/status`).
- Đồng hồ Drawdown + Thanh Daily Loss (B: `top-dd-gauge-*`, `top-dl-*`).
- Giữ các nút của A: Cài đặt, Net/Gross, Sáng/Tối, Sao lưu, Khôi phục, + Thêm giao dịch (nút này bị khóa khi Tier 3 — hành vi của B `evalGates`).
- Thanh nền theo Tier (B: `body[data-tier]` đổi màu header khi Tier 2/3).

---

## 3. Chức năng chỉ có ở B (v9) — BẮT BUỘC chuyển sang bản mới

Đánh dấu `PORT` = chuyển hành vi + UI từ B (viết lại trên lõi/ID của bản hợp nhất, giữ nhãn & công thức).

| # | Chức năng v9 (ID/hàm tham chiếu trong B) | Trang đích |
|---|---|---|
| P1 | Đồng hồ Drawdown & thanh Daily Loss trên cùng (`top-dd-gauge-bar`, `top-dl-bar`) | Header |
| P2 | Lệnh đang mở & **floating loss** (`openPositionsData`), lỗ ngày thực + lỗ mở để tự dừng (`daily-loss-tracker-panel`, `dl-progress-bar`, `dl-stop-alert`) | Buồng lái |
| P3 | **Giao thức hành động Tier 2/3** (`tier2-action-panel`, `tier3-action-panel`: Tier 2 chỉ A-Setup + chẩn đoán 15 lệnh; Tier 3 PF 10–15 lệnh cuối + Monte Carlo phục hồi) | Buồng lái |
| P4 | **Cổng liên động**: Safety Gate (Tier) + Edge Gate (Expectancy>0, Ω(0)>1) khóa Lớp 3 & Stress Lab (`evalGates`, `GATE`, `gate-strip`, `gate-l3`, `gate-cockpit`, `interlock-banner`) | Buồng lái + Lớp 3 + Stress |
| P5 | **Hộp xác nhận 5 giả định** bật/tắt (`ASSUMP`: tierCapMode, tail25Mode, safeTierMax, recRule, lockStressLab + rckMode, rorZoom) (`assumptions-verify-drawer`) | Buồng lái (drawer) |
| P6 | Cấu hình Tier: loại tài khoản (cá nhân/prop), ngưỡng t2/t3 tùy chỉnh, ép Tier thủ công (`tc-acct`, `tc-prop`, `tc-t2`, `tc-t3`, `tc-ovr`, `tierCfg`) | Lớp 1 |
| P7 | Biểu đồ **Phục hồi bất đối xứng** `R=DD/(1−DD)` (`chartAsymmetricRecovery`, `input-dd-pct`) — A có `risk-recovery-chart` nhưng không có ô nhập DD tự do | Lớp 1 |
| P8 | **Phơi nhiễm đồng thời** tự nhóm overlap + biểu đồ (`analyzeSimultaneousExposure`, `chartSimultaneousExposure`, `simultaneous-exposure-summary`). A đã có `risk-overlap` + nhóm tương quan `adv-correlated` → **giữ cả hai**: nhóm tương quan của A + biểu đồ/tóm tắt của B, một hàm duy nhất | Lớp 1 |
| P9 | **RoR**: Kaufman/Balsara + thực nghiệm + **Heatmap RoR (W × b)** + **chế độ phóng đại (zoom)** (`ror-heat`, `renderRorHeatmap`, `ASSUMP.rorZoom`, `chartRorCliff`) | Lớp 1 |
| P10 | **Bảng so sánh các mức rủi ro / họ RCK** (`renderRiskCompare`, `chartRckFam`, `rck-extra`) | Lớp 3 |
| P11 | **What-If Exit** chọn kịch bản + biểu đồ so sánh (`whatif-scenario-select`, `chartWhatIfCompare`) và **Rolling Drift** (`chartRollingDrift`). A đã có What-If theo điều kiện MAE/MFE (`risk-tp-r`, `risk-sl-r`, `exitBounds`) → **gộp**: giữ ô TP/SL (R) của A + chọn kịch bản & biểu đồ của B; Rolling Expectancy/SQN của A (`risk-roll-window`) = Rolling Drift, chỉ giữ 1 | Lớp 2 |
| P12 | **Chỉ số bậc 2 & đuôi**: Sharpe, Sortino, STARR, Rachev, Profit Factor, Break-Even WR (`perf-grid`) | Phân tích → Lợi nhuận & rủi ro |
| P13 | **Expectancy theo tiền ($)** & **lệch Planned RR vs Actual R** + **cảnh báo "Setup Rủi Ro Đuôi Cao"** (`l2-planned-vs-actual-card`, `l2-tail-setup-alert`) | Lớp 2 |
| P14 | **Omega 2 playbook** so sánh + thanh trượt L + điểm Ω(μ)=1 + lưới phân vị 10–90 (`omega-controls-v9`, `om-setup-1/2`, `om-l-slider`, `omega-quantile-grid`) | Lớp 2 |
| P15 | **Bộ đếm vi phạm VaR** vẽ lên biểu đồ (`ensureVarBreachChart`) + Basel ES 97,5% với `tail25Mode` | Lớp 2 |
| P16 | **RCK**: chế độ phân phối thực nghiệm đầy đủ vs nhị phân (`rck-dist-mode`, `rck-mode-rad`) | Lớp 3 |
| P17 | **Monte Carlo phụ thuộc tâm lý** (Revenge dependency), Bootstrap / Hoán vị, seed cố định, Median/P95 Max DD (`chk-mc-revenge-mode`, `sel-mc-mode`, `sel-mc-n`, `mc-mdd`) | Mô phỏng |
| P18 | **Stress Lab sliders**: chuỗi thua 10–15, suy thoái WR −5..−10%, Payoff −20..−30%, khóa theo cổng (`rng-stress-streak-len`, `rng-stress-wr-drop`, `rng-stress-rr-drop`) | Mô phỏng |
| P19 | **Prop Firm mở rộng**: Hyper Growth / Bootcamp / MyFundedFX / FundedNext, phí kích hoạt, thử thách 1-2-3 giai đoạn, chu kỳ trả thưởng 10 ngày, EV %, lợi nhuận tháng lý thuyết, ROI (`propPreset`, `propMulti`, `pf-out`) | Prop Firm |
| P20 | **Sizer đa tài sản mở rộng**: bảng `SPEC` thêm CL, MCL, AAPL/NVDA/SPY; nhóm tài sản & **kỳ hạn thanh khoản** theo nhóm (`ASSET_CLASSES`, `renderLhTable`) | Trade Engine |
| P21 | **Trade engine đầy đủ giá**: tự tính Planned RR, Actual R, thời gian giữ, pips/ticks, **trượt giá chỉ tính khi khớp tại SL/TP** (đóng tay không phải trượt giá) (`calcTradeMetrics`, `exitReason`) | Nhật ký (modal) |
| P22 | **Bộ chuyển `UnifiedTrade` → nhật ký** (`adaptUnifiedTrades`) | Nhập nâng cao |
| P23 | **Database Schema Explorer** (3 bảng `risk_profiles`, `trades_journal`, `simulation_snapshots`), **xuất SQL Supabase**, `exportDatabaseJson`, lưu **IndexedDB** song song localStorage (`db-schema-panel`, `saveToIndexedDB`) | Dữ liệu & kết nối |
| P24 | Ô nhập **lệnh nạp/rút** có loại DEPOSIT/WITHDRAWAL, ghi chú (`cashflow-modal`) — gộp vào sổ nạp/rút của A (Mục 4, D10) | Buồng lái |

## 3b. Chức năng chỉ có ở A (V3) — GIỮ NGUYÊN, KHÔNG ĐỤNG

Bộ lọc 12 tiêu chí AND/OR + saved views + "+ Thêm tùy chọn" (đổi tên/đổi màu) · chips lọc · bảng lệnh sắp xếp mọi cột + sparkline + **sửa tại dòng** (nhấp đúp/Enter) · thẻ KPI ẩn/hiện/kéo thả · Lợi thế thống kê (MFE/MAE scatter, phân phối R, underwater DD, heatmap giờ × thứ, chi phí phá kỷ luật, phân rã nhóm, Hold-time) · khoan sâu theo khung giờ 15/30/60 & phiên Á/Âu/Mỹ · confidence bar / bootstrapCI / SQN cap · Net/Gross · đổi đơn vị **R / $ / % / Pips-Ticks** · dark mode · tooltip modal `?` + từ điển tìm kiếm · mapping simulator Classic→V6 · Kế hoạch & lệnh dự kiến · Lịch · Review tuần 3 bước · Chartbook · checklist trước lệnh · Nhập MT4/MT5/cTrader/Excel · Sao lưu/Khôi phục thống nhất (`exportUnifiedBackup`).

---

## 4. Bảng loại bỏ trùng lặp (QUYẾT ĐỊNH)

Bằng chứng lấy từ kiểm kê: **B có 22 hàm bị định nghĩa lại hoặc bọc-ghi-đè** (`updateRiskOfRuin` ×3, `solveStanfordRCK` ×3, `runMonteCarloSim` ×3, `renderOmegaCurve` ×3, `refreshAll` ×3, `evalGates` ×3, `calcTradeMetrics` ×2, `recalculateMasterCapital` ×2, `switchTab` ×2, `updateCockpitAll` ×2, `calcSizer` ×2, `renderMetrics` ×2, `updateES` ×2, `propPreset` ×2, `saveNewTrade` ×2, `analyzeSimultaneousExposure` ×2, `analyzeSerialPsychology` ×2, `applyLayoutMode` ×2 và bản sao `mulberry/esW/varW/cum` ×2). **A có 4 hàm bị bọc-ghi-đè** (`renderRiskRatios`, `getActiveConditions`, `renderWorkspaceTable`, `renderBreakdown`). Trong B, `updateRiskOfRuin` (dòng 1550) và `renderOmegaCurve` (1638) là **hàm rỗng**; `solveStanfordRCK` (1640) **gán cứng** W=0,533, R=1,6 và kết quả "2.15% / lệnh" — toàn bộ là mã chết bị ghi đè về sau.

| ID | Chức năng trùng | Các bản hiện có | **GIỮ / hợp nhất thành** |
|---|---|---|---|
| **D1** | Web Worker | B: Blob worker v7 (≈1765–1798) **và** `WK4_SRC` 4 mô-đun (2079+); A: không worker | **1 worker duy nhất**, 4 mô-đun (MC, RoR, Prop, Omega/ES/RCK). Mã worker **sinh từ chính các hàm `RiskMath`** (`fn.toString()`) → không còn bản sao toán học. Có fallback chạy luồng chính |
| **D2** | Hàm toán học lặp (`mulberry`, `mean`, `esW`, `varW`, `cum`, `quantile`, `stdev`) | A có ≥3 bản (`mulberry` luồng chính, `sampleRng`, `q/quant`, `mean/avg`); B có ≥3 bản | **1 module `RiskMath`**: `mulberry32`, `mean`, `stdev`, `quantile`, `varW`, `esW`, `omega`, `rckBinary`, `rckEmpirical`, `rorAnalytic`, `rorEmpirical`, `propMulti`, `bootstrap`, `permute` |
| **D3** | Monte Carlo (4 nơi) | A: `tab-simulation` (`simulate()`), `risk-opt-chart`, `adv-mc-chart` (`mcExtended`), `adv-stress-chart`; B: `chartMonteCarloFan` (+ bản seeded 2038), `z4-mc`, `chartCockpitSim` | **1 lõi `simulate()`** (seeded, bootstrap/hoán vị, revenge-dependency) + **1 trang** "Mô phỏng & Stress Lab" gồm 3 phân đoạn: *Monte Carlo · What-if · Stress Lab*. Lớp 3 chỉ còn thẻ tóm tắt + nút "Mở Monte Carlo" |
| **D4** | Heatmap RoR (2 vị trí) | B: `ror-heat` ở Lớp 1 và `z4-heat` (cùng node bị dời) | **1 heatmap** ở Lớp 1 (có nút Zoom) |
| **D5** | Prop Firm (3 nơi) | A: `risk-prop-*` (trong `riskopt`) và `adv-p-*` (`riskprop`); B: `pf-out` + mở rộng 3.2 + `z4-prop` | **1 trang Prop Firm** = bố cục A `riskprop` + preset/giai đoạn/EV của B. **Xóa** thẻ `risk-prop-*` khỏi Lớp 3 |
| **D6** | Stress Lab (4 nơi) | B: `tab-cockpit` (`chk-stress-*`, `rng-cockpit-*`), sliders 1.6, bản 5.5, `z4-stress`; A: `riskstress` (`adv-streak/degrade/tail`) | **1 Stress Lab** với sliders của B (10–15 / −5..−10% / −20..−30%) + công tắc "nhân đôi lỗ ở 2,5% xấu nhất" của A; khóa theo cổng liên động |
| **D7** | Ngân sách lỗ ngày (4 nơi) | B: `daily-budget-detail` (`bud-k`, `bud-f`), `daily-loss-tracker-panel`, `top-dl-bar`; A: `ck-day/ck-daily/ck-personal`, `risk-k`, `risk-budget` | **1 hàm `dailyBudget()`** + **1 bộ tham số** (Risk Profile, Mục 5.3). Hiển thị: thanh header + panel chi tiết ở Buồng lái. Công thức: `min(Equity × f_tier × hệ số Tier , Hạn mức lỗ ngày ÷ k)` (đúng như B 1823 và A `renderCapital`) |
| **D8** | Đồng hồ Drawdown / Tier (3–4 nơi) | B: `top-bar-dd`, `top-dd-gauge-bar`, hộp 3 tầng Lớp 1, `top-bar-status`; A: alerts-bar, `risk-gate-badge`, `ck-cards`, `risk-tier-stats` | **1 hàm `tierOf(dd)`** (ngưỡng 3% / 5%, đọc từ Risk Profile) → mọi chỗ chỉ **đọc** `RiskStore.tier` |
| **D9** | Hành động theo Tier / banner | B: `tier-action-protocol-box`, `interlock-banner`, `modal-tier-note`; A: `adv-interlock`, `risk-gate-badge` | **1 banner liên động** (header) + **1 panel giao thức Tier** (Buồng lái) |
| **D10** | Sổ nạp/rút | A: `X.dep` {date, amt, note} trong tab Buồng lái; B: `cashflowData` {id,time,type,amount,note} + `cashflow-modal`; A còn đọc chéo qua `getCashflow()` bằng localStorage | **1 sổ `state.cashflows`** {id, time, type DEPOSIT/WITHDRAWAL, amount, note}; UI = bảng B + modal B đặt trong Buồng lái; **xóa** `getCashflow()` đọc localStorage |
| **D11** | Vốn thực tế / Drawdown | B `recalculateMasterCapital` (2 bản); A `capitalNAV()` | **Chỉ `capitalNAV()` của A** (Mục 6). Xóa `recalculateMasterCapital` của B |
| **D12** | Omega (2–3 nơi) | B: `omega-target-select` + `chartOmegaCurve` (cũ) và `omega-controls-v9`; A: `risk-omega-l`, `risk-omega-val` | **Chỉ bản v9 nâng cấp** (2 playbook + L-slider + Ω(μ)=1 + lưới phân vị); thay thế selector cũ và `risk-omega-l` |
| **D13** | ES / VaR / đuôi (3 nơi) | B: `chartBaselTail`, `es-stats`, `ensureVarBreachChart`; A: `risk-es-val`, thẻ VaR/CVaR 95% chèn vào `renderRiskRatios` | **1 thẻ "Tail Risk"** ở Lớp 2: ES 97,5%, VaR 97,5%, VaR/CVaR 95%, bộ đếm vi phạm, cảnh báo cỡ mẫu **N < 40** (của A). Xóa chèn VaR/CVaR khỏi `pnlrisk` (chỉ còn link) |
| **D14** | RCK (3 nơi) | B: `solveStanfordRCK` (3 bản) + `rck-extra`; A: `rckBernoulli` + `optimizer()` (lưới mô phỏng) + `rckEmpirical` + `adv-rck` | **1 bảng RCK**: chế độ *Thực nghiệm* (mặc định) / *Nhị phân* (công tắc B), giải bằng `rckEmpirical` của A; nút "Kiểm chứng bằng Monte Carlo" thay cho `optimizer()` độc lập |
| **D15** | Bố cục Four-Zone | B: `fourZoneActive`, `applyLayoutMode` ×2, `zone4-deck`, **dời node DOM** qua comment `z4-origin` | **Bỏ thủ thuật dời DOM.** Thay bằng trang `zones` chỉ chứa **thẻ tóm tắt** (Tier, 3 cổng, Ω, ES, f*, P50/P95 MC, % qua Prop) đọc từ `RiskStore` — không vẽ lại biểu đồ lớn lần hai |
| **D16** | Bảng lệnh (4 nơi) | B: bảng chi tiết `renderTradeLogTable`; A: `workspace-table-body`, `risk-detail-rows`, `adv-trades` | **1 bảng ở Nhật ký** (có nhóm cột: *Cơ bản · Giá & thời gian · Rủi ro/MAE-MFE* chuyển bằng nút). Lớp 1 & Trade Engine chỉ hiện link/tóm tắt, **không** có bảng riêng |
| **D17** | Thêm/sửa lệnh (3 form) | B: `trade-modal` (`saveNewTrade` ×2); A: `openAddTradeModal`, `risk-detail-modal`, sửa tại dòng | **1 modal "Thêm/Sửa lệnh"** (nền `risk-detail-modal` + đủ trường của B) + giữ sửa-tại-dòng. Tier 3 ⇒ nút thêm lệnh bị khóa; Tier 2 ⇒ gợi ý lot giảm 50% |
| **D18** | Sizer (3 nơi) | B: `sz-sym`/`calcSizer` ×2 + `SPEC`; A: `tab-sizer` (thẻ máy tính đang **ẩn** bằng `.hidden`) + `adv-*`/`SOURCE_SPECS` | **1 sizer** `adv-*`, bảng `SPEC` = **hợp** của B (kể cả CL, MCL, AAPL, NVDA, SPY) và `SOURCE_SPECS` của A. **Xóa hẳn** thẻ máy tính cũ của `tab-sizer` (đang chỉ ẩn); giữ checklist ở trang Trade Engine |
| **D19** | Sao lưu | A: `exportBackup` + `exportUnifiedBackup` (ghi đè); B: `saveToIndexedDB`, `exportDatabaseJson`, `STORAGE_KEY` riêng | **1 bộ sao lưu**: JSON thống nhất (gồm trades, cashflows, riskProfile, assumptions, snapshots, extra, ext2) + IndexedDB phản chiếu + xuất SQL |
| **D20** | Khóa lưu trữ | A: `tuannhatky_trial_v3_data`, `…_extra`, `…_ext2`; B: `tuannhatky_v10_db_state` | **1 key** `tuannhatky_pro_unified_v1` (+ migrate, Mục 5.4) |
| **D21** | Registry biểu đồ & helper UI | A: `chartList` + `createChart`, `chart` + `drawChart`; helper `card()` ×3, `htmlStat`, `esc`/`cbEsc` | **1 `ChartRegistry`** (destroy-trước-khi-vẽ), **1 bộ helper** `card/stat/chip/esc/fmt` |
| **D22** | Ghi đè trong A | `renderRiskRatios`, `getActiveConditions`, `renderWorkspaceTable`, `renderBreakdown` bị bọc bởi script `v6-ext`/`v6-ext2` | Gộp thẳng vào **thân hàm gốc**; xóa các script `v6-nav`, `v6-ext`, `v6-ext2` dạng patch, thay bằng cấu trúc module (Mục 7) |
| **D23** | Mã chết ở B | `updateRiskOfRuin(){}`, `renderOmegaCurve(){}`, `solveStanfordRCK` gán cứng, `dailyBudget = equity*0.04/4`, `generateCockpitSimPath` mẫu | **Xóa hẳn**, không mang sang |

---

## 5. Thống nhất dữ liệu

### 5.1 Schema lệnh hợp nhất (`state.trades[i]`)

Nền là schema A (đã có `id, date, symbol, market, side, setup, netPnl, initialRisk, realizedR, maeR, mfeR, hour, weekday, discipline, review, tag` + trường mở rộng của risk-detail-modal: `openTime, closeTime, entryPrice, slPrice, tpPrice, exitPrice, lots, slippage, tickSize, riskEstimated, riskSource`). Bổ sung từ B:

| Trường B | Trường hợp nhất | Quy tắc chuyển |
|---|---|---|
| `id:'T101'` | `id` (chuỗi/số đều được) | giữ nguyên chuỗi |
| `side:'BUY'/'SELL'` | `side:'Long'/'Short'` | BUY→Long, SELL→Short (hiển thị theo A) |
| `lots` | `lots` | giữ |
| `plannedRiskUsd` | `initialRisk` | **P&L = Actual R × initialRisk** từng lệnh (B 1093 dùng đúng ý này) |
| `maeR` (B: số **dương**, vd 0.2) | `maeR` (A: số **âm** hoặc 0, vd −0.2) | **chuẩn hóa về âm** khi nạp dữ liệu B; ghi chú rõ trong modal "MAE (R âm hoặc 0)" |
| `discipline:'Tuân thủ 100%'/'Vào vội (FOMO)'/'Trả Thù (Revenge)'` | `discipline` enum A: `NONE/FOMO/MOVE_SL/EARLY_EXIT` + thêm `REVENGE` | map: Tuân thủ→NONE, FOMO→FOMO, Revenge→REVENGE (thêm vào danh sách lỗi kỷ luật + từ điển) |
| `setup` (vd 'Liquidity Sweep', 'FVG Retest', 'Order Block Sell', 'Session Open Sweep') | `setup` | thêm các setup này vào `customOptions.setup` (không đổi enum gốc A) |
| `exitReason` | `exitReason` ('auto'/'SL'/'TP'/'MANUAL') | giữ logic B 1151–1163 |
| (B tính) `plannedRR, actualR, durationHours, pipDiff, slippageR` | tính khi hiển thị, không lưu thừa | |
| `assetClass` (B v10) | `assetClass` | từ `ASSET_CLASSES` |

Dữ liệu mẫu: dùng **bộ 15 lệnh của A** làm mặc định (đang là dữ liệu mẫu chung của toàn bộ biểu đồ A); **bộ 15 lệnh của B (T101–T115) nạp thành "Bộ mẫu Risk"** chọn trong Cài đặt → "Nạp dữ liệu mẫu". Hiện banner "dữ liệu mẫu" **chỉ khi** đang dùng dữ liệu mẫu, có nút "Xóa dữ liệu mẫu".

### 5.2 Sổ nạp/rút
`state.cashflows[] = {id, time, type:'DEPOSIT'|'WITHDRAWAL', amount>0, note}`. `initialCapital` giữ ở Cài đặt (A). Khi migrate từ B: khoản `CF1 "Vốn khởi tạo ban đầu"` (20.000) → chuyển thành `initialCapital`, các khoản còn lại → `cashflows`.

### 5.3 Risk Profile (1 object, thay các ô rải rác)
Gồm: `acct`(cá nhân/prop), `propKey`, `t2=3`, `t3=5`, `tierOverride('auto'|1|2|3)`, `k` (số lệnh thua dự phòng/ngày, 3–5), `fTier`(% rủi ro Tier 1), `dailyLossLimit`, `personalDailyLimit`, `maxDrawdown`, `ddMode('static'|'trailing')`, `assumptions{…ASSUMP}`. Ánh xạ trực tiếp vào bảng `risk_profiles` của B khi xuất SQL. Các ô cũ (`risk-pct`, `risk-k`, `risk-dd-limit`, `bud-k`, `bud-f`, `ck-daily`, `ck-personal`, `ck-maxdd`, `ck-ddmode`) đọc/ghi **cùng một object**, không còn ô trùng ý nghĩa.

### 5.4 Migrate & tương thích ngược (bắt buộc)
Hàm `migrateLegacy()` chạy 1 lần khi chưa có `tuannhatky_pro_unified_v1`:
1. Đọc (nếu có, theo thứ tự ưu tiên): key v6 production (lấy từ SRC_C), `tuannhatky_trial_v3_data`, `…_extra`, `…_ext2`, `tuannhatky_v10_db_state`.
2. Chuẩn hóa về schema 5.1/5.2, **dedupe lệnh** theo khóa `date|symbol|side|netPnl` (như A `import`).
3. **Không xóa** key cũ. Tự tạo 1 file JSON sao lưu trước khi ghi (nút tải về/cảnh báo).
4. Ghi `schemaVersion:1`.

---

## 6. Quy tắc công thức (bản A đã kiểm toán thắng B)

| Chủ đề | B (v9) | A (V3) | **Quyết định** |
|---|---|---|---|
| Vốn & Drawdown | `peak = max(netCashflow, currentEquity)`; DD không theo dõi đỉnh chạy; nạp/rút làm méo DD | `capitalNAV()`: NAV theo đơn vị (unit), đỉnh chạy, nạp/rút không đổi NAV | **A** |
| Ngân sách ngày (hiển thị đầu trang) | `equity×0,04/4` gán cứng | `min(Equity×rủi ro%×hệ số Tier, hạn mức ÷ k)` | **A** (trùng cả công thức B 1823) |
| Tier | >5% = 3, >3% = 2, còn lại 1; hệ số [1, 1, 0,5, 0] | `tier(dd)` cùng ngưỡng; hệ số 1 / 0,5 / 0 | **Giống nhau** → 1 hằng số/Risk Profile |
| Cổng Lớp 3 | Tier ≤ `safeTierMax` ∧ μ>0 ∧ Ω(0)>1 | DD ≤ 3% ∧ ≥ 30 lệnh R xác minh ∧ μ>0 ∧ Ω(0)>1 | **Hợp nhất**: Safety(Tier ≤ `safeTierMax`) ∧ Edge(μ>0, Ω(0)>1) ∧ **N ≥ 30 lệnh R xác minh** (của A). `safeTierMax` mặc định 1 (cho phép đổi 2 qua hộp 5 giả định) |
| RCK | 3 bản, có bản gán cứng | `rckEmpirical` (bisection, ràng buộc phi tuyến) + `rckBernoulli` (η hiệu chỉnh cỡ mẫu) | **A** |
| ES / VaR | `esW`, `varW` (trọng số phân đoạn), `tail25Mode` | `nTail=ceil(N·0,025)`; cảnh báo N<40 | Giữ `esW/varW` (B) làm lõi + `tail25Mode` + **cảnh báo N<40 của A** |
| Trượt giá | Chỉ tính khi khớp tại SL/TP; đóng tay = 0 | field `slippage` nhập tay | **B** cho tính tự động, A cho nhập tay (nhập tay ghi đè) |
| Pips/Ticks | chỉ 4 mã (EURUSD, BTCUSDT, XAUUSD, US30) | `SOURCE_SPECS` nhiều mã + quy đổi 1R=N pip do người dùng đặt | **A** (+ mã bổ sung từ B) |
| Lệnh đủ điều kiện cho thống kê R | mọi lệnh | `validTrade`: `initialRisk>0 ∧ !riskEstimated ∧ netR hữu hạn` | **A** |

Mọi công thức hiển thị phải **cùng một giá trị** ở mọi nơi (vd: DD, Tier, Equity, Expectancy, Ω(0), ES, f*): thẻ ở header, Buồng lái, Lớp 1/2/3 và `zones` phải đọc từ `RiskStore`, **tính một lần**.

---

## 7. Cấu trúc mã đích (đơn file, nhưng theo module — hết "patch chồng patch")

```
<head> Tailwind config + CSS (gộp CSS A + CSS B cần thiết; hết trùng quy tắc)
<body> header · sidebar · main (các <section id="tab-…">) · modals · drawers
<script>
  1. Core      : state, STORE_KEY, persist/restore/migrateLegacy, backup
  2. RiskMath  : thuần hàm (không đụng DOM) — dùng chung với Worker
  3. Worker    : dựng từ RiskMath, 4 mô-đun + fallback
  4. RiskStore : tính 1 lần → {equity, nav, dd, tier, budget, gates, edge, tail, rck, mc, prop}
  5. UI kit    : ChartRegistry, card/stat/chip/esc/fmt, tooltip, toast
  6. Pages     : mỗi trang 1 hàm render*(RiskStore) — không tự tính lại
  7. Router    : TABS/TAB_ALIAS/TITLES/showTab/route (hash, chạy được trong iframe)
  8. Boot      : migrate → restore → renderAll
```
Mọi `id` trong DOM phải **duy nhất toàn tài liệu**. Mọi hàm `window.*` chỉ có **một** định nghĩa.

---

## 8. Không mang sang (cố ý bỏ)

Thanh `nav-tabs` 5 tab · huy hiệu "REDESIGN V6" · `fourZoneActive`/`applyLayoutMode`/`zone4-deck`/`z4-*` · Blob worker v7 · toàn bộ stub/gán cứng (D23) · `recalculateMasterCapital` · `getCashflow()` đọc localStorage chéo · các script patch `v6-nav`/`v6-ext`/`v6-ext2` dạng bọc-ghi-đè · thẻ máy tính cũ bị ẩn của `tab-sizer` · `STORAGE_KEY='tuannhatky_v10_db_state'` làm khóa chính.

Cân nhắc giữ (A đang có, **không** xóa trừ khi người dùng yêu cầu): trang `pnlrisk` phần "Classic vs V6" và `mapping` simulator — đây là tài liệu chuyển đổi, vẫn nằm trong "Dữ liệu & kết nối"/"Lợi nhuận & rủi ro".

---

## 9. Kế hoạch thực hiện (theo giai đoạn, mỗi giai đoạn có tiêu chí qua)

| GĐ | Việc | Qua khi |
|---|---|---|
| **P0** | Đọc SRC_A, SRC_B, `03_INVENTORY_ID_HAM.json` (và SRC_C nếu có). In bảng đối chiếu ID/hàm: GIỮ/GỘP/BỎ | Mọi ID/hàm trong inventory có 1 trạng thái |
| **P1** | Dựng khung: head+CSS gộp, header mới (thanh trạng thái B), sidebar 6 nhóm, router | Mở được, điều hướng đủ trang (trang rỗng cũng được) |
| **P2** | Core + RiskMath + Worker + RiskStore + migrate | Test số liệu ở Mục 10 đúng; không còn hàm trùng |
| **P3** | Chuyển trang A nguyên trạng: Workspace, Edge/Drilldown/Discipline, Pnlrisk, Kế hoạch, Lịch, Review, Chartbook, Import, Mapping, Dictionary, Settings | Đối chiếu từng ID của A còn nguyên |
| **P4** | Trang Risk: Buồng lái, Lớp 1, Lớp 2, Lớp 3 (gộp theo Mục 3–4) | Mỗi mục P1–P24 hoạt động; D1–D23 đã xử lý |
| **P5** | Mô phỏng & Stress Lab, Prop Firm, Trade Engine & Sizer, Zones | Không còn trùng D3, D5, D6, D15, D18 |
| **P6** | Dữ liệu & kết nối: schema explorer, xuất SQL, IndexedDB, backup thống nhất | Sao lưu → xóa → khôi phục khớp từng trường |
| **P7** | Rà soát: ID trùng, hàm trùng, console lỗi, dark mode, mobile, a11y (giữ `:focus-visible`, `aria-label`) | Qua toàn bộ Mục 10 |

---

## 10. Nghiệm thu (ChatGPT phải tự chạy và báo kết quả thật, không được "tuyên bố đã đạt")

**Kiểm tra tĩnh (bắt buộc dùng code/Node, in kết quả):**
1. Số `id` trùng trong DOM tĩnh + chuỗi HTML chèn bằng JS = **0**.
2. Mỗi tên hàm `function x` / `window.x =` chỉ xuất hiện **1 lần** (quét regex toàn file).
3. `node --check` (hoặc `new Function`) cho từng khối `<script>` không lỗi cú pháp.
4. Không còn chuỗi: `recalculateMasterCapital`, `zone4-deck`, `z4-`, `fourZoneActive`, `WK4_SRC`, `tuannhatky_v10_db_state` (trừ trong `migrateLegacy`), `nav-tabs`.
5. Mọi ID "GIỮ" trong `03_INVENTORY_ID_HAM.json` (cột A) còn tồn tại; liệt kê ID nào đã đổi tên kèm lý do.
6. Kích thước file & số dòng trước/sau.

**Kiểm tra chạy (nếu có môi trường chạy trình duyệt headless; nếu không, nói rõ là chưa chạy và liệt kê test người dùng phải làm tay):**
7. Bộ mẫu A (15 lệnh): Equity, DD, Tier, Expectancy, SQN, Ω(0), ES hiển thị **giống nhau** ở header, Buồng lái, trang tương ứng và `zones`.
8. Bộ mẫu B (T101–T115): Tier 1 an toàn khi DD thấp; đổi `tierOverride` = 3 ⇒ nút "+ Thêm giao dịch" bị khóa, header đổi màu, Lớp 3 & Stress Lab bị khóa.
9. Thêm 1 lệnh qua modal ⇒ **cùng lúc** cập nhật bảng, KPI, Lớp 1/2/3, Mô phỏng, Buồng lái.
10. Thêm lệnh nạp/rút ⇒ DD **không đổi** do nạp/rút (NAV theo đơn vị).
11. Sao lưu → xóa localStorage → khôi phục ⇒ khớp từng trường; migrate từ key cũ không mất lệnh.
12. Dark mode, mobile sidebar (`toggleMobileSidebar`), hash routing (`#riskopt`…), tooltip `?`, đổi đơn vị R/$/%/Pips.

---

## 11. Điểm cần người dùng xác nhận (ChatGPT cứ làm theo mặc định bên cạnh, ghi vào báo cáo cuối)

| Câu hỏi | Mặc định |
|---|---|
| Giữ `pnlrisk` "Classic vs V6" và `mapping` simulator? | **Giữ** (A đang có) |
| Dữ liệu mẫu mặc định là bộ A hay bộ B? | **Bộ A**; bộ B nạp được từ Cài đặt |
| `safeTierMax` mặc định? | **1** (chỉ Tier 1 an toàn) |
| Key lưu trữ mới? | `tuannhatky_pro_unified_v1` |
| Có cần chạy offline (không CDN)? | **Không** — giữ Tailwind/Chart.js CDN như A và B |
