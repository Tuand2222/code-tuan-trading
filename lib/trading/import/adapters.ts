import { D, dec, parseDecimal, positive } from '../domain/decimal';
import { bookKey, cashKey, fillKey, symbolIdentity } from '../domain/identity';
import { normalizeCash, normalizeFill } from '../domain/normalize';
import { cashSchema, fillSchema, type CashEvent, type CostItem, type Fill } from '../domain/types';
import { headerKey } from './tableReader';
import { parseTime } from './time';
import type { ConnectorId, Detection, Parsed, SourceAdapter } from './types';

const common = {
  symbol: ['Symbol', 'Mã CK', 'Mã chứng khoán', 'Mã', 'Contract'], timestamp: ['timestamp_utc', 'Thời gian', 'Ngày giao dịch', 'Ngày khớp', 'Date(UTC)', 'Date', 'Time'],
  side: ['Side', 'Mua/Bán', 'Loại lệnh', 'B/S', 'Type'], qty: ['quantity', 'Qty', 'Khối lượng', 'KL khớp', 'Volume'], price: ['Price', 'Giá', 'Giá khớp'],
  nativeId: ['source_id', 'Trade ID', 'Mã khớp', 'Mã lệnh', 'Số hiệu lệnh'], fee: ['Commission', 'fee', 'Phí', 'Phí giao dịch'], tax: ['Tax', 'Thuế', 'Thuế TNCN'],
  feeCurrency: ['fee_currency', 'Fee Coin', 'Commission Asset'], ccy: ['Currency', 'Asset', 'Đồng tiền'], amount: ['Amount', 'Giá trị', 'Giá trị khớp'],
  positionId: ['Position ID', 'Position'], positionSide: ['Position Side', 'PositionSide'], pnl: ['Profit', 'Realized Profit', 'Realized PNL', 'Lãi/Lỗ', 'Lãi lỗ'],
  openTime: ['Open Time', 'Opened', 'Opening Time', 'Ngày mua'], closeTime: ['Close Time', 'Closed', 'Closing Time', 'Ngày bán'],
  entry: ['Entry Price', 'Giá vốn', 'Giá mua'], exit: ['Avg Close Price', 'Close Price', 'Giá bán'], sl: ['S / L', 'SL', 'Stop Loss'], tp: ['T / P', 'TP'],
  swap: ['Swap', 'Funding'], extraFee: ['Fee'], buyFee: ['Phí mua'], sellFee: ['Phí bán'], sales: ['Giá trị bán', 'Sales Value'], capital: ['Giá trị vốn', 'Giá vốn tổng', 'Cost Value'], proceeds: ['Giá trị ròng', 'Tiền thực nhận', 'Net Proceeds'],
  kind: ['kind', 'Income Type', 'Transaction Type'], accountKey: ['account_key', 'Account', 'Tài khoản', 'Tiểu khoản'], sequence: ['Sequence'],
};
type Definition = { id: ConnectorId; label: string; platform: SourceAdapter['platform']; required: string[]; reportType: Detection['reportType']; granularity: Detection['granularity']; fields?: Record<string, string[]>; timezone?: string };
const definitions: Definition[] = [
  { id: 'vn-stock-fills', label: 'Chứng khoán VN · Lệnh khớp', platform: 'VN_STOCK', required: ['symbol', 'timestamp', 'side', 'qty', 'price'], reportType: 'fills', granularity: 'fill', timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-stock-realized-pl', label: 'Chứng khoán VN · Lãi/lỗ đã thực hiện', platform: 'VN_STOCK', required: ['symbol', 'closeTime', 'qty', 'entry', 'exit', 'pnl'], reportType: 'closedPositions', granularity: 'day-symbol', timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'mt5-positions', label: 'MT4/MT5 · Positions', platform: 'MT5', required: ['nativeId', 'symbol', 'side', 'qty', 'entry', 'exit', 'openTime', 'closeTime', 'pnl'], reportType: 'closedPositions', granularity: 'position', fields: { nativeId: ['Position', 'Ticket'], openTime: ['Time', 'Open Time'], closeTime: ['Time__2', 'Close Time'], entry: ['Price', 'Open Price'], exit: ['Price__2', 'Close Price'] } },
  { id: 'mt5-deals', label: 'MT5 · Deals', platform: 'MT5', required: ['nativeId', 'symbol', 'timestamp', 'side', 'qty', 'price'], reportType: 'mixed', granularity: 'fill', fields: { nativeId: ['Deal'], positionId: ['Position ID'], kind: ['Direction'] } },
  { id: 'binance-position-history', label: 'Binance · Position History', platform: 'BINANCE', required: ['symbol', 'positionSide', 'openTime', 'closeTime', 'entry', 'exit', 'pnl'], reportType: 'closedPositions', granularity: 'position', timezone: 'UTC', fields: { pnl: ['Closing PNL'], qty: ['Closed Quantity', 'Closing Quantity'], displayQty: ['Max Open Interest'] } },
  { id: 'binance-trade-history', label: 'Binance · Trade History', platform: 'BINANCE', required: ['symbol', 'timestamp', 'side', 'qty', 'price', 'feeCurrency'], reportType: 'fills', granularity: 'fill', timezone: 'UTC' },
  { id: 'binance-transaction-history', label: 'Binance · Transaction History', platform: 'BINANCE', required: ['timestamp', 'kind', 'ccy', 'amount'], reportType: 'cashEvents', granularity: 'fill', timezone: 'UTC', fields: { kind: ['Type', 'Income Type', 'Transaction Type'], nativeId: ['TranId', 'Transaction ID'] } },
  { id: 'generic-template', label: 'Mẫu CSV chuẩn · Fill / Cash', platform: 'GENERIC', required: ['timestamp', 'nativeId', 'accountKey'], reportType: 'mixed', granularity: 'fill', timezone: 'UTC', fields: { timestamp: ['timestamp_utc'], nativeId: ['source_id'], accountKey: ['account_key'], feeCurrency: ['fee_currency'], kind: ['kind'], feeKind: ['fee_kind'] } },
];
export const adapters: SourceAdapter[] = definitions.map(def => {
  const fields = { ...common, ...def.fields };
  const adapter: SourceAdapter = {
    ...def, version: '3.0.0-fixtures', fields,
    declare: { pnlBasis: def.id === 'binance-position-history' ? 'unknown' : 'gross', costCompleteness: 'partial', costSigns: { fee: def.platform === 'MT5' ? 'negative-is-paid' : 'positive-is-paid', extraFee: 'negative-is-paid', swap: 'negative-is-paid' }, allowsShort: def.platform !== 'VN_STOCK', defaultTimezone: def.timezone },
    detect(sample) {
      const mapping = Object.fromEntries(Object.entries(fields).flatMap(([key, aliases]) => { const found = aliases.flatMap(alias => sample.headers.filter(h => headerKey(h) === headerKey(alias)))[0]; return found ? [[key, found]] : []; }));
      const matched = def.required.filter(k => mapping[k]).length;
      const warnings: Detection['warnings'] = [{ code: 'FIXTURE_ONLY_ADAPTER', severity: 'info', message: 'Adapter đã kiểm thử bằng dữ liệu giả lập; chưa kiểm chứng file thật của tài khoản này.' }];
      if (def.id === 'binance-position-history') warnings.push({ code: 'FUNDING_NOT_INCLUDED', severity: 'needs-confirmation', message: 'Position History có thể thiếu funding. Xác nhận Gross/Net và khối lượng thực đóng; Max Open Interest không phải khối lượng đóng.' });
      if (def.id === 'mt5-deals') warnings.push({ code: 'MT5_HEDGE_POSITION_ID', severity: 'info', message: 'Tài khoản hedging cần Position ID trong Deals. Nếu không có, hãy dùng báo cáo Positions.' });
      return { connector: def.id, platform: def.platform, reportType: def.reportType, granularity: def.id === 'vn-stock-realized-pl' && mapping.nativeId ? 'closing-order' : def.granularity, confidence: matched / def.required.length, columnMapping: mapping, warnings };
    },
    async parse(rows, { config: cfg, account, batchId }) {
      const out: Parsed = { fills: [], cashEvents: [], errors: [], warnings: adapter.detect({ name: '', headers: Object.values(cfg.columnMapping), rows: [] }).warnings };
      if (account.platform !== adapter.platform && adapter.id !== 'generic-template') throw new Error('Nguồn không khớp tài khoản.');
      if (def.platform === 'VN_STOCK' && (account.baseCcy !== 'VND' || account.quoteCcy !== 'VND' || account.allowsShort)) throw new Error('Tài khoản chứng khoán VN phải dùng VNĐ và không bán khống.');
      positive(cfg.priceUnit.multiplierToCcy); if (cfg.qtyUnit) positive(cfg.qtyUnit.multiplier);
      const warn = (code: string, message: string, row: number) => out.warnings.push({ code, message, severity: 'needs-confirmation', rowRefs: [row] });
      for (const row of rows) {
        try {
          const get = (key: string) => row.values[cfg.columnMapping[key]]?.trim() ?? '';
          const num = (key: string, required = true) => { const v = get(key); if (!v && !required) return undefined; if (!v) throw new Error(`Thiếu ${key}`); return row.numericCells?.includes(cfg.columnMapping[key]) ? dec(D(v)) : parseDecimal(v, cfg.decimalSeparator, cfg.thousandSeparator); };
          const time = (key: string) => { const text = get(key); if (def.id === 'generic-template' && !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) throw new Error('Mẫu chuẩn cần thời gian ISO có Z hoặc ±HH:MM.'); return parseTime(text, cfg.sourceTimezone, row.dateSystem); };
          if (def.id === 'generic-template' && cfg.decimalSeparator !== '.') throw new Error('Mẫu chuẩn dùng dấu thập phân là chấm.');
          if (get('accountKey') && get('accountKey') !== account.accountKey) throw new Error('Dòng thuộc tài khoản khác.');
          const nativeId = get('nativeId') || undefined, ccy = (get('ccy') || account.baseCcy).toUpperCase();
          if (nativeId && row.numericCells?.includes(cfg.columnMapping.nativeId) && !Number.isSafeInteger(Number(nativeId))) throw new Error('Mã lệnh dạng số Excel vượt độ chính xác; cần xuất mã dưới dạng văn bản.');
          const cashRow = def.id === 'binance-transaction-history' || (def.id === 'generic-template' && get('kind')) || (def.id === 'mt5-deals' && /^(balance|credit)$/i.test(get('side')));
          if (cashRow) {
            const kindText = headerKey(get('kind') || get('side'));
            const mapping: Record<string, CashEvent['kind']> = { fundingfee: 'funding', funding: 'funding', swap: 'swap', interest: 'interest', commission: 'commission', deposit: 'deposit', withdrawal: 'withdrawal', realizedpnl: 'reported-realized', reportedrealized: 'reported-realized', other: 'other' };
            let amount = num(def.id === 'mt5-deals' ? 'pnl' : 'amount')!;
            const kind = def.id === 'mt5-deals' ? (D(amount).gte(0) ? 'deposit' : 'withdrawal') : mapping[kindText];
            if (!kind) throw new Error(`Loại dòng tiền chưa hỗ trợ: ${get('kind')}`);
            // CashEvent stores costs paid positive and rebates negative; deposits/withdrawals positive.
            if (['deposit', 'withdrawal'].includes(kind)) amount = dec(D(amount).abs());
            else if (def.id === 'binance-transaction-history' && kind !== 'reported-realized') amount = dec(D(amount).neg());
            let event: CashEvent = { eventId: crypto.randomUUID(), batchId, accountId: account.accountId, active: true, tsUtc: time('timestamp'), kind, amount, ccy, symbol: get('symbol') ? symbolIdentity(get('symbol')) : undefined, nativeId, positionId: get('positionId') || undefined, dedupeKey: '', dedupeOcc: 1, normVersion: 1, raw: row.values };
            event = normalizeCash(cashSchema.parse(event)); event.dedupeKey = await cashKey(event, account); out.cashEvents.push(event); continue;
          }
          const symbol = symbolIdentity(get('symbol'), cfg.symbolSuffixes);
          const qty = dec(D(positive(num('qty')!, 'quantity')).mul(D(cfg.qtyUnit?.multiplier ?? '1')));
          const price = (key: string) => dec(D(positive(num(key)!, key)).mul(D(cfg.priceUnit.multiplierToCcy)));
          const sideText = headerKey(get('side') || get('positionSide'));
          const side = ['buy', 'mua', 'b', 'long'].includes(sideText) ? 'buy' : ['sell', 'ban', 's', 'short'].includes(sideText) ? 'sell' : undefined;
          if (!side && def.id !== 'vn-stock-realized-pl') throw new Error('Không nhận diện được chiều Mua/Bán.');
          const costs: CostItem[] = [];
          const addCost = (key: string, kind: CostItem['kind'], negativePaid = false, required = false) => {
            const amount = num(key, false), feeCcy = (get('feeCurrency') || ccy).toUpperCase();
            const sign = cfg.costSigns?.[key];
            costs.push({ kind, ccy: key === 'fee' ? feeCcy : ccy, origin: amount === undefined ? 'missing' : 'reported', amount: amount === undefined ? undefined : dec((sign ? sign === 'negative-is-paid' : negativePaid) ? D(amount).neg() : D(amount)), batchId });
            if (amount === undefined && required) warn('MISSING_COST', `Chưa có ${key}; không giả định bằng 0.`, row.row);
          };
          if (def.platform === 'VN_STOCK') {
            const closed = def.id === 'vn-stock-realized-pl';
            const basis = closed ? price('entry') : price('price');
            const feeKeys = closed ? ['buyFee', 'sellFee', 'tax'] : ['fee', ...(side === 'sell' ? ['tax'] : [])];
            for (const key of feeKeys) {
              if (closed && key === 'tax' && get('sales') && get('proceeds') && !get('sellFee') && !get('tax')) continue;
              const value = num(key, false);
              if (value !== undefined) costs.push({ kind: key === 'tax' ? 'tax' : 'commission', amount: dec(cfg.costSigns?.fee === 'negative-is-paid' ? D(value).neg() : D(value)), ccy: 'VND', origin: 'reported', batchId });
              else if (closed && key === 'sellFee' && get('sales') && get('proceeds') && !get('tax')) {
                const derived = D(num('sales')!).minus(D(num('proceeds')!));
                if (derived.lt(0)) throw new Error('Giá trị ròng lớn hơn giá trị bán; kiểm tra ánh xạ phí.');
                costs.push({ kind: 'commission', ccy: 'VND', amount: dec(derived), origin: 'derived', batchId });
                warn('DERIVED_SALE_COST', 'Phí và thuế bán được suy ra từ giá trị bán − giá trị ròng; chưa tách được từng loại.', row.row);
              } else {
                const rate = key === 'tax' ? account.feePreset?.taxSellRate : key === 'buyFee' || side === 'buy' ? account.feePreset?.buyRate : account.feePreset?.sellRate;
                const base = closed && key !== 'buyFee' ? price('exit') : basis;
                const calculated = rate === undefined ? undefined : D(base).mul(D(qty)).mul(D(rate));
                const amount = calculated ? dec(key !== 'tax' && account.feePreset?.minFee && calculated.lt(D(account.feePreset.minFee)) ? D(account.feePreset.minFee) : calculated) : undefined;
                costs.push({ kind: key === 'tax' ? 'tax' : 'commission', amount, ccy: 'VND', origin: amount === undefined ? 'missing' : 'derived', batchId });
                warn(amount === undefined ? 'MISSING_COST' : 'DERIVED_COST', `${key}: ${amount === undefined ? 'chưa biết' : 'ước tính từ biểu phí'}.`, row.row);
              }
            }
          } else { addCost('fee', 'commission', def.platform === 'MT5', true); if (def.platform === 'MT5' && get('extraFee') && cfg.columnMapping.extraFee !== cfg.columnMapping.fee) addCost('extraFee', 'commission', true); if (get('swap') || def.platform === 'MT5') addCost('swap', 'swap', true); }
          if (def.id === 'generic-template' && get('feeKind')) {
            const kind = get('feeKind');
            if (!['commission', 'tax', 'funding', 'swap', 'interest', 'other'].includes(kind)) throw new Error('fee_kind không hợp lệ.');
            costs[0].kind = kind as CostItem['kind'];
          }
          for (const cost of costs) {
            const fx = cfg.feeFx?.find(f => f.ccy.toUpperCase() === cost.ccy);
            if (fx) cost.rateToVND = positive(fx.rateToVND);
          }
          const rootSymbol = cfg.symbolRoots?.[symbol] || (account.market === 'commodity' ? symbol.match(/^([A-Z]{1,6})[FGHJKMNQUVXZ]\d{1,4}$/)?.[1] : undefined) || symbol;
          const commonFill = { fillId: crypto.randomUUID(), batchId, accountId: account.accountId, bookKey: '', symbol, rootSymbol, nativeId, positionId: get('positionId') || (def.id === 'mt5-positions' ? nativeId : undefined), positionSide: /^(LONG|SHORT)$/i.test(get('positionSide')) ? get('positionSide').toUpperCase() as 'LONG' | 'SHORT' : undefined, dedupeKey: '', dedupeOcc: 1, normVersion: 1, active: true, raw: row.values, qty, costs };
          let fill: Fill;
          const pnl = num('pnl', false);
          if (def.reportType === 'closedPositions') {
            if (pnl === undefined) throw new Error('Thiếu P&L báo cáo.');
            const reported = { reportedGross: cfg.pnlBasis === 'gross' ? pnl : undefined, reportedNet: cfg.pnlBasis === 'net' ? pnl : undefined };
            if (cfg.pnlBasis === 'unknown') throw new Error('Cần xác nhận P&L là Gross hay Net.');
            fill = def.id === 'vn-stock-realized-pl'
              ? { ...commonFill, role: 'reported-close', closeTsUtc: time('closeTime'), avgCostPrice: price('entry'), closePrice: price('exit'), ...reported, ccy, granularity: nativeId ? 'closing-order' : 'day-symbol' }
              : { ...commonFill, role: 'reported-position', openTsUtc: time('openTime'), closeTsUtc: time('closeTime'), openPrice: price('entry'), closePrice: price('exit'), direction: side === 'buy' ? 'LONG' : 'SHORT', ...reported, ccy, stopLossPrice: num('sl', false) && !D(num('sl')!).isZero() ? price('sl') : undefined, stopOrigin: 'reported-current', takeProfitPrice: num('tp', false) && !D(num('tp')!).isZero() ? price('tp') : undefined };
            if (def.id === 'vn-stock-realized-pl') warn('APPROXIMATE_CYCLE', 'Báo cáo lãi/lỗ không xác định được chu kỳ và thời gian giữ lệnh chính xác.', row.row);
          } else {
            const realized = def.id === 'mt5-deals' && !/^(out|out by|inout)$/i.test(get('kind')) ? undefined : pnl;
            fill = { ...commonFill, role: 'fill', tsUtc: time('timestamp'), side: side!, price: price('price'), seq: get('sequence') || undefined, reportedRealized: realized === undefined ? undefined : { [cfg.pnlBasis === 'net' ? 'net' : 'gross']: realized, ccy } };
            if (def.platform === 'BINANCE') for (const cost of costs) {
              if (cost.ccy !== account.quoteCcy && symbol === `${cost.ccy}${account.quoteCcy}` && cost.amount !== undefined) {
                cost.amount = dec(D(cost.amount).mul(D(fill.price))); cost.ccy = account.quoteCcy; cost.origin = 'derived';
                warn('BASE_ASSET_FEE_CONVERTED', 'Phí trả bằng đồng cơ sở được đổi sang đồng định giá theo giá khớp.', row.row);
              } else if (cost.ccy !== ccy && !['VND', 'USD', 'USDT'].includes(cost.ccy) && !cost.rateToVND) warn('MISSING_FEE_FX', `Chưa có tỷ giá ${cost.ccy}/VNĐ; Net VNĐ chưa xác định.`, row.row);
            }
            if (def.platform === 'VN_STOCK' && get('amount')) {
              const amount = D(num('amount')!).abs(), calculated = D(fill.price).mul(D(qty));
              if (amount.isZero() || calculated.minus(amount).abs().div(amount).gt('0.005')) throw new Error('PRICE_UNIT_MISMATCH: Giá × khối lượng lệch giá trị khớp >0,5%.');
            }
          }
          if (cfg.costCompleteness === 'complete' && costs.some(c => c.origin !== 'reported')) throw new Error('Không thể xác nhận đủ phí khi còn phí thiếu/ước tính.');
          fill.bookKey = bookKey(account, fill); fill = normalizeFill(fillSchema.parse(fill)); fill.dedupeKey = await fillKey(fill, account); out.fills.push(fill);
        } catch (e) { out.errors.push({ ...row, message: e instanceof Error ? e.message : String(e) }); }
      }
      return out;
    },
  };
  return adapter;
});
export const getAdapter = (id: ConnectorId) => adapters.find(a => a.id === id)!;
export function detectSource(sample: Parameters<SourceAdapter['detect']>[0]): Detection[] {
  const generic = sample.headers.some(h => h === 'timestamp_utc');
  const detections = adapters.map(a => a.detect(sample)).sort((a, b) => b.confidence - a.confidence || (generic ? Number(b.connector === 'generic-template') - Number(a.connector === 'generic-template') : 0) || a.connector.localeCompare(b.connector));
  const best = detections[0];
  if (best.confidence < 0.8 || detections.filter(d => d.confidence === best.confidence).length > 1 && !generic) best.warnings.push({ code: 'AMBIGUOUS_SOURCE', severity: 'needs-confirmation', message: 'Cấu trúc khớp nhiều nguồn hoặc chưa đủ tin cậy; hãy chọn đúng báo cáo.' });
  return detections;
}
