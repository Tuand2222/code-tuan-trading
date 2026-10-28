# CHANGELOG v3.3 → v3.4

Ngày 28/10/2026. Vá trực tiếp tệp v3.4.py đính kèm, không viết lại từ đầu.
Giữ toàn bộ tên hàm cũ, thứ tự tham số vị trí và khóa trả về hiện có cho đường dữ liệu hợp lệ;
tham số mới có mặc định. Thay đổi tên l_pct theo quyết định D2 có alias keyword tương thích.
Chữ ký type trả về optional được mở rộng khi dữ liệu thiếu thay vì dựng số giả.

## Quyết định D1–D5

- D1: profit_target_pct Optional, XFA None; evaluation simulator lỗi phase_khong_co_muc_tieu; funded API riêng.
- D2: l_frac phân số, positional cũ vẫn chạy; l_pct keyword giữ phân số cũ và DeprecationWarning; cả hai cùng lúc lỗi.
- D3: DL_START bí danh DL_FIXED; giữ nhánh tính vốn đầu ngày trừ % vốn gốc. [CẦN XÁC MINH định nghĩa chính thức].
- D4: xóa chứng nhận lịch sử thiếu nguồn khỏi trạng thái hiện tại, giữ nhãn [LỊCH SỬ — CHƯA TÁI KIỂM]. Danh sách 125 hiện tại được dựng lại, không giả là bộ runner gốc.
- D5: đã duyệt nguồn chính thức, URL/ngày ở báo cáo. Topstep 55/40 và Standard được xác nhận từng phần, còn payout cap/ngày/phí chưa đủ; mọi preset verified=False,last_verified=None. Bộ số không bị đổi theo suy đoán.

## Ánh xạ tham chiếu cũ → mới (A2)

| Tham chiếu cũ | Tham chiếu v3.4 | Nội dung |
|---|---|---|
| §9.3 khi nói parser/column vote | §9.2 | Đọc số, Q3 |
| §9.4 khi nói map_direction/CashFlow | §9.3 | Hướng và P&L |
| §9.5 khi nói Net A/B/C | §9.3 | P&L ba cấp |
| §9.6 | §9.4, §9.6 | FIFO gốc và adapter tiền tài khoản mới |
| §9.7 khi nói robust log | §9.5 | Kiểm toán giá |
| §6.4 cũ | §6.2 | SQN 7 bậc |
| §6.5 cũ | §6.3 | Hold time / phiên UTC |
| §0.8 / §6.3 khi nói JSON-safe | §0, §6.4 mới | Biên JSON đệ quy |
| §12.5, §12.5.3 cũ | §12.4 | Bootstrap / Wilson / số lần thi |
| §12.6 cũ | §12.4, §12.5 mới | EV và funded lifecycle |
| §15.4–§15.10 cũ | §15.3 | Danh sách vector đầy đủ theo ID |

Các số tham chiếu vốn trùng mục mới được sửa theo ngữ cảnh tên hàm, không chỉ thay chuỗi số mù.

## B1–B8

| Mục | Thay đổi | Test | Spec |
|---|---|---|---|
| B1 | Cấp C → cycle_to_trade, phí account/price units, fee FX thực sự nhân | test_B1_* | 9.6 |
| B2 | compute_r_multiple + SL đúng phía + all-legs fallback + loại empirical khỏi SQN | test_B2_* | 5.7 |
| B3 | IANA UTC, DST gap/fold tường minh, trading day reset | test_B3_* | 9.7 |
| B4 | Header vị trí trùng, aliases, CSV/HTML/XLSX raw, Preview/atomic hai sổ, undo receipt | test_B4_* | 9.7, 10.5 |
| B5 | 5 dataclass đầy đủ trường, Decimal và validation | test_B5_* | 3.1 |
| B6 | Omega(theta), median, ES warning, money stats, JSON-safe đệ quy | test_B6_* | 6.4 |
| B7 | Quét sự kiện UTC O(N log N), không prefix O(N²), vật hóa iterator | test_B7_* | 4.8 |
| B8 | Ngày nguyên cụm, funded payout/floor modes, lifecycle cùng latent world, mean unconditional EV | test_B8_* | 12.5 |

## Bằng chứng A8 và sửa lỗi bổ sung

Các dòng sau là dòng **tệp đầu vào nguyên trạng**, không phải số dòng tự khai lịch sử.

1. **size_position, input lines 343–437:** D(NaN) đi tới so sánh Decimal; None đi tới <=, override 0 bị bỏ qua do if override; slip/commission âm không chặn. Sửa: D/to_dec hữu hạn, validate missing/bool/step/min/csize/cost trước công thức.

2. **compute_net_pnl, input lines 732–801:** fee=.001 BNB, FX=600, gross100: mã cũ chỉ kiểm FX nhưng không nhân, cho99.999 thay vì100-.6=99.4. Direction rác ở B bị coi Sell. Sửa: Nhân fee FX, validate hướng/chi phí; công thức và dấu nguồn không đổi.

3. **cycle_net_account, input lines 907–911:** fees_in_account=False được khai báo nhưng bị bỏ qua; gross35,vpoint10,fees.45 => expected345.5, trước cho349.55. Sửa: Áp dụng nhân phí với vpoint chỉ khi phí ở price units.

4. **drawdown, input lines 953–977:** events là generator bị sum đếm hết trước vòng replay; số dư và DD không chạy. Sửa: Vật hóa list một lần, validate events, thiếu vốn trả reason.

5. **replay_tier_tags, input lines 1056–1105:** close10:00+07=03:00Z xảy ra trước open04:00Z nhưng so chuỗi 10:00>04:00 bỏ sót; quét toàn events cho từng trade là O(N²). Sửa: Aware UTC và quét hai danh sách đã sort.

6. **hold_time_and_session, input lines 1144–1182:** Naive giờ mở lẫn aware giờ đóng có thể ném TypeError hoặc dùng timezone máy. Sửa: Không giả timezone; missing_timezone explicit.

7. **metrics_to_json_safe, input lines 1299–1313:** Chỉ lặp một tầng dict; nested kelly_ci90 NaN/Infinity và Decimal không serialize chuẩn được. Sửa: Đệ quy, Decimal string, wrapper đặc biệt; Decimal1e10000 không bị nhầm Infinity khi cast float.

8. **upsert_multiset_batch, input lines 643–687:** Trùng fingerprint nhưng incoming id giống nhau sinh nhiều bản ghi cùng id; cập nhật tuần tự có thể ghi nửa batch. Sửa: Working copy, unique id theo occurrence, receipt before/after.

9. **undo_import_batch, input lines 690–692:** Chỉ xóa NEW theo batch ID, không phục hồi ENRICH và có thể bỏ chỉnh sửa sau import. Sửa: Receipt khôi phục đầy đủ, kiểm tra conflict trước sửa; old 2-arg API giữ hành vi NEW-only có tài liệu.

10. **parse_optional_cost, input lines 185–192:** Chi phí bool/NaN/rác trả0 có cờ nhưng caller có thể dùng như phí thật. Sửa: Chỉ ô rỗng tùy chọn trả0+cờ; rác trảNone+reason.

11. **wilson_ci95, input lines 1702–1711:** total=0 trả(0,0) làm thiếu dữ liệu giống xác suất chắc chắn0. Sửa: ValueError có lý do; số đếm nguyên hợp lệ mới tính Wilson.

12. **prop_pass_probability, input lines 1714–1764:** resample day nhánh Efron không giữ ngày; pooled Wilson coi các thử trong cùng latent world là độc lập. Sửa: Lấy nguyên ngày ở cả hai tầng; Wilson per-world, pooled None khi outer>1. Phân vị Monte Carlo chuẩn giữ nguyên.

13. **prop_ev_roi, input lines 1813–1832:** activation_fee NaN/None bị or0 che thiếu dữ liệu; p_funded ngoài[0,1] vẫn tính tiền. Sửa: Validate tham số, không dựng phí thiếu thành0. Mean payout vẫn vô điều kiện như công thức gốc.

Lỗi adapter CSV mới tìm thấy khi chạy pytest lần đầu: metadata một cột trước header làm csv.Sniffer không nhận delimiter; giữ nguyên kỳ vọng test, sửa fallback chọn delimiter từ số lần xuất hiện ở toàn mẫu header/data. Log lần đầu vẫn lưu, không xóa ca đỏ.

**[ĐỀ XUẤT, CHƯA ÁP DỤNG]** ES công thức âm của mẫu toàn thắng: R=[1,2],k=1,ES=-1. Giữ nguyên công thức, chưa clamp/abs. Mô tả “số dương” không luôn đúng.
**[ĐỀ XUẤT, CHƯA ÁP DỤNG]** Preset quỹ cần schema riêng cho ngày thắng, payout caps, thời điểm hoàn phí; giữ bộ số đầu vào và verified=False, không tự coi generic funded là toàn bộ chính sách quỹ.

## Thay đổi chữ ký thực tế

- `parse_optional_cost`: `(v, dec_sep: 'str' = '.') -> 'Tuple[Decimal, Optional[str]]'` → `(v, dec_sep: 'str' = '.') -> 'Tuple[Optional[Decimal], Optional[str]]'`. Thứ tự vị trí tương thích: True.
- `risk1r`: `(entry, sl, volume, vpoint) -> 'Optional[Decimal]'` → `(entry, sl, volume, vpoint, direction=None, side=None) -> 'Optional[Decimal]'`. Thứ tự vị trí tương thích: True.
- `upsert_multiset_batch`: `(db_records: 'List[Dict[str, Any]]', incoming_records: 'List[Dict[str, Any]]', import_batch_id: 'str') -> 'Dict[str, Any]'` → `(db_records: 'List[Dict[str, Any]]', incoming_records: 'List[Dict[str, Any]]', import_batch_id: 'str', batch_journal=None) -> 'Dict[str, Any]'`. Thứ tự vị trí tương thích: True.
- `undo_import_batch`: `(db_records: 'List[Dict[str, Any]]', import_batch_id: 'str') -> 'List[Dict[str, Any]]'` → `(db_records: 'List[Dict[str, Any]]', import_batch_id: 'str', undo_record=None, batch_journal=None, db_cashflows=None) -> 'List[Dict[str, Any]]'`. Thứ tự vị trí tương thích: True.
- `compute_net_pnl`: `(level: 'str', gross_pnl=None, entry_price=None, exit_price=None, volume=None, direction: 'str' = 'buy', vpoint_exit=None, commission=None, swap=None, fee=None, tax=None, source_type: 'str' = 'mt4_mt5', fee_currency: 'Optional[str]' = None, account_currency: 'str' = 'USD', fee_fx_rate=None) -> 'Dict[str, Any]'` → `(level: 'str', gross_pnl=None, entry_price=None, exit_price=None, volume=None, direction: 'str' = 'buy', vpoint_exit=None, commission=None, swap=None, fee=None, tax=None, source_type: 'str' = 'mt4_mt5', fee_currency: 'Optional[str]' = None, account_currency: 'str' = 'USD', fee_fx_rate=None, fills=None, cycle=None, allow_short=True, fees_in_account=True, account_id='', symbol='', fallback_1r=None) -> 'Dict[str, Any]'`. Thứ tự vị trí tương thích: True.
- `trading_day_key`: `(ts: 'dt.datetime', reset: 'str' = '00:00') -> 'dt.date'` → `(ts: 'dt.datetime', reset: 'str' = '00:00', serverTimeZone=None, fold=None) -> 'Optional[dt.date]'`. Thứ tự vị trí tương thích: True.
- `metrics`: `(R: 'Iterable', with_kelly_ci: 'bool' = False) -> 'Dict[str, Any]'` → `(R: 'Iterable', with_kelly_ci: 'bool' = False, theta: 'float' = 0.0, esWarnR: 'float' = 2.0, money_pnls=None, trades=None) -> 'Dict[str, Any]'`. Thứ tự vị trí tương thích: True.
- `metrics_to_json_safe`: `(m: 'Dict[str, Any]') -> 'Dict[str, Any]'` → `(m)`. Thứ tự vị trí tương thích: True.
- `simulate_path`: `(rs: 'random.Random', pop, cumw, phase: 'PhaseRule', preset: 'PropPresetV3', risk_pct: 'float' = 1.0, trades_per_day: 'int' = 1, sample_mode: 'str' = 'empirical', fee_drag_R: 'float' = 0.0, bound: 'str' = 'optimistic', mfe_extra_R: 'float' = 0.5, day_cap: 'int' = 250) -> 'int'` → `(rs: 'random.Random', pop, cumw, phase: 'PhaseRule', preset: 'PropPresetV3', risk_pct: 'float' = 1.0, trades_per_day: 'int' = 1, sample_mode: 'str' = 'empirical', fee_drag_R: 'float' = 0.0, bound: 'str' = 'optimistic', mfe_extra_R: 'float' = 0.5, day_cap: 'int' = 250, day_samples=None) -> 'Any'`. Thứ tự vị trí tương thích: True.
- `prop_pass_probability`: `(samples, preset: 'PropPresetV3', phase_index: 'int' = 0, risk_pct: 'float' = 1.0, trades_per_day: 'int' = 1, sample_mode: 'str' = 'empirical', fee_drag_R: 'float' = 0.0, b_outer: 'int' = 200, m_inner: 'int' = 300, resample: 'str' = 'bayesian', bound: 'str' = 'optimistic', mfe_extra_R: 'float' = 0.5, seed: 'int' = 0, day_cap: 'int' = 250, block_size: 'int' = 5) -> 'Dict[str, Any]'` → `(samples, preset: 'PropPresetV3', phase_index: 'int' = 0, risk_pct: 'float' = 1.0, trades_per_day: 'int' = 1, sample_mode: 'str' = 'empirical', fee_drag_R: 'float' = 0.0, b_outer: 'int' = 200, m_inner: 'int' = 300, resample: 'str' = 'bayesian', bound: 'str' = 'optimistic', mfe_extra_R: 'float' = 0.5, seed: 'int' = 0, day_cap: 'int' = 250, block_size: 'int' = 5, parametric_mean=None, parametric_sd=None, parametric_n=200) -> 'Dict[str, Any]'`. Thứ tự vị trí tương thích: True.
- `eod_floor_series`: `(b0, l_pct, closes: 'Sequence[Any]', lock_at_initial: 'bool' = True) -> 'List[Decimal]'` → `(b0, l_frac=None, closes: 'Sequence[Any]' = (), lock_at_initial: 'bool' = True, *, l_pct=None) -> 'List[Decimal]'`. Thứ tự vị trí tương thích: True.

API mới: `AccountProfile`, `CashFlow`, `Fallback1RConfig`, `InstrumentSpec`, `Trade`, `_TableReader`, `_finite_float`, `_group_day_samples`, `_money_metrics`, `_prepare_fifo_fees`, `compute_r_multiple`, `cycle_to_trade`, `detect_header`, `import_pipeline`, `map_columns`, `prop_full_lifecycle`, `read_import_rows`, `simulate_funded_phase`, `source_to_utc`.

Không bỏ hàm gốc. Các trường cũ giữ nguyên ở đường dữ liệu hợp lệ; invalid input có trạng thái/lý do rõ hoặc ValueError, không giữ lại số giả cũ. Q1–Q4 và ba giá trị Kelly chuẩn được kiểm thử.
