import { tradeSchema, type Trade } from './schema';
import { validateSnapshot, type Snapshot } from './snapshot';
import { tradeFacts } from '../core/trade';

export function replaceTradeLegs(
  data: Snapshot,
  id: string,
  legs: Trade['legs'],
  status: Trade['status'],
) {
  const old = data.trades.find((t) => t.id === id);
  if (!old) throw Error('TRADE_NOT_FOUND');
  const trade = tradeSchema.parse({
    ...old,
    legs,
    status,
    review: { ...old.review, done: false, at: undefined },
    updatedAt: new Date().toISOString(),
  });
  tradeFacts(trade);
  return validateSnapshot({ ...data, trades: data.trades.map((t) => (t.id === id ? trade : t)) });
}
export { mergeTrades } from './mergeTrades';
