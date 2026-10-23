import { useEffect, useRef, useState } from 'react';
export const quantHelp = {
  expectancy: [
    'Kỳ vọng mỗi lệnh',
    'Trung bình kết quả theo một đơn vị rủi ro ban đầu.',
    'E = ΣR / N',
    'E > 0 là kết quả dương trong mẫu; chưa chứng minh lợi thế tương lai.',
    'Đối chiếu số mẫu, chi phí và các giai đoạn độc lập trước khi kết luận.',
  ],
  sqn: [
    'Chất lượng hệ thống (SQN)',
    'Kết hợp kỳ vọng, độ phân tán và số lệnh có 1R.',
    'SQN = √min(N,100) × mean(R) / SD mẫu(R)',
    '<1,6: kém; 1,6–2: dưới trung bình; 2–2,5: trung bình; 2,5–3: tốt; 3–5: xuất sắc. Mẫu dưới 30 còn yếu. Chế độ không trần và 100 lệnh gần nhất đổi hệ số N.',
    'Kiểm tra cùng một chiến lược, định nghĩa 1R và tính đầy đủ của mẫu. Điểm số không phải tín hiệu tăng khối lượng.',
  ],
  pf: [
    'Hệ số lợi nhuận theo R',
    'So sánh tổng R dương với tổng R âm trong cùng mẫu.',
    'PF(R) = Σmax(R,0) / |Σmin(R,0)|',
    '>1: tổng R dương vượt tổng R âm; không có lệnh thua hiển thị ∞. Khác PF theo tiền khi các lệnh có 1R khác nhau.',
    'Đọc cùng Expectancy và độ bao phủ 1R; không so trực tiếp với PF tiền mặt Classic.',
  ],
  capture: [
    'Hiệu suất chốt lời',
    'Phần lợi nhuận tiềm năng đã giữ lại, chỉ tính lệnh thắng có MFE đo được.',
    'Capture = mean(Realized R / MFE R) × 100%',
    'Không có ngưỡng bảo đảm tối ưu cho mọi chiến lược. Có thể vượt 100% do khoản hoàn phí hoặc khác biệt phép đo.',
    'Đối chiếu nhật ký và cấu trúc thoát lệnh. Không coi đỉnh/đáy nhìn lại là mức giá có thể khớp chắc chắn.',
  ],
  dd: [
    'Sụt giảm theo R',
    'Khoảng giảm từ đỉnh đường R tích lũy xuống đáy kế tiếp.',
    'DD = max(đỉnh ΣR − ΣR)',
    'Chỉ hiển thị toàn mẫu khi mọi lệnh đều có R và thứ tự đóng đáng tin cậy. Đây là đường R chuẩn hóa, không phải drawdown phần trăm tài khoản.',
    'Kiểm tra chuỗi thua và quy mô rủi ro thực ở Classic. Các bộ lọc không thay hạn mức tài khoản.',
  ],
  recovery: [
    'Hệ số phục hồi theo R',
    'Kết quả R tích lũy so với mức sụt giảm R lớn nhất.',
    'Recovery(R) = ΣR / Max DD(R)',
    'DD bằng 0 hoặc thiếu R: không xác định. Chỉ so sánh các mẫu cùng định nghĩa.',
    'Xem thời gian phục hồi và mức tập trung lợi nhuận; không dùng riêng chỉ số này để quyết định rủi ro.',
  ],
  mfe: [
    'Lợi nhuận tiềm năng (MFE)',
    'Mức thuận lợi lớn nhất trong thời gian giữ lệnh đã được ghi nhận.',
    'MFE(R) = mức thuận lợi theo tiền / 1R ban đầu',
    'Trục X: MFE(R); trục Y: R thực hiện. Đường chéo biểu thị giữ lại 100% MFE.',
    'Chỉ dùng extrema của một lần vào/ra thực. Thiếu extrema hoặc có scale-in/out không đủ đường chạy vị thế sẽ được loại riêng khỏi biểu đồ này.',
  ],
  mae: [
    'Chịu nhiệt tối đa (MAE)',
    'Mức bất lợi lớn nhất đã ghi nhận, biểu diễn bằng số R dương.',
    'MAE(R) = |mức bất lợi theo tiền| / 1R ban đầu',
    'Trục X: MAE(R); trục Y: R thực hiện. Xem cả lệnh thắng lẫn thua.',
    'Đỉnh/đáy không cho biết thứ tự chạm giá. Không suy diễn một stop-loss mới sẽ tạo ra kết quả tốt hơn.',
  ],
  distribution: [
    'Phân phối kết quả R',
    'Tần suất lệnh trong 12 khoảng R. Mỗi lệnh kinh tế chỉ được tính một lần.',
    'R = P&L được chọn / 1R − ma sát giả định',
    'Đường chuẩn là đối chiếu Gaussian có cùng trung bình và SD; không khẳng định R có phân phối chuẩn.',
    'Quan sát đuôi trái, độ lệch và các ngoại lệ. Bấm một cột để xem lệnh của khoảng đó.',
  ],
  heat: [
    'Kỳ vọng theo thời điểm',
    'R trung bình theo thứ và khung giờ trong múi giờ sổ nhật ký.',
    'E(ô) = ΣR trong ô / N của ô',
    'Ô trống là thiếu mẫu, không phải 0. Giờ dùng ngày vào hoặc ngày ra theo cài đặt; không tự suy từ ngày không có giờ.',
    'Đọc N trong từng ô trước khi so sánh; nhóm nhỏ dễ tạo tín hiệu ngẫu nhiên.',
  ],
  ratios: [
    'Tỷ số theo R mỗi lệnh',
    'Sharpe và Sortino chuẩn hóa kết quả từng lệnh, không thường niên hóa.',
    'Sharpe = mean(R)/SD mẫu(R); Sortino = mean(R)/√mean(min(R,0)²)',
    'Rf và MAR bằng 0; thiếu độ phân tán hoặc không có downside thì không xác định. Không tương đương tỷ số lợi suất ngày.',
    'Không tính Calmar từ tổng R: Calmar cần lợi suất vốn theo thời gian, lịch nạp/rút và drawdown phần trăm đáng tin cậy.',
  ],
  rolling: [
    'SQN trượt 30 lệnh',
    'Theo dõi thay đổi chất lượng trên tối đa 30 lệnh đóng gần nhất.',
    'SQN cửa sổ = √N × mean(R) / SD mẫu(R)',
    'Mỗi điểm có số mẫu riêng; cửa sổ chưa đủ 30 lệnh chỉ là tạm tính.',
    'Dùng để xác định giai đoạn cần rà soát, tránh tối ưu quá khớp một đoạn ngắn.',
  ],
} satisfies Record<string, string[]>;
export type QuantHelpKey = keyof typeof quantHelp;
export function QuantHelp({ id }: { id: QuantHelpKey }) {
  const [open, setOpen] = useState(false),
    [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 80 });
  const ref = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout>>();
  const content = quantHelp[id];
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(340, window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 400)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
        ref.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  useEffect(() => () => clear(), []);
  return (
    <div
      className="quant-help"
      ref={ref}
      onMouseEnter={() => {
        clear();
        timer.current = setTimeout(() => setOpen(true), 150);
      }}
      onMouseLeave={() => {
        clear();
        if (!pinned) timer.current = setTimeout(() => setOpen(false), 120);
      }}
    >
      <button
        type="button"
        className="quant-help-trigger"
        aria-label={'Giải thích ' + content[0]}
        aria-expanded={open}
        onClick={() => {
          clear();
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        ?
      </button>
      {open && (
        <div className="quant-popover" role="note" aria-label={content[0]} style={position}>
          <strong>{content[0]}</strong>
          {['Chức năng', 'Công thức', 'Cách đọc', 'Điều cần đối chiếu'].map((label, i) => (
            <p key={label}>
              <b>{label}</b>
              <span>{content[i + 1]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
