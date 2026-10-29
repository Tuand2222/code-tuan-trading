# Kiểm tra nhập dữ liệu, phân tích và đồng bộ — 29/10/2026

## Phạm vi và nguyên nhân

Đối chiếu bốn ảnh lỗi người dùng cung cấp. Không có file đã tạo 30 lệnh trong ảnh; người dùng yêu cầu tìm file tương tự trên mạng. Các mẫu công khai chỉ được thử trong môi trường riêng. Không nhập mẫu vào nhật ký đang chạy và không tự gán phí, tỷ giá hay 1R cho các lệnh cũ.

Trang Trading Metrix trước đây tự đặt vốn 200.000.000 VNĐ, tính hiệu suất từ cả lệnh chưa xác minh, coi dữ liệu R/thời gian/kỷ luật thiếu là 0 và có thể hiển thị SAFE/Đạt. Kết quả vì vậy không khớp trạng thái trong bảng nhật ký.

Hợp đồng API cấu hình vốn từ chối trường currency và metadata sổ nạp/rút do kho chung gửi lên. Khi phiên bản cloud thay đổi, bộ đồng bộ cũ dừng ở xung đột; thông báo lỗi dùng cùng màu và dấu ✓ với thông báo thành công.

Nhập lại theo cùng định danh trước đây có thể thay riêng P&L/phí nhưng giữ cờ xác minh, swap hoặc rủi ro cũ. Classic và V6 cũng chưa dùng cùng phép dựng vị thế từ execution.

## Những thay đổi đã thực hiện

- Trading Metrix đọc vốn và hạn mức từ cấu hình chung. Chỉ Net đã xác minh đi vào hiệu suất; chỉ 1R hợp lệ đi vào thống kê R. Hiển thị số mẫu Net/1R và dữ liệu thiếu; không dùng 99 làm Profit Factor vô hạn, không biến R/thời gian/kỷ luật thiếu thành 0.
- Các ngày hoặc nguồn chưa đầy đủ không được kết luận SAFE/Đạt. Giữ lệnh gốc, phân biệt phần hiệu suất đã xác minh với số dư tài khoản đầy đủ. Drawdown vẫn dùng lõi NAV đã kiểm toán, trung hòa nạp/rút.
- Tách schema cấu hình chung: đọc được cấu hình cũ thiếu trường bằng mặc định; ghi mới vẫn phải đủ schema, không cho một yêu cầu rỗng vô tình đặt lại vốn. Giữ currency, origin và metadata của cashflow.
- Đồng bộ dùng so sánh ba bản: gốc, thiết bị, cloud. Tự gộp thay đổi độc lập, thử lại có giới hạn khi một ghi nhật ký khác làm đổi phiên bản cloud. Nếu hai nơi sửa cùng trường, lưu cả hai bản và hiện bảng đối chiếu để chủ nhật ký chọn; không tự quyết định vốn thật.
- Nhận diện Buy/Sell phải rõ ràng. Không suy đoán phiên Á từ dữ liệu chỉ có ngày. Báo cáo có hai cột Time/Price dùng ngày đóng và giá đóng tương ứng; không tự gán múi giờ broker.
- Phân biệt Profit gộp và Net P&L. Commission MT4/MT5 có dấu và swap được tính đúng một lần. Net được báo cáo trực tiếp có thể dùng cho thống kê Net dù thiếu chi tiết phí, nhưng gross P&L và fee-R vẫn để thiếu.
- Phí 0 được giữ là số 0 đã cung cấp khi sửa lệnh; ô thiếu vẫn thiếu. Có thể review lệnh nhập thiếu 1R mà không phải bịa 1R để vượt qua form.
- Bắt buộc xác nhận tiền tệ và tỷ giá về VNĐ khi nhập ngoại tệ; quy đổi cả P&L, phí, swap và risk, không quy đổi giá/khối lượng. Lưu chứng từ và thông tin quy đổi.
- Execution phải gắn mã tài khoản trước khi lưu. Một phép dựng vị thế dùng chung ở src/core/position-cycles.js cho Classic và V6, giữ execution gốc và không sinh 1R. Dựng chu kỳ từ P&L broker, không suy đoán hệ số hợp đồng từ biến động giá.
- Nhập trùng cập nhật bộ dữ kiện tài chính cùng cờ xác minh và bằng chứng. Nguồn mới thiếu dữ kiện không thay Net đã xác minh. Ghi chú/setup/review của người dùng được giữ.
- Thông báo chưa đồng bộ/lỗi có màu cảnh báo và dấu !. Các nhóm thống kê và nhóm execution dùng cấu trúc tra cứu thay vì sao chép mảng trong vòng lặp.

## Mẫu công khai và kết quả thực tế

Nguồn:
- [Binance Account Trade List](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade): chuyển ví dụ phản hồi chính thức thành CSV thử nghiệm. Một execution, không đủ dựng vị thế đóng; cả hai giao diện không tự tạo kết quả vị thế hoặc 1R từ execution này.
- [ProEA MT5 report analyzer](https://proea.app/en/tools/mt5-report-analyzer): nhà phát hành ghi rõ đây là dữ liệu giảng dạy tổng hợp. Tải ba ví dụ CSV/HTML công khai và lưu URL/hash riêng.
- [MetaTrader: Trading report](https://www.metatrader5.com/en/terminal/help/trading_advanced/history_report): tham chiếu cấu trúc Orders/Deals và đơn vị tiền tài khoản.

HTML MT5 có 7 dòng: 4 execution hợp lệ tạo 2 chu kỳ đóng, Net vị thế = 22 ở cả Classic và V6, mẫu 1R = 0. Ba dòng nạp/rút/phí riêng không được giả làm lệnh. Nguồn này còn thiếu đối soát các bút toán đó nên cảnh báo chưa đầy đủ. Số 22 không phải toàn bộ biến động số dư: với vốn đầu 10.000, nạp/rút ròng +300 và phí riêng -5, số dư báo cáo mẫu là 10.317. Không tuyên bố đã tự nhập các bút toán bị loại.

Hai CSV ProEA thiếu hướng hoặc dữ kiện execution cần thiết bị từ chối theo từng dòng, thay vì tự gán Buy hay bịa giá/khối lượng.

Thử 30.000 vị thế tổng hợp với vốn 10.000.000: Net = 970.000, Balance = 10.970.000, Net N = 30.000, R N = 30.000. Thời gian đo riêng của bộ chọn Metrix và lõi chung được lưu trong PUBLIC_SAMPLE_RESULTS.json; đây không phải thời gian đồng bộ cloud thật.

## Kiểm thử và giới hạn

Đã viết hồi quy trước khi sửa các đường tài chính: loại Net chưa xác minh khỏi Balance/WR/R; vốn chung; drawdown qua nạp/rút; commission/swap; Net không trừ phí hai lần; phí 0; thiếu hướng; schema; xung đột ba bản; nhập lại giữ review; và phép dựng execution chung.

Đã chạy thử trình duyệt thật trong môi trường riêng:
1. Nhập 30 lệnh thiếu phí: giữ đủ dòng ở cả hai giao diện, Net không vào hiệu suất và không có ngày Đạt.
2. Đổi vốn ở Metrix: V6 cập nhật qua kho chung, không dùng mặc định 200 triệu.
3. Sửa phần review của lệnh nhập thiếu 1R: không tự xác minh phí/rủi ro.
4. Nhập Profit 100, commission -2, swap -1,5; xác nhận USD → VNĐ ở 25.000: Net 2.412.500, 1R 1.250.000 và R = 1,93 ở V6 và Metrix.
5. Net có số 0/phí 0 và Net báo cáo trực tiếp thiếu chi tiết phí: giữ đúng trạng thái qua nhập/sửa/đồng bộ.

Kết quả toàn bộ cổng kiểm tra được chèn bên dưới từ output thực tế khi hoàn tất. Các kiểm thử D1/IndexedDB/trình duyệt dùng dữ liệu tổng hợp, không phải thử ghi 50.000 lệnh vào tài khoản production.

Chưa thể khôi phục các dữ kiện thực tế bị thiếu của 30 lệnh trong ảnh vì không có chứng từ gốc. File mẫu trên mạng không chứng minh được phí, 1R, nguồn hoặc đơn vị tiền của các lệnh đó. Không sửa các con số này bằng phỏng đoán. Xung đột thật về vốn cần chủ nhật ký chọn trong bảng đối chiếu; bản sửa không tự ghi đè một trong hai giá trị.

GitHub dùng PR #10 trên nhánh feature/prop-v34-complete, gồm phần Prop v3.4 đã triển khai trước đó và bản sửa nhập/đồng bộ này. Không thay bảo vệ main; ngoại lệ trước đây chỉ dành cho PR #9. Website được đóng gói từ cùng cây mã với commit GitHub đã kiểm tra. Mã phiên bản triển khai được ghi riêng trong biên bản phát hành.


## Output kiểm tra cuối

Lệnh thực thi: npm run ci:check. Exit code: 0. Có 9/9 nhóm đạt; V6 chạy đủ 13 bộ kiểm thử trình duyệt, đồng bộ hai tab 18/18, vòng đời Classic 4/4 và nhập dữ liệu mới 5/5. Không ghi dữ liệu mẫu vào production.

```json
{
  "ci": {
    "passed": 9,
    "total": 9,
    "steps": [
      {
        "name": "source-drift",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 1034
      },
      {
        "name": "v6-core",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 46206
      },
      {
        "name": "financial-guards",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 5468
      },
      {
        "name": "root-tests",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 274035
      },
      {
        "name": "v6-browser",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 327382
      },
      {
        "name": "two-tab-sync",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 35807
      },
      {
        "name": "classic-lifecycle",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 10362
      },
      {
        "name": "intake-browser",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 16547
      },
      {
        "name": "cloud-sync-safety",
        "exitCode": 0,
        "signal": null,
        "elapsedMs": 10023
      }
    ]
  },
  "root": {
    "vitest": 292,
    "node": 27,
    "typecheck": true,
    "build": true
  },
  "v6": {
    "scriptsChecked": 3,
    "duplicateIds": 0,
    "duplicateFunctions": 0,
    "passed": 116,
    "total": 116
  },
  "intakeBrowser": {
    "passed": 5,
    "total": 5,
    "pageErrors": [],
    "productionWrites": 0
  },
  "scale": [
    {
      "records": 10000,
      "persistMs": 15493.934799999999
    },
    {
      "records": 50000,
      "persistMs": 72142.19459999999
    },
    {
      "loaded": 50000,
      "pages": 50,
      "loadMs": 22172.166200000007
    },
    {
      "ownerIsolation": true,
      "stalePatch": 409,
      "staleDelete": 409,
      "sourceReceiptRetained": true
    },
    {
      "csvRows": 50000,
      "duplicateRows": 50000,
      "parseAndDedupeMs": 16670.756699999984
    }
  ]
}
```
