import type { ImportWarning } from '../domain/types';
const messages: Record<string, string> = {
  POSSIBLE_CROSS_REPORT_OVERLAP: 'Hai loại báo cáo có thể mô tả cùng giao dịch. Chọn nguồn ưu tiên và xem tác động trước khi lưu.',
  POSSIBLE_DUPLICATE_CASH_COST: 'Một khoản phí có thể đã nằm trong file lệnh. Gắn dòng tiền vào dòng lệnh đối chiếu hoặc kiểm tra lại nguồn.',
  MISSING_OPENING: 'Thiếu số dư đầu kỳ. Khai số cổ phiếu đã có trước file hoặc bổ sung lịch sử mua.',
  OVERSELL: 'Khối lượng bán vượt số dư có thể xác minh. Kiểm tra số dư đầu kỳ và lịch sử khớp lệnh.',
  AMBIGUOUS_ORDER: 'Có cả mua và bán cùng thời điểm nhưng thiếu thứ tự khớp. Kiểm tra cột Sequence hoặc lấy file có thời gian chính xác hơn.',
  UNSUPPORTED_PNL_MODEL: 'Không đủ dữ liệu tính P&L cho sản phẩm này. Cần hệ số/tiền định giá đúng hoặc cột P&L tiền tài khoản.',
  UNKNOWN_PNL_BASIS: 'Chưa xác nhận P&L là trước phí hay sau phí.',
  REPORTED_PNL_MISMATCH: 'P&L báo cáo và P&L tính lại lệch ngoài dung sai; hãy đối chiếu trước khi xác nhận.',
  AMBIGUOUS_CASH_ALLOCATION: 'Dòng funding/phí khớp nhiều vị thế. Khoản này vẫn nằm trong đường cong vốn nhưng chưa gắn vào một chu kỳ cụ thể.',
  INVALID_CASH_LINK: 'Dòng đối chiếu đang trỏ tới một lệnh không tồn tại hoặc đã hoàn tác.',
  OVERLAY_MERGE_CONFLICT: 'Tính lại sổ làm nhiều nhật ký gộp vào một chu kỳ. Cần kiểm tra lại phần review.',
};
export const warningMessage = (w: ImportWarning) => messages[w.code] ?? w.message;
export function groupWarnings(warnings: ImportWarning[]): ImportWarning[] {
  const groups = new Map<string, ImportWarning>();
  const severity = { info: 0, 'needs-confirmation': 1, blocker: 2 };
  for (const w of warnings) {
    const previous = groups.get(w.code);
    groups.set(w.code, previous ? { ...previous, severity: severity[w.severity] > severity[previous.severity] ? w.severity : previous.severity, rowRefs: [...new Set([...(previous.rowRefs ?? []), ...(w.rowRefs ?? [])])], fillIds: [...new Set([...(previous.fillIds ?? []), ...(w.fillIds ?? [])])] } : { ...w });
  }
  return [...groups.values()].sort((a, b) => severity[b.severity] - severity[a.severity] || a.code.localeCompare(b.code));
}
