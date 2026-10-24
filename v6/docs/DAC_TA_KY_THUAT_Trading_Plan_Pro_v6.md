

## 1. SẢN PHẨM & QUYẾT ĐỊNH KIẾN TRÚC

**Sản phẩm:** Trading Plan Pro — nhật ký giao dịch đa thị trường + quản trị rủi ro, 100% Local-first (dữ liệu trên thiết bị, không đăng nhập), bản sắc "ghi sự thật, không suy diễn", khẩu hiệu "Kỷ luật · Kiên định · Tăng trưởng".

**Hai nguồn tham chiếu hợp nhất:**
- **TraderSync:** thanh lọc toàn cục, Evaluator/Pivot, đường vốn tuân thủ Shadow, lịch + thống kê tuần, chip lỗi phím 1–9
- **Edgewonk:** đa sổ cục bộ, đổi Tiền/%/R, Scale In/Out + Merge, Tiltmeter 3 khâu, OTP Hit, Exit Analysis, Monte Carlo

### 1.1 Bảy quyết định kiến trúc (bắt buộc)

1. **Dựng lại sạch (Rebuild) thay vì vá web cũ.** Chưa có mã nguồn web hiện tại nên không thể "sửa F01→F10" trên hộp đen. Web cũ giữ làm bản tham chiếu; web mới dựng trên stack chuẩn, và F01→F10 trở thành *tiêu chí nghiệm thu* của bản mới (không được lặp lại các lỗi đó).
2. **Tách "Lõi tính toán" khỏi giao diện.** Mọi con số hiển thị đều đến từ một thư viện hàm thuần (pure functions) có kiểm thử. Không tính toán trong component giao diện.
3. **Bộ số liệu mốc (mục 4) là bài kiểm thử tự động ("golden tests").** Mỗi lần commit đều chạy; lệch là CI đỏ, không deploy.
4. **Một sổ = một tiền tệ** (VND / USD / USDT). Không cộng chéo sổ khác tiền tệ khi chưa có tỷ giá do người dùng nhập.
5. **Lưu IndexedDB (không dùng localStorage cho dữ liệu lệnh)**, kèm xin `navigator.storage.persist()`, nhắc sao lưu định kỳ và kiểm tra khôi phục. Mất dữ liệu trình duyệt là rủi ro số 1 của mô hình không đăng nhập (mục 12).
6. **Build theo 10 Sprint (S0→S9), mỗi Sprint có cổng nghiệm thu bằng golden tests.** Không giao ChatGPT "làm hết 57 việc" trong một lần.
7. **Deploy tĩnh** (Cloudflare Pages mặc định; Netlify / Vercel / GitHub Pages / "publish của ChatGPT" là phương án thay thế) + PWA offline. Không cần server vì không có tài khoản.

### 1.2 Lộ trình sản phẩm
| Mốc | Sprint | Kết quả |
| :--- | :--- | :--- |
| **v0.5 (thay thế web cũ)** | S0 → S3 | Lõi tính toán + golden tests, khung giao diện chuẩn, Tổng quan/MetriX/Nhật ký/Lịch/Review, F01→F10 đạt |
| **v0.8 (đa thị trường)** | S4 → S6 | Đa sổ, vốn nạp/rút, đa thị trường, Scale In/Out, Import, kỷ luật & Tiltmeter, cảnh báo |
| **v1.0 (đầy đủ)** | S7 → S9 | Phân tích chuyên sâu (Exit Analysis, OTP, Drill-down), Monte Carlo/What-if, PWA, landing, báo cáo PDF |

### 1.3 Bối cảnh web cũ (tham chiếu)
- Sản phẩm: Trading Plan Pro — nhật ký giao dịch đa thị trường + quản trị rủi ro (Cổ phiếu, Hợp đồng tương lai/Phái sinh, Hàng hóa, Forex/CFD, Crypto, Quyền chọn). Thương hiệu "Tuan Trader", khẩu hiệu "Kỷ luật · Kiên định · Tăng trưởng".
- URL: https://tuannhatky.fabledcoot2.chatgpt.site/ (ứng dụng chạy bằng JavaScript; công cụ đọc web chỉ thấy khung giao diện, không thấy dữ liệu).
- Lưu trữ dữ liệu: 100% trong trình duyệt của người dùng ("Sổ dữ liệu v3 · Trên thiết bị", Local-first, KHÔNG làm đăng nhập đám mây), có sao lưu thủ công ở "Cài đặt & sao lưu". Múi giờ mặc định Asia/Ho_Chi_Minh.
- Menu: Tổng quan · Nhật ký giao dịch · Lịch giao dịch · Quy trình setup · Ghi chú & review · Lợi thế thống kê · Lợi nhuận & rủi ro · Trading MetriX · Theo dõi hệ thống · Định giá doanh nghiệp · Kết nối dữ liệu · Cài đặt & sao lưu.
- Dữ liệu hiện tại là GIẢ LẬP: 30 lệnh (mã minh họa HPG, FPT, VCB, VNM, MWG, SSI), mỗi ghi chú có dạng "DỮ LIỆU GIẢ LẬP #n/30". Có banner "DỮ LIỆU MINH HỌA" ở trang Nhật ký. Vì vậy chỉ đánh giá giao diện/tính năng, không đánh giá hiệu suất giao dịch.
- Mục tiêu cải tiến: đạt chuẩn một web nhật ký đa thị trường chuyên nghiệp, kết hợp tinh hoa của **TraderSync** (https://tradersync.com/ — bộ lọc, Evaluator, đường vốn tuân thủ) và **Edgewonk** (http://www.youtube.com/watch?v=rZWQT6f242M — đa sổ nhật ký cục bộ, chuyển đổi đơn vị Tiền/%/R, Scale In/Out & gộp lệnh, Tiltmeter 3 khâu, OTP Hit & biểu đồ quản lý lệnh, Updraw/Drawdown, Monte Carlo Simulator), đồng thời hỗ trợ sẵn các quy tắc thị trường Việt Nam & quốc tế.

### Vùng CHƯA xem được (cần xác minh trước khi sửa)
- Phần dưới của Tổng quan (hàng thẻ KPI cuối) và các mục "Mục tiêu · Equity · Giới hạn rủi ro" của Trading MetriX.
- Trang Định giá doanh nghiệp, Kết nối dữ liệu, Cài đặt & sao lưu.
- Các lựa chọn trong ô "Phân nhóm" (hiện chỉ thấy "Setup").
- Giao diện điện thoại/responsive, tooltip của biểu đồ, form "Thêm giao dịch".
- Ảnh chụp có thanh trắng "Đang xử lý trong X phút..." ở đáy: đó là lớp phủ của công cụ ngoài, không phải lỗi của web.

---

## 3. NGUYÊN TẮC PHẢI GIỮ (đừng phá khi sửa)
1. Minh bạch tính toán: mỗi thẻ KPI có nhãn n=x/30 và mục "Cách tính". Giữ nguyên.
2. Khoảng tin cậy: winrate dùng Wilson 95%; kỳ vọng dùng bootstrap 2.000 lần với seed cố định. Ngưỡng 20 lệnh và dòng cảnh báo "chưa phải bằng chứng có lợi thế" phải còn.
3. Cảnh báo thiên lệch chọn lọc: đường vốn Shadow (xanh, loại lệnh vi phạm) luôn đi kèm cảnh báo khi tỷ lệ review thắng/thua chênh hơn 15 điểm %.
4. Không suy diễn nguyên nhân: Review tuần ghi rõ "không tự suy luận nguyên nhân hay tạo nhận định AI". Nếu thêm AI sau này, AI chỉ truy vấn/tóm tắt dữ liệu đã ghi và dẫn về từng lệnh cụ thể.
5. Đối chiếu Gross → Phí → Net và "bào mòn lợi nhuận gộp" phải còn.
6. Hàng đợi review cân bằng lãi/lỗ phải còn.
7. Dữ liệu minh họa phải luôn được gắn nhãn rõ và tách được khỏi dữ liệu thật (có hoàn tác cả đợt nhập tại "Lịch sử nhập").
8. Sau mỗi lần sửa, đối chiếu lại bảng số liệu mốc ở mục 4. Nếu lệch, nghĩa là có lỗi hồi quy.
9. (v4) Chuẩn hóa chỉ đổi cách hiển thị và cách làm việc, không đổi giá trị tính. Nếu một chuẩn buộc đổi giá trị, ghi vào mục 5B và hỏi người dùng trước. Số mốc mục 4 được so theo giá trị nền (có dung sai làm tròn), không so theo chuỗi hiển thị.
10. (v4) Mỗi chỉ số hoặc bảng có đúng một "trang chủ" (bảng vai trò trang ở 5D.2). Trang khác chỉ hiện bản rút gọn kèm liên kết về trang chủ.
11. (v5 — Đa thị trường & Không đăng nhập) Ứng dụng hoạt động 100% Local-first trên trình duyệt (không yêu cầu tài khoản/đăng nhập). Mọi tính năng mở rộng đa thị trường (đa tiền tệ USD/USDT/VND, đổi đơn vị Phút/Giờ/Ngày, đổi hiển thị Tiền/%/R, xóa mềm danh mục) phải đảm bảo khi chọn Sổ dữ liệu minh họa 30 lệnh ở chế độ mặc định (VND), toàn bộ số mốc mục 4 và 4.9 giữ nguyên tuyệt đối.
12. **(v6) Một lõi tính toán duy nhất.** Mọi con số/biểu đồ lấy từ thư viện `core/` (hàm thuần, có test). Giao diện không tự tính, không làm tròn trong lõi; chỉ làm tròn ở lớp hiển thị.
13. **(v6) R luôn tính trên Net:** R = Net ÷ 1R của lệnh (bằng chứng: VCB 13/10 = 159.620 ÷ 200.000 = 0,80R). Công thức gộp "Kỳ vọng theo R", "Chỉ số ổn định", "Kỷ luật trung bình" phải đối chiếu với mục "Cách tính" của web cũ; chưa xác minh được thì ghi `TODO-VERIFY`, **không tự bịa công thức**.
14. **(v6) Cổng mẫu thống nhất:** n < 20 → huy hiệu "Chưa đủ mẫu" + cảnh báo "chưa phải bằng chứng có lợi thế"; 20 ≤ n < 50 → "Mẫu nhỏ"; n ≥ 50 → "Đủ mẫu cơ bản". Ngưỡng cấu hình được ở Cài đặt, mặc định 20 (giữ nguyên tắc 2).
15. **(v6) Mọi đường/số "giả định"** (Shadow, What-if, Alternative Strategies, Management Effect, Monte Carlo) mang nhãn **GIẢ ĐỊNH — không phải kết quả thực** và luôn đặt cạnh đường/số thực. Không bao giờ thay thế số thực.
16. **(v6) Migration an toàn:** tự động sao lưu trước khi nâng schema; đọc được v3; không ghi đè dữ liệu cũ; mỗi lần nâng có test với file v3 mẫu.
17. **(v6) Riêng tư tuyệt đối mặc định:** không gửi dữ liệu ra ngoài thiết bị, không analytics định danh, không gọi LLM ngoài khi chưa được người dùng bật rõ (C9). Chính sách CSP chặn kết nối ngoài.
18. **(v6) Không dựa vào màu một mình:** lãi/lỗ luôn kèm dấu +/− hoặc ▲▼; biểu đồ có hoa văn/nhãn phụ; đạt tương phản WCAG AA.

---

## 4. SỐ LIỆU MỐC (GOLDEN NUMBERS) — dùng để kiểm thử hồi quy
Tất cả đã được tính lại bằng code và khớp nhau (2026-10-19).

### 4.1 Tổng quan / Trading MetriX
| Chỉ số | Giá trị đúng |
| :--- | :--- |
| Tổng số lệnh | 30 (18 thắng, 12 thua, 0 hòa vốn) |
| Tỷ lệ thắng | 60% |
| Tổng lãi / Tổng lỗ | 7.658.330 đ / 4.356.040 đ |
| Lãi TB/lệnh thắng | 425.462,78 đ (n=18) |
| Lỗ TB/lệnh thua | −363.003,33 đ (n=12) |
| Lợi nhuận ròng | 3.302.290 đ |
| Hệ số lợi nhuận (PF) | 1,76 (= 7.658.330 / 4.356.040 = 1,758) |
| Kỳ vọng theo R | 0,32R |
| Kỳ vọng lợi nhuận | 110.076,33 đ |
| Sụt giảm tối đa | 1.243.950 đ (trùng lệnh thua lớn nhất; hợp lý vì chuỗi thua dài nhất chỉ 1) |
| Sụt giảm hiện tại | 639.220 đ |
| Hệ số phục hồi | 2,65 |
| Chuỗi thắng dài nhất / Chuỗi thua dài nhất / Chuỗi hiện tại | 2 / 1 / 1 |
| Lệnh thắng lớn nhất / Lệnh thua lớn nhất | 1.064.900 đ / −1.243.950 đ |
| Chỉ số ổn định | 0,22 |
| Thời gian giữ lệnh TB | 234,33 (chưa có đơn vị, xem F03, C1 & E03) |
| Kỷ luật trung bình | 85% |
| 1R trung bình | 266.667 đ |
| 5 lệnh lãi lớn nhất | 52,6% tổng lãi dương |

### 4.2 Gross → Phí → Net
- Lãi/lỗ gộp: 4.330.000
- Phí & thuế đã biết: 1.027.710 (TB 34.257/lệnh)
- Funding/Swap/Margin trả / nhận: 0 / 0
- Net: 3.302.290 (= 4.330.000 − 1.027.710)
- Bào mòn lợi nhuận gộp: 23,73%
- Đủ phí: 30/30 lệnh; chi phí chưa xác định: 0

### 4.3 Phân bố theo khoảng R (tổng 30)
≤ −1R: 8 · −1R→0: 4 · 0→1R: 6 · 1R→2R: 7 · 2R→3R: 5 (thua = 8+4 = 12, thắng = 6+7+5 = 18)

### 4.4 Theo tháng / tuần
- 2026-09: 1.912.660 (18 sự kiện) · 2026-10: 1.389.630 (12 sự kiện) · tổng = 3.302.290.
- Tuần 2026-W42: 5 chu kỳ đóng, 5 sự kiện, Net 143.950, đã review 4/5.
- Lịch tháng 10/2026 (net theo ngày): 1→−38.020 · 2→871.550 · 5→−212.040 · 6→678.560 · 7→728.800 · 8→−1.243.950 · 9→460.780 · 12→−24.570 · 13→159.620 · 14→228.160 · 15→−469.820 · 16→250.560. Các ngày còn lại trống.

### 4.5 Review
- Đã review 24/30 lệnh; lãi 12/18, lỗ 12/12; còn 6 lệnh chờ (cả 6 đều là lệnh lãi):
  HPG 871.550 (1,74R, 02/10) · FPT 460.780 (2,3R, 09/10) · VCB 268.500 (0,9R, 25/09) · VNM 250.560 (0,63R, 16/10) · MWG 237.830 (2,38R, 11/09) · SSI 81.140 (0,41R, 18/09).
- Đường vốn Shadow loại 7 lệnh vi phạm. Cảnh báo chênh lệch review >15 điểm % đang bật.
- Header Tổng quan: "6 lệnh chờ review · 0 lệnh chưa có 1R · 0 cảnh báo · 0 hồ sơ cần gắn lại · Đủ phí 30/30".

### 4.6 Hiệu suất theo setup (mỗi setup 10 lệnh / 8 review, winrate 60%, Wilson 95% = 31,27% → 83,18%, trạng thái "Chưa đủ mẫu")
| Setup | PF | Kỳ vọng | CI 95% |
| :--- | :--- | :--- | :--- |
| Hỗ trợ / Kháng cự | 0,57 | −0,15R | −0,93 → 0,57 |
| Breakout + Retest | 4,92 | 0,79R | −0,27 → 1,7 |
| Pullback xu hướng | 2,02 | 0,33R | −0,66 → 1,26 |

### 4.7 Theo dõi hệ thống (cửa sổ trượt)
- 20 lệnh gần nhất: kỳ vọng 0,34R, CI −0,3 → 0,94, PF 2,18, winrate 60%, "Chưa rõ tín hiệu".
- 50 lệnh gần nhất (có 30) và 100 lệnh gần nhất (có 30): kỳ vọng 0,32R, CI −0,23 → 0,87, PF 1,76, winrate 60%.
- Kỳ vọng toàn bộ mẫu: 0,32R.

### 4.8 Hồ sơ lệnh mẫu (VCB, 13/10)
Gross 180.000 → Net 159.620; Setup "Hỗ trợ / Kháng cự"; 1R = 200.000 (→ 0,8R); điểm kỷ luật 90; đã review.

### 4.9 Mốc bổ sung v4 (tính lại từ mục 4.4 và 4.5 ngày 2026-10-19 — chưa đối chiếu với giao diện thật)
- Lịch tháng 10/2026, cột tổng tuần (chỉ cộng các ngày thuộc tháng đang xem): Tuần 40 (1–4/10, phần thuộc tháng 10) = 833.530 · Tuần 41 (5–11/10) = 412.150 · Tuần 42 (12–18/10) = 143.950 · tổng 3 tuần = 1.389.630 = Net tháng 10.
- Chênh lệch tỷ lệ review: lỗ 12/12 = 100%, lãi 12/18 = 66,7%, chênh 33,3 điểm % (> 15 nên cảnh báo bật). Kịch bản kiểm thử T-R1: review thêm 3/6 lệnh lãi đang chờ → 15/18 = 83,3%, chênh 16,7, còn cảnh báo · thêm 4/6 → 16/18 = 88,9%, chênh 11,1, hết cảnh báo · thêm đủ 6/6 → chênh 0.
- Thời gian giữ lệnh TB: nếu C1 xác nhận đơn vị là giờ thì 234,33 giờ ≈ 9 ngày 18 giờ.
- Công thức suy ngược khớp số mốc: Hệ số phục hồi = Net ÷ Sụt giảm tối đa (3.302.290 ÷ 1.243.950 = 2,65) · Kỳ vọng lợi nhuận = Net ÷ số lệnh (3.302.290 ÷ 30 = 110.076,33) · Bào mòn lợi nhuận gộp = Phí ÷ Gross (1.027.710 ÷ 4.330.000 = 23,73%).

### 4.10 Mốc bổ sung v6 (Claude tính lại bằng code ngày 2026-10-19 — chưa đối chiếu với giao diện thật)
- Wilson 95% cho tỷ lệ thắng toàn bộ 18/30 = **42,32% → 75,41%** (CI rộng: mẫu 30 lệnh chưa đủ kết luận).
- Wilson 95% cho 6/10 = 31,27% → 83,18% — **khớp đúng mục 4.6**, xác nhận công thức Wilson (z = 1,96) đang dùng là chuẩn.
- Giá trị nền chính xác: PF = 1,7581 · Hệ số phục hồi = 2,6547 (hiển thị 2,65) · R của VCB 13/10 = 0,7981 (hiển thị 0,80R, mốc ghi 0,8R).
- 234,33 giờ = 14.059,8 phút = 9,764 ngày (9 ngày 18 giờ 18 phút). Lõi lưu thời gian giữ lệnh bằng **phút**; mặc định hiển thị **giờ** để giữ mốc 234,33.
- Tổng tháng 9 + tháng 10 = 1.912.660 + 1.389.630 = 3.302.290 ✔ · Tổng 3 tuần lịch tháng 10 = 833.530 + 412.150 + 143.950 = 1.389.630 ✔ (đã tính lại độc lập từ 12 ngày ở mục 4.4).
- **Dung sai so sánh golden:** tiền VND ≤ 0,5 đ · hệ số/R 2 chữ số ≤ 0,005 · phần trăm ≤ 0,05 điểm % · số nguyên (đếm lệnh, chuỗi) phải khớp tuyệt đối. So theo giá trị nền, không so chuỗi hiển thị (nguyên tắc 9).
- **Chưa xác minh được từ số liệu tổng hợp (đánh dấu `TODO-VERIFY` trong test, lấy từ file sao lưu v3 hoặc "Cách tính" web cũ):** định nghĩa "lệnh vi phạm" (7 lệnh bị loại khỏi đường Shadow), công thức "Chỉ số ổn định 0,22", "Kỷ luật trung bình 85%", "5 lệnh lãi lớn nhất 52,6%", "Sụt giảm hiện tại 639.220" (cần thứ tự đóng lệnh từng lệnh).

> **Ghi chú v6 về cách đọc backlog gốc (mục 5, 5B, 5C bên dưới là nguyên văn v5):** vì v6 chọn hướng **dựng lại sạch** (mục 0.1 điểm 1), các việc **F01→F10 là tiêu chí nghiệm thu của bản mới** (bản mới phải không có các lỗi đó và phải đạt hành vi mô tả), không phải thao tác sửa trên mã cũ. Các ID khác giữ nguyên ý nghĩa. Ma trận ID → Sprint ở mục 5H.2.


---

## 5. BACKLOG — VIỆC CẦN SỬA / LÀM
Quy ước trạng thái: [ ] chưa làm · [~] đang làm · [x] xong · [-] đã hủy theo quyết định người dùng (ghi ngày + ghi chú vào mục 7).

### P0 — Lỗi hiển thị & logic (làm trước, rủi ro thấp)
- [ ] F01 — Placeholder checklist lộ ký tự \n. Trang Quy trình setup, ô "Checklist (mỗi dòng: tiêu chí | trọng số)" đang hiện Đúng xu hướng | 2\nĐủ điều kiện vào lệnh | 3. Xong khi: placeholder hiện 2 dòng thật.
- [ ] F02 — "Nhập gần nhất" hiện chuỗi ISO UTC. Trang Theo dõi hệ thống hiện 2026-10-19T06:29:55.037Z. Xong khi: hiện theo giờ Việt Nam, ví dụ 13:29 19/10/2026 (06:29:55Z = 13:29:55 GMT+7).
- [ ] F03 — Thiếu đơn vị/nhãn. "Thời gian giữ lệnh TB = 234,33" chưa có đơn vị (phút/giờ/ngày?). "Chuỗi hiện tại = 1" chưa nói đang thắng hay thua. Xong khi: có đơn vị rõ ràng (kiểm tra theo C1, hỗ trợ đổi Phút/Giờ/Ngày theo E03) và nhãn "thắng/thua".
- [ ] F04 — Thống nhất ký hiệu tiền. Đang lẫn "đ" và "VND", và có số lẻ (425.462,78 đ). Xong khi: một ký hiệu duy nhất cho từng đồng tiền của sổ (với sổ VND làm tròn đến đồng; với sổ USD/USDT giữ 2 số lẻ theo E02; R vẫn giữ 2 chữ số thập phân). Không được đổi giá trị tính toán, chỉ đổi cách hiển thị.
- [ ] F05 — Quy tắc cảnh báo chưa hoạt động. Header ghi "0 cảnh báo" trong khi có 8/30 lệnh ≤ −1R và MWG (15/10) lỗ −2,35R. Xong khi: có rule cấu hình được: lệnh lỗ vượt 1R (có dung sai phí theo C2), vượt lỗ tối đa/ngày, vượt số lệnh/ngày, sụt giảm hiện tại vượt ngưỡng. Với dữ liệu mốc, cảnh báo "lỗ vượt 1R" phải bắt được MWG (15/10) kèm ID lệnh duy nhất (theo C3).
- [ ] F06 — Bảng phân bố R không theo thứ tự. Đang là 0→1R, 2→3R, −1R→0, 1R→2R, ≤−1R. Xong khi: sắp tăng dần (≤−1R … ≥3R) và vẽ thành histogram (nhấn mạnh cảnh báo các lệnh lỗ ngoại lai phía đuôi trái theo E08); số liệu giữ nguyên theo mục 4.3.
- [ ] F07 — Đường vốn thiếu trục giá trị. Xong khi: có trục Y (VND / % / R theo E02), lưới nhạt, tooltip theo ngày/lệnh; thêm biểu đồ drawdown (underwater theo VND, và mở khóa % khi có vốn ban đầu theo C8 & E02).
- [ ] F08 — Trùng lặp nội dung. Tổng quan và Trading MetriX gần như cùng hơn 20 thẻ KPI; bảng "Hiệu suất theo setup" xuất hiện ở 3 trang (Quy trình setup, Lợi thế thống kê, Theo dõi hệ thống). Xong khi: Tổng quan còn 6–8 KPI + đường vốn + lịch mini + cảnh báo; MetriX giữ phần chi tiết; bảng setup chỉ ở một nơi, nơi khác chỉ link.
- [ ] F09 — Ô "Lỗi đã ghi nhận" nhập tay bằng dấu phẩy trong khi đã có nút phím tắt 1–9 (FOMO, Dời SL, Nhồi lệnh, Trả thù, Vào sớm, Thoát sớm, Quá rủi ro, Sai setup, Mất tập trung). Xong khi: hiển thị dạng chip (phân 3 nhóm Điểm vào / Quản lý / Điểm thoát theo E05), bấm/gõ 1–9 là thêm/bỏ chip, vẫn lưu cùng cấu trúc dữ liệu cũ (không mất dữ liệu cũ).
- [ ] F10 — Lịch giao dịch. Thêm cột/dòng tổng theo tuần, tô màu theo cường độ lãi/lỗ, hiển thị số lệnh thắng/thua trong ngày, hỗ trợ bấm vào ô ngày để lọc bảng lệnh (theo E10). Net tháng phải giữ 1.389.630.

### P1 — Đạt chuẩn một journal đa thị trường chuyên nghiệp
- [ ] G01 — Biểu đồ giá trong hồ sơ lệnh với marker điểm vào/ra (cần nâng schema theo C5 và chốt nguồn dữ liệu giá nến OHLC theo C6).
- [ ] G02 — Đính kèm ảnh chụp biểu đồ/ghi chú trong hồ sơ lệnh (tối đa 6 ảnh hoặc dán link TradingView kèm mô tả ngắn cho từng ảnh theo E10).
- [ ] G03 — Tag đa chiều + trạng thái cảm xúc + 20 khe Thống kê Tùy chỉnh (Custom Statistics theo E09) cho mỗi lệnh.
- [ ] G04 — Trading plan có quy tắc (số lệnh/ngày, lỗ tối đa/ngày, setup được phép, khung giờ) và tự tính điểm checklist/tuân thủ cho lệnh mới hoặc hiển thị song song (không ghi đè "Điểm kỷ luật 0–100" cũ theo C4).
- [ ] G05 — Báo cáo đa chiều (Evaluator & Drill-down): thêm các cách "Phân nhóm" đa cấp theo giờ/khung 10–30 phút, thứ trong tuần (chọn theo ngày vào hoặc ngày ra), mã, thị trường, thời gian giữ, kích thước vị thế, lỗi, R-bucket; thêm MFE/MAE (Updraw/Drawdown theo C7 & E07).
- [ ] G06 — Mẫu import CSV đa thị trường (CTCK Việt Nam, MT4/MT5 cho Forex/CFD/Vàng, Binance/OKX/Bybit cho Crypto, TradingView/cTrader; chờ file mẫu thật theo C12).
- [ ] G07 — Báo cáo tuần/tháng xuất PDF.

### P2 — Hạ tầng (Local-first, không đăng nhập)
- [-] H01 — [ĐÃ HỦY 2026-10-19] Tài khoản đăng nhập + đồng bộ đám mây mã hóa (Người dùng quyết định bỏ phần đăng nhập, giữ 100% dữ liệu trên thiết bị; thay bằng quản lý Đa sổ nhật ký cục bộ E01 và quy trình sao lưu QT05).
- [ ] H02 — PWA/giao diện điện thoại (cần kiểm tra responsive trước; cho phép cài ứng dụng offline trên máy tính/điện thoại).
- [ ] H03 — Xuất file báo cáo tĩnh / ảnh chụp chỉ đọc để chia sẻ khi cần (không cần server tài khoản).

### P3 — Khác biệt hóa
- [ ] I01 — Trợ lý truy vấn dữ liệu "có nguồn" (rule-based query nội bộ, dẫn về từng ID lệnh theo C3 & C9, tuân thủ nguyên tắc 4 ở mục 3).
- [ ] I02 — What-if dựa trên đường Shadow (lọc thử loại bỏ lỗi/chọn setup theo C10, giữ nguyên cảnh báo thiên lệch >15%) + Chiến lược thay thế (Alternative Strategies theo E11).
- [ ] I03 — Replay nhẹ bằng nến OHLC (chờ chốt C5, C6; không làm tick 250ms/Level II).

### P4 — Trang giới thiệu
- [ ] J01 — Landing page: hero + lời hứa giá trị (Nhật ký Đa thị trường · Lưu trữ 100% trên thiết bị, không cần đăng nhập), 3 trụ cột (Lập kế hoạch → Đo lường → Bảo vệ vốn), nguồn dữ liệu hỗ trợ, hướng dẫn, "Có gì mới" (Changelog), điều khoản & miễn trừ rủi ro, nút dùng thử ngay.
- [ ] J02 — Hỗ trợ quy tắc Đa thị trường: Cổ phiếu VN (thuế bán 0,1%, lô 100, T+2), Phái sinh VN30F (nhân 100.000 đ, phí HNX/VSDC), Crypto Futures (Funding/Maker-Taker), Forex/Hàng hóa/CFD (Lot/Pip/Swap).

### P5 — Chuẩn hóa giao diện (chỉ đổi cách hiển thị; chuẩn chi tiết ở 5D.2)
- [ ] UI01 — Thẻ KPI chuẩn (6 thành phần: nhãn · giá trị · đơn vị · mẫu n=x/N · huy hiệu Đủ/Chưa đủ mẫu · nút Cách tính & Cách đọc).
- [ ] UI02 — Chuẩn định dạng số/ngày/đơn vị dùng chung toàn hệ thống (hỗ trợ đa tiền tệ VND/USD/USDT và đổi đơn vị thời gian giữ lệnh).
- [ ] UI03 — Chuẩn biểu đồ (trục Y, lưới, tooltip ngày + ID lệnh, chú giải, nhãn n=, nhãn MINH HỌA, đường Shadow nét đứt).
- [ ] UI04 — Khung trạng thái dùng chung (trống · đang tải · thiếu dữ liệu · chưa đủ mẫu · dữ liệu minh họa · lỗi nhập).
- [ ] UI05 — Điều hướng & thanh lọc (menu 4 nhóm; nút Thêm giao dịch luôn thấy; thanh lọc toàn cục có toán tử AND/OR; dòng trạng thái đầu trang bấm được).
- [ ] UI06 — Responsive & khả dụng (360 / 768 / 1280 px; lãi/lỗ kèm dấu +/− hoặc ▲▼; phím 1–9 không kích hoạt trong ô nhập; hỗ trợ sửa nhanh trên dòng Inline Editing và đánh dấu Sao lệnh).
- [ ] UI07 — Rà soát vùng chưa xem (Định giá doanh nghiệp, Kết nối dữ liệu, Cài đặt & sao lưu, form Thêm giao dịch, tooltip biểu đồ, ô Phân nhóm).

### P6 — Chuẩn hóa quy trình hệ thống (chuẩn chi tiết ở 5D.3)
- [ ] QT01 — Chốt bản chuẩn (nguồn chân lý): 1 repo + 1 nơi triển khai.
- [ ] QT02 — Vòng đời lệnh chuẩn (5 trạng thái: Mới nhập · Thiếu dữ liệu · Chờ review · Đã review · Cần gắn lại; bổ sung kiểm soát Khối lượng mở Open Quantity = 0 khi Scale In/Out theo E04).
- [ ] QT03 — Hàng đợi review chuẩn (giữ cân bằng lãi/lỗ, kiểm thử theo kịch bản T-R1 ở mục 4.9).
- [ ] QT04 — Quy trình nhập dữ liệu chuẩn (FIFO → UnifiedTrade, xem trước, xác nhận, báo cáo đợt, hoàn tác theo đợt + công cụ Gộp lệnh thủ công Merge Trades theo E04).
- [ ] QT05 — Sao lưu & phiên bản dữ liệu (nhắc sao lưu định kỳ, nâng schema v3 → v4 an toàn, quản lý đa sổ nhật ký cục bộ).
- [ ] QT06 — Quản trị cấu hình ở Cài đặt (ngưỡng cảnh báo, vốn ban đầu & sổ nạp/rút, chế độ xóa mềm Disabled Icons không làm mất dữ liệu lịch sử theo E01).
- [ ] QT07 — Quy trình nghiệm thu mỗi việc (8 bước ở 5D.3c).
- [x] QT08 — Chuẩn tên file & bàn giao (`NHAT_KY_SUA_LOI_Trading_Plan_Pro_vN.md`). Xong 2026-10-19.

### P7 — Chuẩn hóa nội dung (bản nháp ở 5D.4)
- [ ] ND01 — Bảng thuật ngữ chuẩn (bổ sung thuật ngữ đa thị trường: Lot, Pip, Funding, Swap, Updraw, OTP Hit, Tiltmeter).
- [ ] ND02 — Thông điệp chuẩn cho trạng thái, cảnh báo, xác nhận.
- [ ] ND03 — Mẫu ghi chú chuẩn (Mẫu lệnh · Mẫu ngày · Mẫu phiên review tuần/tháng).
- [ ] ND04 — Danh mục chuẩn Setup & Lỗi (3 setup + 9 lỗi chia làm 3 khâu Entry / Management / Exit).
- [ ] ND05 — Nội dung "Cách tính & Cách đọc" cho mọi chỉ số (khung 4 dòng).
- [ ] ND06 — Nội dung pháp lý & mô tả Đa thị trường cho landing page.

### P8 — Tính năng Nâng cao Đa thị trường học từ Edgewonk (chi tiết ở mục 5E)
- [ ] E01 — Quản lý Đa Sổ Nhật ký cục bộ (Multi-Journal trên trình duyệt, nhân bản cấu hình sổ, xóa mềm danh mục Disabled Icons).
- [ ] E02 — Sổ Nạp/Rút vốn (Deposits & Withdrawals) + Nút chuyển đổi hiển thị toàn cục (Tiền tệ / % Return / R-Multiple).
- [ ] E03 — Cấu hình Đa thị trường trên từng Sổ/Lệnh (Cổ phiếu, Phái sinh, Crypto, Forex/CFD, Hàng hóa) + Nút đổi đơn vị Thời gian giữ lệnh (Phút / Giờ / Ngày).
- [ ] E04 — Scale In & Out (nhiều lần vào/ra trong 1 lệnh, tính giá TB và khối lượng mở) + Công cụ Gộp lệnh trùng/lẻ (Merge Trades).
- [ ] E05 — Phân nhóm Nhận xét 3 khâu (Entry / Management / Exit) có trọng số Tích cực/Tiêu cực/Trung tính + Thanh Tiltmeter & Biểu đồ Efficiency (% tuân thủ theo thời gian).
- [ ] E06 — Trường 1 chạm "OTP Hit" (Chạm TP gốc trước SL gốc?) + Biểu đồ Quản lý lệnh (Actual R vs. Set-and-Forget Potential R & Management Effect).
- [ ] E07 — Biểu đồ Phân tích Điểm thoát (Exit Analysis: cột xanh Updraw % về phía TP, cột đỏ Drawdown % về phía SL, chấm Kim cương đen tại điểm thoát thực tế) từ giá Highest/Lowest.
- [ ] E08 — Đường vốn Đa lớp (bật/tắt đường Trước phí vs. Sau phí; phủ nền Tiltmeter; vẽ đè đường Trung bình động Equity MA-20/50; gộp điểm theo Lệnh hoặc theo Ngày).
- [ ] E09 — Bảng Phân tích Khoan sâu Đa cấp (Multi-level Drill-down Table, kéo thả đảo chiều cấp 1/cấp 2) + 20 khe Thống kê Tùy chỉnh (Custom Statistics) + Chế độ so sánh 2 biểu đồ cạnh nhau (Side-by-Side).
- [ ] E10 — Báo cáo Tháng xổ xuống Tuần kèm Mũi tên Xu hướng (so sánh 2 tuần gần nhất) + Thư viện ảnh trực quan Chartbook + Hỗ trợ dán URL ảnh TradingView kèm mô tả từng ảnh.
- [ ] E11 — Luồng Lệnh Dự kiến (Planned Trades) → chuyển 1 chạm sang Nhật ký thật hoặc Sổ Lệnh Bỏ lỡ (Missed Trades Journal) + Bảng Chiến lược Thay thế (Alternative Strategies).
- [ ] E12 — Trình Mô phỏng Tương lai (Monte Carlo Simulator từ Winrate, R-multiple và Bootstrap sẵn có) + Hệ thống Cột mốc Kỷ luật (Milestones 9 khía cạnh).


---

## 5B. HIỆU CHỈNH SAU RÀ SOÁT (2026-10-19 14:33, cập nhật đa thị trường ở v5) — ĐỌC TRƯỚC KHI LÀM
| # | Việc liên quan | Hiệu chỉnh |
| :--- | :--- | :--- |
| **C1** | F03, E03 | Với 30 lệnh giả lập hiện tại (HPG, FPT, VCB, VNM, MWG, SSI trải 07/09–16/10 ~39 ngày), số `234,33` nhiều khả năng được tính bằng **giờ** (≈ 9 ngày 18 giờ). Cách xác định: mở code/"Cách tính" để đọc đơn vị gốc, không đổi số `234,33`. Sau khi hiển thị đúng đơn vị gốc cho dữ liệu mốc, bổ sung nút chuyển đổi hiển thị **Phút / Giờ / Ngày** (E03) để hỗ trợ giao dịch đa thị trường (Scalping/Intraday/Swing). |
| **C2** | F05 | Quy tắc "lỗ vượt 1R" cần dung sai hoặc tính trên R gộp, vì phí và trượt giá làm R ròng thấp hơn −1R một chút. Với dữ liệu mốc, chỉ chắc chắn lệnh MWG 15/10 (−2,35R) phải bị bắt. Không đưa tổng số cảnh báo ("7 lệnh khác") vào tiêu chí kiểm thử cứng. |
| **C3** | F05, I01 | Dùng **ID lệnh duy nhất** khi trích dẫn, không chỉ dùng mã giao dịch. MWG, VCB, SSI, HPG đều xuất hiện ≥ 2 lần với kết quả khác nhau. |
| **C4** | F09, G04, E05 | Không ghi đè "Điểm kỷ luật" nhập tay cũ, vì sẽ làm đổi số mốc "Kỷ luật trung bình 85%". Giữ điểm cũ ở dạng legacy; điểm Checklist Setup, Điểm tuân thủ Plan và thanh Tiltmeter (E05) hiển thị song song hoặc áp cho lệnh mới. |
| **C5** | G01, E04, E07 | Cần nâng schema Sổ dữ liệu v3 → v4 với migration không phá dữ liệu, sao lưu trước khi nâng, vẫn đọc được v3. Schema v4 bổ sung: loại thị trường (`marketType`), tiền tệ (`currency`), mảng khớp lệnh (`legs` cho Scale In/Out), `entryPrice`, `exitPrice`, `quantity`, `plannedSL`, `plannedTP`, `highestPrice`, `lowestPrice`, `otpHit`. |
| **C6** | G01, I03 | Nguồn nến OHLC chưa được chọn. Chưa chốt thì chưa làm G01, I03; ưu tiên làm trước E06 (OTP Hit) và E07 (Exit Analysis từ Highest/Lowest nhập tay hoặc CSV) vì không phụ thuộc API nến. |
| **C7** | G05, E07 | MAE/MFE (Updraw/Drawdown) chỉ cần Highest Price và Lowest Price trong thời gian giữ lệnh (theo E07). |
| **C8** | F07, E02 | Drawdown tính theo % cần vốn gốc. Bổ sung bảng "Vốn ban đầu & Nạp/Rút" ở Cài đặt (E02); khi chưa nhập vốn gốc thì chỉ hiển thị theo tiền tệ (VND). |
| **C9** | I01 | Trợ lý phân tích ưu tiên chạy bằng thuật toán truy vấn nội bộ (rule-based) ngay trên trình duyệt, không gửi dữ liệu ra LLM ngoài khi chưa xin phép. |
| **C10** | I02, E12 | Phân biệt rõ 3 công cụ: (1) Bộ lọc đường vốn Shadow (loại lỗi/chọn setup); (2) Chiến lược thay thế (Alternative Strategies - nhập thử kết quả nếu dùng Trailing Stop theo E11); (3) Monte Carlo Simulator (phóng chiếu ngẫu nhiên 50–500 lệnh tương lai theo E12). |
| **C11** | J02, G06, E03 | Hỗ trợ bộ quy tắc phí/thuế theo từng loại thị trường: Cổ phiếu VN (T+2, lô 100, thuế bán 0,1%); Phái sinh VN30F (nhân 100.000 đ/điểm, phí HNX 2.700 đ/HĐ/lượt, phí qua đêm VSDC 2.550 đ/HĐ/ngày); Crypto (Maker/Taker, Funding); Forex/CFD/Hàng hóa (Lot, Commission, Swap). |
| **C12** | G06, E04 | Chờ file CSV mẫu thực tế của người dùng cho từng nền tảng; kết hợp tự động gom FIFO khi import (QT04) và nút gộp lệnh thủ công Merge Trades (E04). |
| **C13** | I02, I01 | Tham chiếu đúng tên gọi tính năng của TraderSync và Edgewonk. |

## 5C. ĐẶC TẢ CHI TIẾT RÚT RA TỪ VIDEO REVIEW TRADERSYNC (2026-10-19 14:47)
(Giữ nguyên 8 điểm V1 → V8 từ phiên bản v3/v4: V1 Thanh bộ lọc toàn cục · V2 Ghi chú 2 cấp độ Ngày/Lệnh & Nút chèn mẫu ghi chú chuẩn · V3 Bảng Evaluator kiểu Pivot Chart · V4 Giao diện Trading Plan & Đường vốn Tuân thủ Shadow · V5 Lịch giao dịch kèm cột thống kê tuần · V6 Kiểm soát gắn tag lỗi thủ công bằng Chip 1–9 · V7 Trợ lý truy vấn dữ liệu nội bộ · V8 Mọi chỉ số/biểu đồ mới đều có "Cách tính & Cách đọc" bằng tiếng Việt, không làm tính năng nửa vời thiếu tài liệu).


---

## 5D. BỐ CỤC CHUẨN · THÀNH PHẦN GIAO DIỆN · QUY TRÌNH · NỘI DUNG (DỰNG LẠI ĐẦY ĐỦ Ở v6)
> v5 ghi "giữ nguyên 5D.1→5D.5 của v4" nhưng nội dung đó không còn trong file. Phần này **dựng lại đầy đủ từ các tham chiếu còn sót** (UI01→UI07, QT01→QT08, ND01→ND06, F08, F09, V1→V8) và được xem là **đề xuất chuẩn**. Nếu chủ dự án còn bản v4 gốc, bản gốc thắng khi mâu thuẫn; ghi sự khác biệt vào mục 7.

### 5D.0 Phễu phân tích 5 tầng & 7 câu hỏi cốt lõi (xương sống của bố cục)
Mỗi trang/biểu đồ phải trả lời **một** trong 7 câu hỏi dưới đây; trang nào không thuộc tầng nào thì không nên tồn tại. Thứ tự lướt xuống của người dùng = tầng 1 → 5.

| Tầng | Câu hỏi cốt lõi | Trang chủ (single-home) | Chỉ số / biểu đồ chính |
| :--- | :--- | :--- | :--- |
| 1. Sức khỏe tài khoản | **Q1.** Tôi đang lãi hay lỗ sau phí? | Tổng quan | Net, đường vốn, Drawdown, lịch mini |
| 2. Bằng chứng lợi thế | **Q2.** Đã đủ bằng chứng có lợi thế chưa? | Lợi thế thống kê | Winrate (Wilson), Kỳ vọng R (bootstrap), PF, huy hiệu mẫu n |
| 3. Nguồn gốc lợi thế | **Q3.** Lợi thế đến từ setup / thị trường / khung giờ nào? | Phân tích khoan sâu (Evaluator) | Drill-down đa cấp, 20 Custom Stats, so sánh cạnh nhau |
| 4. Rò rỉ lợi nhuận | **Q4.** Tôi mất tiền ở đâu (phí, lỗi hành vi, thoát sớm, đuôi trái)? | Lợi nhuận & rủi ro · Kỷ luật & Quản lý lệnh | Gross→Phí→Net, phân bố R, chip lỗi theo khâu, Exit Analysis, OTP, Management Effect |
| 5. Hành động | **Q5.** Tôi có tuân thủ plan không? **Q6.** Rủi ro đuôi/drawdown thế nào? **Q7.** Việc cần làm tiếp theo? | Hôm nay & Kế hoạch · Theo dõi hệ thống · Ghi chú & Review | Compliance/Tiltmeter, cảnh báo, hàng đợi review, cửa sổ trượt 20/50/100, Monte Carlo |

### 5D.1 Sơ đồ điều hướng (menu 4 nhóm) & Bản đồ vai trò trang
Nút **[+ Thêm giao dịch]** và **bộ chuyển Sổ nhật ký ▾** luôn hiện ở thanh đầu trang (UI05).

| Nhóm | Trang | Ghi chú |
| :--- | :--- | :--- |
| **HÔM NAY** | Tổng quan · Kế hoạch & Lệnh dự kiến (G04, E11) | Trang mở đầu mỗi phiên |
| **NHẬT KÝ** | Nhật ký giao dịch · Lịch giao dịch · Ghi chú & Review · Chartbook (E10) | Nơi ghi sự thật |
| **PHÂN TÍCH** | Lợi thế thống kê · Phân tích khoan sâu (E09) · Lợi nhuận & rủi ro · Kỷ luật & Quản lý lệnh (E05–E07) · Trading MetriX · Theo dõi hệ thống · Mô phỏng & What-if (E11, E12, I02) | Theo thứ tự tầng 2→5 |
| **HỆ THỐNG** | Quy trình setup (Playbook) · Định giá doanh nghiệp (công cụ ngoài phạm vi journal — kiểm tra ở UI07) · Kết nối dữ liệu (Import) · Cài đặt & sao lưu | |

**Bản đồ vai trò trang — mỗi chỉ số/bảng có đúng MỘT "trang chủ" (nguyên tắc 10); trang khác chỉ hiện bản rút gọn + liên kết về trang chủ:**
| Chỉ số / bảng | Trang chủ | Trang khác được hiện |
| :--- | :--- | :--- |
| 6–8 KPI tóm tắt + đường vốn + lịch mini + cảnh báo + top 5 hàng đợi review | Tổng quan | — |
| Toàn bộ KPI chi tiết (20+) | Trading MetriX | Tổng quan chỉ link |
| Bảng hiệu suất theo Setup (PF, kỳ vọng, CI) | Lợi thế thống kê | Quy trình setup, Theo dõi hệ thống: chỉ link |
| Cửa sổ trượt 20/50/100 lệnh | Theo dõi hệ thống | — |
| Gross→Phí→Net, bào mòn, phân bố R (histogram), Drawdown/underwater, đường vốn Shadow + cảnh báo thiên lệch | Lợi nhuận & rủi ro | Tổng quan: công tắc Thực/Shadow |
| Chip lỗi theo khâu, Tiltmeter, Efficiency, Exit Analysis, OTP Hit, Management Effect | Kỷ luật & Quản lý lệnh | Hồ sơ lệnh hiện bản của từng lệnh |
| Hàng đợi review đầy đủ, ghi chú ngày/lệnh/tuần/tháng | Ghi chú & Review | Tổng quan: top 5 |
| Lịch tháng + cột tổng tuần | Lịch giao dịch | Tổng quan: lịch mini |
| Báo cáo Tháng→Tuần có ▲▼ | Lịch giao dịch (tab Báo cáo) | — |
| Monte Carlo, What-if, Alternative Strategies | Mô phỏng & What-if | — |
| Hồ sơ lệnh (ngăn kéo/drawer) | Mở từ mọi bảng lệnh | — |

### 5D.2 Chuẩn thành phần giao diện (UI01 → UI06)
**a) Thẻ KPI chuẩn — 6 thành phần (UI01):** ① nhãn · ② giá trị · ③ đơn vị · ④ mẫu `n=x/N` · ⑤ huy hiệu (Đủ mẫu / Mẫu nhỏ / Chưa đủ mẫu / Minh họa) · ⑥ nút **"Cách tính & Cách đọc"** (popover 4 dòng, mục 5D.4e). Thẻ không có đủ 6 thành phần = chưa đạt.

**b) Chuẩn định dạng (UI02, F02, F03, F04):**
| Loại | Quy tắc hiển thị | Ví dụ |
| :--- | :--- | :--- |
| Tiền VND | Dấu chấm nghìn, làm tròn đến đồng, ký hiệu duy nhất `đ`; giá trị nền giữ nguyên số lẻ | `425.463 đ` (nền 425.462,78) |
| Tiền USD / USDT | 2 số lẻ, ký hiệu `$` / `USDT` | `$1,234.57` |
| Âm / dương | Dấu `−` (U+2212) cho âm; bảng lãi/lỗ dùng `+`/`−` hoặc ▲▼, không chỉ dùng màu | `−1.243.950 đ` |
| R | 2 chữ số + hậu tố R | `0,32R` |
| Phần trăm | 1 chữ số thập phân (đề xuất Q7) | `60,0%` |
| PF / Hệ số | 2 chữ số | `1,76` |
| Ngày giờ | `dd/MM/yyyy HH:mm`, 24h, múi giờ Asia/Ho_Chi_Minh mặc định (cấu hình theo sổ); lưu ISO UTC nội bộ, **không bao giờ hiển thị ISO** | `13:29 19/10/2026` |
| Thời gian giữ lệnh | Chọn Phút / Giờ / Ngày (E03), mặc định **Giờ**; phụ chú tự động | `234,33 giờ (≈ 9 ngày 18 giờ)` |
| Chuỗi | Luôn có chiều | `1 lệnh thua`, `2 lệnh thắng` |

**c) Chuẩn biểu đồ (UI03, F06, F07):** trục Y có đơn vị · lưới nhạt · tooltip (ngày + **ID lệnh** + giá trị) · chú giải · nhãn `n=` · nhãn **MINH HỌA** khi là dữ liệu minh họa · đường giả định (Shadow…) **nét đứt + nhãn GIẢ ĐỊNH** · category theo thứ tự có nghĩa (R tăng dần) · bộ nút Tiền/%/R (E02) · zoom/pan khi > 100 điểm · xuất PNG · có bảng dữ liệu thay thế cho trình đọc màn hình.

**d) Khung trạng thái dùng chung (UI04):** trống (kèm nút hành động) · đang tải (skeleton) · thiếu dữ liệu (nêu trường thiếu + link sửa) · chưa đủ mẫu · dữ liệu minh họa (banner vàng cố định) · lỗi nhập (nêu dòng + cột + gợi ý sửa).

**e) Bảng lệnh:** tiêu đề dính (sticky) · sắp xếp đa cột · ẩn/hiện cột · **sửa nhanh trên dòng (Inline Editing)** cho trường an toàn (ghi chú, setup, chip lỗi, 1R) · chọn nhiều dòng (để Merge, E04) · đánh dấu **Sao ⭐** · virtual scroll từ 500 dòng · xuất CSV theo bộ lọc hiện tại.

**f) Thanh lọc toàn cục (V1, UI05):** Sổ · khoảng ngày (hôm nay/tuần/tháng/quý/YTD/tùy chọn) · thị trường · mã · setup · chiều · lỗi · kết quả · trạng thái review · tag; toán tử **AND/OR**; lưu thành "View" đặt tên; hiện chip bộ lọc đang áp dụng; áp dụng cho mọi trang phân tích; trạng thái lưu trên URL hash để chia sẻ/tải lại.

**g) Responsive & thao tác (UI06):** 3 điểm gãy 360 / 768 / 1280 px · mobile: thanh tab dưới 5 mục (Tổng quan · Nhật ký · ＋ · Phân tích · Menu) · phím tắt: `N` thêm lệnh, `/` tìm, `Ctrl+K` bảng lệnh nhanh (N06), `1–9` chip lỗi (**chỉ hoạt động khi không đang gõ trong ô nhập**), `[` `]` lệnh trước/sau, `R` đánh dấu đã review · giao diện sáng/tối theo hệ thống · tương tác chạm tối thiểu 44 px.

### 5D.3 Quy trình
**a) Vòng đời lệnh chuẩn — 5 trạng thái (QT02):**
| Trạng thái | Điều kiện vào | Chuyển tiếp |
| :--- | :--- | :--- |
| **Mới nhập** | Vừa tạo (tay hoặc import) | → Thiếu dữ liệu hoặc Chờ review (tự động kiểm tra) |
| **Thiếu dữ liệu** | Đã đóng nhưng thiếu trường bắt buộc: 1R, giá/khối lượng, phí, thị trường (đếm vào header "0 lệnh chưa có 1R", "Đủ phí 30/30") | → Chờ review khi đủ |
| **Chờ review** | Đủ dữ liệu, `Open Quantity = 0`, chưa review | → Đã review |
| **Đã review** | Có ghi chú review + chip 3 khâu (hoặc tick "không có gì để ghi") | → Chờ review nếu người dùng mở lại |
| **Cần gắn lại** | Setup/Lỗi/Thị trường bị ẩn hoặc không khớp danh mục sau khi sửa, hoặc import lỗi ánh xạ (header "0 hồ sơ cần gắn lại") | → Chờ review sau khi gắn lại |
Lệnh còn `Open Quantity > 0` là trạng thái phụ **"Đang mở"**: hiện ở Nhật ký, **không** tính vào thống kê đóng (E04).

**b) Nhịp làm việc chuẩn khi code (người/AI):** mỗi lượt làm **đúng một việc** → chạy QT07 → cập nhật nhật ký → mới sang việc kế. Không gộp nhiều việc P0 trong một lần giao.

**c) Quy trình nghiệm thu mỗi việc — 8 bước (QT07):** ① đọc đặc tả + chuẩn liên quan ② viết/cập nhật test trước (đơn vị + golden) ③ làm đúng một việc ④ chạy toàn bộ test, golden phải xanh ⑤ kiểm tra giao diện ở 360/768/1280 px, sáng/tối ⑥ kiểm tra nhãn Minh họa/Thật, đọc được sổ v3, không phá schema ⑦ cập nhật file nhật ký (đổi trạng thái, 1 dòng ở mục 7, sửa mục 1) ⑧ chụp ảnh/ghi lại bằng chứng, commit có tag `ID-việc`.

**d) Quy trình hằng ngày của trader (vòng lặp Plan → Execute → Record → Review → Measure → Adjust):**
| Thời điểm | Việc làm trong hệ thống | Thời lượng | Sản phẩm |
| :--- | :--- | :--- | :--- |
| **Trước phiên** | Mở "Hôm nay": đọc quy tắc Plan (số lệnh/ngày, lỗ tối đa/ngày, setup được phép, khung giờ); nhập **Lệnh dự kiến** (mã, chiều, vào, SL, TP, 1R); tick checklist setup; xem cảnh báo hôm trước | 5–10' | Lệnh dự kiến + điểm checklist |
| **Trong phiên** | Quick Add khi vào lệnh (1R tự tính); thêm leg khi Scale In/Out; bấm `1–9` gắn chip lỗi ngay khi nhận ra; banner cảnh báo khi chạm ngưỡng. **Không phân tích trong phiên.** | tối thiểu | Lệnh mở + chip |
| **Sau phiên** | Đóng lệnh: giá thoát, phí, Highest/Lowest, OTP Hit; đính ảnh (tối đa 6); chọn chip 3 khâu; viết Nhật ký ngày (mẫu ngày); review các lệnh đứng đầu hàng đợi cân bằng | 10–15' | Lệnh đủ dữ liệu + review |
| **Tuần (CN, 30')** | Mẫu review tuần; xem báo cáo Tuần ▲▼; setup tốt/xấu **theo CI, không theo cảm giác**; chọn **một** quy tắc cải thiện đo được, ghi vào Plan | 30' | 1 quy tắc tuần sau |
| **Tháng (60')** | Evaluator drill-down (Q3); Exit Analysis/OTP (Q4); Equity MA; rolling 20/50/100 (Q6); cập nhật Plan; **xuất sao lưu và cất ngoài máy** | 60' | Báo cáo tháng PDF (G07) + file sao lưu |
| **Quý** | Monte Carlo + What-if (nhãn GIẢ ĐỊNH); kiểm tra `n ≥ 50` trước khi kết luận lợi thế; Milestones | 60' | Quyết định giữ/bỏ/chỉnh setup |
Nguyên tắc: hệ thống **ghi và đo**; kết luận do người dùng viết (nguyên tắc 4).

**e) Hàng đợi review cân bằng (QT03):** mục tiêu giữ chênh lệch tỷ lệ review giữa lệnh lãi và lệnh lỗ ≤ 15 điểm % (nguyên tắc 3, 6). Thuật toán: ① tính tỷ lệ đã review của nhóm lãi `rW` và nhóm lỗ `rL` ② lấy ứng viên từ nhóm có tỷ lệ **thấp hơn**; hòa → nhóm lãi ③ trong nhóm, ưu tiên `|R|` lớn rồi ngày cũ ④ lặp lại sau mỗi lệnh được review. Kiểm thử T-R1 (mục 4.9): hiện 12/12 vs 12/18 → chênh 33,3 (cảnh báo bật); +3 lệnh lãi → 15/18, chênh 16,7 (còn cảnh báo); +4 → 16/18, chênh 11,1 (hết); đủ 6/6 → 0.

**f) Quy tắc cảnh báo cấu hình được (F05, C2, C3):**
| Quy tắc | Ngưỡng mặc định | Ghi chú |
| :--- | :--- | :--- |
| Lỗ vượt 1R | R ≤ −1R − dung sai (mặc định 0,10R do phí/trượt giá; tính thêm trên R gộp) | Dữ liệu mốc **phải bắt MWG 15/10 (−2,35R)**; mỗi cảnh báo trỏ **ID lệnh duy nhất**; không đưa tổng số cảnh báo vào test cứng |
| Lỗ tối đa/ngày | theo Plan (G04), ví dụ 2R hoặc số tiền | |
| Số lệnh/ngày | theo Plan | |
| Sụt giảm hiện tại | vượt X% vốn (khi có vốn, C8) hoặc X lần 1R trung bình | |
| Chuỗi thua | ≥ 3 lệnh liên tiếp (gợi ý nghỉ — không chặn) | liên kết Tiltmeter |
| Lệnh thiếu dữ liệu quá 48 giờ | 48 giờ | nhắc bổ sung |
Mỗi cảnh báo: mức (thông tin/cảnh báo/nghiêm trọng) · ID lệnh · nút "Xem lệnh" · có thể tạm ẩn có lý do (ghi nhật ký).

**g) Quy trình nhập dữ liệu (QT04):** chọn nền tảng/mẫu → tải CSV → ánh xạ cột (lưu mẫu ánh xạ) → phân tích cú pháp → ghép khớp **FIFO** thành `UnifiedTrade` (các khớp thành `legs`) → **xem trước** (hợp lệ / cảnh báo / lỗi, theo dòng + cột) → xác nhận → tạo **Đợt nhập** → báo cáo (mới / trùng bỏ qua / lỗi) → **hoàn tác theo đợt** bất cứ lúc nào. Khóa chống trùng: `broker + orderId`, thiếu thì `hash(symbol, thời gian, chiều, giá, khối lượng)`. Lệnh import thiếu SL/1R vào trạng thái "Thiếu dữ liệu". Có công cụ **Gộp lệnh thủ công** (E04).

### 5D.4 Chuẩn nội dung (ND01 → ND06)
**a) Danh mục Setup mặc định (ND04) và checklist mẫu (F01):** 3 setup: *Hỗ trợ / Kháng cự*, *Breakout + Retest*, *Pullback xu hướng*. Ô checklist nhận mỗi dòng `tiêu chí | trọng số`; placeholder hiển thị **2 dòng thật** (xuống dòng thật, không lộ `\n`):
```
Đúng xu hướng | 2
Đủ điều kiện vào lệnh | 3
```
Điểm checklist = Σ trọng số tiêu chí đạt ÷ Σ trọng số × 100 (hiển thị **song song** "Điểm kỷ luật (cũ)", không ghi đè — C4).

**b) 9 lỗi chuẩn chia 3 khâu (F09, E05, ND04):** phím `1–9`; mỗi lỗi mặc định sắc thái **Tiêu cực**.
| Khâu | Lỗi (phím) |
| :--- | :--- |
| **Điểm vào (Entry)** | FOMO (1) · Vào sớm (5) · Quá rủi ro (7) · Sai setup (8) · Trả thù (4) |
| **Quản lý lệnh (Management)** | Dời SL (2) · Nhồi lệnh (3) · Mất tập trung (9) |
| **Điểm thoát (Exit)** | Thoát sớm (6) |
Ngoài 9 lỗi còn có chip **Tích cực / Trung tính** do người dùng tạo theo từng khâu (E05). Khâu Exit chỉ có 1 lỗi gốc nên **đề xuất tùy chọn (tắt mặc định, cần duyệt):** *Giữ lệnh thua quá lâu*, *Không chốt theo kế hoạch*, *Thoát muộn*. Chip lưu cùng cấu trúc dữ liệu cũ (mảng mã lỗi), không mất dữ liệu cũ; chip bị xóa → chuyển "Đã ẩn" (E01).

**c) Bảng thuật ngữ song ngữ (ND01)** — nhãn chính tiếng Việt, thuật ngữ quốc tế trong ngoặc ở trang chi tiết/Cách tính:
Lãi/lỗ ròng (Net PnL) · Lãi/lỗ gộp (Gross) · Bội số rủi ro (R-Multiple) · 1R = số tiền rủi ro dự kiến mỗi lệnh · Kỳ vọng (Expectancy) · Hệ số lợi nhuận (Profit Factor) · Sụt giảm (Drawdown) · Hệ số phục hồi (Recovery Factor) · Tỷ lệ thắng (Win rate) · Khoảng tin cậy (CI, Wilson/Bootstrap) · Đường vốn Shadow (loại lệnh vi phạm) · Lot · Pip · Funding · Swap · Bước giá/Hệ số nhân (Multiplier) · Updraw/Drawdown lệnh (MFE/MAE) · OTP Hit (chạm TP gốc trước SL gốc) · Tiltmeter · Scale In/Out · Gộp lệnh (Merge) · Trung bình động vốn (Equity MA) · Mô phỏng Monte Carlo · n (cỡ mẫu).

**d) Thông điệp chuẩn (ND02):**
| Loại | Mẫu câu |
| :--- | :--- |
| Chưa đủ mẫu | "Mới có {n}/{20} lệnh — chưa phải bằng chứng có lợi thế." |
| Thiếu dữ liệu | "{k} lệnh thiếu {trường}. Bổ sung để tính chính xác." + link |
| Dữ liệu minh họa | "DỮ LIỆU MINH HỌA — không phản ánh hiệu suất thật." |
| Thiên lệch review | "Tỷ lệ review lệnh lãi/lỗ chênh {x} điểm % (>15): số liệu có thể thiên lệch chọn lọc." |
| Giả định | "GIẢ ĐỊNH — không phải kết quả thực." |
| Xác nhận xóa | "Ẩn '{tên}'? Lệnh cũ vẫn giữ nguyên. Có thể bật lại ở Cài đặt → Đã ẩn." |
| Hoàn tác nhập | "Hoàn tác đợt nhập {id}? {k} lệnh sẽ bị gỡ; dữ liệu khác không ảnh hưởng." |
| Sao lưu | "Lần sao lưu gần nhất: {ngày} ({k} ngày trước). Xuất ngay." |

**e) Khung "Cách tính & Cách đọc" — 4 dòng cho mọi chỉ số (ND05, V8):** ① **Là gì** (1 câu) ② **Cách tính** (công thức + mẫu số n) ③ **Cách đọc** (khoảng tốt/xấu, lưu ý cỡ mẫu) ④ **Không nói được gì** (giới hạn). Ví dụ — *Hệ số lợi nhuận (Profit Factor)*: ① tổng lãi chia tổng lỗ ② Σ lãi thắng ÷ |Σ lỗ thua| = 7.658.330 ÷ 4.356.040 = 1,76 (n=30) ③ >1 là có lãi gộp; nhưng với n<50 dao động lớn, xem kèm CI ④ không cho biết thứ tự lệnh, rủi ro đuôi hay lợi thế bền vững.

**f) Mẫu ghi chú chuẩn (ND03, V2) — nút "Chèn mẫu":**
- *Mẫu lệnh:* `Bối cảnh: … · Lý do vào (đúng setup?): … · Điều đã xảy ra (sự thật): … · Điều làm đúng: … · Điều lệch plan: … · Lỗi gắn chip: …`
- *Mẫu ngày:* `Tâm trạng/Thể trạng (1–5): … · Số lệnh/Net: … · Tuân thủ plan (có/không + lý do): … · Một việc làm tốt: … · Một việc sửa ngày mai: …`
- *Mẫu review tuần/tháng:* `Net & n: … · Setup nào đủ/chưa đủ mẫu: … · Lỗi lặp lại nhiều nhất (theo số lệnh): … · Quy tắc cải thiện duy nhất kỳ tới (đo được): … · Cách kiểm tra kỳ sau: …` — tất cả chỉ ghi sự thật, **không suy luận nguyên nhân tự động** (nguyên tắc 4).

**g) Nội dung pháp lý & landing (ND06, J01):** lời hứa giá trị "Nhật ký Đa thị trường · Lưu 100% trên thiết bị · Không cần đăng nhập"; 3 trụ cột "Lập kế hoạch → Đo lường → Bảo vệ vốn"; miễn trừ: không phải tư vấn đầu tư, hiệu suất quá khứ không đảm bảo tương lai, người dùng tự chịu trách nhiệm sao lưu dữ liệu.

### 5D.5 Wireframe các trang chính (ASCII — để ChatGPT dựng bố cục)
**Tổng quan (Q1):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☰ Tuan Trader  [Sổ: Minh họa 30 lệnh ▾] [Tiền | % | R] [Lọc ▾] [＋ Thêm giao dịch] │
│ ▸ 6 chờ review · 0 thiếu 1R · N cảnh báo · 0 cần gắn lại · Đủ phí 30/30   (bấm được) │
│ ⚠ DỮ LIỆU MINH HỌA (banner vàng, chỉ khi sổ minh họa)                         │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────────┤
│ Net      │ Winrate  │ PF       │ Kỳ vọng R│ Max DD   │ Kỷ luật  │ Phí/Gross │  ← 6–8 thẻ KPI (6 thành phần)
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴───────────┤
│ Đường vốn (Thực ── | Shadow ┄┄ GIẢ ĐỊNH) [Trước/Sau phí][MA20/50]  trục Y, tooltip │
│ Underwater drawdown (dưới đường vốn)                                         │
├───────────────────────────────────────┬─────────────────────────────────────┤
│ Lịch mini tháng (màu theo net)        │ Cảnh báo & Việc cần làm (top 5 review) │
└───────────────────────────────────────┴─────────────────────────────────────┘
```
**Nhật ký giao dịch + Hồ sơ lệnh (drawer bên phải):**
```
┌ Thanh lọc toàn cục ──────────────────────────────────────────────────────────┐
│ ☐ │ ⭐ │ ID │ Ngày │ Mã │ Thị trường │ Chiều │ Setup │ Net │ R │ Chip │ TT  │  ← sửa nhanh trên dòng
│ … chọn ≥2 dòng cùng Mã+Setup+Chiều → nút [Gộp lệnh]                          │
└──────────────────────────────────────────────────────────────────────────────┘
Drawer: [Tổng quan lệnh] Gross→Phí→Net · 1R · R · Tiltmeter · Điểm checklist + Điểm kỷ luật (cũ)
        [Legs] bảng Scale In/Out + giá TB + Open Quantity   [OTP Hit: Có/Không/Hòa]
        [Exit Analysis] Updraw xanh | Drawdown đỏ | ◆ điểm thoát   [Quản lý lệnh] Actual R vs Set-and-Forget R
        [Chip 3 khâu] Entry | Management | Exit (phím 1–9)   [Ảnh ≤6 + mô tả]   [Ghi chú: Chèn mẫu]
```
**Phân tích khoan sâu (Q3):** trái = bảng cây `Cấp 1 ▸ Cấp 2 ▸ …` (kéo-thả đảo cấp; cột n · Winrate+CI · PF · Kỳ vọng R · Net · huy hiệu mẫu); phải = biểu đồ tương ứng; nút **[So sánh cạnh nhau]** chia đôi màn hình; 20 khe Custom Stats ở tab riêng.

---


---

## 5E. ĐẶC TẢ MỞ RỘNG ĐA THỊ TRƯỜNG & TINH HOA TỪ VIDEO EDGEWONK (2026-10-19 15:30)
Nguồn tham chiếu: Video "Full Edgewonk Trading Journal Tour - All Features" (http://www.youtube.com/watch?v=rZWQT6f242M). Áp dụng 12 điểm sau để biến Trading Plan Pro thành nhật ký đa thị trường hoạt động 100% trên thiết bị:

1. **E01 — Đa Sổ Nhật ký Cục bộ (Unlimited Local Journals) & Xóa mềm (Soft-Delete):**
   - Menu góc phải cho phép tạo/chuyển đổi nhiều Sổ nhật ký độc lập trong IndexedDB/LocalStorage (ví dụ: Sổ Cổ phiếu VN, Sổ Phái sinh, Sổ Crypto, Sổ Forex, Sổ Minh họa 30 lệnh) và nhân bản cấu hình sang sổ mới.
   - Khi xóa một Setup, Lỗi hoặc Thống kê tùy chỉnh trong Cài đặt, chuyển vào mục "Đã ẩn (Disabled)" thay vì xóa cứng để bảo toàn lịch sử các lệnh cũ.
2. **E02 — Sổ Nạp/Rút Vốn & Chuyển đổi 3 Đơn vị Hiển thị Toàn cục (Tiền tệ / % / R):**
   - Trong Cài đặt mỗi sổ, quản lý Số dư ban đầu (Starting Balance) và lịch sử Nạp/Rút (Deposits/Withdrawals).
   - Ở đầu trang Tổng quan, Lịch và Biểu đồ, thêm bộ nút chuyển đổi hiển thị giữa **Tiền tệ gốc của sổ (VND/USD/USDT) · Phần trăm lợi nhuận (%) · Bội số rủi ro (R)**.
3. **E03 — Hồ sơ Đa Thị trường & Đổi Đơn vị Thời gian Giữ lệnh (Phút / Giờ / Ngày):**
   - Cho phép chọn loại thị trường (`Stocks`, `Futures/Phái sinh`, `Forex`, `Crypto`, `Commodities`, `CFD`, `Options`) và tự động bật các trường chi phí tương ứng (Phí giao dịch, Thuế, Funding/Swap/Margin ở mục 4.2).
   - Cho phép chuyển đổi đơn vị hiển thị Thời gian giữ lệnh giữa **Phút · Giờ · Ngày** trên thẻ KPI và biểu đồ phân tán (Holding Time Scatter).
4. **E04 — Scale In & Out (Vào/Ra nhiều phần) & Gộp Lệnh (Merge Trades):**
   - Trong form lệnh, nút `+` bên cạnh giá vào/ra mở bảng nhập nhiều lần khớp lệnh (Scale In/Out), tự tính giá vào/ra trung bình và kiểm soát `Khối lượng mở (Open Quantity)`; chỉ khi `Open Quantity = 0` mới tính là lệnh đã đóng.
   - Trên bảng Nhật ký, tích chọn ≥ 2 lệnh có cùng Mã, cùng Setup, cùng Chiều (Long/Short) sẽ bật nút **"Gộp lệnh (Merge Trades)"** để gom thành 1 lệnh nhiều phần và cộng dồn PnL.
5. **E05 — Nhận xét 3 Khâu (Entry / Management / Exit) & Thanh Tiltmeter:**
   - Chia các chip đánh giá hành vi vào 3 khâu: **Điểm vào (Entry)**, **Quản lý lệnh (Management)** và **Điểm thoát (Exit)** với 3 sắc thái: Tích cực (Xanh lá), Tiêu cực (Đỏ), Trung tính (Đen/Xám).
   - Hiển thị thanh **Tiltmeter** trên từng dòng lệnh và biểu đồ **Efficiency (% tuân thủ quy tắc theo thời gian)**, hoàn toàn tách biệt và không ghi đè "Điểm kỷ luật (cũ) = 85%" (tuân thủ C4).
6. **E06 — Nút 1 chạm "OTP Hit" & Biểu đồ Quản lý Lệnh (Actual vs. Set-and-Forget):**
   - Thêm trường `OTP Hit (Có / Không / Hòa vốn)` trả lời câu hỏi: *"Giá có chạm TP ban đầu trước khi chạm SL ban đầu không?"*.
   - Vẽ biểu đồ **Trade Management Graph** so sánh Đường R thực tế với Đường R thụ động (Set-and-Forget) và hiển thị chỉ số **Hiệu quả Quản lý Lệnh (Management Effect = ΔR)**.
7. **E07 — Biểu đồ Phân tích Điểm thoát (Exit Analysis: Updraw / Drawdown / Black Diamond):**
   - Từ 2 trường `Highest Price` và `Lowest Price` trong thời gian giữ lệnh, vẽ biểu đồ cột mỗi lệnh gồm phần Xanh (**Updraw**: % đi về phía TP), phần Đỏ (**Drawdown**: % đi ngược về phía SL) và **điểm Kim cương đen** chỉ vị trí giá thoát thực tế.
8. **E08 — Đường vốn Đa lớp (Phí, Tiltmeter, Đường Trung bình Động Equity MA) & Cảnh báo Đuôi trái:**
   - Trên biểu đồ Đường vốn, cho phép bật/tắt: (a) Đường vốn Trước phí vs. Sau phí; (b) Phủ nền Tiltmeter; (c) Đường Trung bình động của vốn (**Equity MA-20 / MA-50**) để nhận diện ngay khi phong độ gần đây cắt xuống dưới mức trung bình; (d) Chế độ gộp điểm theo Lệnh hoặc theo Ngày.
   - Trên biểu đồ Phân bố R (F06), tự động tô nổi bật vùng **Lỗ ngoại lai phía đuôi trái (Negative Left-Tail Outliers < -1R)**.
9. **E09 — Bảng Phân tích Khoan sâu Đa cấp (Drill-down), 20 Thống kê Tùy chỉnh & So sánh Cạnh nhau:**
   - Nâng cấp bảng thống kê thành dạng cây đa cấp (ví dụ: mở rộng Setup → xem Long/Short → xem Khung thời gian, hoặc đảo chiều cấp 1/cấp 2), hỗ trợ bộ lọc nâng cao `AND / OR`.
   - Cung cấp tới **20 khe Thống kê Tùy chỉnh (Custom Statistics)** do người dùng tự đặt tên và gắn giá trị.
   - Trong trang Phân tích, thêm chế độ **So sánh 2 biểu đồ cạnh nhau (Side-by-Side Comparison)**.
10. **E10 — Báo cáo Tháng/Tuần có Mũi tên Xu hướng, Chartbook & Quản lý 6 Ảnh/Lệnh:**
    - Bảng báo cáo Tháng cho phép bấm mở rộng ra từng Tuần kèm **mũi tên Tăng/Giảm (▲/▼)** so sánh hiệu suất của 2 tuần gần nhất.
    - Mỗi lệnh gắn được tới 6 ảnh (upload hoặc dán link ảnh TradingView) kèm mô tả ngắn cho từng ảnh; gom tất cả vào thư viện **Chartbook** (lọc theo Lệnh thực tế, Lệnh dự kiến, Lệnh bỏ lỡ).
11. **E11 — Lệnh Dự kiến (Planned Trades), Lệnh Bỏ lỡ (Missed Trades) & Chiến lược Thay thế:**
    - Lập danh sách Lệnh dự kiến trước phiên → bấm 1 nút chuyển sang Nhật ký chính hoặc chuyển sang **Sổ Lệnh Bỏ lỡ (Missed Trades)** kèm lý do bỏ lỡ và bảng so sánh Thực tế vs. Bỏ lỡ.
    - Thêm công cụ **Chiến lược Thay thế (Alternative Strategies)** cho phép nhập kết quả giả định trên từng lệnh của một Setup (ví dụ nếu dùng Trailing Stop) để so sánh với chiến lược hiện tại.
12. **E12 — Mô phỏng Tương lai (Monte Carlo Simulator) & Cột mốc Kỷ luật (Milestones):**
    - Tận dụng bộ máy Bootstrap sẵn có để dựng công cụ **Monte Carlo Simulator**: phóng chiếu 50–500 lệnh tương lai từ Winrate và R-multiple hiện tại thành chùm đường vốn dự phóng.
    - Thêm bảng **Milestones (9 cột mốc thói quen ghi nhật ký & kỷ luật)** với thanh tiến trình lên cấp (Level).

> **Ghi chú v6:** Thứ tự thực thi 'Đợt 0→5' của v5 được thay bằng Sprint S0→S9 ở mục 5H (ma trận ID → Sprint ở 5H.2). Nội dung E01→E12 bên trên giữ nguyên là đặc tả chi tiết.

---


---

## 5F. KIẾN TRÚC KỸ THUẬT · SCHEMA v4 · CÔNG THỨC CHUẨN · THỊ TRƯỜNG (MỚI v6)

### 5F.1 Stack đề xuất (ChatGPT dùng đúng stack này, không tự đổi)
| Lớp | Lựa chọn | Lý do |
| :--- | :--- | :--- |
| Khung | **Vite + React 18 + TypeScript (strict)** | Build tĩnh, deploy mọi nơi |
| Định tuyến | **HashRouter** | Host tĩnh không cần cấu hình rewrite; trạng thái lọc nằm trên URL hash |
| Dữ liệu | **IndexedDB qua Dexie** (+ dexie-react-hooks) | Dung lượng lớn, lưu được ảnh (Blob); localStorage giới hạn ~5 MB |
| Trạng thái UI | Zustand | Nhẹ |
| Biểu đồ | **Apache ECharts** | Histogram, lịch heatmap, scatter, markPoint (kim cương ◆), zoom, vùng bất định |
| Bảng | TanStack Table + TanStack Virtual | Sắp xếp/ẩn cột/virtual scroll |
| Form & kiểm tra | React Hook Form + Zod | Xác thực schema, dùng lại khi import/migration |
| Số học tiền | **decimal.js** trong `core/` | Tránh sai số dấu phẩy động (crypto 8 số lẻ, forex pip) |
| Ngày giờ | date-fns + date-fns-tz | Múi giờ theo sổ |
| CSV | PapaParse · ZIP: JSZip | Import / sao lưu kèm ảnh |
| PDF | CSS in (print stylesheet) + tùy chọn jsPDF | G07 không cần server |
| Kiểm thử | **Vitest** (đơn vị + golden) · **Playwright** (e2e + ảnh chụp 360/768/1280) · axe-core (a11y) | QT07 |
| PWA | vite-plugin-pwa (Workbox) | H02 offline |
| Tính nặng | Web Worker cho bootstrap & Monte Carlo | Không treo UI |
| Phương án đóng gói 1 file | `vite-plugin-singlefile` → một `index.html` | Dùng khi nơi deploy chỉ nhận 1 file (xem mục 11) |

### 5F.2 Cấu trúc thư mục
```
tuan-trader/
├─ src/
│  ├─ core/        # LÕI TÍNH TOÁN — hàm thuần, KHÔNG import React/Dexie
│  │  ├─ money.ts  r.ts  holding.ts  equity.ts  shadow.ts  alerts.ts  review-queue.ts
│  │  ├─ stats/    wilson.ts  bootstrap.ts  kpi.ts  drawdown.ts  streaks.ts  rolling.ts
│  │  ├─ analysis/ drilldown.ts  exit-analysis.ts  otp.ts  tiltmeter.ts  monte-carlo.ts  whatif.ts
│  │  ├─ fees/     stocks-vn.ts  futures-vn30f.ts  crypto.ts  forex.ts  profile.ts
│  │  └─ import/   fifo.ts  merge.ts  parsers/…
│  ├─ data/        # Dexie schema, migrations (v3→v4), repositories, backup/restore
│  ├─ ui/          # KpiCard, Chart*, StateFrame, FilterBar, TradeTable, TradeDrawer, ChipPicker…
│  ├─ pages/       # mỗi trang một thư mục, theo 5D.1
│  ├─ i18n/vi.json # mọi chuỗi hiển thị (để thêm 'en' sau)
│  └─ app/         # router, store, theme
├─ tests/  golden/{fixture-30-trades.json, golden.expected.json, golden.test.ts} · unit/ · e2e/
├─ docs/   NHAT_KY_SUA_LOI_Trading_Plan_Pro_vN.md · CHANGELOG.md
└─ public/ manifest.webmanifest · icons/
```
Quy tắc: `core/` không phụ thuộc UI/DB → chạy được trong test và Web Worker. Giao diện chỉ gọi `core/` rồi định dạng.

### 5F.3 Schema v4 (TypeScript — khung dữ liệu cho C5)
```ts
type Market = 'stocks'|'futures'|'forex'|'crypto'|'commodities'|'cfd'|'options';
type Currency = 'VND'|'USD'|'USDT';
type Dec = string;                       // số thập phân dạng chuỗi (decimal.js); thời gian = ISO UTC

interface Journal { id: string; name: string; currency: Currency; timezone: string;   // mặc định 'Asia/Ho_Chi_Minh'
  isDemo: boolean; startingBalance?: Dec; settings: JournalSettings; createdAt: string; archivedAt?: string; schemaVersion: 4 }

interface Trade {
  id: string;                            // UUID duy nhất — luôn dùng khi trích dẫn (C3)
  journalId: string; symbol: string; market: Market; side: 'long'|'short';
  status: 'open'|'closed'; legs: Leg[];  // ≥1 'in' + ≥0 'out' (Scale In/Out); đóng khi openQty = 0
  multiplier?: Dec; lotSize?: Dec;       // phái sinh/forex/CFD
  plannedSL?: Dec; plannedTP?: Dec; initialRisk?: Dec;   // initialRisk = 1R tính bằng tiền
  costs: { commission: Dec; tax: Dec; funding: Dec; swap: Dec; other: Dec }; costsKnown: boolean;
  highestPrice?: Dec; lowestPrice?: Dec; otpHit?: 'yes'|'no'|'breakeven';
  setupId?: string; errorTagIds: string[];              // mảng mã lỗi cũ — giữ nguyên (F09)
  stageChips?: { entry: string[]; management: string[]; exit: string[] };   // E05
  checklist?: { criterionId: string; checked: boolean }[];
  disciplineLegacy?: number;             // 0–100 nhập tay cũ — KHÔNG ghi đè (C4)
  tags: string[]; emotion?: string; starred: boolean;
  review: { done: boolean; at?: string; noteId?: string };
  attachments: { id: string; kind: 'blob'|'url'; blobKey?: string; url?: string; caption: string }[];  // ≤ 6 (E10)
  customStats: Record<string, string|number>;           // 20 khe (E09)
  importBatchId?: string; mergedFrom?: string[]; isDemo: boolean; createdAt: string; updatedAt: string;
}
interface Leg { id: string; kind: 'in'|'out'; time: string; price: Dec; quantity: Dec; fee?: Dec; synthetic?: boolean }
// KHÔNG lưu trường dẫn xuất: net, gross, R, holdMinutes, avgEntry, avgExit, openQty — luôn tính từ core/.

interface Setup { id; name; checklist: {id; text; weight: number}[]; disabledAt?: string }              // xóa mềm (E01)
interface ErrorTag { id; code; name; stage: 'entry'|'management'|'exit'; tone: 'pos'|'neg'|'neu'; hotkey?: 1|2|3|4|5|6|7|8|9; disabledAt?: string }
interface Plan { journalId; maxTradesPerDay?: number; maxLossPerDay?: {type:'R'|'money'; value: Dec}; allowedSetupIds: string[]; sessionWindows: {from:string; to:string}[]; alertRules: AlertRule[] }
interface CashFlow { id; journalId; date: string; type: 'deposit'|'withdrawal'; amount: Dec; note?: string }   // E02
interface ImportBatch { id; journalId; platform: string; fileName: string; at: string; tradeIds: string[]; stats: {added:number; skipped:number; errors:number} }
interface Note { id; journalId; scope: 'trade'|'day'|'week'|'month'; refId: string; body: string; templateId?: string; createdAt: string }
interface PlannedTrade { id; journalId; symbol; side; plannedEntry; plannedSL; plannedTP; setupId?; status: 'planned'|'taken'|'missed'|'cancelled'; missedReason?: string; takenTradeId?: string }  // E11
interface AltStrategy { id; setupId: string; name: string; hypotheticalR: {tradeId: string; r: Dec}[] }          // E11
interface CustomStatDef { slot: number /*1..20*/; name: string; kind: 'number'|'text'|'choice'; choices?: string[]; disabledAt?: string }
interface AppMeta { schemaVersion: 4; lastBackupAt?: string; lastOpenedAt: string; thresholds: {minSample: number /*20*/} }
```
Dexie: bảng `trades` có chỉ mục `id, journalId, [journalId+closedAt], symbol, setupId, status, review.done`. Mọi bảng có `journalId` để cô lập các sổ.

### 5F.4 Migration v3 → v4 (QT05, nguyên tắc 16)
> Web mới nằm ở **tên miền khác** nên **không đọc được localStorage/IndexedDB của web cũ** (trình duyệt cô lập theo nguồn gốc). Đường chuyển dữ liệu duy nhất: **xuất file sao lưu v3 từ web cũ → Nhập vào web mới.**
1. Phát hiện `schemaVersion: 3` trong file → kiểm tra bằng Zod → **lưu bản gốc nguyên vẹn vào kho "Bản sao lưu trước nâng cấp"** trước khi làm gì khác.
2. Ánh xạ: điểm kỷ luật cũ → `disciplineLegacy`; mã lỗi cũ → `errorTagIds`; ghi chú dạng "DỮ LIỆU GIẢ LẬP #n/30" → `isDemo = true`; `market` mặc định `stocks`, `currency` mặc định `VND`, múi giờ `Asia/Ho_Chi_Minh`; `initialRisk` từ 1R cũ; `costs` từ chênh lệch Gross − Net; nếu lệnh cũ chỉ có giá/khối lượng vào–ra → tạo 2 `legs` đánh dấu `synthetic: true`.
3. **Kiểm chứng:** chạy bộ golden trên sổ vừa nhập (nếu là sổ minh họa). Lệch dung sai → **hủy nhập**, giữ bản gốc, hiện báo cáo lệch từng chỉ số.
4. Trường v3 chưa biết cấu trúc → `TODO-VERIFY` với file sao lưu mẫu (mục 8); **không đoán**.

### 5F.5 Công thức chuẩn trong `core/` (một nguồn chân lý)
| Chỉ số | Công thức | Ghi chú |
| :--- | :--- | :--- |
| Giá vào/ra TB | Σ(giá × khối lượng) ÷ Σ khối lượng theo từng `leg` cùng loại | Scale In/Out (E04) |
| Gross mỗi lệnh | Cổ phiếu/crypto/forex: (ra TB − vào TB) × KL × (±chiều) · Phái sinh/CFD: × `multiplier` · Forex: theo pip/lot | |
| **Net** | Gross − commission − tax − funding − swap − other | Gross → Phí → Net (nguyên tắc 5) |
| **1R** | `initialRisk` nhập tay, hoặc `abs(vào TB − plannedSL) × KL × multiplier` | Thiếu → "Thiếu dữ liệu" |
| **R** | Net ÷ 1R | Nguyên tắc 13 |
| Thắng/Thua/Hòa | Net > 0 / < 0 / = 0 | Hòa vốn tách riêng, hiện n |
| Tỷ lệ thắng | Thắng ÷ (Thắng + Thua) | 18/30 = 60% |
| Wilson 95% | `c = (p + z²/2n)/(1+z²/n)`, `m = z·√(p(1−p)/n + z²/4n²)/(1+z²/n)`, z = 1,96 | Đã xác nhận khớp mục 4.6 |
| Lãi/Lỗ TB, Payoff | Σ lãi ÷ số thắng · Σ lỗ ÷ số thua · Lãi TB ÷ abs(Lỗ TB) | |
| **PF** | Σ lãi ÷ abs(Σ lỗ) | 1,7581 |
| Kỳ vọng (tiền) | Net ÷ N | 110.076,33 |
| Kỳ vọng (R) | trung bình R các lệnh có 1R | `TODO-VERIFY` 0,32R |
| Bootstrap CI | 2.000 lần lấy mẫu lại có hoàn lại, **PRNG có seed cố định** (mulberry32), phân vị 2,5 / 97,5 của trung bình R | ⚠ CI mốc 4.6/4.7 phụ thuộc PRNG + seed của web cũ: nếu không thu hồi được thuật toán gốc, test CI dùng **dung sai thống kê ±0,10R** và ghi rõ trong test |
| Đường vốn | Cộng dồn Net theo thứ tự đóng lệnh (gộp theo Lệnh hoặc Ngày — E08); có `startingBalance` + `CashFlow` thì tính cả %, và loại dòng tiền nạp/rút khỏi % lợi nhuận (E02) | |
| **Max Drawdown** | max(đỉnh chạy − vốn hiện tại) | 1.243.950 đ; % chỉ khi có vốn gốc (C8) |
| Sụt giảm hiện tại | đỉnh chạy − vốn hiện tại | `TODO-VERIFY` 639.220 |
| Hệ số phục hồi | Net ÷ Max DD | 2,6547 |
| Chuỗi | Duyệt theo thứ tự đóng: thắng/thua dài nhất + chuỗi hiện tại (kèm chiều) | 2 / 1 / 1 |
| Bào mòn lợi nhuận gộp | Σ phí ÷ Σ Gross | 23,73% |
| Thời gian giữ lệnh | (thời điểm `out` cuối − `in` đầu) tính **phút**; hiển thị đổi Phút/Giờ/Ngày | 234,33 giờ |
| Shadow | Đường vốn cộng dồn **loại lệnh "vi phạm"** (định nghĩa `TODO-VERIFY`: 7 lệnh ở mốc); luôn kèm cảnh báo thiên lệch review > 15 điểm % | Nhãn GIẢ ĐỊNH |
| Điểm checklist | Σ trọng số tiêu chí đạt ÷ Σ trọng số × 100 | Song song điểm cũ (C4) |
| Tiltmeter (đề xuất) | Mỗi lệnh: +1 mỗi khâu Tích cực, −1 mỗi khâu Tiêu cực, 0 Trung tính → thang −3…+3 hiển thị thanh | Chốt công thức với chủ dự án |
| Efficiency (đề xuất) | % lệnh **không có chip Tiêu cực** trong cửa sổ trượt 20 lệnh | |
| OTP / Potential R | OTP = `yes` → R tiềm năng = (TP − vào)/(vào − SL); `no` → −1R; `breakeven` → 0 | E06 |
| Management Effect | ΔR = R thực tế − R tiềm năng set-and-forget | Nhãn GIẢ ĐỊNH |
| Updraw / Drawdown lệnh | Long: Updraw% = (Highest − vào)/(TP − vào); Drawdown% = (vào − Lowest)/(vào − SL); ◆ = (ra − vào)/(TP − vào). Short: đảo dấu | E07, C7 |
| Equity MA-N | Trung bình động đơn giản N điểm của đường vốn (N = 20/50) | E08 |
| Monte Carlo | Lấy mẫu lại có hoàn lại từ dãy R (≥ 20 lệnh), 1.000 đường × 50–500 lệnh, rủi ro mỗi lệnh = f% vốn (mặc định 1%) hoặc 1R cố định; xuất dải phân vị 5/25/50/75/95, P(Net>0), p95 Max DD, xác suất chạm ngưỡng cháy | Nhãn GIẢ ĐỊNH + "không phải dự báo"; n < 50 hiện banner độ bất định |

### 5F.6 Quy tắc thị trường & chi phí (C11, J02) — dưới dạng **hồ sơ phí cấu hình được**
| Thị trường | Quy tắc / chi phí mặc định | Ghi chú |
| :--- | :--- | :--- |
| Cổ phiếu VN | Lô 100; thuế bán 0,1% giá trị bán; phí môi giới theo CTCK (người dùng nhập); T+2 | Không bán khống; cảnh báo lệnh bán trước T+2 |
| Phái sinh VN30F | Hệ số nhân 100.000 đ/điểm; phí HNX 2.700 đ/HĐ/lượt; phí qua đêm VSDC 2.550 đ/HĐ/ngày; phí CTCK nhập tay | |
| Crypto (spot/futures) | Maker/Taker (%); Funding theo chu kỳ (nhập); KL 8 số lẻ; tiền tệ USDT | |
| Forex | Lot 100.000 đơn vị; pip 0,0001 (cặp JPY 0,01); Commission/lot; Swap/đêm | Giá trị pip theo cặp & tiền tệ tài khoản |
| Hàng hóa / Vàng / CFD | Kích thước hợp đồng theo sàn; Commission; Swap | |
| Quyền chọn | Premium × hệ số × số hợp đồng; ngày đáo hạn | Greeks **ngoài phạm vi v1.0** |
> ⚠ Các con số phí/thuế lấy từ C11 của v5 và **chưa được xác minh lại ngày 2026-10-19**. Mọi tham số phải ở dạng **hồ sơ có ngày hiệu lực, sửa được** — không hard-code — và người dùng cần đối chiếu biểu phí hiện hành của CTCK/sàn trước khi dùng cho số liệu thật.

### 5F.7 Lưu trữ, sao lưu & phi chức năng
- **Lưu trữ:** gọi `navigator.storage.persist()` khi khởi động; cảnh báo ở 80% hạn mức (`navigator.storage.estimate()`). Ảnh nén WebP ≤ ~300 KB, tối đa 6 ảnh/lệnh; ảnh URL ngoài (TradingView) **chỉ tải khi người dùng bấm "Hiện ảnh"** (tránh rò IP/theo dõi).
- **Sao lưu:** xuất `.json` (`{app, schemaVersion, exportedAt, journals[], checksum SHA-256}`) hoặc `.zip` (kèm `images/`); nhắc khi > 7 ngày hoặc ≥ 20 lệnh mới kể từ lần sao lưu; nút **"Kiểm tra khôi phục"** (chạy thử nhập, đối chiếu checksum + số lượng, không ghi đè); tùy chọn mã hóa mật khẩu AES-GCM (N05); Chromium: tùy chọn ghi tự động bằng File System Access API.
- **Hiệu năng:** 10.000 lệnh vẫn mở Tổng quan < 1 giây (chỉ mục + memo + Worker cho bootstrap/MC).
- **Bảo mật:** CSP `default-src 'self'` (chặn kết nối ngoài), render ghi chú qua bộ lọc DOMPurify, không `eval`, không analytics.
- **Truy cập:** WCAG AA, điều hướng bàn phím, nhãn aria cho biểu đồ + bảng dữ liệu thay thế.

---


---

## 5G. HỢP NHẤT HAI NGUỒN & FIXTURE DỰ PHÒNG

### 5G.2 Hợp nhất tinh hoa của hai nguồn (theo đặc tả V1–V8 và E01–E12 đã rút ra trong file)
| Năng lực | Nguồn tinh hoa | ID | Cách hợp nhất vào Trading Plan Pro |
| :--- | :--- | :--- | :--- |
| Thanh lọc toàn cục AND/OR, lưu View | TraderSync | V1, UI05, N08 | Một thanh lọc dùng cho mọi trang phân tích |
| Ghi chú 2 cấp Ngày/Lệnh + mẫu chèn | TraderSync | V2, ND03 | Nút "Chèn mẫu", ghi sự thật |
| Evaluator dạng Pivot | TraderSync | V3, G05 | Bảng khoan sâu đa cấp |
| Đường vốn tuân thủ (Shadow) | TraderSync | V4 | Giữ + cảnh báo thiên lệch, nhãn GIẢ ĐỊNH |
| Lịch + cột tổng tuần | TraderSync | V5, F10 | Lịch tô cường độ, bấm ngày để lọc |
| Chip lỗi phím 1–9 | TraderSync | V6, F09 | Chip + 3 khâu của Edgewonk (E05) |
| Trợ lý truy vấn có nguồn | TraderSync | V7, I01 | Rule-based nội bộ, dẫn ID lệnh (C9) |
| Tài liệu "Cách tính & Cách đọc" cho mọi chỉ số | (bài học V8) | V8, ND05 | Không có tính năng nửa vời thiếu tài liệu |
| Đa sổ cục bộ + xóa mềm | Edgewonk | E01 | Thay hoàn toàn đăng nhập/đám mây |
| Đổi Tiền / % / R, nạp–rút vốn | Edgewonk | E02 | Công tắc toàn cục |
| Đa thị trường, đổi Phút/Giờ/Ngày | Edgewonk | E03 | Hồ sơ phí theo thị trường |
| Scale In/Out, Merge Trades | Edgewonk | E04 | `legs` + Open Quantity |
| Tiltmeter 3 khâu, Efficiency | Edgewonk | E05 | Song song, không ghi đè điểm cũ |
| OTP Hit, Management graph | Edgewonk | E06 | Nhãn GIẢ ĐỊNH |
| Exit Analysis (Updraw/Drawdown/◆) | Edgewonk | E07 | Từ Highest/Lowest |
| Đường vốn đa lớp, Equity MA | Edgewonk | E08 | Bật/tắt từng lớp |
| Drill-down đa cấp, 20 Custom Stats, Side-by-Side | Edgewonk | E09 | |
| Báo cáo Tháng→Tuần ▲▼, Chartbook, ≤ 6 ảnh | Edgewonk | E10 | |
| Planned/Missed Trades, Alternative Strategies | Edgewonk | E11 | Không làm backtester phức tạp |
| Monte Carlo, Milestones | Edgewonk | E12 | Dùng bộ bootstrap sẵn có |
| **Bản sắc riêng (không nguồn nào có)** | Trading Plan Pro | Nguyên tắc 1–6 | Wilson + bootstrap, cổng mẫu, cảnh báo thiên lệch, không suy diễn, minh bạch cách tính, quy tắc thị trường VN |

### 5G.3 Phương án dự phòng nếu không xuất được file sao lưu v3 — "Fixture tái dựng"
ChatGPT viết script sinh 30 lệnh thỏa **ràng buộc cứng** (mọi số lấy từ mục 4) rồi kiểm tra tự động: 30 lệnh (18 thắng / 12 thua / 0 hòa) · mã HPG, FPT, VCB, VNM, MWG, SSI (mỗi mã ≥ 2 lệnh) · 07/09 → 16/10/2026 · Σ lãi 7.658.330, Σ lỗ 4.356.040, Gross 4.330.000, phí 1.027.710 · tháng 9 = 1.912.660 (18 lệnh), tháng 10 = 1.389.630 (12 lệnh) với 12 ngày net đúng mục 4.4 · phân bố R 8/4/6/7/5 · 1R TB 266.667 · 3 setup × 10 lệnh · review 24/30 (lãi 12/18, lỗ 12/12) và 6 lệnh chờ đúng mục 4.5 · lệnh thắng lớn nhất 1.064.900, thua lớn nhất −1.243.950 (08/10) · MWG 15/10 = −2,35R · VCB 13/10 đúng 4.8 · chuỗi 2/1/1 · Max DD 1.243.950 · giữ lệnh TB 234,33 giờ · 7 lệnh "vi phạm".
**Bắt buộc** gắn nhãn `FIXTURE TÁI DỰNG — không phải dữ liệu gốc`. Hạn chế: các mốc tổng hợp sẽ pass, nhưng CI bootstrap từng setup, đường Shadow, "Chỉ số ổn định" **không thể coi là golden** cho tới khi có dữ liệu gốc.

### 5G.4 Ý tưởng mới (đề xuất bổ sung, không thuộc backlog gốc)
| ID | Ý tưởng | Giá trị | Sprint |
| :--- | :--- | :--- | :--- |
| N01 | Phễu phân tích 5 tầng + 7 câu hỏi cốt lõi làm xương sống bố cục (5D.0) | Mỗi trang có lý do tồn tại, đọc theo thứ tự tư duy | S2 |
| N02 | Lưu bền (`persist()`), nhắc sao lưu, nút "Kiểm tra khôi phục" | Chống mất dữ liệu (phát hiện E) | S3 |
| N03 | Chế độ Phiên giao dịch: đếm lệnh/ngày, banner chạm ngưỡng, gợi ý nghỉ sau chuỗi thua (không chặn) | Kỷ luật theo thời gian thực | S6 |
| N04 | Bộ kiểm thử golden + fixture là hạng mục kỹ thuật hạng nhất | Chặn hồi quy | S0 |
| N05 | Mã hóa file sao lưu bằng mật khẩu (WebCrypto AES-GCM) — tùy chọn | Riêng tư khi lưu ở Drive/Notion | S9 |
| N06 | Bảng lệnh nhanh `Ctrl+K` + phím tắt | Thao tác nhanh | S8 |
| N07 | Điểm chất lượng dữ liệu cho từng KPI (n đủ dữ liệu / N) | Trung thực về độ tin cậy | S8 |
| N08 | "View" bộ lọc đã lưu + báo cáo tĩnh chỉ-đọc để chia sẻ (liên kết H03) | Chia sẻ không cần máy chủ | S9 |


---

## 5H. LỘ TRÌNH SPRINT S0 → S9 (MỚI v6 — thay "Đợt 0→5")

### 5H.1 Sprint, sản phẩm và cổng nghiệm thu
| Sprint | Phạm vi (ID) | Sản phẩm | **Cổng nghiệm thu (DoD)** | Đọc mục |
| :--- | :--- | :--- | :--- | :--- |
| **S0** Chuẩn bị & nền | QT01, UI07, N04 | Repo, CI (lint → typecheck → test → build), Vitest, fixture + `golden.expected.json` | CI xanh; fixture nạp được; kiểu TypeScript schema biên dịch | 0, 4, 5F.1–5F.3, 11 |
| **S1** Lõi dữ liệu & tính toán | QT05, 5F.3–5F.5 | `core/` + `data/` (Dexie, migration v3→v4, backup/restore), trang debug | **Toàn bộ golden 4.1→4.9 PASS** theo dung sai 4.10; nhập v3 → kiểm chứng tự động | 3, 4, 5F |
| **S2** Khung & chuẩn giao diện | UI01–UI06, ND01, ND02, ND05, F04, V1, N01 | Layout 4 nhóm, thanh lọc, `KpiCard` 6 thành phần, `Chart*`, `StateFrame`, định dạng số/ngày | Test định dạng 5D.2b; ảnh chụp 360/768/1280; KpiCard thiếu thành phần = test đỏ | 5D |
| **S3** Trang lõi → **v0.5** | F01–F03, F05–F10, QT02, QT03, QT06 (cơ bản), ND03, ND04, N02 | Tổng quan, MetriX, Nhật ký (Quick Add, Inline Edit, Sao), Hồ sơ lệnh cơ bản, Lịch, Ghi chú & Review, Quy trình setup, Theo dõi hệ thống, Cài đặt & sao lưu cơ bản | UI hiển thị đúng số mốc (so giá trị nền); mỗi F01→F10 có test; T-R1 pass; cảnh báo bắt MWG 15/10 + ID duy nhất; **chuyển dữ liệu thật, tắt web cũ khi ổn** | 5D, 4, 5B |
| **S4** Đa sổ · Vốn · Thị trường → v0.8 | E01, E02, E03, QT06 (đủ), J02, C8, C11 | Chuyển sổ, nhân bản, xóa mềm; nạp/rút; Tiền/%/R; hồ sơ phí 5 thị trường; Phút/Giờ/Ngày | Sổ minh họa VND giữ nguyên golden khi bật mọi tính năng (nguyên tắc 11); sổ USDT 2 số lẻ | 5E, 5F.6 |
| **S5** Scale In/Out · Import · Merge | E04, QT04, G06 (mẫu CSV chung trước), QT02 (Open Quantity) | `legs`, giá TB, Merge, FIFO, Import có xem trước + hoàn tác theo đợt | Test FIFO/Merge cộng dồn PnL; hoàn tác đợt không đụng dữ liệu khác | 5D.3g, 5E |
| **S6** Kỷ luật & Hành vi | G03, G04, E05, F09 (3 khâu), F05 (đủ), N03 | Chip 3 khâu, Tiltmeter, Efficiency, Plan có quy tắc, Session mode | "Kỷ luật TB 85%" giữ nguyên (C4); cảnh báo cấu hình được | 5D.3f, 5D.4b |
| **S7** Phân tích chuyên sâu | G02, G05, E06, E07, E08, E09, E10, G07 | OTP/Management, Exit Analysis, Equity MA, Drill-down + 20 Custom Stats + Side-by-Side, Chartbook, báo cáo Tháng→Tuần ▲▼, PDF | Công thức 5F.5 có test tính tay (long & short); Drill-down khớp tổng | 5E, 5F.5 |
| **S8** Nâng cao | E11, E12, I01, I02, N06, N07 | Planned/Missed, Alternative, Monte Carlo, Milestones, trợ lý rule-based, What-if, `Ctrl+K` | MC tái lập được theo seed; mọi đường giả định có nhãn; I01 dẫn ID, không suy diễn | 5E, 5F.5 |
| **S9** Hoàn thiện → **v1.0** | H02, H03, J01, ND06, N05, N08 | PWA offline, báo cáo tĩnh, landing + Changelog, mã hóa sao lưu | Lighthouse PWA ≥ 90, axe 0 lỗi nghiêm trọng, golden xanh, 10.000 lệnh < 1 giây, CSP đúng | 11, 12 |
| *(chờ)* | G01, I03 | Biểu đồ giá + replay | **Chưa làm** cho tới khi chốt C5, C6 (nguồn nến OHLC) | 5B |

### 5H.2 Ma trận ID → Sprint (đối chiếu đủ 57 việc gốc + N01→N08)
- **P0:** F01, F02, F03, F05, F06, F07, F08, F09, F10 → S3 (F09 mở rộng 3 khâu ở S6) · F04 → S2
- **P1:** G01 → chờ · G02 → S7 · G03, G04 → S6 · G05 → S7 · G06 → S5 · G07 → S7
- **P2:** H01 → đã hủy · H02, H03 → S9
- **P3:** I01, I02 → S8 · I03 → chờ
- **P4:** J01 → S9 · J02 → S4
- **P5:** UI01–UI06 → S2 · UI07 → S0
- **P6:** QT01 → S0 · QT02 → S3 (+Open Quantity S5) · QT03 → S3 · QT04 → S5 · QT05 → S1 · QT06 → S3/S4 · QT07 → **mọi Sprint** · QT08 → xong
- **P7:** ND01, ND02, ND05 → S2 · ND03, ND04 → S3 · ND06 → S9
- **P8:** E01–E03 → S4 · E04 → S5 · E05 → S6 · E06–E10 → S7 · E11, E12 → S8
- **Mới:** N04 → S0 · N01 → S2 · N02 → S3 · N03 → S6 · N06, N07 → S8 · N05, N08 → S9

### 5H.3 Quy tắc cắt phạm vi khi chậm tiến độ (cắt từ trên xuống, **không bao giờ cắt S0→S3**)
Milestones (E12) → N06/N07/N08 → Alternative Strategies (E11) → What-if (I02) → Chartbook (E10) → 20 Custom Stats (E09) → mã hóa sao lưu (N05).

---


---

## 11. TRIỂN KHAI KỸ THUẬT (DEPLOY)

### 11.1 Chọn nơi deploy (ứng dụng là **tĩnh**, không cần máy chủ vì không có tài khoản)
| Phương án | Khi nào dùng | Cấu hình |
| :--- | :--- | :--- |
| **Cloudflare Pages (mặc định)** | Muốn miễn phí, nhanh, có xem trước theo PR | Kết nối repo GitHub · Build: `npm run build` · Output: `dist` · Node 20 · không cần biến môi trường |
| Netlify / Vercel | Đã quen hệ sinh thái | Cùng build/output như trên |
| GitHub Pages | Muốn mọi thứ trong GitHub | Đặt `base` của Vite đúng tên repo; dùng HashRouter nên không cần rewrite |
| **"Publish" của ChatGPT** (như web cũ `*.chatgpt.site`) | Muốn giữ cách đang dùng | Nếu công cụ chỉ nhận 1 file: chạy `npm run build:single` (vite-plugin-singlefile) → `dist/index.html`. Lưu ý: PWA/service worker có thể không hoạt động trên tên miền đó; ghi vào README |

### 11.3 CI (cổng bắt buộc trước khi merge/deploy)
```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run typecheck
      - run: npm test            # gồm tests/golden — lệch số mốc là đỏ
      - run: npm run build
      - run: npx playwright install --with-deps && npm run e2e   # ảnh chụp 360/768/1280 + axe
```
Bật "Require status checks" trên nhánh `main`.

### 11.4 Tiêu đề bảo mật (`public/_headers` cho Cloudflare/Netlify)
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```
`img-src https:` chỉ để hiện ảnh URL TradingView khi người dùng bấm "Hiện ảnh" (5F.7). Không khai báo tên miền analytics nào.

### 11.6 Danh sách kiểm tra phát hành v1.0
Golden xanh · e2e xanh ở 360/768/1280 · axe 0 lỗi nghiêm trọng · Lighthouse PWA ≥ 90 · 10.000 lệnh mở Tổng quan < 1 giây · CSP đúng · không có yêu cầu mạng ngoài (kiểm bằng tab Network) · sao lưu → xóa dữ liệu → khôi phục thành công · landing có miễn trừ rủi ro · nhãn Minh họa/Thật đúng · "Cách tính & Cách đọc" có ở mọi KPI.

