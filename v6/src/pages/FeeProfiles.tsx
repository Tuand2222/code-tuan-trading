import { useState } from 'react';
import { feeProfileSchema, type FeeProfile, type Journal } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
import { profileCosts } from '../core/marketRules';
export function FeeProfiles({ journal }: { journal: Journal }) {
  const { data, mutate, busy, revision } = useLedger();
  const blank = (): FeeProfile => ({
    id: crypto.randomUUID(),
    name: 'Hồ sơ mới',
    market: 'stocks',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    currency: journal.currency,
    multiplier: '1',
    quantityStep: '1',
    commissionPercent: '0',
    commissionPerUnit: '0',
    sellTaxPercent: '0',
    overnightPerUnit: '0',
    settlementDays: 0,
    allowShort: true,
  });
  const [draft, setDraft] = useState(blank),
    [version, setVersion] = useState(revision),
    [tradeId, setTradeId] = useState(''),
    [message, setMessage] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const profiles = journal.settings.feeProfiles ?? [];
  const change = (patch: Partial<FeeProfile>) => {
    setDraft({ ...draft, ...patch });
    setConfirmed(false);
  };
  let estimate: ReturnType<typeof profileCosts> | undefined;
  try {
    const trade = data.trades.find((t) => t.id === tradeId);
    if (trade) estimate = profileCosts(trade, feeProfileSchema.parse(draft), journal.currency);
  } catch {
    /* Validation appears at explicit application. */
  }
  return (
    <section className="panel">
      <h2>Hồ sơ phí và quy tắc thị trường</h2>
      <p>
        Mỗi hồ sơ có ngày hiệu lực. Các tham số do bạn xác nhận theo biểu phí sàn; không tự ghi đè
        phí lịch sử. Số đêm là ngày lịch; funding thực tế vẫn nhập từ sàn.
      </p>
      <label>
        Hồ sơ đã lưu
        <select
          value={profiles.some((p) => p.id === draft.id) ? draft.id : ''}
          onChange={(e) => {
            setDraft(profiles.find((p) => p.id === e.target.value) ?? blank());
            setVersion(revision);
            setConfirmed(false);
          }}
        >
          <option value="">Tạo hồ sơ mới</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.effectiveFrom}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mẫu cấu hình thị trường · cần xác nhận biểu phí
        <select
          defaultValue=""
          onChange={(e) => {
            const key = e.target.value;
            const template = blank();
            const rules: Record<string, Partial<FeeProfile>> = {
              vn: {
                name: 'Cổ phiếu VN',
                market: 'stocks',
                quantityStep: '100',
                allowShort: false,
                settlementDays: 2,
              },
              future: {
                name: 'Phái sinh VN',
                market: 'futures',
                multiplier: '100000',
                quantityStep: '1',
              },
              crypto: {
                name: 'Crypto Spot',
                market: 'crypto',
                quantityStep: '0.00000001',
                allowShort: false,
              },
              forex: {
                name: 'Forex',
                market: 'forex',
                multiplier: '100000',
                quantityStep: '0.01',
                pipSize: '0.0001',
              },
              cfd: { name: 'CFD / hàng hóa', market: 'cfd', quantityStep: '0.01' },
            };
            if (rules[key]) {
              setDraft({ ...template, ...rules[key] });
              setVersion(revision);
              setConfirmed(false);
            }
          }}
        >
          <option value="">Chọn mẫu cấu trúc</option>
          <option value="vn">Cổ phiếu VN</option>
          <option value="future">Phái sinh VN</option>
          <option value="crypto">Crypto Spot</option>
          <option value="forex">Forex</option>
          <option value="cfd">CFD / hàng hóa</option>
        </select>
      </label>
      <p>
        Mẫu chỉ điền đơn vị và quy tắc tham chiếu. Phí mặc định 0 chưa phải biểu phí được xác nhận;
        nhập phí, hệ số hợp đồng và ngày hiệu lực theo sản phẩm thực tế trước khi áp dụng. Swap tính
        theo vị thế còn giữ ngay trước 00:00 UTC; chưa tính ngày nghỉ hay ngày nhân ba của broker.
      </p>
      <label>
        Tên hồ sơ phí
        <input value={draft.name} onChange={(e) => change({ name: e.target.value })} />
      </label>
      <label>
        Thị trường hồ sơ
        <select
          value={draft.market}
          onChange={(e) => change({ market: e.target.value as FeeProfile['market'] })}
        >
          {['stocks', 'futures', 'crypto', 'forex', 'commodities', 'cfd', 'options'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {(
        [
          'effectiveFrom',
          'effectiveTo',
          'multiplier',
          'quantityStep',
          'commissionPercent',
          'commissionPerUnit',
          'sellTaxPercent',
          'overnightPerUnit',
          'pipSize',
        ] as const
      ).map((k) => (
        <label key={k}>
          {
            {
              effectiveFrom: 'Hiệu lực từ',
              effectiveTo: 'Hiệu lực đến',
              multiplier: 'Hệ số hợp đồng / đơn vị mỗi lot',
              quantityStep: 'Bước khối lượng / lô',
              commissionPercent: 'Phí giao dịch % giá trị',
              commissionPerUnit: 'Phí mỗi đơn vị mỗi lượt',
              sellTaxPercent: 'Thuế bán %',
              overnightPerUnit: 'Swap / đơn vị / đêm (nhận ghi âm)',
              pipSize: 'Kích thước pip (tham chiếu)',
            }[k]
          }
          <input
            type={k.startsWith('effective') ? 'date' : 'text'}
            value={draft[k] ?? ''}
            onChange={(e) => change({ [k]: e.target.value || undefined })}
          />
        </label>
      ))}
      <label>
        Tiền tệ hồ sơ
        <select
          value={draft.currency}
          onChange={(e) => change({ currency: e.target.value as FeeProfile['currency'] })}
        >
          {['VND', 'USD', 'USDT'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Số phiên thanh toán T+
        <input
          type="number"
          min="0"
          max="30"
          value={draft.settlementDays}
          onChange={(e) => change({ settlementDays: Number(e.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.allowShort}
          onChange={(e) => change({ allowShort: e.target.checked })}
        />
        Cho phép short
      </label>
      <button
        disabled={busy}
        onClick={() => {
          try {
            const parsed = feeProfileSchema.parse(draft);
            void mutate(
              (s) => ({
                ...s,
                journals: s.journals.map((j) =>
                  j.id === journal.id
                    ? {
                        ...j,
                        settings: {
                          ...j.settings,
                          feeProfiles: [
                            ...(j.settings.feeProfiles ?? []).filter((p) => p.id !== parsed.id),
                            parsed,
                          ],
                        },
                      }
                    : j,
                ),
              }),
              version,
            )
              .then(() => {
                setVersion(revision + 1);
                setMessage('Đã lưu hồ sơ phí.');
              })
              .catch((e) => setMessage(String(e)));
          } catch (e) {
            setMessage(String(e));
          }
        }}
      >
        Lưu hồ sơ phí
      </button>
      <h3>Xem trước và áp dụng vào một lệnh</h3>
      <label>
        Lệnh áp dụng hồ sơ
        <select
          value={tradeId}
          onChange={(e) => {
            setTradeId(e.target.value);
            setVersion(revision);
            setConfirmed(false);
          }}
        >
          <option value="">Chọn lệnh</option>
          {data.trades
            .filter((t) => t.journalId === journal.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.symbol} · {t.id}
              </option>
            ))}
        </select>
      </label>
      {estimate && (
        <p>
          Commission {estimate.costs.commission} · Thuế {estimate.costs.tax} · Swap{' '}
          {estimate.costs.swap} {journal.currency}. {estimate.warnings.join(' ')}
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Tôi đã đối chiếu biểu phí và muốn thay các khoản tính được. Funding/Other giữ nguyên; không
        tự đánh dấu đủ phí.
      </label>
      <button
        disabled={!tradeId || !confirmed || busy}
        onClick={() => {
          try {
            const p = feeProfileSchema.parse(draft);
            void mutate(
              (s) => ({
                ...s,
                trades: s.trades.map((t) =>
                  t.id === tradeId
                    ? {
                        ...t,
                        costs: profileCosts(t, p, journal.currency).costs,
                        multiplier: p.multiplier,
                        review: { ...t.review, done: false },
                        updatedAt: new Date().toISOString(),
                      }
                    : t,
                ),
              }),
              version,
            )
              .then(() => {
                setMessage('Đã áp dụng hồ sơ.');
                setConfirmed(false);
              })
              .catch((e) => setMessage(String(e)));
          } catch (e) {
            setMessage(String(e));
          }
        }}
      >
        Áp dụng phí đã xem trước
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
