# NHẬT KÝ DỰ ÁN — v7 (checkpoint Sprint S0)

Đọc cùng [đặc tả v6](DAC_TA_KY_THUAT_Trading_Plan_Pro_v6.md). Tài liệu gốc được giữ nguyên riêng trong docs/. Bản checkpoint chỉ cập nhật trạng thái và thêm lịch sử; không sửa các số mốc kỹ thuật v6.



## CÁCH DÙNG

1. Gửi ChatGPT **cả 2 file**: đặc tả kỹ thuật + file này.
2. Dùng prompt ở mục 10 bên dưới để khởi động.
3. Mỗi Sprint chỉ làm đúng phạm vi trong đặc tả mục 5H.
4. Chỉ thêm vào mục Nhật ký tiến độ (mục 7), không xóa lịch sử.
5. Khi gõ `CHECKPOINT` hoặc sắp hết ngữ cảnh → cập nhật mục 1 + 7, gửi lại file, viết lại prompt bàn giao.

---

## 0. TÓM TẮT ĐIỀU HÀNH

**Sản phẩm:** Trading Plan Pro — nhật ký giao dịch đa thị trường + quản trị rủi ro, 100% Local-first (dữ liệu nằm trên thiết bị, không đăng nhập), bản sắc "ghi sự thật, không suy diễn", khẩu hiệu "Kỷ luật · Kiên định · Tăng trưởng".

**Hai nguồn tham chiếu được hợp nhất:** TraderSync (thanh lọc toàn cục, Evaluator/Pivot, đường vốn tuân thủ Shadow, lịch + thống kê tuần, chip lỗi phím 1–9) và Edgewonk (đa sổ cục bộ, đổi Tiền/%/R, Scale In/Out + Merge, Tiltmeter 3 khâu, OTP Hit, Exit Analysis, Monte Carlo). Bảng hợp nhất ở mục 5G.2.


### 0.2 Ba việc người dùng cần làm TRƯỚC khi ChatGPT bắt đầu code (blocker)
1. **Xuất file sao lưu Sổ dữ liệu v3 từ web cũ** (Cài đặt & sao lưu → Xuất) và gửi kèm. Lý do: file v5 chỉ có số liệu *tổng hợp* và vài lệnh mẫu, chưa có đủ dữ liệu từng lệnh của 30 lệnh minh họa để dựng fixture đúng. Nếu không xuất được → dùng phương án dự phòng ở mục 5G.3 (fixture tái dựng, gắn nhãn rõ).
2. **Gửi ảnh chụp các trang chưa xem (UI07):** Định giá doanh nghiệp, Kết nối dữ liệu, Cài đặt & sao lưu, form Thêm giao dịch, giao diện điện thoại.
3. **Duyệt/đổi các mặc định ở mục 6 (9 câu hỏi mở đã có đề xuất sẵn)** và chọn nơi deploy (mục 11). Không trả lời = áp dụng mặc định.

---

## 1. TRẠNG THÁI HIỆN TẠI (cập nhật mỗi lần checkpoint)
| Mục | Giá trị |
| :--- | :--- |
| **Cập nhật lần cuối** | 2026-10-19 — Sprint S0 đã được người dùng xác nhận |
| **Phiên bản nhật ký** | v7 checkpoint S0; đặc tả kỹ thuật vẫn là v6, giữ bản gốc đi kèm |
| **Tiến độ backlog** | QT01, UI07 và N04 của S0 được triển khai; QT08/H01 giữ trạng thái cũ. S1–S9 chưa thực hiện |
| **Việc đang làm** | Nghiệm thu S0: nền v6 trong v6/, schema v4, fixture gốc, expected golden, CI và audit UI07. Trạng thái CI chi tiết tại PR S0 |
| **Việc kế tiếp nên làm** | S1 sau xác nhận mới; trước đó chốt mâu thuẫn đơn vị holding và mẫu số winrate khi có hòa vốn |
| **Chặn (blocker)** | Đã có export v3 nguyên gốc và ảnh UI07. S1 còn quyết định đơn vị holding, winrate và chỉ mục closedAt dẫn xuất |

---


---

## 6. QUYẾT ĐỊNH ĐÃ CHỐT & CÂU HỎI MỞ
### Đã chốt
- Giữ triết lý "ghi sự thật, không suy diễn" làm bản sắc (mục 3).
- **(Mới chốt ở v5) Bỏ phần đăng nhập & đồng bộ đám mây (H01):** Giữ 100% dữ liệu trên thiết bị (Local-first) để riêng tư và đơn giản hóa hạ tầng; thay bằng quản lý Đa Sổ Nhật ký cục bộ (E01) và xuất/nhập file sao lưu (QT05).
- **(Mới chốt ở v5) Định hướng Nhật ký Đa thị trường (Multi-Market):** Hỗ trợ Cổ phiếu, Hợp đồng tương lai/Phái sinh, Forex/CFD, Crypto, Hàng hóa, Quyền chọn; nhưng giữ nguyên 30 lệnh giả lập (VND) làm bộ Số liệu mốc (mục 4) để kiểm thử hồi quy.
- Không làm replay tick/Level II hay backtester tự động phức tạp dễ lỗi; chỉ làm Bar Replay nhẹ bằng nến OHLC (sau khi chốt C5, C6) và Bảng ghi nhanh Backtest / Alternative Strategies kiểu Edgewonk (E11).
- Bổ sung nút "Chèn mẫu ghi chú chuẩn" (Template) và Trợ lý truy vấn nội bộ (rule-based) dẫn thẳng tới ID lệnh duy nhất.

### Câu hỏi mở (hỏi người dùng khi cần)
1. Mã nguồn web nằm ở đâu? (file HTML/JS, repo, hay công cụ đã tạo ra trang?) — bắt buộc có để sửa được.
2. Bạn đang giao dịch trên những sàn/nền tảng cụ thể nào (ví dụ: MT5, Binance, cTrader, TradingView, hay CTCK nào) để ưu tiên làm mẫu Import CSV (G06) trước?
3. Đơn vị gốc của "thời gian giữ lệnh = 234,33" trong code hiện tại là gì (kiểm tra công thức tính theo C1)?
4. ~~Có muốn làm bản đăng nhập + đám mây, hay giữ "dữ liệu trên thiết bị" để riêng tư?~~ → **ĐÃ CHỐT (v5): Bỏ đăng nhập, giữ dữ liệu trên thiết bị.**
5. Mô hình thương mại: miễn phí, gói trả phí, hay chỉ dùng cá nhân?
6. Bản nào là bản chuẩn: bản dựng trên ChatGPT, bản Render, hay repo GitHub code-tuan-trading? (QT01)
7. Phần trăm hiển thị 1 chữ số thập phân (đề xuất ở 5D.2c) hay giữ như hiện tại?
8. Định nghĩa 9 lỗi (chia 3 khâu Entry/Management/Exit) và 3 mẫu ghi chú ở 5D.4 có cần chỉnh sửa gì cho hợp đa thị trường không?
9. Thuật ngữ: Việt hóa hoàn toàn hay song ngữ (tên Việt + thuật ngữ quốc tế trong ngoặc như `Lãi/lỗ ròng (Net PnL)`, `Bội số rủi ro (R-Multiple)`)?

### Đã chốt / đề xuất mặc định ở v6 (áp dụng nếu chủ dự án không phản đối)
- **Hướng dựng lại sạch** (mục 0.1 điểm 1) thay vì vá web cũ; web cũ là bản tham chiếu chỉ đọc.
- **Stack theo 5F.1**; **Sprint S0→S9 theo 5H**; **golden tests là cổng bắt buộc** trước mỗi lần deploy.
- **Một sổ = một tiền tệ**; thời gian giữ lệnh lưu bằng phút, mặc định hiển thị giờ.
- **Phân loại lỗi, mẫu ghi chú, thuật ngữ** theo 5D.4 (bản dựng lại, chờ duyệt).

### Mặc định đề xuất cho 9 câu hỏi mở (+2 câu mới)
| # | Mặc định v6 |
| :--- | :--- |
| 1. Mã nguồn | **Không cần** — dựng lại; thay bằng **file sao lưu v3** (mục 8) |
| 2. Sàn/nền tảng | Chưa biết → làm **mẫu CSV chung** (ánh xạ cột tùy chỉnh) trước; mẫu riêng theo sàn khi có file thật (C12) |
| 3. Đơn vị 234,33 | **Giờ** (lõi lưu phút) — xác nhận lại bằng "Cách tính" web cũ |
| 4. Đăng nhập/đám mây | **Đã chốt: bỏ** |
| 5. Mô hình thương mại | Miễn phí/dùng cá nhân, không thu thập dữ liệu; thương mại hóa sau không đổi kiến trúc Local-first |
| 6. Bản chuẩn (QT01) | **Repo GitHub mới = bản chuẩn**; web ChatGPT cũ = tham chiếu; bản Render bỏ |
| 7. % một chữ số thập phân | **Đồng ý** (`60,0%`) |
| 8. 9 lỗi & 3 mẫu ghi chú | Dùng 5D.4b / 5D.4f; 3 chip Exit tùy chọn cần duyệt |
| 9. Thuật ngữ | **Song ngữ**: nhãn tiếng Việt, thuật ngữ quốc tế trong ngoặc ở trang chi tiết/"Cách tính" |
| 10. (mới) Nơi deploy | **Cloudflare Pages** (mục 11) — hoặc nói rõ nếu muốn dùng "publish của ChatGPT" |
| 11. (mới) Tên miền | Dùng tên miền phụ miễn phí của nơi deploy; gắn tên miền riêng sau |

---


---

## 7. NHẬT KÝ TIẾN ĐỘ (chỉ thêm mới ở cuối, không xóa)
Mẫu một dòng: [YYYY-MM-DD HH:MM] [ID việc] [trạng thái] — đã làm gì — kiểm tra thế nào — bước kế tiếp
- [2026-10-19 13:44] Kiểm tra truy cập web: đọc được khung giao diện; không thấy số liệu vì ứng dụng tải bằng JavaScript.
- [2026-10-19 14:06] Nhận 12 ảnh chụp màn hình các trang. Tham khảo tradersync.com. Đánh giá: nền tảng thống kê tốt, chưa đạt chuẩn journal chuyên nghiệp. Lập đề xuất cải tiến 5 giai đoạn.
- [2026-10-19 14:15] Tạo file nhật ký này. Đã chạy lại phép tính để xác nhận số liệu mốc mục 4 (PF = 1,758; Net = 3.302.290; bào mòn 23,73%; tổng tháng và W42 khớp). Chưa sửa dòng mã nào. Bước kế tiếp: lấy mã nguồn (câu hỏi mở số 1), rồi làm F01 → F03.
- [2026-10-19 14:33] [Rà soát kế hoạch bot tiếp quản] — Đối chiếu file trả lời của bot với mục 4, nguồn TraderSync và quy định thị trường VN (T+2, phí phái sinh). Kết luận: hướng đi và thứ tự ưu tiên đúng; 13 điểm cần hiệu chỉnh đã ghi ở mục 5B (nổi bật: C1 đơn vị thời gian giữ lệnh, C2/C3 quy tắc cảnh báo, C4 không ghi đè điểm kỷ luật cũ, C5/C6 thiếu dữ liệu giá và nguồn nến). Nâng nhật ký lên v2. Chưa sửa mã. Bước kế tiếp: lấy mã nguồn, xác định đơn vị F03 (C1), làm F01 → F03.
- [2026-10-19 14:47] [Phân tích video thực tế TraderSync & cập nhật đặc tả] — Phân tích video review TraderSync (http://www.youtube.com/watch?v=Db_59jGMG20) để rút ra 8 đặc tả thực tế (V1→V8 ở mục 5C): bộ lọc toàn cục, nhật ký 2 cấp độ + bổ sung Template ghi chú, Evaluator dạng Pivot Chart, đường vốn Tuân thủ (Shadow) có bộ lọc, lịch có cột tổng tuần, chip lỗi phím tắt 1–9, trợ lý truy vấn nội bộ theo ID lệnh, và nguyên tắc tránh lỗi thiếu tài liệu như Backtester của TraderSync. Đã đồng bộ hoàn toàn với C1→C13 (mục 5B). Nâng nhật ký lên v3. Chưa sửa mã. Bước kế tiếp: nhận mã nguồn từ người dùng, kiểm tra đơn vị F03 (theo C1), thực thi F01 → F03.
- [2026-10-19 --:--] [Phân tích cải tiến v4: giao diện · quy trình · nội dung] — Đọc toàn bộ v3, đối chiếu mục 4/5/5B/5C. Thêm mục 5D (chẩn đoán, chuẩn giao diện, quy trình, nội dung, thứ tự thực thi v4), mục 4.9 (mốc bổ sung), nguyên tắc 9–10, nhóm việc P5 (UI01–UI07), P6 (QT01–QT08), P7 (ND01–ND06), câu hỏi mở 6–9. QT08 xong: sửa tên file trong prompt mục 10. Kiểm tra: đã tính lại số mốc bổ sung (833.530 + 412.150 + 143.950 = 1.389.630; PF 1,758; phục hồi 2,65; kỳ vọng 110.076,33; bào mòn 23,73%; kịch bản review 15/18 và 16/18). Chưa sửa mã, chưa đối chiếu mốc 4.9 với giao diện thật. Bước kế tiếp: người dùng duyệt 5D và trả lời câu hỏi 6–9, chốt QT01, lấy mã nguồn, áp QT07 khi sửa F01.
- [2026-10-19 15:30] [H01, P8: E01→E12] [Cập nhật v5: Bỏ đăng nhập · Mở rộng Đa thị trường · Tích hợp Edgewonk] — Theo chỉ đạo của người dùng: (1) Hủy việc H01 (bỏ đăng nhập đám mây, chốt câu hỏi mở số 4 giữ dữ liệu 100% trên thiết bị); (2) Chuyển định hướng sang Nhật ký Đa thị trường (thêm nguyên tắc 11, cập nhật C1, C5, C11); (3) Phân tích toàn bộ video Edgewonk (http://www.youtube.com/watch?v=rZWQT6f242M) và thêm mục 5E cùng 12 hạng mục P8 (E01→E12: Đa sổ cục bộ & xóa mềm, Sổ nạp/rút & đổi hiển thị Tiền/%/R, Đa thị trường & đổi đơn vị Phút/Giờ/Ngày, Scale In/Out & Merge Trades, Tiltmeter 3 khâu & Efficiency, OTP Hit & Biểu đồ quản lý lệnh, Exit Analysis Updraw/Drawdown, Equity MA & Phí, Drill-down & 20 Custom Stats, Chartbook & xu hướng tuần, Planned/Missed Trades & Alternative Strategies, Monte Carlo Simulator & Milestones). Kiểm tra: toàn bộ số mốc mục 4 và 4.9 được bảo toàn nguyên vẹn. Chưa sửa mã. Bước kế tiếp: chốt QT01, nhận mã nguồn từ người dùng, kiểm tra đơn vị F03 (C1), thực thi F01 → F03 theo QT07.

<!-- Thêm dòng mới ngay bên dưới đây -->
- [2026-10-19 --:--] [v6: Master Blueprint] [Cập nhật v6] — Đọc toàn bộ v5; phát hiện mục 5D chỉ còn dòng "giữ nguyên" (nội dung thật không có trong file) → **dựng lại đầy đủ 5D** (phễu 5 tầng Q1–Q7, điều hướng 4 nhóm, bản đồ vai trò trang, chuẩn KPI/định dạng/biểu đồ/trạng thái/lọc/bảng, vòng đời lệnh, quy trình trader hằng ngày–tuần–tháng–quý, hàng đợi review, cảnh báo, import, danh mục setup & lỗi 3 khâu, thuật ngữ, thông điệp, mẫu ghi chú, wireframe). Thêm **5F** (stack, schema v4, migration, công thức chuẩn, hồ sơ phí thị trường, lưu trữ/sao lưu), **5G** (14 phát hiện, bảng hợp nhất TraderSync + Edgewonk, fixture dự phòng, ý tưởng N01→N08), **5H** (Sprint S0→S9 + ma trận ID), **mục 10** (prompt ChatGPT), **mục 11** (deploy), **mục 12** (rủi ro); nguyên tắc 12–18; mốc 4.10. Kiểm tra: tính lại bằng code — Net 3.302.290; PF 1,7581; phục hồi 2,6547; bào mòn 23,73%; Wilson 6/10 = 31,27→83,18 (khớp 4.6); Wilson 18/30 = 42,32→75,41; tổng tuần 833.530 + 412.150 + 143.950 = 1.389.630. Golden gốc không đổi. Chưa có dòng mã nào. Bước kế tiếp: người dùng làm 3 việc ở mục 0.2 → ChatGPT chạy Sprint S0.


---

- [2026-10-19 --:--] [S0: QT01, UI07, N04] [Triển khai theo xác nhận trực tiếp] — Dựng nền React 18/Vite/TypeScript strict độc lập trong v6/ cùng repo code-tuan-trading; giữ production v3 và Tổng quan gốc. Xuất nguyên vẹn backup schemaVersion 3 gồm 1 tài khoản minh họa, 60 fills/30 overlays/24 review; lưu checksum/provenance và số mốc 4.1–4.9. Schema v4 đã có kiểm tra cấu trúc, chưa triển khai core/migration S1. Cấu hình lint/typecheck/Vitest/build/Playwright/axe và CI. Test tham chiếu bằng core v3 khớp số mốc, 6 test nền v6 đạt, 3 TODO công khai; suite cũ 89 Vitest +20 test nền đạt. UI07 đã rà soát Định giá/Kết nối/Cài đặt/form/8 nhóm và readout biểu đồ; ảnh form 360/768/1280 nằm tại docs/evidence. Phát hiện mâu thuẫn tài liệu: 234,333 là PHÚT từ timestamps, không phải GIỜ; không chỉnh dữ liệu để ép khớp. Bootstrap gốc mulberry32 seed2103, 2000 lần; dữ liệu demo seed301019. Nâng ESLint 10 theo peer dependencies và runtime Node24.19.0. S0 không deploy nền trống đè website chính theo xác nhận. Kế tiếp: xem CI của PR S0, chốt các mâu thuẫn rồi duyệt S1.


## 8. THÔNG TIN CÒN THIẾU ĐỂ TIẾP TỤC (cập nhật v6)
| # | Cần gì | Dùng để | Chặn Sprint |
| :--- | :--- | :--- | :--- |
| 1 | **File sao lưu Sổ dữ liệu v3** của web cũ (Cài đặt & sao lưu → Xuất), gồm 30 lệnh minh họa | Dựng fixture đúng, kiểm chứng migration, thu hồi định nghĩa "lệnh vi phạm" | S0–S1 (dự phòng: 5G.3) |
| 2 | Ảnh chụp bổ sung (UI07): Định giá doanh nghiệp, Kết nối dữ liệu, Cài đặt & sao lưu, form Thêm giao dịch, tooltip biểu đồ, giao diện điện thoại; cùng 12 ảnh gốc | Đối chiếu bố cục, quyết định trang "Định giá doanh nghiệp" | S2–S3 |
| 3 | "Cách tính" của web cũ cho: Chỉ số ổn định (0,22), Kỷ luật TB (85%), Kỳ vọng R (0,32R), Sụt giảm hiện tại (639.220), 5 lệnh lãi lớn nhất (52,6%), PRNG + seed bootstrap | Gỡ các `TODO-VERIFY` ở 4.10, 5F.5 | S1 |
| 4 | Quyết định nơi deploy (mục 11) | Cấu hình CI/CD | S0 |
| 5 | File CSV mẫu thật theo từng nền tảng bạn dùng (C12) | Mẫu Import (G06) | S5 |
| 6 | Biểu phí/thuế hiện hành của CTCK/sàn bạn dùng (C11) | Hồ sơ phí đúng thực tế | S4 |
| 7 | Nguồn nến OHLC (C6) — chỉ khi muốn làm G01/I03 | Biểu đồ giá + replay | sau v1.0 |


---

## 9. QUY TRÌNH CHECKPOINT (để không mất tiến độ khi hết token)
1. Sau mỗi việc xong (đổi [ ] → [x]): thêm 1 dòng vào mục 7, cập nhật bảng mục 1.
2. Cứ sau 3–5 việc hoặc khi cuộc trò chuyện đã rất dài: AI tự xuất bản mới của file này.
3. Người dùng có thể gõ "CHECKPOINT" bất cứ lúc nào → AI phải cập nhật file, gửi lại file mới và in ra khối "Prompt bàn giao" (mục 10) đã điền sẵn trạng thái hiện tại.
4. Người dùng tự tải file về sau mỗi checkpoint và lưu ngoài (máy tính, Google Drive, Notion).
5. Khi sang bot/cuộc trò chuyện mới: đính kèm file này + mã nguồn + ảnh chụp, rồi dán "Prompt bàn giao".
6. Nếu AI mới cũng sắp hết giới hạn: lặp lại bước 1–5. Phiên bản nhật ký tăng lên (v6, v7...).
7. Đặt tên file theo mẫu `NHAT_KY_SUA_LOI_Trading_Plan_Pro_vN.md` và giữ lại bản cũ để đối chiếu; prompt bàn giao phải ghi đúng tên file và số phiên bản hiện tại.


---

## 10. PROMPT GỬI CHATGPT (sao chép nguyên khối; đính kèm file này + file sao lưu v3 + ảnh chụp)

### 10.1 Prompt khởi động (dùng một lần ở đầu cuộc trò chuyện)
```
Bạn là kỹ sư full-stack kiêm người giữ kỷ luật dự án. Tôi đính kèm file
NHAT_KY_SUA_LOI_Trading_Plan_Pro_v7.md — bản thiết kế + bộ nhớ của dự án
"Trading Plan Pro" (nhật ký giao dịch đa thị trường, lưu 100% trên thiết bị,
không đăng nhập, thương hiệu Tuan Trader). Làm đúng thứ tự:

1. Đọc mục 0, 3, 5D.0–5D.2 và 5F. Trả lời tối đa 15 dòng: (a) dự án là gì,
   (b) stack/kiến trúc bạn sẽ dùng (PHẢI đúng mục 5F.1, không tự đổi),
   (c) bạn cần tôi cung cấp gì, (d) rủi ro bạn thấy. CHƯA viết code.
2. Mỗi lượt chỉ làm ĐÚNG MỘT Sprint theo mục 5H. Trước khi code: liệt kê file sẽ
   tạo/sửa và các test sẽ viết, rồi chờ tôi xác nhận.
3. Quy tắc cứng:
   - Mọi con số đến từ thư viện core/ (hàm thuần). UI không tự tính.
   - Số liệu mốc mục 4 là golden tests: lệch dung sai (4.10) = chưa xong.
   - Không bịa công thức. Gặp TODO-VERIFY thì hỏi tôi.
   - Không thêm tính năng ngoài phạm vi Sprint; không đổi stack; không đăng nhập;
     không gọi mạng ngoài; mọi chuỗi giao diện tiếng Việt qua i18n.
   - Đường/số giả định luôn có nhãn GIẢ ĐỊNH và đi kèm số thực.
   - Chuẩn hóa chỉ đổi cách hiển thị, không đổi giá trị tính (nguyên tắc 9).
4. Cuối mỗi Sprint: chạy toàn bộ test và dán kết quả; báo cáo từng ID
   "đạt/không đạt + bằng chứng"; cập nhật file nhật ký (mục 1, mục 7, đổi trạng
   thái việc) và gửi lại file; viết lại prompt bàn giao với trạng thái mới.
5. Thiếu dữ liệu hoặc thấy mâu thuẫn trong file: hỏi tôi, đừng đoán.
```

### 10.2 Mẫu prompt cho mỗi Sprint
```
SPRINT {Sx} — {tên}.
Đọc mục: {danh sách mục ở cột "Đọc mục" của 5H.1}.
Phạm vi (CHỈ các ID): {danh sách ID}.
Cổng nghiệm thu: {dán nguyên cột "Cổng nghiệm thu" của 5H.1}.
Cấm: làm ID ngoài phạm vi; sửa số liệu mốc; đổi schema ngoài 5F.3.
Đầu ra: mã nguồn trong repo + kết quả test + file nhật ký đã cập nhật.
```

### 10.3 Prompt Sprint S0 (dùng ngay sau 10.1)
```
SPRINT S0 — Chuẩn bị & nền. Đọc mục 4, 5F.1–5F.3, 11.
Việc: (1) khởi tạo repo Vite + React 18 + TypeScript strict đúng cấu trúc 5F.2;
(2) cấu hình ESLint, Prettier, Vitest, Playwright; (3) CI GitHub Actions:
lint → typecheck → test → build; (4) tạo tests/golden/ gồm fixture-30-trades.json
(dùng file sao lưu v3 tôi đính kèm; nếu chưa có thì dùng phương án 5G.3 và gắn
nhãn "FIXTURE TÁI DỰNG") và golden.expected.json chứa số mốc 4.1–4.9 kèm dung sai
4.10 (mục TODO-VERIFY viết thành it.todo); (5) tạo src/data/schema.ts theo 5F.3;
(6) README ghi cách chạy và cách deploy theo mục 11.
Cổng nghiệm thu: CI xanh; fixture nạp được; schema biên dịch; không có UI.
```

### 10.4 Prompt bàn giao sang cuộc trò chuyện mới (khi gõ "CHECKPOINT" hoặc sắp hết ngữ cảnh)
```
Bạn tiếp quản dự án "Trading Plan Pro". Tôi đính kèm file nhật ký
NHAT_KY_SUA_LOI_Trading_Plan_Pro_v{N}.md (bộ nhớ dự án) và mã nguồn hiện tại.
Đọc mục 1 (trạng thái), 3 (nguyên tắc), 5H (Sprint) và dòng cuối mục 7. Trả lời
ngắn: dự án là gì, Sprint nào đã xong/đang làm, việc kế tiếp, còn thiếu gì.
Chưa làm gì khác trước khi tôi xác nhận. Giữ nguyên các nguyên tắc ở mục 3 và
quy tắc cứng ở 10.1. Không đoán, không bịa số liệu.
```

---


---

## 11. TRIỂN KHAI & VẬN HÀNH (phần quy trình)

### 11.2 Quy trình Git & phát hành
Repo GitHub **riêng tư** · `main` = production · mỗi việc một nhánh `sprint/Sx-ID` → Pull Request → **bản xem trước (preview deploy)** → merge khi CI xanh · gắn tag `vX.Y.Z` mỗi mốc (v0.5, v0.8, v1.0) · cập nhật `CHANGELOG.md` (hiển thị ở mục "Có gì mới" của landing, J01).

### 11.5 Kế hoạch chuyển đổi từ web cũ (cutover) — không làm gián đoạn dữ liệu
1. Deploy web mới **song song**, không đụng web cũ.
2. Ở web cũ: **Cài đặt & sao lưu → xuất file v3**; ở web mới: Nhập → tự sao lưu trước → migration → **golden tự kiểm** trên sổ minh họa. Lệch → dừng, báo cáo.
3. Chạy song song 1–2 tuần cho dữ liệu thật mới (ghi vào web mới); sao lưu hằng tuần.
4. Lưu trữ file sao lưu v3 của web cũ; giữ web cũ ở chế độ chỉ đọc rồi tắt.
**Rollback:** deploy lại tag trước; dữ liệu người dùng nằm trên thiết bị nên không mất; mọi nâng schema đều có bản sao lưu trước (nguyên tắc 16).

### 11.7 Vận hành sau phát hành
PWA hiện thông báo "Có bản mới — tải lại" · nhắc sao lưu theo 5F.7 · mỗi lần đổi công thức phải tăng phiên bản core, ghi vào CHANGELOG và cập nhật golden có chủ đích (kèm lý do ở mục 7).

---


---

## 12. RỦI RO & GIẢM THIỂU (MỚI v6)
| Rủi ro | Mức | Giảm thiểu |
| :--- | :--- | :--- |
| Mất dữ liệu (xóa dữ liệu trình duyệt, đổi máy; Safari/iOS có thể dọn dữ liệu web lâu không dùng) | Cao | `persist()` · cài PWA lên màn hình chính · nhắc sao lưu · "Kiểm tra khôi phục" · bản sao lưu cất ngoài máy |
| AI code tự bịa công thức hoặc lệch số mốc | Cao | Quy tắc cứng 10.1 · golden bắt buộc · `TODO-VERIFY` phải hỏi |
| Phạm vi phình, bỏ dở giữa chừng | Cao | Sprint + cổng nghiệm thu · quy tắc cắt phạm vi 5H.3 · v0.5 đã đủ thay web cũ |
| Hồi quy khi thêm tính năng đa thị trường | TB | Nguyên tắc 11: sổ minh họa VND luôn giữ golden |
| Bootstrap CI không tái lập đúng mốc cũ | TB | Dung sai thống kê, thu hồi PRNG+seed (mục 8 #3) |
| Phí/thuế thay đổi theo quy định/CTCK | TB | Hồ sơ phí có ngày hiệu lực, sửa được (5F.6) |
| Sai số dấu phẩy động / lệch múi giờ | TB | `decimal.js`; lưu ISO UTC, hiển thị theo múi giờ sổ |
| Quá hạn mức IndexedDB khi đính nhiều ảnh | TB | Nén WebP, ≤ 6 ảnh/lệnh, cảnh báo 80% |
| XSS từ ghi chú / URL ảnh | TB | DOMPurify, CSP, ảnh URL chỉ tải khi bấm |
| Người dùng hiểu số giả định là thật | TB | Nguyên tắc 15, nhãn GIẢ ĐỊNH, cổng mẫu |
| Chủ dự án không xuất được file v3 | TB | Fixture tái dựng (5G.3) với nhãn rõ + giới hạn đã nêu |

*— Hết file v6. Khi cập nhật: tăng số phiên bản, chỉ thêm vào mục 7, giữ nguyên số liệu mốc mục 4 trừ khi đổi có chủ đích và ghi lý do. —*

## Checkpoint S1 — 2026-10-20

Phạm vi QT05, 5F.3–5F.5. Core v6, repository Dexie, migration/backup/restore và trang debug đã triển khai; chưa triển khai S2–S9.

Quyết định: chủ dự án chốt winrate thắng/(thắng+thua), loại hòa vốn (4/8=50%). Thời gian giữ lệnh gốc 234,333 phút ≈3,906 giờ; bảo toàn timestamps. closedAt chỉ ở metadata chỉ mục, không lưu trong Trade.

Kiểm chứng local: lint + typecheck + 20 tests + build đạt. Golden 4.1–4.9 chạy bằng core v6, bộ gốc checksum không đổi. Trình duyệt đã xem trước, lưu 30 lệnh và tải lại thành công: Net 3.302.290đ, PF 1,7581, review 24/30. CI/E2E và deployment ghi tại báo cáo phát hành S1 sau khi có kết quả.

Sửa phát hiện trong kiểm thử: báo cáo từng loại phí phải lấy các sự kiện chốt, kể cả khi vị thế còn mở. Bổ sung test chứng minh commission/tax/funding/swap phân bổ khớp Net.

Migration từ chối cấu trúc không bảo toàn được (reported P&L, FX phức tạp, opening balances, corporate adjustments, cash events, phân bổ phí khác) và giữ nguồn. Blob attachment chưa được đóng gói S1. Không coi đây là hỗ trợ mọi loại dữ liệu v3. Xem README.

Giữ website v3, Tổng quan cũ, các lựa chọn MetriX/System Tracker. Bản kiểm chứng S1 ở Site riêng. Main cần review theo CONTRIBUTING.
