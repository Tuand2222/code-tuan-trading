# VERIFICATION REPORT — TUAN TRADER v3.4

Ngày: 28/10/2026. [ĐÃ CHẠY v3.4]

## Kết quả thực tế

- Tổng **214 ca pytest đạt**, 0 sai, 0 skip, 0 xfail; log nguyên văn ở cuối báo cáo.
- **125 vector cơ sở + 89 ca mới**. Số nhóm: 11 / 20 / 25 / 20 / 4 / 6 / 15 / 5 / 10 / 4 / 1 / 3 / 1.
- Cùng 125 vector cơ sở chạy trên tệp đầu vào nguyên trạng: **125 đạt, 0 sai, 0 skip**. Đây là kiểm tra hồi quy trên tệp được gửi, không phải xác minh bộ runner lịch sử.
- Các input/expected/source đều công khai đầy đủ trong Mục 15 của đặc tả và BASE_VECTORS trong pytest.
- **SNAPSHOT: 0**. Không dùng giá trị sinh từ engine làm kỳ vọng, không skip/xfail, không nới tolerance để che lỗi. Các giá trị Kelly làm tròn 10 số có abs tolerance 5e-11 công khai ngay trong test; Decimal hữu hạn so chính xác, Fraction division kiểm tra 1e-35 tại prec40.
- Biên dịch Python bằng py_compile: hai tệp Python hợp lệ.
- Định nghĩa cấp module: 72 tên gốc được bảo toàn, 91 tên sau bổ sung, 0 tên trùng; 0 tên gốc bị bỏ. Chữ ký được kiểm tự động về thứ tự positional; alias l_pct theo D2.
- Tham chiếu § không tồn tại trong Python/spec/test: **0**. 125 dòng vector được đếm từ tài liệu bằng code.
- Ngoài CHANGELOG, năm tệp bàn giao không dùng nhãn phiên bản cũ. Đặc tả không chứa dấu rút gọn ba chấm hoặc cụm chỉ dẫn bỏ nội dung bị cấm.
- Q1: R=[-1] → DD_R=1R. Q2: entry_avg=105 và entry_avg_closed=155/1.5; đóng hết về105. Q3: rỗng→None. Q4: giữ bộ cấu hình 55% / Standard không Consistency / Consistency40%, XFA target=None.
- Ba nghiệm Kelly chuẩn đều đạt: .2053489069 / .3956162848 / .6816059592. FPT có phí: 700 CP, loss6465, risk4,525,500.

## Đầu vào và giới hạn lịch sử

Hai tệp đọc toàn bộ, parse AST và kiểm tra phần kết thúc, không phát hiện cắt cụt:
- `original_v3.4.py`: 81315 bytes, 1832 dòng, SHA-256 `0b5f68f25031f071b1013d598d2cc34970d629fd531defc6d6312ae00bc88c8b`.
- `original_v3.4.md`: 88081 bytes, 761 dòng, SHA-256 `2d3cbd30cc85b83ba5fc242bcf6056508ece90f148b7b97f925caf3b771e0c64`.

Không được cung cấp runner lịch sử run_125_vectors.py, engine gốc lịch sử, PDF hay DOCX gốc trong gói hiện tại. Vì vậy **[LỊCH SỬ — CHƯA TÁI KIỂM]** áp dụng cho các tuyên bố 105/125, hash rút gọn và 125/125 lịch sử. Bộ 125 hiện tại được dựng lại từ chuẩn cụ thể ở đặc tả theo đúng số nhóm; không thể khẳng định danh tính từng ca trùng runner không có. Không dùng trí nhớ của công việc trước làm chứng cứ.

## Môi trường và chạy lại

```json
{
  "python": "3.12.14 (main, Aug 25 2026, 14:01:42) [MSC v.1944 64 bit (AMD64)]",
  "platform": "win32",
  "decimal_precision": 40
}
```

Pytest 9.2.0 và tzdata 2026.6 được cài vào thư mục phụ trợ riêng để chạy kiểm thử, không thay dependency website.
Engine dùng Python standard library; trên Windows cần tzdata để ZoneInfo có cơ sở múi giờ.

Trong thư mục chứa hai tệp Python:

```powershell
python -m pip install pytest tzdata
python -m py_compile tuan_trader_v3_4.py test_tuan_trader_v3_4.py
python -m pytest -v test_tuan_trader_v3_4.py
```

Không cần các script build nội bộ để sử dụng tệp bàn giao. Test tự chứa dữ liệu, tạo XLSX synthetic trong thư mục tạm.

## Phạm vi đã chạy

- 125 vector gốc theo danh sách hiện tại, bộ mở rộng B1–B8, dữ liệu biên, seed MC cố định.
- Các nhóm B có engine + pytest + đoạn đặc tả + CHANGELOG tương ứng, bảng ánh xạ tại Phụ lục A.
- Preview CSV/HTML synthetic và XLSX raw XML; mapping Time/Price trùng, volume slash, dấu số mơ hồ; no-auto-scale và price_unit tường minh.
- Import hai sổ trên working copy, multiset, ENRICH bảo vệ user fields, receipt undo, conflict sau sửa, cashflow dedupe/undo.
- DST New York năm2026 (spring gap / fall fold0 và1), UTC-aware replay, reset ngày tài khoản.
- Funded deterministic cash paths kiểm riêng KEEP_FLOOR / LOCK_AT_INITIAL / LOCK_AT_BUFFER / FULL_RESET, min payout, Consistency reset, daily loss, MAE; lifecycle mean payout/fees/split/refund.
- JSON đệ quy allow_nan=False, Decimal lớn hữu hạn, nested Kelly CI, N=0/1, thiếu/corrupt inputs.

**Hiệu năng replay Python thực đo**, dữ liệu synthetic không phải nhật ký người dùng:

- 10,000 trade: 0.211690 giây, output 10,000 bản ghi; breach_count=0.
- 50,000 trade: 1.094761 giây, output 50,000 bản ghi; breach_count=0.

Đây là số đo tại máy này, không cam kết mọi môi trường và không chứng minh storage/cloud/browser sync 50k. Cấu trúc replay sort rồi quét một lần có độ phức tạp O(N log N), bộ nhớ O(N).

## Bằng chứng lỗi đầu vào và kết quả sau sửa

Các output sau là probe thực chạy trên hai engine, không phải số dự đoán:

```json
[
  {
    "function": "compute_net_pnl",
    "args": [
      "A"
    ],
    "kwargs": {
      "gross_pnl": 100,
      "fee": ".001",
      "source_type": "binance_futures",
      "fee_currency": "BNB",
      "fee_fx_rate": 600
    },
    "input_result": "{'status': 'ok', 'grossPnl': Decimal('100'), 'netPnl': Decimal('99.999'), 'netPnlSource': 'derived_A', 'feeKnown': True, 'label': 'Net sau phí', 'flags': []}",
    "patched_result": "{'status': 'ok', 'grossPnl': Decimal('100'), 'netPnl': Decimal('99.400'), 'netPnlSource': 'derived_A', 'feeKnown': True, 'label': 'Net sau phí', 'flags': []}"
  },
  {
    "function": "size_position",
    "args": [
      null,
      1,
      "1.085",
      "1.083",
      "buy",
      "EURUSD"
    ],
    "kwargs": {},
    "input_result": "TypeError: '<=' not supported between instances of 'NoneType' and 'int'",
    "patched_result": "{'status': 'error', 'why': 'missing_numeric_input'}"
  },
  {
    "function": "size_position",
    "args": [
      10000,
      1,
      "1.085",
      "1.083",
      "buy",
      "EURUSD"
    ],
    "kwargs": {
      "step_override": 0
    },
    "input_result": "{'status': 'ok', 'volume': Decimal('0.5'), 'vraw': Decimal('0.5'), 'vRaw': Decimal('0.5'), 'vpoint': Decimal('100000'), 'vpointAcct': Decimal('100000'), 'loss_lot': Decimal('200.000'), 'lossPerLot': Decimal('200.000'), 'risk_actual': Decimal('100.0000'), 'riskActual': Decimal('100.0000'), 'risk_pct_actual': Decimal('1.0000'), 'riskPctActual': Decimal('1.0000'), 'assumptions': [], 'flags': [], 'warnings': []}",
    "patched_result": "{'status': 'error', 'why': 'invalid_contract_or_cost'}"
  },
  {
    "function": "parse_optional_cost",
    "args": [
      true
    ],
    "kwargs": {},
    "input_result": "(Decimal('0'), 'invalid_cost_bool_not_allowed')",
    "patched_result": "(None, 'invalid_cost_bool_not_allowed')"
  },
  {
    "function": "hold_time_and_session",
    "args": [
      "2026-01-01T00:00:00",
      "2026-01-01T01:00:00Z"
    ],
    "kwargs": {},
    "input_result": "TypeError: can't subtract offset-naive and offset-aware datetimes",
    "patched_result": "{'holdTimeSeconds': None, 'session': None, 'flags': ['missing_timezone']}"
  },
  {
    "function": "wilson_ci95",
    "args": [
      0,
      0
    ],
    "kwargs": {},
    "input_result": "(0.0, 0.0)",
    "patched_result": "ValueError: invalid_binomial_counts_or_z"
  }
]
```

Lần pytest đầu: 195 đạt, 1 sai do adapter CSV mới xử lý metadata/header. Đã sửa code chọn delimiter dự phòng, không sửa kỳ vọng tài chính; log đầu được bảo toàn trong workspace. Các kiểm tra mới sau đó bổ sung đến tổng ở đầu báo cáo.

## Nguồn quỹ đã truy cập và phần chưa xác minh

Ngày truy cập thực trong lượt này: **28/10/2026**.

- [Topstep Consistency](https://help.topstep.com/en/articles/8284208-consistency-at-topstep): đối chiếu được Combine55% và XFA40%.
- [Topstep XFA Parameters](https://help.topstep.com/en/articles/8284215-express-funded-account-parameters): Standard không Consistency, XFA không profit target.
- [Topstep Payout Policy](https://help.topstep.com/en/articles/8284233-topstep-payout-policy): còn điều kiện ngày/cửa sổ/payout cap ngoài cấu hình đầu vào. Không chứng nhận preset là đầy đủ.
- [The5ers High Stakes](https://the5ers.com/high-stakes/): đối chiếu một phần ngưỡng target/loss/ngày lãi, chưa xác minh toàn bộ chương trình/phí/hành vi sau rút.
- [FTMO Trading Objectives](https://ftmo.com/en/trading-objectives/): đối chiếu một phần 2-Step; phí và ngày hoàn phí còn phải xác minh theo hợp đồng cụ thể.
- Apex: thử truy cập trang quy tắc chính thức không thành công; **chưa tái xác minh**. Không lấy kết quả thứ cấp thay cho nguồn chính thức.

**Mọi preset verified=False,last_verified=None**. Ngày effective_from/program_version cũ chỉ là metadata đầu vào, không phải ngày xác minh mới. Các con số được bảo toàn theo D5; nguồn xác nhận từng phần không biến thành xác nhận toàn bộ gói.

## Những việc chưa được kiểm thử hoặc chưa thuộc gói bàn giao

- Chưa chạy trên file sao kê thật MT4/MT5/Binance/SSI/VPS; chỉ fixture synthetic, không chạm nhật ký người dùng.
- XLSX adapter tham chiếu đọc worksheet đầu và raw cells; không tự đọc định dạng cell.w để đoán locale/ngày. Excel serial ngày cần bước chuẩn hóa riêng, không bị giả thành timestamp.
- Funded là mô hình cấu hình tổng quát. Payout mặc định theo trading-day simulation, không lịch nghỉ quỹ; payout_fraction mặc định1 chỉ là giả định cấu hình. Đủ điều kiện rút riêng từng quỹ chưa được sao chép toàn bộ. Các điểm cần quyết về công thức/chính sách được gắn [ĐỀ XUẤT] và chưa tự áp dụng.
- ES giữ nguyên công thức: toàn thắng R=[1,2] cho ES=-1; không tự lấy abs/clamp chỉ vì mô tả cũ ghi số dương.
- DL_START là alias, định nghĩa chính thức vẫn cần xác minh.
- Chưa tích hợp/deploy bộ v3.4 này lên Classic/V6, GitHub hoặc website. Chưa test UI Chrome/Edge/Firefox/Samsung, PWA, cloud persistence hoặc sync nhiều máy với bộ Python mới. Tệp đầu ra là bộ tham chiếu theo yêu cầu hiện tại.
- Các thay đổi website đang làm ở lượt trước vẫn nằm riêng trong checkout, không bị ghi đè bởi gói này.

## Log pytest nguyên văn của bản vá

```text
============================= test session starts =============================
platform win32 -- Python 3.12.14, pytest-9.2.0, pluggy-1.7.0 -- C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\ADMIN\Documents\Codex\2026-10-22\x\outputs\tuan-trader-v3_4
collecting ... collected 214 items

test_tuan_trader_v3_4.py::test_base_125[G01-01] PASSED                   [  0%]
test_tuan_trader_v3_4.py::test_base_125[G01-02] PASSED                   [  0%]
test_tuan_trader_v3_4.py::test_base_125[G01-03] PASSED                   [  1%]
test_tuan_trader_v3_4.py::test_base_125[G01-04] PASSED                   [  1%]
test_tuan_trader_v3_4.py::test_base_125[G01-05] PASSED                   [  2%]
test_tuan_trader_v3_4.py::test_base_125[G01-06] PASSED                   [  2%]
test_tuan_trader_v3_4.py::test_base_125[G01-07] PASSED                   [  3%]
test_tuan_trader_v3_4.py::test_base_125[G01-08] PASSED                   [  3%]
test_tuan_trader_v3_4.py::test_base_125[G01-09] PASSED                   [  4%]
test_tuan_trader_v3_4.py::test_base_125[G01-10] PASSED                   [  4%]
test_tuan_trader_v3_4.py::test_base_125[G01-11] PASSED                   [  5%]
test_tuan_trader_v3_4.py::test_base_125[G02-01] PASSED                   [  5%]
test_tuan_trader_v3_4.py::test_base_125[G02-02] PASSED                   [  6%]
test_tuan_trader_v3_4.py::test_base_125[G02-03] PASSED                   [  6%]
test_tuan_trader_v3_4.py::test_base_125[G02-04] PASSED                   [  7%]
test_tuan_trader_v3_4.py::test_base_125[G02-05] PASSED                   [  7%]
test_tuan_trader_v3_4.py::test_base_125[G02-06] PASSED                   [  7%]
test_tuan_trader_v3_4.py::test_base_125[G02-07] PASSED                   [  8%]
test_tuan_trader_v3_4.py::test_base_125[G02-08] PASSED                   [  8%]
test_tuan_trader_v3_4.py::test_base_125[G02-09] PASSED                   [  9%]
test_tuan_trader_v3_4.py::test_base_125[G02-10] PASSED                   [  9%]
test_tuan_trader_v3_4.py::test_base_125[G02-11] PASSED                   [ 10%]
test_tuan_trader_v3_4.py::test_base_125[G02-12] PASSED                   [ 10%]
test_tuan_trader_v3_4.py::test_base_125[G02-13] PASSED                   [ 11%]
test_tuan_trader_v3_4.py::test_base_125[G02-14] PASSED                   [ 11%]
test_tuan_trader_v3_4.py::test_base_125[G02-15] PASSED                   [ 12%]
test_tuan_trader_v3_4.py::test_base_125[G02-16] PASSED                   [ 12%]
test_tuan_trader_v3_4.py::test_base_125[G02-17] PASSED                   [ 13%]
test_tuan_trader_v3_4.py::test_base_125[G02-18] PASSED                   [ 13%]
test_tuan_trader_v3_4.py::test_base_125[G02-19] PASSED                   [ 14%]
test_tuan_trader_v3_4.py::test_base_125[G02-20] PASSED                   [ 14%]
test_tuan_trader_v3_4.py::test_base_125[G03-01] PASSED                   [ 14%]
test_tuan_trader_v3_4.py::test_base_125[G03-02] PASSED                   [ 15%]
test_tuan_trader_v3_4.py::test_base_125[G03-03] PASSED                   [ 15%]
test_tuan_trader_v3_4.py::test_base_125[G03-04] PASSED                   [ 16%]
test_tuan_trader_v3_4.py::test_base_125[G03-05] PASSED                   [ 16%]
test_tuan_trader_v3_4.py::test_base_125[G03-06] PASSED                   [ 17%]
test_tuan_trader_v3_4.py::test_base_125[G03-07] PASSED                   [ 17%]
test_tuan_trader_v3_4.py::test_base_125[G03-08] PASSED                   [ 18%]
test_tuan_trader_v3_4.py::test_base_125[G03-09] PASSED                   [ 18%]
test_tuan_trader_v3_4.py::test_base_125[G03-10] PASSED                   [ 19%]
test_tuan_trader_v3_4.py::test_base_125[G03-11] PASSED                   [ 19%]
test_tuan_trader_v3_4.py::test_base_125[G03-12] PASSED                   [ 20%]
test_tuan_trader_v3_4.py::test_base_125[G03-13] PASSED                   [ 20%]
test_tuan_trader_v3_4.py::test_base_125[G03-14] PASSED                   [ 21%]
test_tuan_trader_v3_4.py::test_base_125[G03-15] PASSED                   [ 21%]
test_tuan_trader_v3_4.py::test_base_125[G03-16] PASSED                   [ 21%]
test_tuan_trader_v3_4.py::test_base_125[G03-17] PASSED                   [ 22%]
test_tuan_trader_v3_4.py::test_base_125[G03-18] PASSED                   [ 22%]
test_tuan_trader_v3_4.py::test_base_125[G03-19] PASSED                   [ 23%]
test_tuan_trader_v3_4.py::test_base_125[G03-20] PASSED                   [ 23%]
test_tuan_trader_v3_4.py::test_base_125[G03-21] PASSED                   [ 24%]
test_tuan_trader_v3_4.py::test_base_125[G03-22] PASSED                   [ 24%]
test_tuan_trader_v3_4.py::test_base_125[G03-23] PASSED                   [ 25%]
test_tuan_trader_v3_4.py::test_base_125[G03-24] PASSED                   [ 25%]
test_tuan_trader_v3_4.py::test_base_125[G03-25] PASSED                   [ 26%]
test_tuan_trader_v3_4.py::test_base_125[G04-01] PASSED                   [ 26%]
test_tuan_trader_v3_4.py::test_base_125[G04-02] PASSED                   [ 27%]
test_tuan_trader_v3_4.py::test_base_125[G04-03] PASSED                   [ 27%]
test_tuan_trader_v3_4.py::test_base_125[G04-04] PASSED                   [ 28%]
test_tuan_trader_v3_4.py::test_base_125[G04-05] PASSED                   [ 28%]
test_tuan_trader_v3_4.py::test_base_125[G04-06] PASSED                   [ 28%]
test_tuan_trader_v3_4.py::test_base_125[G04-07] PASSED                   [ 29%]
test_tuan_trader_v3_4.py::test_base_125[G04-08] PASSED                   [ 29%]
test_tuan_trader_v3_4.py::test_base_125[G04-09] PASSED                   [ 30%]
test_tuan_trader_v3_4.py::test_base_125[G04-10] PASSED                   [ 30%]
test_tuan_trader_v3_4.py::test_base_125[G04-11] PASSED                   [ 31%]
test_tuan_trader_v3_4.py::test_base_125[G04-12] PASSED                   [ 31%]
test_tuan_trader_v3_4.py::test_base_125[G04-13] PASSED                   [ 32%]
test_tuan_trader_v3_4.py::test_base_125[G04-14] PASSED                   [ 32%]
test_tuan_trader_v3_4.py::test_base_125[G04-15] PASSED                   [ 33%]
test_tuan_trader_v3_4.py::test_base_125[G04-16] PASSED                   [ 33%]
test_tuan_trader_v3_4.py::test_base_125[G04-17] PASSED                   [ 34%]
test_tuan_trader_v3_4.py::test_base_125[G04-18] PASSED                   [ 34%]
test_tuan_trader_v3_4.py::test_base_125[G04-19] PASSED                   [ 35%]
test_tuan_trader_v3_4.py::test_base_125[G04-20] PASSED                   [ 35%]
test_tuan_trader_v3_4.py::test_base_125[G05-01] PASSED                   [ 35%]
test_tuan_trader_v3_4.py::test_base_125[G05-02] PASSED                   [ 36%]
test_tuan_trader_v3_4.py::test_base_125[G05-03] PASSED                   [ 36%]
test_tuan_trader_v3_4.py::test_base_125[G05-04] PASSED                   [ 37%]
test_tuan_trader_v3_4.py::test_base_125[G06-01] PASSED                   [ 37%]
test_tuan_trader_v3_4.py::test_base_125[G06-02] PASSED                   [ 38%]
test_tuan_trader_v3_4.py::test_base_125[G06-03] PASSED                   [ 38%]
test_tuan_trader_v3_4.py::test_base_125[G06-04] PASSED                   [ 39%]
test_tuan_trader_v3_4.py::test_base_125[G06-05] PASSED                   [ 39%]
test_tuan_trader_v3_4.py::test_base_125[G06-06] PASSED                   [ 40%]
test_tuan_trader_v3_4.py::test_base_125[G07-01] PASSED                   [ 40%]
test_tuan_trader_v3_4.py::test_base_125[G07-02] PASSED                   [ 41%]
test_tuan_trader_v3_4.py::test_base_125[G07-03] PASSED                   [ 41%]
test_tuan_trader_v3_4.py::test_base_125[G07-04] PASSED                   [ 42%]
test_tuan_trader_v3_4.py::test_base_125[G07-05] PASSED                   [ 42%]
test_tuan_trader_v3_4.py::test_base_125[G07-06] PASSED                   [ 42%]
test_tuan_trader_v3_4.py::test_base_125[G07-07] PASSED                   [ 43%]
test_tuan_trader_v3_4.py::test_base_125[G07-08] PASSED                   [ 43%]
test_tuan_trader_v3_4.py::test_base_125[G07-09] PASSED                   [ 44%]
test_tuan_trader_v3_4.py::test_base_125[G07-10] PASSED                   [ 44%]
test_tuan_trader_v3_4.py::test_base_125[G07-11] PASSED                   [ 45%]
test_tuan_trader_v3_4.py::test_base_125[G07-12] PASSED                   [ 45%]
test_tuan_trader_v3_4.py::test_base_125[G07-13] PASSED                   [ 46%]
test_tuan_trader_v3_4.py::test_base_125[G07-14] PASSED                   [ 46%]
test_tuan_trader_v3_4.py::test_base_125[G07-15] PASSED                   [ 47%]
test_tuan_trader_v3_4.py::test_base_125[G08-01] PASSED                   [ 47%]
test_tuan_trader_v3_4.py::test_base_125[G08-02] PASSED                   [ 48%]
test_tuan_trader_v3_4.py::test_base_125[G08-03] PASSED                   [ 48%]
test_tuan_trader_v3_4.py::test_base_125[G08-04] PASSED                   [ 49%]
test_tuan_trader_v3_4.py::test_base_125[G08-05] PASSED                   [ 49%]
test_tuan_trader_v3_4.py::test_base_125[G09-01] PASSED                   [ 50%]
test_tuan_trader_v3_4.py::test_base_125[G09-02] PASSED                   [ 50%]
test_tuan_trader_v3_4.py::test_base_125[G09-03] PASSED                   [ 50%]
test_tuan_trader_v3_4.py::test_base_125[G09-04] PASSED                   [ 51%]
test_tuan_trader_v3_4.py::test_base_125[G09-05] PASSED                   [ 51%]
test_tuan_trader_v3_4.py::test_base_125[G09-06] PASSED                   [ 52%]
test_tuan_trader_v3_4.py::test_base_125[G09-07] PASSED                   [ 52%]
test_tuan_trader_v3_4.py::test_base_125[G09-08] PASSED                   [ 53%]
test_tuan_trader_v3_4.py::test_base_125[G09-09] PASSED                   [ 53%]
test_tuan_trader_v3_4.py::test_base_125[G09-10] PASSED                   [ 54%]
test_tuan_trader_v3_4.py::test_base_125[G10-01] PASSED                   [ 54%]
test_tuan_trader_v3_4.py::test_base_125[G10-02] PASSED                   [ 55%]
test_tuan_trader_v3_4.py::test_base_125[G10-03] PASSED                   [ 55%]
test_tuan_trader_v3_4.py::test_base_125[G10-04] PASSED                   [ 56%]
test_tuan_trader_v3_4.py::test_base_125[G11-01] PASSED                   [ 56%]
test_tuan_trader_v3_4.py::test_base_125[G12-01] PASSED                   [ 57%]
test_tuan_trader_v3_4.py::test_base_125[G12-02] PASSED                   [ 57%]
test_tuan_trader_v3_4.py::test_base_125[G12-03] PASSED                   [ 57%]
test_tuan_trader_v3_4.py::test_base_125[G13-01] PASSED                   [ 58%]
test_tuan_trader_v3_4.py::test_inventory_has_exact_group_counts PASSED   [ 58%]
test_tuan_trader_v3_4.py::test_B1_cycle_money_units[1-True-34.55] PASSED [ 59%]
test_tuan_trader_v3_4.py::test_B1_cycle_money_units[100000-True-3499999.55] PASSED [ 59%]
test_tuan_trader_v3_4.py::test_B1_cycle_money_units[10-False-345.50] PASSED [ 60%]
test_tuan_trader_v3_4.py::test_B1_missing_vpoint_and_fills PASSED        [ 60%]
test_tuan_trader_v3_4.py::test_B1_fee_fx_is_applied PASSED               [ 61%]
test_tuan_trader_v3_4.py::test_B2_side[buy-100-95-5] PASSED              [ 61%]
test_tuan_trader_v3_4.py::test_B2_side[buy-100-105-None] PASSED          [ 62%]
test_tuan_trader_v3_4.py::test_B2_side[sell-100-105-5] PASSED            [ 62%]
test_tuan_trader_v3_4.py::test_B2_side[sell-100-95-None] PASSED          [ 63%]
test_tuan_trader_v3_4.py::test_B2_side[buy-100-100-None] PASSED          [ 63%]
test_tuan_trader_v3_4.py::test_B2_legacy_abs_and_cycle_fallback PASSED   [ 64%]
test_tuan_trader_v3_4.py::test_B2_empirical_and_missing PASSED           [ 64%]
test_tuan_trader_v3_4.py::test_B3_dst[2026-03-08 02:30:00-None-needs_confirm-dst_nonexistent-None] PASSED [ 64%]
test_tuan_trader_v3_4.py::test_B3_dst[2026-11-01 01:30:00-None-needs_confirm-dst_ambiguous-None] PASSED [ 65%]
test_tuan_trader_v3_4.py::test_B3_dst[2026-11-01 01:30:00-0-ok-None-2026-11-01T05:30:00Z] PASSED [ 65%]
test_tuan_trader_v3_4.py::test_B3_dst[2026-11-01 01:30:00-1-ok-None-2026-11-01T06:30:00Z] PASSED [ 66%]
test_tuan_trader_v3_4.py::test_B3_dst[2026-01-01-None-date_only-date_only-None] PASSED [ 66%]
test_tuan_trader_v3_4.py::test_B3_dst[2026-02-30 01:00:00-None-error-invalid_time-None] PASSED [ 67%]
test_tuan_trader_v3_4.py::test_B3_reset_and_hash PASSED                  [ 67%]
test_tuan_trader_v3_4.py::test_B4_pipeline_preview_commit_and_undo PASSED [ 68%]
test_tuan_trader_v3_4.py::test_B4_ambiguous_then_confirm PASSED          [ 68%]
test_tuan_trader_v3_4.py::test_B4_cashflow_skip_and_invalid PASSED       [ 69%]
test_tuan_trader_v3_4.py::test_B4_enrich_undo_and_later_edit_conflict PASSED [ 69%]
test_tuan_trader_v3_4.py::test_B4_multiset_unique_ids_atomic_validation PASSED [ 70%]
test_tuan_trader_v3_4.py::test_B4_fifo_groups_dont_cross_symbols PASSED  [ 70%]
test_tuan_trader_v3_4.py::test_B4_html_csv_header_detection PASSED       [ 71%]
test_tuan_trader_v3_4.py::test_B4_xlsx_raw_value PASSED                  [ 71%]
test_tuan_trader_v3_4.py::test_B5_invalid_profile[kwargs0] PASSED        [ 71%]
test_tuan_trader_v3_4.py::test_B5_invalid_profile[kwargs1] PASSED        [ 72%]
test_tuan_trader_v3_4.py::test_B5_invalid_profile[kwargs2] PASSED        [ 72%]
test_tuan_trader_v3_4.py::test_B5_invalid_profile[kwargs3] PASSED        [ 73%]
test_tuan_trader_v3_4.py::test_B5_invalid_profile[kwargs4] PASSED        [ 73%]
test_tuan_trader_v3_4.py::test_B5_trade_cashflow_instrument_models PASSED [ 74%]
test_tuan_trader_v3_4.py::test_B6_metrics_extensions PASSED              [ 74%]
test_tuan_trader_v3_4.py::test_B6_empirical_sqn_exclusion PASSED         [ 75%]
test_tuan_trader_v3_4.py::test_B6_recursive_json_safe PASSED             [ 75%]
test_tuan_trader_v3_4.py::test_B7_mixed_offsets_and_prefix_reference PASSED [ 76%]
test_tuan_trader_v3_4.py::test_B7_generator_and_date_only PASSED         [ 76%]
test_tuan_trader_v3_4.py::test_B8_no_phase_target PASSED                 [ 77%]
test_tuan_trader_v3_4.py::test_B8_day_clusters_and_missing_day PASSED    [ 77%]
test_tuan_trader_v3_4.py::test_B8_payout_floor_modes[KEEP_FLOOR-1100] PASSED [ 78%]
test_tuan_trader_v3_4.py::test_B8_payout_floor_modes[LOCK_AT_INITIAL-1000] PASSED [ 78%]
test_tuan_trader_v3_4.py::test_B8_payout_floor_modes[LOCK_AT_BUFFER-1050] PASSED [ 78%]
test_tuan_trader_v3_4.py::test_B8_payout_floor_modes[FULL_RESET-900] PASSED [ 79%]
test_tuan_trader_v3_4.py::test_B8_minimum_and_consistency_windows PASSED [ 79%]
test_tuan_trader_v3_4.py::test_B8_daily_limit_and_mae PASSED             [ 80%]
test_tuan_trader_v3_4.py::test_B8_lifecycle_mean_fees_and_split PASSED   [ 80%]
test_tuan_trader_v3_4.py::test_B8_unconditional_zero_on_failed_eval PASSED [ 81%]
test_tuan_trader_v3_4.py::test_D2_deprecated_fraction_keyword PASSED     [ 81%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[None] PASSED     [ 82%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[True] PASSED     [ 82%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[] PASSED         [ 83%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[nan] PASSED      [ 83%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[inf] PASSED      [ 84%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[value5] PASSED   [ 84%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_value[value6] PASSED   [ 85%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_overrides[kwargs0] PASSED [ 85%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_overrides[kwargs1] PASSED [ 85%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_overrides[kwargs2] PASSED [ 86%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_overrides[kwargs3] PASSED [ 86%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_overrides[kwargs4] PASSED [ 87%]
test_tuan_trader_v3_4.py::test_edge_invalid_sizer_overrides[kwargs5] PASSED [ 87%]
test_tuan_trader_v3_4.py::test_edge_cost_no_silent_zero[] PASSED         [ 88%]
test_tuan_trader_v3_4.py::test_edge_cost_no_silent_zero[True] PASSED     [ 88%]
test_tuan_trader_v3_4.py::test_edge_cost_no_silent_zero[NaN] PASSED      [ 89%]
test_tuan_trader_v3_4.py::test_edge_cost_no_silent_zero[Infinity] PASSED [ 89%]
test_tuan_trader_v3_4.py::test_edge_missing_zone_no_machine_timezone_guess PASSED [ 90%]
test_tuan_trader_v3_4.py::test_edge_json_roundtrip_and_no_input_mutation PASSED [ 90%]
test_tuan_trader_v3_4.py::test_edge_simulation_invalid_counts PASSED     [ 91%]
test_tuan_trader_v3_4.py::test_edge_ast_unique_definitions PASSED        [ 91%]
test_tuan_trader_v3_4.py::test_B4_atomic_cashflow_commit_restore PASSED  [ 92%]
test_tuan_trader_v3_4.py::test_B6_money_without_R_and_huge_finite_decimal PASSED [ 92%]
test_tuan_trader_v3_4.py::test_B8_invalid_sample_explicit[True] PASSED   [ 92%]
test_tuan_trader_v3_4.py::test_B8_invalid_sample_explicit[nan] PASSED    [ 93%]
test_tuan_trader_v3_4.py::test_B8_invalid_sample_explicit[inf] PASSED    [ 93%]
test_tuan_trader_v3_4.py::test_B8_invalid_sample_explicit[bad] PASSED    [ 94%]
test_tuan_trader_v3_4.py::test_edge_invalid_fx_and_implied_input PASSED  [ 94%]
test_tuan_trader_v3_4.py::test_edge_binomial_empty_and_invalid_probabilities PASSED [ 95%]
test_tuan_trader_v3_4.py::test_B7_replay_with_cashflow_prefix PASSED     [ 95%]
test_tuan_trader_v3_4.py::test_B8_fee_drag_only_when_unpaid PASSED       [ 96%]
test_tuan_trader_v3_4.py::test_B4_explicit_price_unit PASSED             [ 96%]
test_tuan_trader_v3_4.py::test_B8_parametric_empty_sample_explicit_parameters PASSED [ 97%]
test_tuan_trader_v3_4.py::test_edge_invalid_gate_configuration[tiers0] PASSED [ 97%]
test_tuan_trader_v3_4.py::test_edge_invalid_gate_configuration[tiers1] PASSED [ 98%]
test_tuan_trader_v3_4.py::test_edge_invalid_gate_configuration[tiers2] PASSED [ 98%]
test_tuan_trader_v3_4.py::test_B6_ES_sign_formula_preserved PASSED       [ 99%]
test_tuan_trader_v3_4.py::test_B1_fifo_foreign_fee_and_raw_provenance PASSED [ 99%]
test_tuan_trader_v3_4.py::test_B4_fifo_descending_input_and_date_only_confirmation PASSED [100%]

- generated xml file: C:\Users\ADMIN\Documents\Codex\2026-10-22\x\outputs\tuan-trader-v3_4\PYTEST_RESULTS.xml -
============================= 214 passed in 1.96s =============================

```

## Log kiểm tra 125 vector trên đầu vào nguyên trạng

```text
============================= test session starts =============================
platform win32 -- Python 3.12.14, pytest-9.2.0, pluggy-1.7.0 -- C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\ADMIN\Documents\Codex\2026-10-22\x\outputs\tuan-trader-v3_4
collecting ... collected 214 items / 89 deselected / 125 selected

test_tuan_trader_v3_4.py::test_base_125[G01-01] PASSED                   [  0%]
test_tuan_trader_v3_4.py::test_base_125[G01-02] PASSED                   [  1%]
test_tuan_trader_v3_4.py::test_base_125[G01-03] PASSED                   [  2%]
test_tuan_trader_v3_4.py::test_base_125[G01-04] PASSED                   [  3%]
test_tuan_trader_v3_4.py::test_base_125[G01-05] PASSED                   [  4%]
test_tuan_trader_v3_4.py::test_base_125[G01-06] PASSED                   [  4%]
test_tuan_trader_v3_4.py::test_base_125[G01-07] PASSED                   [  5%]
test_tuan_trader_v3_4.py::test_base_125[G01-08] PASSED                   [  6%]
test_tuan_trader_v3_4.py::test_base_125[G01-09] PASSED                   [  7%]
test_tuan_trader_v3_4.py::test_base_125[G01-10] PASSED                   [  8%]
test_tuan_trader_v3_4.py::test_base_125[G01-11] PASSED                   [  8%]
test_tuan_trader_v3_4.py::test_base_125[G02-01] PASSED                   [  9%]
test_tuan_trader_v3_4.py::test_base_125[G02-02] PASSED                   [ 10%]
test_tuan_trader_v3_4.py::test_base_125[G02-03] PASSED                   [ 11%]
test_tuan_trader_v3_4.py::test_base_125[G02-04] PASSED                   [ 12%]
test_tuan_trader_v3_4.py::test_base_125[G02-05] PASSED                   [ 12%]
test_tuan_trader_v3_4.py::test_base_125[G02-06] PASSED                   [ 13%]
test_tuan_trader_v3_4.py::test_base_125[G02-07] PASSED                   [ 14%]
test_tuan_trader_v3_4.py::test_base_125[G02-08] PASSED                   [ 15%]
test_tuan_trader_v3_4.py::test_base_125[G02-09] PASSED                   [ 16%]
test_tuan_trader_v3_4.py::test_base_125[G02-10] PASSED                   [ 16%]
test_tuan_trader_v3_4.py::test_base_125[G02-11] PASSED                   [ 17%]
test_tuan_trader_v3_4.py::test_base_125[G02-12] PASSED                   [ 18%]
test_tuan_trader_v3_4.py::test_base_125[G02-13] PASSED                   [ 19%]
test_tuan_trader_v3_4.py::test_base_125[G02-14] PASSED                   [ 20%]
test_tuan_trader_v3_4.py::test_base_125[G02-15] PASSED                   [ 20%]
test_tuan_trader_v3_4.py::test_base_125[G02-16] PASSED                   [ 21%]
test_tuan_trader_v3_4.py::test_base_125[G02-17] PASSED                   [ 22%]
test_tuan_trader_v3_4.py::test_base_125[G02-18] PASSED                   [ 23%]
test_tuan_trader_v3_4.py::test_base_125[G02-19] PASSED                   [ 24%]
test_tuan_trader_v3_4.py::test_base_125[G02-20] PASSED                   [ 24%]
test_tuan_trader_v3_4.py::test_base_125[G03-01] PASSED                   [ 25%]
test_tuan_trader_v3_4.py::test_base_125[G03-02] PASSED                   [ 26%]
test_tuan_trader_v3_4.py::test_base_125[G03-03] PASSED                   [ 27%]
test_tuan_trader_v3_4.py::test_base_125[G03-04] PASSED                   [ 28%]
test_tuan_trader_v3_4.py::test_base_125[G03-05] PASSED                   [ 28%]
test_tuan_trader_v3_4.py::test_base_125[G03-06] PASSED                   [ 29%]
test_tuan_trader_v3_4.py::test_base_125[G03-07] PASSED                   [ 30%]
test_tuan_trader_v3_4.py::test_base_125[G03-08] PASSED                   [ 31%]
test_tuan_trader_v3_4.py::test_base_125[G03-09] PASSED                   [ 32%]
test_tuan_trader_v3_4.py::test_base_125[G03-10] PASSED                   [ 32%]
test_tuan_trader_v3_4.py::test_base_125[G03-11] PASSED                   [ 33%]
test_tuan_trader_v3_4.py::test_base_125[G03-12] PASSED                   [ 34%]
test_tuan_trader_v3_4.py::test_base_125[G03-13] PASSED                   [ 35%]
test_tuan_trader_v3_4.py::test_base_125[G03-14] PASSED                   [ 36%]
test_tuan_trader_v3_4.py::test_base_125[G03-15] PASSED                   [ 36%]
test_tuan_trader_v3_4.py::test_base_125[G03-16] PASSED                   [ 37%]
test_tuan_trader_v3_4.py::test_base_125[G03-17] PASSED                   [ 38%]
test_tuan_trader_v3_4.py::test_base_125[G03-18] PASSED                   [ 39%]
test_tuan_trader_v3_4.py::test_base_125[G03-19] PASSED                   [ 40%]
test_tuan_trader_v3_4.py::test_base_125[G03-20] PASSED                   [ 40%]
test_tuan_trader_v3_4.py::test_base_125[G03-21] PASSED                   [ 41%]
test_tuan_trader_v3_4.py::test_base_125[G03-22] PASSED                   [ 42%]
test_tuan_trader_v3_4.py::test_base_125[G03-23] PASSED                   [ 43%]
test_tuan_trader_v3_4.py::test_base_125[G03-24] PASSED                   [ 44%]
test_tuan_trader_v3_4.py::test_base_125[G03-25] PASSED                   [ 44%]
test_tuan_trader_v3_4.py::test_base_125[G04-01] PASSED                   [ 45%]
test_tuan_trader_v3_4.py::test_base_125[G04-02] PASSED                   [ 46%]
test_tuan_trader_v3_4.py::test_base_125[G04-03] PASSED                   [ 47%]
test_tuan_trader_v3_4.py::test_base_125[G04-04] PASSED                   [ 48%]
test_tuan_trader_v3_4.py::test_base_125[G04-05] PASSED                   [ 48%]
test_tuan_trader_v3_4.py::test_base_125[G04-06] PASSED                   [ 49%]
test_tuan_trader_v3_4.py::test_base_125[G04-07] PASSED                   [ 50%]
test_tuan_trader_v3_4.py::test_base_125[G04-08] PASSED                   [ 51%]
test_tuan_trader_v3_4.py::test_base_125[G04-09] PASSED                   [ 52%]
test_tuan_trader_v3_4.py::test_base_125[G04-10] PASSED                   [ 52%]
test_tuan_trader_v3_4.py::test_base_125[G04-11] PASSED                   [ 53%]
test_tuan_trader_v3_4.py::test_base_125[G04-12] PASSED                   [ 54%]
test_tuan_trader_v3_4.py::test_base_125[G04-13] PASSED                   [ 55%]
test_tuan_trader_v3_4.py::test_base_125[G04-14] PASSED                   [ 56%]
test_tuan_trader_v3_4.py::test_base_125[G04-15] PASSED                   [ 56%]
test_tuan_trader_v3_4.py::test_base_125[G04-16] PASSED                   [ 57%]
test_tuan_trader_v3_4.py::test_base_125[G04-17] PASSED                   [ 58%]
test_tuan_trader_v3_4.py::test_base_125[G04-18] PASSED                   [ 59%]
test_tuan_trader_v3_4.py::test_base_125[G04-19] PASSED                   [ 60%]
test_tuan_trader_v3_4.py::test_base_125[G04-20] PASSED                   [ 60%]
test_tuan_trader_v3_4.py::test_base_125[G05-01] PASSED                   [ 61%]
test_tuan_trader_v3_4.py::test_base_125[G05-02] PASSED                   [ 62%]
test_tuan_trader_v3_4.py::test_base_125[G05-03] PASSED                   [ 63%]
test_tuan_trader_v3_4.py::test_base_125[G05-04] PASSED                   [ 64%]
test_tuan_trader_v3_4.py::test_base_125[G06-01] PASSED                   [ 64%]
test_tuan_trader_v3_4.py::test_base_125[G06-02] PASSED                   [ 65%]
test_tuan_trader_v3_4.py::test_base_125[G06-03] PASSED                   [ 66%]
test_tuan_trader_v3_4.py::test_base_125[G06-04] PASSED                   [ 67%]
test_tuan_trader_v3_4.py::test_base_125[G06-05] PASSED                   [ 68%]
test_tuan_trader_v3_4.py::test_base_125[G06-06] PASSED                   [ 68%]
test_tuan_trader_v3_4.py::test_base_125[G07-01] PASSED                   [ 69%]
test_tuan_trader_v3_4.py::test_base_125[G07-02] PASSED                   [ 70%]
test_tuan_trader_v3_4.py::test_base_125[G07-03] PASSED                   [ 71%]
test_tuan_trader_v3_4.py::test_base_125[G07-04] PASSED                   [ 72%]
test_tuan_trader_v3_4.py::test_base_125[G07-05] PASSED                   [ 72%]
test_tuan_trader_v3_4.py::test_base_125[G07-06] PASSED                   [ 73%]
test_tuan_trader_v3_4.py::test_base_125[G07-07] PASSED                   [ 74%]
test_tuan_trader_v3_4.py::test_base_125[G07-08] PASSED                   [ 75%]
test_tuan_trader_v3_4.py::test_base_125[G07-09] PASSED                   [ 76%]
test_tuan_trader_v3_4.py::test_base_125[G07-10] PASSED                   [ 76%]
test_tuan_trader_v3_4.py::test_base_125[G07-11] PASSED                   [ 77%]
test_tuan_trader_v3_4.py::test_base_125[G07-12] PASSED                   [ 78%]
test_tuan_trader_v3_4.py::test_base_125[G07-13] PASSED                   [ 79%]
test_tuan_trader_v3_4.py::test_base_125[G07-14] PASSED                   [ 80%]
test_tuan_trader_v3_4.py::test_base_125[G07-15] PASSED                   [ 80%]
test_tuan_trader_v3_4.py::test_base_125[G08-01] PASSED                   [ 81%]
test_tuan_trader_v3_4.py::test_base_125[G08-02] PASSED                   [ 82%]
test_tuan_trader_v3_4.py::test_base_125[G08-03] PASSED                   [ 83%]
test_tuan_trader_v3_4.py::test_base_125[G08-04] PASSED                   [ 84%]
test_tuan_trader_v3_4.py::test_base_125[G08-05] PASSED                   [ 84%]
test_tuan_trader_v3_4.py::test_base_125[G09-01] PASSED                   [ 85%]
test_tuan_trader_v3_4.py::test_base_125[G09-02] PASSED                   [ 86%]
test_tuan_trader_v3_4.py::test_base_125[G09-03] PASSED                   [ 87%]
test_tuan_trader_v3_4.py::test_base_125[G09-04] PASSED                   [ 88%]
test_tuan_trader_v3_4.py::test_base_125[G09-05] PASSED                   [ 88%]
test_tuan_trader_v3_4.py::test_base_125[G09-06] PASSED                   [ 89%]
test_tuan_trader_v3_4.py::test_base_125[G09-07] PASSED                   [ 90%]
test_tuan_trader_v3_4.py::test_base_125[G09-08] PASSED                   [ 91%]
test_tuan_trader_v3_4.py::test_base_125[G09-09] PASSED                   [ 92%]
test_tuan_trader_v3_4.py::test_base_125[G09-10] PASSED                   [ 92%]
test_tuan_trader_v3_4.py::test_base_125[G10-01] PASSED                   [ 93%]
test_tuan_trader_v3_4.py::test_base_125[G10-02] PASSED                   [ 94%]
test_tuan_trader_v3_4.py::test_base_125[G10-03] PASSED                   [ 95%]
test_tuan_trader_v3_4.py::test_base_125[G10-04] PASSED                   [ 96%]
test_tuan_trader_v3_4.py::test_base_125[G11-01] PASSED                   [ 96%]
test_tuan_trader_v3_4.py::test_base_125[G12-01] PASSED                   [ 97%]
test_tuan_trader_v3_4.py::test_base_125[G12-02] PASSED                   [ 98%]
test_tuan_trader_v3_4.py::test_base_125[G12-03] PASSED                   [ 99%]
test_tuan_trader_v3_4.py::test_base_125[G13-01] PASSED                   [100%]

- generated xml file: C:\Users\ADMIN\Documents\Codex\2026-10-22\x\outputs\tuan-trader-v3_4\BASELINE_125_RESULTS.xml -
===================== 125 passed, 89 deselected in 1.53s ======================

```
