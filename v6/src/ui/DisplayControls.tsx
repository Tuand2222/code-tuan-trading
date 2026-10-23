import type { Journal } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
export function DisplayControls({ journal }: { journal: Journal }) {
  const { mutate, busy } = useLedger();
  return (
    <div className="actions" aria-label="Đơn vị toàn sổ">
      <label>
        Đơn vị hiển thị toàn sổ
        <select
          disabled={busy}
          aria-label="Đơn vị hiển thị toàn sổ"
          value={journal.settings.displayUnit}
          onChange={(e) => {
            const unit = e.target.value as Journal['settings']['displayUnit'];
            void mutate((s) => ({
              ...s,
              journals: s.journals.map((j) =>
                j.id === journal.id ? { ...j, settings: { ...j.settings, displayUnit: unit } } : j,
              ),
            })).catch(() => {});
          }}
        >
          <option value="money">{journal.currency}</option>
          <option value="percent">% vốn</option>
          <option value="R">R</option>
        </select>
      </label>
      <label>
        Thời gian giữ lệnh toàn sổ
        <select
          disabled={busy}
          aria-label="Thời gian giữ lệnh toàn sổ"
          value={journal.settings.holdingUnit}
          onChange={(e) => {
            const unit = e.target.value as Journal['settings']['holdingUnit'];
            void mutate((s) => ({
              ...s,
              journals: s.journals.map((j) =>
                j.id === journal.id ? { ...j, settings: { ...j.settings, holdingUnit: unit } } : j,
              ),
            })).catch(() => {});
          }}
        >
          <option value="minutes">Phút</option>
          <option value="hours">Giờ</option>
          <option value="days">Ngày</option>
        </select>
      </label>
    </div>
  );
}
