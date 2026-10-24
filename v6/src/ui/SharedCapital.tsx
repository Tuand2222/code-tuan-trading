import { useEffect, useState } from 'react';
import { DEFAULT_RISK, type RiskSettings } from '../../../lib/risk-analytics';
export function SharedCapital({
  onReference,
  currency,
}: {
  onReference: (capital: number) => void;
  currency: string;
}) {
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_RISK),
    [owner, setOwner] = useState(''),
    [version, setVersion] = useState(0),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const r = await fetch('/api/risk-settings', { cache: 'no-store' });
      if (!r.ok) throw Error('Đăng nhập để quản lý vốn dùng chung với Classic.');
      const b = await r.json();
      setSettings(b.settings ?? DEFAULT_RISK);
      setVersion(b.version);
      setOwner(b.owner);
      setReady(true);
      setMessage('');
    } catch (e) {
      setMessage(String(e));
    }
  };
  useEffect(() => {
    let active = true;
    void fetch('/api/risk-settings', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw Error('Đăng nhập để quản lý vốn dùng chung với Classic.');
        return r.json();
      })
      .then((b) => {
        if (active) {
          setSettings(b.settings ?? DEFAULT_RISK);
          setVersion(b.version);
          setOwner(b.owner);
          setReady(true);
          setMessage('');
        }
      })
      .catch((e) => {
        if (active) setMessage(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const field = (k: keyof RiskSettings, label: string, max = 100) => (
    <label>
      {label}
      <input
        type="number"
        min="0"
        max={max}
        step="any"
        value={Number(settings[k])}
        onChange={(e) =>
          setSettings((s) => ({
            ...s,
            [k]: Math.min(max, Math.max(0, Number(e.target.value) || 0)),
          }))
        }
      />
    </label>
  );
  return (
    <fieldset>
      <legend>Vốn và hạn mức dùng chung với Classic</legend>
      <p>
        Thay đổi tại đây được lưu cho cùng tài khoản. Các số liệu phân tích vẫn tách riêng dữ liệu
        thực và mô phỏng.
      </p>
      {ready && (
        <>
          {field('initialCapital', 'Vốn ban đầu (VNĐ)', 1e15)}
          {field('riskPercent', 'Rủi ro mỗi lệnh (%)')}
          {field('dailyLossPercent', 'Giới hạn lỗ ngày (%)')}
          {field('maxDrawdownPercent', 'Giới hạn sụt giảm tối đa (%)')}
          {field('defensivePercent', 'Ngưỡng phòng thủ (%)')}
          {field('stopPercent', 'Ngưỡng dừng (%)')}
          <label>
            Kiểu sụt giảm
            <select
              value={settings.floorMode}
              onChange={(e) =>
                setSettings({ ...settings, floorMode: e.target.value as RiskSettings['floorMode'] })
              }
            >
              <option value="static">Cố định theo vốn đầu</option>
              <option value="trailing">Trượt theo đỉnh vốn</option>
            </select>
          </label>
          <label>
            Loại tài khoản
            <select
              value={settings.accountMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  accountMode: e.target.value as RiskSettings['accountMode'],
                })
              }
            >
              <option value="personal">Cá nhân</option>
              <option value="prop">Quỹ / Prop</option>
            </select>
          </label>
          <h4>Nạp / rút vốn thực</h4>
          {(settings.cashFlows ?? []).map((f, i) => (
            <div key={f.id}>
              <input
                aria-label="Ngày nạp rút"
                type="date"
                value={f.date}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cashFlows: settings.cashFlows!.map((x, n) =>
                      n === i ? { ...x, date: e.target.value } : x,
                    ),
                  })
                }
              />
              <select
                aria-label="Loại dòng tiền"
                value={f.type}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cashFlows: settings.cashFlows!.map((x, n) =>
                      n === i ? { ...x, type: e.target.value as 'deposit' | 'withdrawal' } : x,
                    ),
                  })
                }
              >
                <option value="deposit">Nạp</option>
                <option value="withdrawal">Rút</option>
              </select>
              <input
                aria-label="Số tiền nạp rút"
                type="number"
                min="0"
                value={f.amount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cashFlows: settings.cashFlows!.map((x, n) =>
                      n === i ? { ...x, amount: Math.max(0, Number(e.target.value)) } : x,
                    ),
                  })
                }
              />
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    cashFlows: settings.cashFlows!.filter((_, n) => n !== i),
                  })
                }
              >
                Xóa dòng tiền
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setSettings({
                ...settings,
                cashFlows: [
                  ...(settings.cashFlows ?? []),
                  {
                    id: crypto.randomUUID(),
                    date: new Date().toISOString().slice(0, 10),
                    type: 'deposit',
                    amount: 0,
                  },
                ],
              })
            }
          >
            Thêm nạp / rút
          </button>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void fetch('/api/risk-settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ expectedOwner: owner, settings, version }),
                })
                  .then(async (r) => {
                    const b = await r.json();
                    if (!r.ok) throw Error(b.error);
                    setVersion(b.revision);
                    setMessage('Đã lưu cấu hình vốn dùng chung.');
                  })
                  .catch((e) => setMessage(String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Lưu vốn và hạn mức thực
            </button>
            <button
              disabled={!['VND', 'VNĐ'].includes(currency)}
              onClick={() => onReference(settings.initialCapital)}
            >
              Dùng vốn đầu làm tham chiếu phân tích
            </button>
          </div>
        </>
      )}
      <button disabled={busy} onClick={() => void load()}>
        Tải lại cấu hình vốn
      </button>
      {message && <p role="status">{message}</p>}
    </fieldset>
  );
}
