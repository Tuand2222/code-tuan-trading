'use client';
import type { Account } from '../../lib/trading/domain/types';

export function OpeningBalanceFields({ account, onChange, disabled = false }: { account: Account; onChange: (a: Account) => void; disabled?: boolean }) {
  const update = (index: number, patch: Partial<Account['openingBalances'][number]>) => onChange({ ...account, openingBalances: account.openingBalances.map((b, i) => i === index ? { ...b, ...patch } : b) });
  return <div className="hub-opening">
    <p>Khai số dư trước dòng đầu tiên của file. Giá vốn và thời điểm cần khớp sao kê đầu kỳ; bỏ trống danh sách nếu không có.</p>
    {account.openingBalances.map((balance, index) => <fieldset key={index} disabled={disabled}>
      <legend>Vị thế {index + 1}</legend>
      <div className="hub-fields">
        <label>Mã sản phẩm<input value={balance.symbol} onChange={e => update(index, { symbol: e.target.value.toUpperCase().trim() })} /></label>
        <label>Số lượng (âm nếu Short)<input inputMode="decimal" value={balance.qty} onChange={e => update(index, { qty: e.target.value })} /></label>
        <label>Giá vốn theo tiền gốc<input inputMode="decimal" value={balance.avgPrice} onChange={e => update(index, { avgPrice: e.target.value })} /></label>
        <label>Thời điểm số dư (UTC)<input type="datetime-local" value={balance.asOfUtc.slice(0, 16)} onChange={e => update(index, { asOfUtc: e.target.value ? `${e.target.value}:00.000Z` : '' })} /></label>
        {account.bookMode === 'hedging' && <label>Chiều sổ<select value={balance.positionSide ?? 'LONG'} onChange={e => update(index, { positionSide: e.target.value as 'LONG' | 'SHORT' })}><option>LONG</option><option>SHORT</option></select></label>}
        <label>Tỷ giá tiền gốc → VNĐ<input inputMode="decimal" value={balance.rateToVND ?? (account.baseCcy === 'VND' ? '1' : '')} onChange={e => update(index, { rateToVND: e.target.value || undefined })} /></label>
      </div>
      <button type="button" onClick={() => onChange({ ...account, openingBalances: account.openingBalances.filter((_, i) => i !== index) })}>Bỏ vị thế này</button>
    </fieldset>)}
    <button type="button" disabled={disabled} onClick={() => onChange({ ...account, openingBalances: [...account.openingBalances, { symbol: '', qty: '', avgPrice: '', asOfUtc: '', origin: 'user-declared', ...(account.bookMode === 'hedging' ? { positionSide: 'LONG' as const } : {}) }] })}>Thêm số dư đầu kỳ</button>
  </div>;
}

export function FeePresetFields({ account, onChange, disabled = false }: { account: Account; onChange: (a: Account) => void; disabled?: boolean }) {
  const labels = { buyRate: 'Phí mua (tỷ lệ, ví dụ 0.0015)', sellRate: 'Phí bán (tỷ lệ)', taxSellRate: 'Thuế bán (tỷ lệ)', minFee: 'Phí tối thiểu (tiền gốc)' };
  return <fieldset disabled={disabled}><legend>Biểu phí tự khai khi file thiếu phí</legend><p>Để trống nếu chưa biết. Chi phí suy ra từ biểu phí luôn được ghi là ước tính.</p><div className="hub-fields">{Object.entries(labels).map(([key, label]) => <label key={key}>{label}<input inputMode="decimal" value={account.feePreset?.[key as keyof NonNullable<Account['feePreset']>] ?? ''} onChange={e => onChange({ ...account, feePreset: { ...account.feePreset, [key]: e.target.value || undefined } })} /></label>)}</div></fieldset>;
}

export default function ImportAccountFields({ account, onChange, identityLocked = false }: { account: Account; onChange: (a: Account) => void; identityLocked?: boolean }) {
  const patch = (p: Partial<Account>) => onChange({ ...account, ...p });
  return <>
    <div className="hub-fields">
      <label>Tên hiển thị<input value={account.label} onChange={e => patch({ label: e.target.value })} /></label>
      <label>Mã tài khoản<input value={account.accountKey} disabled={identityLocked} onChange={e => patch({ accountKey: e.target.value.trim() })} /></label>
      <label>Nguồn<select value={account.platform} disabled={identityLocked} onChange={e => patch({ platform: e.target.value as Account['platform'] })}>{['VN_STOCK', 'MT5', 'BINANCE', 'GENERIC', 'MANUAL'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Thị trường<select value={account.market} onChange={e => patch({ market: e.target.value as Account['market'] })}><option value="stock">Chứng khoán</option><option value="crypto">Crypto</option><option value="forex">Forex</option><option value="commodity">Hàng hóa</option></select></label>
      <label>Tiền tài khoản<input value={account.baseCcy} disabled={identityLocked || account.platform === 'VN_STOCK'} onChange={e => patch({ baseCcy: e.target.value.toUpperCase().trim() })} /></label>
      <label>Tiền định giá sản phẩm<input value={account.quoteCcy} onChange={e => patch({ quoteCcy: e.target.value.toUpperCase().trim() })} /></label>
      <label>Múi giờ nguồn<input value={account.sourceTimezone} placeholder="Asia/Ho_Chi_Minh hoặc UTC" onChange={e => patch({ sourceTimezone: e.target.value })} /></label>
      <label>Phương pháp giá vốn<select value={account.costBasis} onChange={e => patch({ costBasis: e.target.value as Account['costBasis'] })}><option value="fifo">FIFO</option><option value="average">Bình quân</option></select></label>
      <label>Sổ vị thế<select value={account.bookMode} disabled={identityLocked} onChange={e => patch({ bookMode: e.target.value as Account['bookMode'] })}><option value="netting">Netting</option><option value="hedging">Hedging</option></select></label>
      <label>Nguồn P&L<select value={account.pnlModel} onChange={e => patch({ pnlModel: e.target.value as Account['pnlModel'] })}><option value="linear">Tính từ chênh lệch giá (tuyến tính)</option><option value="reported">Lấy P&L tiền gốc từ báo cáo</option></select></label>
      <label>Hệ số hợp đồng<input inputMode="decimal" value={account.contractMultiplier} onChange={e => patch({ contractMultiplier: e.target.value })} /></label>
    </div>
    <label className="hub-check"><input type="checkbox" checked={account.allowsShort} disabled={account.platform === 'VN_STOCK'} onChange={e => patch({ allowsShort: e.target.checked })} />Cho phép vị thế Short (bỏ chọn cho Crypto Spot).</label>
    <OpeningBalanceFields account={account} onChange={onChange} />
    <FeePresetFields account={account} onChange={onChange} />
  </>;
}
