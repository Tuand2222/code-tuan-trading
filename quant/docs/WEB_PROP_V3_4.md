# Giao diện Prop v3.4 trên web

Ngày triển khai: 29/10/2026 (Asia/Saigon).

## Phạm vi

Màn hình V6 → Prop Firm dùng cùng mô hình vòng đời trong `src/core/quant-prop-v34.js`, được đưa vào QuantV34 rồi bundle vào HTML và Web Worker từ một nguồn. RiskMath.propMulti chỉ là adapter. Mô hình Prop cũ có chiến dịch thi lại và co giãn peak theo payout đã được thay thế.

Giữ nguyên Classic, backend, kho lệnh, dòng tiền, khóa no-mock, Site identity và quyền truy cập. Không có migration xóa hoặc sửa lệnh lịch sử. Giữ các khóa preset Tier cũ để cấu hình đã lưu vẫn chọn được. Preset Prop cũ không tự chuyển sang bộ số mới; dữ liệu cấu hình của người dùng được giữ.

## Chức năng đã nối vào màn hình

- Bắt đầu từ vòng thi nhiều giai đoạn hoặc tài khoản đã Funded không có mục tiêu thi.
- Điều kiện riêng mỗi giai đoạn: số ngày giao dịch, số ngày có lời, mức lời tối thiểu/ngày, giới hạn ngày.
- Phân phối gốc, Bayesian/Efron hai tầng hoặc bootstrap theo cả ngày. Một world latent được dùng xuyên các vòng thi và funded; các vòng thi reset vốn như tham chiếu.
- Nhóm ngày theo múi giờ IANA và giờ reset; chuyển đổi và sắp thời gian trong Worker. Thiếu khóa ngày/DST chưa rõ trả lỗi, không tự chuyển sang IID. Không tạo số MAE/MFE cho nhật ký.
- Static, EOD trailing, intraday trailing; Daily loss theo vốn gốc hoặc số dư đầu ngày. MAE/MFE và hai thứ tự lạc quan/thận trọng.
- Payout theo chu kỳ, min payout, tỷ lệ rút, cap tùy chọn, Consistency tại cửa sổ rút, profit split.
- KEEP_FLOOR / LOCK_AT_INITIAL / LOCK_AT_BUFFER / FULL_RESET. Chạm sàn sau rút vẫn là vi phạm.
- Chọn điều khoản Funded riêng sau vòng thi. Ô được thay bằng preset bị khóa và hiển thị giá trị hiệu dụng; đổi về cấu hình chung khôi phục giá trị tùy chỉnh.
- EV/ROI từ mean payout vô điều kiện theo mỗi lần bắt đầu; activation và refund theo P(Funded). Không nhân xác suất lần thứ hai vào mean.
- Worker có tiến độ và hủy; hủy/lỗi Worker Prop không chạy lại phép tính nặng trên luồng giao diện.
- Header có liên kết “v3.4 · Prop”. Bảng 4 vùng đọc chính kết quả RiskStore, không tính một EV khác.

## Điều khoản tham chiếu và giả định

Bảy preset được xuất trực tiếp từ Python đi kèm bằng `scripts/export-prop-v34-presets.py`; tất cả giữ `verified=False`. Các con số là cấu hình tham chiếu đã cung cấp, không xác nhận điều khoản quỹ hiện hành. Topstep XFA có target=None nên đi thẳng vào funded.

Tiền, sàn và payout dùng Decimal precision=40; xác suất và PRNG không thứ nguyên dùng Number. PRNG trình duyệt là seeded Mulberry32, khác Python Random; không tuyên bố khớp từng đường Monte Carlo ngẫu nhiên giữa hai ngôn ngữ. Đối chiếu chính xác Python dùng các đường P&L tiền tệ xác định.

Mặc định risk theo vốn gốc như v3.4. Tùy chọn lãi kép cũ được giữ và có nhãn mô hình mở rộng. Ngày mô phỏng là ngày giao dịch, không là lịch thanh toán thực. Horizon cũ theo số lệnh được đổi sang số ngày đủ lệnh bằng floor(horizon/lệnh mỗi ngày), ghi rõ số ngày thực dùng trong kết quả. Hai cột Static/Trailing là hai kịch bản áp dụng cơ chế tương ứng cho cả thi và funded.

Biên thận trọng khi thiếu MFE sử dụng giả định tham chiếu +0,5R; chỉ là kịch bản mô phỏng, không ghi thành quan sát lịch sử. Chỉ lệnh có Net/1R đã xác minh được đưa vào mẫu.

## Kiểm thử và khác biệt so với oracle cũ

`tests/trading/quant-prop-v34.test.ts` có kỳ vọng tính tay, thêm trước khi viết engine. `quant-prop-v34-parity.test.ts` so sánh 36 đường xác định với Python v3.4. Bộ browser `v34-prop-browser.mjs` kiểm tra UI, Worker, số USD cụ thể, ngày, preset, lưu/reload, hủy và mobile.

Oracle source A trước đây kiểm tra target ngay trong lệnh và mô hình có thi lại. v3.4 §12.5 kiểm tra mục tiêu theo ngày hoàn tất và EV một lần bắt đầu. Vì vậy ca oracle cũ được thay bằng ca ngày [+2,-2] có gain=0, không thể vượt target; chi phí khi rớt là một phí thi thay vì 10 phí. Giữ ca Daily loss chạm sàn trước hồi phục bằng đường tiền tệ độc lập. Không nới dung sai hay sửa giá trị tiền chuẩn theo kết quả mới.

Lệnh tái kiểm tra:
`npm run ci:check`, `python -m pytest tests/quant/test_tuan_trader_v3_4.py -q`.
Kết quả chạy thực tế và publication được ghi riêng sau khi hoàn tất kiểm tra.

## Giới hạn xác minh

Không dùng sao kê thật hay ghi nhật ký production trong kiểm thử. Chưa kiểm chứng cloud 50.000 lệnh trên nhiều thiết bị, tuổi thọ lưu trữ 30 năm, các trình duyệt/thiết bị vật lý khác hoặc hợp đồng từng quỹ.

Đây là hoàn thiện phần Prop v3.4 trên giao diện hiện có; không phải chứng nhận mọi yêu cầu kiến trúc dài hạn ở §13–14 đã hoàn thành. AccountProfile/import pipeline đầy đủ vẫn có trong Python tham chiếu; không tuyên bố chuyển toàn bộ schema giao diện sang dataclass Python hoặc thay toàn bộ bố cục Classic.
