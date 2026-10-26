# Đồng bộ nhật ký Classic–V6 và kiểm tra 10.000–50.000 lệnh

Ngày 26/10/2026 (Asia/Saigon). Baseline GitHub `6fdd92ff9486898ac10c5e767400ccdf4f4fd1df`. Đích triển khai: https://tuannhatky.fabledcoot2.chatgpt.site/v6/ .

## Kết quả và cách dùng

- Đã bỏ nhãn **HỢP NHẤT • DEMO** khỏi đầu trang. Các thông báo dữ liệu mẫu vẫn hiện khi thực sự đang xem bộ mẫu.
- Đăng nhập cùng tài khoản trên Classic và V6, cùng tên miền web. Nhập file Binance tại **Classic → Nhật ký giao dịch**. V6 đọc cùng nhật ký cloud, cập nhật khi chuyển tab, bấm Đồng bộ ngay hoặc qua lượt kiểm tra 15 giây lúc trang đang mở. Đây là đồng bộ có độ trễ, không phải giao dịch đồng thời tức thời.
- Lệnh mới, chỉnh sửa và xóa từ V6 được đưa vào hàng đợi có chủ sở hữu, gửi vào API Classic rồi đọc lại bản chung. Các tab Classic được báo cập nhật. Không tạo một kho lệnh cloud V6 riêng.
- Vốn đầu kỳ và sổ nạp/rút chung do Classic quản lý. V6 đọc lại theo phiên bản cấu hình, khóa sửa vốn riêng tại V6 và đưa nút nạp/rút về Classic. Các tham số mô phỏng, Risk Profile, ghi chú Review tổng hợp và bố cục V6 không được coi là đã đồng bộ hai chiều toàn bộ.
- Khi nhận diện file Binance, giao diện ưu tiên USDT và yêu cầu tỷ giá sang VNĐ; nếu file đã quy đổi, chọn VNĐ. Bộ CSV tải lớn trong bài thử dùng các số tiền VNĐ tổng hợp và chọn VNĐ rõ ràng. Không tự suy ra tỷ giá.
- P&L V6 = P&L gộp Classic − phí − swap, trừ một lần. Thiếu 1R được giữ là chưa biết và loại khỏi thống kê R; thiếu phí không được gắn là đã xác minh. Giá khớp giữ đơn vị thị trường. Sizer của tài khoản VNĐ yêu cầu nhập giá trị điểm theo VNĐ thay vì tự dùng thông số USD.

## Những lỗi đã xử lý

1. V6 trước đây chưa nối cùng nhật ký Classic. Nay có cầu nối API có xác thực, kiểm tra tài khoản, phiên bản và bản lưu trước lần thay thế đầu tiên.
2. Bỏ chặn cả file ở 500 dòng. File được gửi theo lô 250; mỗi lô và biên nhận được lưu riêng. Nếu gián đoạn, các lô trước vẫn tồn tại; nhập lại file để tiếp tục. Không tuyên bố toàn bộ file là một transaction duy nhất.
3. Không ép toàn bộ nhật ký lớn vào localStorage. Classic lưu IndexedDB trước; V6 dùng IndexedDB cho nhật ký lớn và localStorage chỉ giữ dấu dẫn nhỏ. Khi không lưu được trên thiết bị, thông báo không cam kết bản chờ đã bền vững và yêu cầu tải JSON trước khi đóng tab.
4. Bảng nhật ký hai giao diện chỉ vẽ 200 dòng mỗi trang; bộ lọc, thống kê và xuất dữ liệu vẫn dùng toàn bộ lệnh. Bộ chọn ảnh có tìm kiếm và giới hạn danh sách gợi ý, không xóa lệnh ngoài 200 dòng.
5. Chống trùng dùng chỉ mục và băm theo nhóm giới hạn thay vì tìm tuyến tính từng cặp. VaR mở rộng dùng thứ hạng chính xác thay vì sắp xếp lại mọi tiền tố. Đã đối chiếu 2.390 phân vị với công thức cũ. Bootstrap lớn vẫn giữ đúng 2.000 lượt/seed, chạy trong Worker dùng chung RiskMath.
6. Đã sửa lỗi title SVG ở biểu đồ Classic gây lệch HTML máy chủ/trình duyệt.
7. Đã sửa lỗi chỉnh sửa ngay sau reload chưa vào hàng đợi. Bản chờ luôn gắn với tài khoản của nhật ký; không gửi hàng đợi người A khi đăng nhập người B. Xung đột 409 giữ bản chờ, cho tải sao lưu trước khi dùng bản Classic.
8. PATCH chỉ gửi trường thực sự thay đổi và gộp các chỉnh sửa chưa gửi. Sửa ghi chú không làm đổi tỷ lệ checklist Classic. Ghi chú Review/tag V6 không mất khi nhập lại biên nhận broker cập nhật P&L.

## Kiểm tra thực tế

Hai lớp kiểm tra được chạy riêng: (a) API thật với cơ sở dữ liệu D1 của Miniflare và đầy đủ migration; (b) Chromium chạy HTML V6 và build Classic thật, dùng API dữ liệu tổng hợp để tránh ghi thử vào tài khoản thật. **Chưa chạy nhập 50.000 lệnh vào D1 trên tên miền production.**

- D1: 10.000 lệnh đầu trong 12.70 giây; thêm 40.000 để đạt 50.000 trong 64.43 giây. Đọc lại đủ 50.000 ID, không lặp, qua 50 trang trong 21.77 giây. Nhập lại 250 ID kiểm tra không tăng số dòng.
- Giao diện: file 10.000 dòng → 40 lô → Classic/V6/IndexedDB đủ 10.000, tổng P&L ròng 456,520,000 VNĐ, 21.28 giây.
- Giao diện: cập nhật file 50.000 dòng, trong đó 10.000 đã có → 200 lô → tổng cuối đúng 50.000, IndexedDB đúng 50.000, bảng vẽ 200 dòng, tổng P&L ròng 2,283,260,000 VNĐ, 123.45 giây.
- Sau reload vẫn 50.000. Sửa P&L tại V6 thành 123.456 VNĐ → API Classic và cache Classic cùng nhận 123.456. Lỗi mạng 503 giữ bản chờ; thử lại gửi được ghi chú `offline-note-preserved`. Page errors = 0.
- Kiểm tra an toàn: vốn chung không lệch do sửa riêng ở V6; sửa sớm trước init được xếp hàng; lỗi IndexedDB không bị báo là đã lưu; xung đột có bản sao; không gửi hàng đợi sai tài khoản; đọc/ghi lại nhật ký Classic trên cùng thiết bị khi chưa đăng nhập đều đạt.
- 66/66 kiểm tra lõi V6; 76/76 kiểm tra trình duyệt V6; 122/122 kiểm tra Classic/miền nghiệp vụ/D1; 23/23 kiểm tra backend Node; typecheck đạt. Ba script inline qua kiểm tra cú pháp, ID trùng = 0, hàm có tên trùng = 0. Build HTML và Worker đã được kiểm tra; bản đóng gói được helper build lại trước khi xuất bản.

Số đo phụ thuộc máy và bộ dữ liệu; không phải cam kết tốc độ hạ tầng thật. Lượt đầu dùng máy chủ dev bị ngắt bởi tự tải lại lúc đang sửa/build; kết quả tải lớn cuối cùng nêu trên chạy build production, không có HMR. Lỗi đồng bộ phát hiện ở các lượt trước đã có kiểm tra hồi quy riêng.

### Output thực tế

```json
{
  "browser": {
    "pass": true,
    "cases": [
      {
        "records": 10000,
        "classicToV6AndIndexedDbMs": 21283.0867,
        "postBatches": 40,
        "indexedDbRows": 10000,
        "renderedV6Rows": 200,
        "netPnl": 456520000
      },
      {
        "records": 50000,
        "classicToV6AndIndexedDbMs": 123452.04879999999,
        "postBatches": 200,
        "indexedDbRows": 50000,
        "renderedV6Rows": 200,
        "netPnl": 2283260000
      },
      {
        "reload50000": true,
        "v6ToClassic": true,
        "offlineQueueRetainedAndRetried": true,
        "pageErrors": []
      }
    ]
  },
  "d1": [
    {
      "records": 10000,
      "persistMs": 12700.3412
    },
    {
      "records": 50000,
      "persistMs": 64432.50129999999
    },
    {
      "loaded": 50000,
      "pages": 50,
      "loadMs": 21771.9663
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
      "parseAndDedupeMs": 16054.435599999997
    }
  ]
}
```

## Lưu trữ và giới hạn

- Cloud chính dùng bảng `trades` của Classic trong D1, theo tài khoản; bản sao trên thiết bị dùng IndexedDB. Cần đăng nhập để dữ liệu có trên máy khác. Chưa đăng nhập chỉ đồng bộ Classic/V6 trên cùng trình duyệt, cùng origin; không coi đó là lưu cloud.
- Nhật ký đang hoạt động không có chính sách tự xóa sau 30 năm trong mã hiện tại. Thùng rác Classic có cửa sổ khôi phục 30 ngày; đây không phải thời hạn của lệnh đang hoạt động. Không thể hứa lưu vĩnh viễn chỉ dựa vào một lần thử 50.000 dòng: vẫn cần tài khoản/dịch vụ hoạt động và bản sao JSON định kỳ ở nơi độc lập.
- Chưa kiểm thử tải 50.000 dòng PDF/XLSX, 50.000 ảnh, thiết bị RAM thấp, hoặc xung đột stress nhiều thiết bị thật. Bộ tải lớn ở đây là CSV Binance tổng hợp có ID. Các định dạng Binance/PDF hiện có được kiểm tra bằng fixture nhỏ trong bộ test riêng.
- Chống trùng tuyệt đối dựa ID nguồn/phạm vi tài khoản. Với file thiếu ID hoặc biên nhận khác nhau, cặp gần giống chỉ được đưa ra đối soát, không tự xóa lệnh có thể là thật.
- Khôi phục JSON/snapshot V6 vẫn là chức năng khôi phục cục bộ; không coi bản JSON cũ là yêu cầu thay thế hàng loạt cloud. Để nhập lại vào sổ cloud, dùng luồng nhập/đối soát Classic. Bản trước thao tác được lưu; key legacy không bị xóa.

## Bằng chứng và mã nguồn

- [Kết quả tổng hợp](evidence/classic-sync/CHECKS.json), [D1](evidence/classic-sync/SERVER_SCALE.json), [trình duyệt tải lớn](evidence/classic-sync/BROWSER_SCALE.json), [an toàn đồng bộ](evidence/classic-sync/SYNC_SAFETY.json), [công thức/ánh xạ](evidence/classic-sync/SYNC_CORE.json).
- HTML chính: `v6/index.html`, SHA-256 `257467ce77222f166f476c17b98273aacfdbb609bfbc5748d50ccd1162c98945`.
- PR cập nhật: https://github.com/Tuand2222/code-tuan-trading/pull/9 . Giữ nhánh feature theo CONTRIBUTING/AGENTS; không tự merge main. D1/R2 và audience hiện có được giữ nguyên khi triển khai.

## Kiểm tra cuối trên tên miền thật

Lượt xuất bản đầu đã bộc lộ lỗi khởi động Classic do tạo mã tab ngẫu nhiên ở cấp module khi Worker nạp SSR. Đã đổi sang tạo mã này chỉ trong trình duyệt và bổ sung `tests/classic-ssr.test.mjs` mô phỏng môi trường cấm tạo số ngẫu nhiên ở cấp module. Toàn bộ 23/23 kiểm tra backend đạt; typecheck và hai workflow GitHub của commit sửa `0dd13bdb24c97057c5881e7152be3f14965f61ce` đều đạt.

Sau bản sửa, Chromium mở tên miền thật: V6 HTTP 200, Classic HTTP 200, không có page error, nhãn đã bỏ và nút đồng bộ hiện đúng. HTML phục vụ khớp SHA-256 ở trên sau khi bỏ script do Cloudflare chèn. API nhật ký không đăng nhập trả 401; bài smoke không ghi bản ghi nào vào production. Xem [output production thực tế](evidence/classic-sync/PRODUCTION_SMOKE.json). Việc xác nhận tải lớn vẫn giới hạn ở hai môi trường kiểm thử đã nêu, không chuyển thành tuyên bố đã nhập 50.000 dòng lên tài khoản production.
