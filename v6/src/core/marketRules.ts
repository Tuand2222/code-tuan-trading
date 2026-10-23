import type { FeeProfile, Trade } from '../data/schema';
import { D, dec, sum } from './money';
import { tradeFacts } from './trade';
export function profileCosts(t: Trade, p: FeeProfile, currency: string) {
  const f = tradeFacts(t),
    date = f.openTime.slice(0, 10);
  if (
    p.market !== t.market ||
    p.currency !== currency ||
    date < p.effectiveFrom ||
    (p.effectiveTo && date > p.effectiveTo) ||
    t.legs.some(
      (l) =>
        l.time.slice(0, 10) < p.effectiveFrom ||
        (p.effectiveTo && l.time.slice(0, 10) > p.effectiveTo),
    )
  )
    throw Error('Hồ sơ không khớp thị trường, tiền tệ hoặc ngày hiệu lực.');
  if (!p.allowShort && t.side === 'short') throw Error('Hồ sơ này không cho phép bán khống.');
  if (t.legs.some((l) => !D(l.quantity).mod(p.quantityStep).isZero()))
    throw Error('Khối lượng không đúng bước/lô của hồ sơ.');
  const notional = sum(t.legs.map((l) => dec(D(l.price).mul(l.quantity).mul(p.multiplier))));
  const sold = sum(
    t.legs
      .filter((l) => (t.side === 'long') === (l.kind === 'out'))
      .map((l) => dec(D(l.price).mul(l.quantity).mul(p.multiplier))),
  );
  const ordered = [...t.legs].sort((a, b) => a.time.localeCompare(b.time));
  let overnightUnits = D('0'),
    held = D('0'),
    index = 0;
  const rollover = new Date(f.openTime.slice(0, 10) + 'T00:00:00Z');
  rollover.setUTCDate(rollover.getUTCDate() + 1);
  for (
    let days = 0;
    f.closeTime && rollover.getTime() <= Date.parse(f.closeTime) && days < 36600;
    days++, rollover.setUTCDate(rollover.getUTCDate() + 1)
  ) {
    while (index < ordered.length && Date.parse(ordered[index].time) < rollover.getTime()) {
      const leg = ordered[index++];
      held = leg.kind === 'in' ? held.plus(leg.quantity) : held.minus(leg.quantity);
    }
    overnightUnits = overnightUnits.plus(held);
  }
  const quantity = sum(t.legs.map((l) => l.quantity));
  const warnings: string[] = [];
  const settlementLots: { date: string; quantity: ReturnType<typeof D> }[] = [];
  let early = false;
  for (const leg of ordered) {
    if (leg.kind === 'in')
      settlementLots.push({ date: leg.time.slice(0, 10), quantity: D(leg.quantity) });
    else {
      let remaining = D(leg.quantity);
      for (const lot of settlementLots) {
        if (remaining.isZero()) break;
        if (lot.quantity.isZero()) continue;
        const matched = remaining.lt(lot.quantity) ? remaining : lot.quantity;
        let sessions = 0;
        const cursor = new Date(lot.date + 'T12:00:00Z');
        for (
          let i = 0;
          i < 36600 && cursor.toISOString().slice(0, 10) < leg.time.slice(0, 10);
          i++
        ) {
          cursor.setUTCDate(cursor.getUTCDate() + 1);
          if (![0, 6].includes(cursor.getUTCDay())) sessions++;
        }
        if (p.settlementDays && sessions < p.settlementDays) early = true;
        remaining = remaining.minus(matched);
        lot.quantity = lot.quantity.minus(matched);
      }
    }
  }
  if (early)
    warnings.push(
      'Bán trước T+' +
        p.settlementDays +
        ' theo lịch ngày làm việc; chưa trừ ngày nghỉ lễ của sàn.',
    );
  return {
    multiplier: p.multiplier,
    warnings,
    costs: {
      ...t.costs,
      commission: dec(
        D(notional).mul(p.commissionPercent).div(100).plus(D(quantity).mul(p.commissionPerUnit)),
      ),
      tax: dec(D(sold).mul(p.sellTaxPercent).div(100)),
      swap: f.closeTime ? dec(D(p.overnightPerUnit).mul(overnightUnits)) : t.costs.swap,
    },
  };
}
