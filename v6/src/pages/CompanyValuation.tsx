'use client';
import '../app/valuation.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeNumericInput, parseNumericInput, selectNumericInput } from './numeric-input';

type ModelId =
  'fcff' | 'fcfe' | 'ddm' | 'residual' | 'multiples' | 'sotp' | 'apv' | 'reverse' | 'options';
type BusinessProfile = 'industrial' | 'financial' | 'growth' | 'holding' | 'leveraged' | 'resource';

type Segment = {
  name: string;
  metric: number;
  multiple: number;
};

type ValuationInputs = {
  companyName: string;
  ticker: string;
  currentPrice: number;
  shares: number;
  debt: number;
  cash: number;
  otherLiabilities: number;
  baseFcff: number;
  nopat: number;
  incrementalRoic: number;
  terminalRoic: number;
  fcffGrowth: number;
  baseFcfe: number;
  fcfeGrowth: number;
  terminalGrowth: number;
  riskFree: number;
  beta: number;
  equityRiskPremium: number;
  countryRiskPremium: number;
  preTaxDebtCost: number;
  taxRate: number;
  equityWeight: number;
  dividendPerShare: number;
  dividendGrowth: number;
  bookEquity: number;
  netIncome: number;
  stableRoe: number;
  payoutRatio: number;
  revenue: number;
  ebitda: number;
  peerEvSales: number;
  peerEvEbitda: number;
  peerPe: number;
  peerPb: number;
  unleveredCost: number;
  debtRepaymentYears: number;
  optionAssetValue: number;
  optionInvestment: number;
  optionYears: number;
  optionVolatility: number;
  optionCarryCost: number;
  segments: Segment[];
};

type CashFlowRow = {
  year: number;
  growth: number;
  cashFlow: number;
  presentValue: number;
};

type ValueResult = {
  enterpriseValue: number;
  equityValue: number;
  perShare: number;
  pvExplicit: number;
  pvTerminal: number;
  terminalShare: number;
  valid: boolean;
  rows: CashFlowRow[];
};

const STORAGE_KEY = 'tuan-trader-valuation-lab-v4';
const LEGACY_KEYS = ['tuan-trader-dcf-model-v2', 'tuan-trader-dcf-model-v1'];
const FORECAST_YEARS = 10;

const DEFAULT_INPUTS: ValuationInputs = {
  companyName: 'Doanh nghiệp Việt Nam mẫu',
  ticker: 'VNCO',
  currentPrice: 50_000,
  shares: 1_000,
  debt: 10_000,
  cash: 12_000,
  otherLiabilities: 1_000,
  baseFcff: 5_000,
  nopat: 12_500,
  incrementalRoic: 20,
  terminalRoic: 11,
  fcffGrowth: 12,
  baseFcfe: 4_200,
  fcfeGrowth: 10,
  terminalGrowth: 4,
  riskFree: 4.5,
  beta: 1.05,
  equityRiskPremium: 6,
  countryRiskPremium: 2,
  preTaxDebtCost: 8,
  taxRate: 20,
  equityWeight: 70,
  dividendPerShare: 2_000,
  dividendGrowth: 8,
  bookEquity: 40_000,
  netIncome: 6_000,
  stableRoe: 11.5,
  payoutRatio: 35,
  revenue: 50_000,
  ebitda: 8_000,
  peerEvSales: 2,
  peerEvEbitda: 10,
  peerPe: 14,
  peerPb: 1.8,
  unleveredCost: 11.5,
  debtRepaymentYears: 5,
  optionAssetValue: 12_000,
  optionInvestment: 10_000,
  optionYears: 5,
  optionVolatility: 35,
  optionCarryCost: 5,
  segments: [
    { name: 'Mảng kinh doanh cốt lõi', metric: 7_000, multiple: 9 },
    { name: 'Mảng tăng trưởng', metric: 1_000, multiple: 14 },
    { name: 'Tài sản / quỹ đất', metric: 8_000, multiple: 1 },
    { name: 'Đầu tư khác', metric: 1_000, multiple: 1 },
  ],
};

const PROFILE_META: Record<
  BusinessProfile,
  {
    label: string;
    description: string;
    recommended: ModelId[];
    weights: Partial<Record<ModelId, number>>;
  }
> = {
  industrial: {
    label: 'Doanh nghiệp phi tài chính',
    description: 'Dòng tiền vận hành tương đối ổn định',
    recommended: ['fcff', 'multiples', 'reverse'],
    weights: { fcff: 50, multiples: 30, fcfe: 20 },
  },
  financial: {
    label: 'Ngân hàng · Bảo hiểm',
    description: 'Vốn chủ và ROE là trục định giá',
    recommended: ['residual', 'ddm', 'multiples'],
    weights: { residual: 45, ddm: 25, multiples: 30 },
  },
  growth: {
    label: 'Tăng trưởng cao · FCF yếu',
    description: 'Kiểm tra kỳ vọng trước, giá trị sau',
    recommended: ['reverse', 'multiples', 'fcff'],
    weights: { multiples: 45, fcff: 35, options: 20 },
  },
  holding: {
    label: 'Holding · Bất động sản',
    description: 'Định giá từng tài sản và nghĩa vụ',
    recommended: ['sotp', 'multiples', 'fcff'],
    weights: { sotp: 60, multiples: 20, fcff: 20 },
  },
  leveraged: {
    label: 'Đòn bẩy thay đổi mạnh',
    description: 'Tách giá trị hoạt động và lá chắn thuế',
    recommended: ['apv', 'fcff', 'reverse'],
    weights: { apv: 50, fcff: 30, multiples: 20 },
  },
  resource: {
    label: 'Tài nguyên · Dự án tùy chọn',
    description: 'Giá trị phụ thuộc quyền trì hoãn / mở rộng',
    recommended: ['options', 'sotp', 'fcff'],
    weights: { options: 35, sotp: 35, fcff: 30 },
  },
};

const MODEL_META: { id: ModelId; label: string; short: string; use: string }[] = [
  {
    id: 'fcff',
    label: 'DCF · FCFF',
    short: 'Giá trị doanh nghiệp',
    use: 'Doanh nghiệp phi tài chính, cơ cấu vốn tương đối ổn định',
  },
  {
    id: 'fcfe',
    label: 'FCFE',
    short: 'Dòng tiền cổ đông',
    use: 'Nợ vay và chính sách tài trợ có thể dự phóng tin cậy',
  },
  {
    id: 'ddm',
    label: 'DDM',
    short: 'Cổ tức đa giai đoạn',
    use: 'Doanh nghiệp trả cổ tức đều, chính sách chi trả rõ ràng',
  },
  {
    id: 'residual',
    label: 'Residual Income',
    short: 'Lợi nhuận thặng dư',
    use: 'Ngân hàng, bảo hiểm hoặc doanh nghiệp có FCF khó đọc',
  },
  {
    id: 'multiples',
    label: 'Multiples',
    short: 'Định giá tương đối',
    use: 'Có nhóm so sánh đủ tương đồng và số liệu đã chuẩn hóa',
  },
  {
    id: 'sotp',
    label: 'SOTP · NAV',
    short: 'Tổng các bộ phận',
    use: 'Holding, tập đoàn đa ngành, bất động sản và tài sản ẩn',
  },
  {
    id: 'apv',
    label: 'APV',
    short: 'Giá trị hiện tại điều chỉnh',
    use: 'LBO, dự án hoặc doanh nghiệp có đòn bẩy thay đổi mạnh',
  },
  {
    id: 'reverse',
    label: 'Reverse DCF',
    short: 'Kỳ vọng trong giá',
    use: 'Kiểm tra thị trường đang đòi hỏi tăng trưởng bao nhiêu',
  },
  {
    id: 'options',
    label: 'Real Options',
    short: 'Giá trị linh hoạt',
    use: 'Mỏ, bằng sáng chế, quỹ đất, quyền mở rộng hoặc trì hoãn',
  },
];

const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const PRICE = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function moneyBn(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${NUMBER.format(value)} tỷ`;
}

function price(value: number) {
  if (!Number.isFinite(value)) return '—';
  return PRICE.format(Math.max(0, value));
}

function growthAt(year: number, highGrowth: number, terminalGrowth: number) {
  if (year <= 5) return highGrowth;
  return highGrowth + (terminalGrowth - highGrowth) * ((year - 5) / 5);
}

function costOfEquity(input: ValuationInputs) {
  return input.riskFree + input.beta * input.equityRiskPremium + input.countryRiskPremium;
}

function wacc(input: ValuationInputs) {
  const equityWeight = clamp(input.equityWeight, 0, 100) / 100;
  const debtWeight = 1 - equityWeight;
  const afterTaxDebt = input.preTaxDebtCost * (1 - clamp(input.taxRate, 0, 100) / 100);
  return equityWeight * costOfEquity(input) + debtWeight * afterTaxDebt;
}

function discountedCashFlow(
  baseCashFlow: number,
  highGrowth: number,
  terminalGrowth: number,
  discountRate: number,
  input: ValuationInputs,
  equityDirect: boolean,
): ValueResult {
  const rate = discountRate / 100;
  const terminal = terminalGrowth / 100;
  const valid = rate > terminal && rate > 0;
  const denominator = Math.max(rate - terminal, 0.0025);
  let cashFlow = baseCashFlow;
  const rows: CashFlowRow[] = [];
  for (let year = 1; year <= FORECAST_YEARS; year += 1) {
    const growth = growthAt(year, highGrowth, terminalGrowth);
    cashFlow *= 1 + growth / 100;
    rows.push({
      year,
      growth,
      cashFlow,
      presentValue: cashFlow / (1 + Math.max(rate, 0.001)) ** year,
    });
  }
  const pvExplicit = rows.reduce((sum, row) => sum + row.presentValue, 0);
  const terminalValue = (cashFlow * (1 + terminal)) / denominator;
  const pvTerminal = terminalValue / (1 + Math.max(rate, 0.001)) ** FORECAST_YEARS;
  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = equityDirect
    ? enterpriseValue
    : enterpriseValue - input.debt + input.cash - input.otherLiabilities;
  return {
    enterpriseValue,
    equityValue,
    perShare: (equityValue * 1_000) / Math.max(input.shares, 1),
    pvExplicit,
    pvTerminal,
    terminalShare: enterpriseValue ? (pvTerminal / enterpriseValue) * 100 : 0,
    valid,
    rows,
  };
}

function dividendValue(input: ValuationInputs) {
  const discountRate = costOfEquity(input) / 100;
  const terminal = input.terminalGrowth / 100;
  const valid = discountRate > terminal;
  let dividend = input.dividendPerShare;
  let pvExplicit = 0;
  const rows: CashFlowRow[] = [];
  for (let year = 1; year <= FORECAST_YEARS; year += 1) {
    const growth = growthAt(year, input.dividendGrowth, input.terminalGrowth);
    dividend *= 1 + growth / 100;
    const presentValue = dividend / (1 + Math.max(discountRate, 0.001)) ** year;
    pvExplicit += presentValue;
    rows.push({ year, growth, cashFlow: dividend, presentValue });
  }
  const terminalValue = (dividend * (1 + terminal)) / Math.max(discountRate - terminal, 0.0025);
  const pvTerminal = terminalValue / (1 + Math.max(discountRate, 0.001)) ** FORECAST_YEARS;
  return {
    perShare: pvExplicit + pvTerminal,
    pvExplicit,
    pvTerminal,
    terminalShare: (pvTerminal / Math.max(pvExplicit + pvTerminal, 1)) * 100,
    valid,
    rows,
  };
}

function residualIncomeValue(input: ValuationInputs) {
  const requiredReturn = costOfEquity(input) / 100;
  const startingRoe = input.bookEquity ? input.netIncome / input.bookEquity : 0;
  const stableRoe = input.stableRoe / 100;
  const startingPayout = clamp(input.payoutRatio, 0, 100) / 100;
  const terminalGrowth = input.terminalGrowth / 100;
  const terminalPayout = clamp(1 - terminalGrowth / Math.max(stableRoe, 0.001), 0, 1);
  let book = input.bookEquity;
  let pvResidual = 0;
  const rows: CashFlowRow[] = [];
  for (let year = 1; year <= FORECAST_YEARS; year += 1) {
    const roe = startingRoe + (stableRoe - startingRoe) * (year / FORECAST_YEARS);
    const income = book * roe;
    const residual = income - book * requiredReturn;
    const presentValue = residual / (1 + Math.max(requiredReturn, 0.001)) ** year;
    const payout = startingPayout + (terminalPayout - startingPayout) * (year / FORECAST_YEARS);
    pvResidual += presentValue;
    rows.push({ year, growth: roe * 100, cashFlow: residual, presentValue });
    book += income * (1 - payout);
  }
  const valid = requiredReturn > terminalGrowth;
  const residualNext = (stableRoe - requiredReturn) * book * (1 + terminalGrowth);
  const continuingValue = residualNext / Math.max(requiredReturn - terminalGrowth, 0.0025);
  const pvContinuing = continuingValue / (1 + Math.max(requiredReturn, 0.001)) ** FORECAST_YEARS;
  const equityValue = input.bookEquity + pvResidual + pvContinuing;
  return {
    equityValue,
    perShare: (equityValue * 1_000) / Math.max(input.shares, 1),
    pvResidual,
    pvContinuing,
    endingBook: book,
    startingRoe: startingRoe * 100,
    valid,
    rows,
  };
}

function multiplesValue(input: ValuationInputs) {
  const rows = [
    {
      label: 'EV / Revenue',
      multiple: input.peerEvSales,
      price:
        ((input.revenue * input.peerEvSales - input.debt + input.cash - input.otherLiabilities) *
          1_000) /
        Math.max(input.shares, 1),
    },
    {
      label: 'EV / EBITDA',
      multiple: input.peerEvEbitda,
      price:
        ((input.ebitda * input.peerEvEbitda - input.debt + input.cash - input.otherLiabilities) *
          1_000) /
        Math.max(input.shares, 1),
    },
    {
      label: 'P / E',
      multiple: input.peerPe,
      price: (input.netIncome * input.peerPe * 1_000) / Math.max(input.shares, 1),
    },
    {
      label: 'P / B',
      multiple: input.peerPb,
      price: (input.bookEquity * input.peerPb * 1_000) / Math.max(input.shares, 1),
    },
  ];
  const sorted = rows
    .map((row) => row.price)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const perShare = sorted.length ? (sorted[1] + sorted[2]) / 2 : 0;
  return { rows, perShare, low: sorted[0] ?? 0, high: sorted[sorted.length - 1] ?? 0 };
}

function sotpValue(input: ValuationInputs) {
  const rows = input.segments.map((segment) => ({
    ...segment,
    value: segment.metric * segment.multiple,
  }));
  const enterpriseValue = rows.reduce((sum, row) => sum + row.value, 0);
  const equityValue = enterpriseValue - input.debt + input.cash - input.otherLiabilities;
  return {
    rows,
    enterpriseValue,
    equityValue,
    perShare: (equityValue * 1_000) / Math.max(input.shares, 1),
  };
}

function apvValue(input: ValuationInputs) {
  const operations = discountedCashFlow(
    input.baseFcff,
    input.fcffGrowth,
    input.terminalGrowth,
    input.unleveredCost,
    input,
    true,
  );
  const years = clamp(Math.round(input.debtRepaymentYears), 1, 30);
  const debtCost = Math.max(input.preTaxDebtCost / 100, 0.001);
  const annualPrincipal = input.debt / years;
  let debtBalance = input.debt;
  let pvTaxShield = 0;
  for (let year = 1; year <= years; year += 1) {
    const taxShield = (debtBalance * debtCost * clamp(input.taxRate, 0, 100)) / 100;
    pvTaxShield += taxShield / (1 + debtCost) ** year;
    debtBalance = Math.max(0, debtBalance - annualPrincipal);
  }
  const adjustedEnterprise = operations.enterpriseValue + pvTaxShield;
  const equityValue = adjustedEnterprise - input.debt + input.cash - input.otherLiabilities;
  return {
    operations,
    pvTaxShield,
    adjustedEnterprise,
    equityValue,
    perShare: (equityValue * 1_000) / Math.max(input.shares, 1),
  };
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function realOptionValue(input: ValuationInputs) {
  const asset = Math.max(input.optionAssetValue, 0.001);
  const investment = Math.max(input.optionInvestment, 0.001);
  const years = Math.max(input.optionYears, 0.01);
  const volatility = Math.max(input.optionVolatility / 100, 0.001);
  const riskFree = input.riskFree / 100;
  const carry = Math.max(input.optionCarryCost / 100, 0);
  const d1 =
    (Math.log(asset / investment) + (riskFree - carry + volatility ** 2 / 2) * years) /
    (volatility * Math.sqrt(years));
  const d2 = d1 - volatility * Math.sqrt(years);
  const optionValue =
    asset * Math.exp(-carry * years) * normalCdf(d1) -
    investment * Math.exp(-riskFree * years) * normalCdf(d2);
  const staticNpv = asset - investment;
  return {
    optionValue,
    staticNpv,
    flexibilityPremium: optionValue - Math.max(staticNpv, 0),
    d1,
    d2,
  };
}

function reverseDcf(input: ValuationInputs, discountRate: number) {
  const targetEnterprise =
    (input.currentPrice * Math.max(input.shares, 1)) / 1_000 +
    input.debt -
    input.cash +
    input.otherLiabilities;
  const enterpriseAt = (growth: number) =>
    discountedCashFlow(input.baseFcff, growth, input.terminalGrowth, discountRate, input, false)
      .enterpriseValue;
  let low = -50;
  let high = 100;
  const lowValue = enterpriseAt(low);
  const highValue = enterpriseAt(high);
  const inRange = targetEnterprise >= lowValue && targetEnterprise <= highValue;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    if (enterpriseAt(middle) < targetEnterprise) low = middle;
    else high = middle;
  }
  const impliedGrowth = (low + high) / 2;
  const impliedYear5Fcff = input.baseFcff * (1 + impliedGrowth / 100) ** 5;
  return { impliedGrowth, impliedYear5Fcff, targetEnterprise, inRange };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function monteCarlo(input: ValuationInputs, discountRate: number) {
  const random = seededRandom(20260807);
  const normal = () => {
    const first = Math.max(random(), 1e-9);
    const second = random();
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  };
  const samples = Array.from({ length: 1_200 }, () => {
    const sampledWacc = clamp(discountRate + normal() * 1.25, 3, 30);
    const sampledTerminal = clamp(input.terminalGrowth + normal() * 0.75, -2, sampledWacc - 0.5);
    const sampledGrowth = clamp(input.fcffGrowth + normal() * 4, -20, 80);
    return Math.max(
      0,
      discountedCashFlow(input.baseFcff, sampledGrowth, sampledTerminal, sampledWacc, input, false)
        .perShare,
    );
  }).sort((a, b) => a - b);
  const percentile = (p: number) =>
    samples[Math.min(samples.length - 1, Math.round((samples.length - 1) * p))];
  const p10 = percentile(0.1);
  const p50 = percentile(0.5);
  const p90 = percentile(0.9);
  const probabilityAboveMarket =
    (samples.filter((value) => value >= input.currentPrice).length / samples.length) * 100;
  const min = percentile(0.02);
  const max = Math.max(percentile(0.98), min + 1);
  const bins = Array.from({ length: 12 }, () => 0);
  for (const sample of samples) {
    const index = clamp(
      Math.floor(((clamp(sample, min, max) - min) / (max - min)) * bins.length),
      0,
      bins.length - 1,
    );
    bins[index] += 1;
  }
  return { p10, p50, p90, probabilityAboveMarket, bins, min, max };
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);
  return (
    <label className="vlab-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          onFocus={(event) => {
            editing.current = true;
            selectNumericInput(event);
          }}
          onChange={(event) => {
            const next = normalizeNumericInput(event.target.value);
            setDraft(next);
            const parsed = parseNumericInput(next);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
            editing.current = false;
            setDraft(String(value));
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

function CashFlowTable({
  rows,
  label,
  unit = 'tỷ VNĐ',
}: {
  rows: CashFlowRow[];
  label: string;
  unit?: string;
}) {
  return (
    <div
      className="vlab-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Bảng định giá có thể cuộn"
    >
      <table className="vlab-forecast-table">
        <tbody>
          <tr>
            <th>Năm dự phóng</th>
            {rows.map((row) => (
              <td key={row.year}>N{row.year}</td>
            ))}
          </tr>
          <tr>
            <th>{label}</th>
            {rows.map((row) => (
              <td key={row.year}>{NUMBER.format(row.cashFlow)}</td>
            ))}
          </tr>
          <tr>
            <th>Tăng trưởng / ROE</th>
            {rows.map((row) => (
              <td key={row.year}>{row.growth.toFixed(1)}%</td>
            ))}
          </tr>
          <tr className="highlight">
            <th>Giá trị hiện tại</th>
            {rows.map((row) => (
              <td key={row.year}>{NUMBER.format(row.presentValue)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <small className="vlab-table-unit">Đơn vị: {unit}</small>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'gold';
}) {
  return (
    <div className={`vlab-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function ModelIntro({ id, recommended }: { id: ModelId; recommended: boolean }) {
  const meta = MODEL_META.find((model) => model.id === id)!;
  return (
    <div className="vlab-model-intro">
      <div>
        <span>{meta.short}</span>
        <h3>{meta.label}</h3>
        <p>{meta.use}</p>
      </div>
      {recommended && <b>Phù hợp hồ sơ đã chọn</b>}
    </div>
  );
}

export default function CompanyValuation() {
  const [input, setInput] = useState<ValuationInputs>(DEFAULT_INPUTS);
  const [profile, setProfile] = useState<BusinessProfile>('industrial');
  const [activeModel, setActiveModel] = useState<ModelId>('fcff');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const current = window.localStorage.getItem(STORAGE_KEY);
        if (current) {
          const saved = JSON.parse(current) as {
            input?: Partial<ValuationInputs>;
            profile?: BusinessProfile;
          };
          setInput({
            ...DEFAULT_INPUTS,
            ...saved.input,
            segments: saved.input?.segments ?? DEFAULT_INPUTS.segments,
          });
          if (saved.profile && PROFILE_META[saved.profile]) setProfile(saved.profile);
          return;
        }
        for (const key of LEGACY_KEYS) {
          const legacy = window.localStorage.getItem(key);
          if (!legacy) continue;
          const saved = JSON.parse(legacy) as Record<string, number | string>;
          setInput((currentInput) => ({
            ...currentInput,
            companyName: String(saved.companyName ?? currentInput.companyName),
            ticker: String(saved.ticker ?? currentInput.ticker),
            baseFcff: Number(saved.freeCashFlow ?? currentInput.baseFcff),
            debt: Number(saved.debt ?? currentInput.debt),
            cash: Number(saved.cash ?? currentInput.cash),
            fcffGrowth: Number(saved.growth1 ?? currentInput.fcffGrowth),
            terminalGrowth: Number(saved.growth3 ?? currentInput.terminalGrowth),
            shares: Number(saved.shares ?? currentInput.shares),
            currentPrice: Number(saved.currentPrice ?? currentInput.currentPrice),
          }));
          break;
        }
      } catch {
        /* Keep the audited illustrative model. */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = <K extends keyof ValuationInputs>(key: K, value: ValuationInputs[K]) =>
    setInput((current) => ({ ...current, [key]: value }));
  const updateSegment = (index: number, patch: Partial<Segment>) =>
    setInput((current) => ({
      ...current,
      segments: current.segments.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...patch } : segment,
      ),
    }));
  const coe = costOfEquity(input);
  const discountRate = wacc(input);
  const fcff = useMemo(
    () =>
      discountedCashFlow(
        input.baseFcff,
        input.fcffGrowth,
        input.terminalGrowth,
        discountRate,
        input,
        false,
      ),
    [input, discountRate],
  );
  const fcfe = useMemo(
    () =>
      discountedCashFlow(input.baseFcfe, input.fcfeGrowth, input.terminalGrowth, coe, input, true),
    [input, coe],
  );
  const ddm = useMemo(() => dividendValue(input), [input]);
  const residual = useMemo(() => residualIncomeValue(input), [input]);
  const multiples = useMemo(() => multiplesValue(input), [input]);
  const sotp = useMemo(() => sotpValue(input), [input]);
  const apv = useMemo(() => apvValue(input), [input]);
  const option = useMemo(() => realOptionValue(input), [input]);
  const optionAdjustedPerShare =
    fcff.perShare + (option.optionValue * 1_000) / Math.max(input.shares, 1);
  const reverse = useMemo(() => reverseDcf(input, discountRate), [input, discountRate]);
  const simulation = useMemo(() => monteCarlo(input, discountRate), [input, discountRate]);
  const profileMeta = PROFILE_META[profile];
  const modelValues: Record<ModelId, number> = {
    fcff: fcff.perShare,
    fcfe: fcfe.perShare,
    ddm: ddm.perShare,
    residual: residual.perShare,
    multiples: multiples.perShare,
    sotp: sotp.perShare,
    apv: apv.perShare,
    reverse: input.currentPrice,
    options: optionAdjustedPerShare,
  };
  const weightedModels = Object.entries(profileMeta.weights)
    .map(([id, weight]) => ({
      id: id as ModelId,
      weight: Number(weight),
      value: modelValues[id as ModelId],
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0);
  const totalWeight = weightedModels.reduce((sum, row) => sum + row.weight, 0);
  const consensus =
    weightedModels.reduce((sum, row) => sum + row.value * row.weight, 0) / Math.max(totalWeight, 1);
  const comparisonMax = Math.max(input.currentPrice, ...weightedModels.map((row) => row.value), 1);
  const upside = input.currentPrice ? (consensus / input.currentPrice - 1) * 100 : 0;
  const reinvestmentRate = input.nopat ? (1 - input.baseFcff / input.nopat) * 100 : 0;
  const fundamentalGrowth = (reinvestmentRate * input.incrementalRoic) / 100;
  const terminalReinvestment = input.terminalRoic
    ? (input.terminalGrowth / input.terminalRoic) * 100
    : 0;
  const guardrailBroken =
    input.terminalGrowth >= Math.min(discountRate, coe, input.unleveredCost) ||
    terminalReinvestment > 100;

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ input, profile }));
    setNotice('Đã lưu toàn bộ mô hình trên thiết bị.');
  };

  const sharedCapitalFields = (
    <div className="vlab-input-grid">
      <NumberField
        label="Lãi suất phi rủi ro"
        unit="%"
        value={input.riskFree}
        step={0.1}
        onChange={(value) => update('riskFree', value)}
      />
      <NumberField
        label="Beta"
        unit="x"
        value={input.beta}
        step={0.05}
        min={0}
        onChange={(value) => update('beta', value)}
      />
      <NumberField
        label="Phần bù rủi ro cổ phiếu"
        unit="%"
        value={input.equityRiskPremium}
        step={0.1}
        onChange={(value) => update('equityRiskPremium', value)}
      />
      <NumberField
        label="Phần bù rủi ro quốc gia"
        unit="%"
        value={input.countryRiskPremium}
        step={0.1}
        onChange={(value) => update('countryRiskPremium', value)}
      />
    </div>
  );

  return (
    <div className="vlab-shell">
      <section className="vlab-hero">
        <div className="vlab-hero-copy">
          <span className="vlab-kicker">
            <i /> VALUATION LAB · 9 MODELS · PROBABILISTIC
          </span>
          <h2>Định giá doanh nghiệp 360°</h2>
          <p>
            Từ dòng tiền, lợi nhuận thặng dư và tài sản đến kỳ vọng ẩn trong giá. Mỗi kết quả phải
            được kiểm tra chéo — không có một “con số đúng” duy nhất.
          </p>
        </div>
        <div className="vlab-hero-actions">
          <label>
            <span>Hồ sơ doanh nghiệp</span>
            <select
              value={profile}
              onChange={(event) => {
                const next = event.target.value as BusinessProfile;
                setProfile(next);
                setActiveModel(PROFILE_META[next].recommended[0]);
              }}
            >
              <option value="industrial">Phi tài chính</option>
              <option value="financial">Ngân hàng · Bảo hiểm</option>
              <option value="growth">Tăng trưởng cao</option>
              <option value="holding">Holding · BĐS</option>
              <option value="leveraged">Đòn bẩy thay đổi</option>
              <option value="resource">Tài nguyên · Dự án</option>
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              setInput(DEFAULT_INPUTS);
              setProfile('industrial');
              setActiveModel('fcff');
            }}
          >
            Đặt lại
          </button>
          <button onClick={save}>Lưu mô hình</button>
        </div>
      </section>

      <section className="vlab-identity">
        <label>
          <span>Tên doanh nghiệp</span>
          <input
            value={input.companyName}
            onChange={(event) => update('companyName', event.target.value)}
          />
        </label>
        <label className="ticker">
          <span>Mã</span>
          <input
            value={input.ticker}
            onChange={(event) => update('ticker', event.target.value.toUpperCase())}
          />
        </label>
        <NumberField
          label="Giá thị trường"
          unit="VNĐ / CP"
          value={input.currentPrice}
          min={0}
          step={100}
          onChange={(value) => update('currentPrice', value)}
        />
        <NumberField
          label="Cổ phiếu lưu hành"
          unit="triệu CP"
          value={input.shares}
          min={1}
          onChange={(value) => update('shares', value)}
        />
      </section>

      {guardrailBroken && (
        <div className="vlab-warning">
          <strong>Giả định chưa hội tụ.</strong>
          <span>
            Tăng trưởng dài hạn phải thấp hơn WACC, chi phí vốn chủ và chi phí vốn không đòn bẩy.
            Công cụ vẫn hiển thị để bạn sửa, nhưng không nên dùng kết quả hiện tại.
          </span>
        </div>
      )}

      <section className="vlab-command-center">
        <div className="vlab-consensus-card">
          <div className="vlab-section-head">
            <div>
              <span>TRIANGULATED FAIR VALUE</span>
              <h3>{input.ticker || '—'} · Giá trị hợp lý tổng hợp</h3>
            </div>
            <b>{profileMeta.label}</b>
          </div>
          <div className="vlab-consensus-main">
            <div>
              <span>Giá trị trung tâm</span>
              <strong>{price(consensus)}</strong>
              <small>Trọng số theo loại hình doanh nghiệp</small>
            </div>
            <div className={upside >= 0 ? 'positive' : 'negative'}>
              <span>Biên an toàn / chênh lệch</span>
              <strong>
                {upside >= 0 ? '+' : ''}
                {upside.toFixed(1)}%
              </strong>
              <small>So với {price(input.currentPrice)}</small>
            </div>
          </div>
          <div className="vlab-profile-note">
            <span>Logic lựa chọn</span>
            <p>
              {profileMeta.description}. Ưu tiên{' '}
              {profileMeta.recommended
                .map((id) => MODEL_META.find((model) => model.id === id)?.label)
                .join(' · ')}
              .
            </p>
          </div>
        </div>
        <div className="vlab-crosscheck-card">
          <div className="vlab-section-head">
            <div>
              <span>MODEL CROSS-CHECK</span>
              <h3>Phân rã theo phương pháp</h3>
            </div>
            <small>Giá / cổ phiếu</small>
          </div>
          <div className="vlab-model-bars">
            {weightedModels.map((row) => (
              <button key={row.id} onClick={() => setActiveModel(row.id)}>
                <span>
                  {MODEL_META.find((model) => model.id === row.id)?.label}
                  <small>{row.weight}%</small>
                </span>
                <i>
                  <b style={{ width: `${clamp((row.value / comparisonMax) * 100, 2, 100)}%` }} />
                </i>
                <strong>{price(row.value)}</strong>
              </button>
            ))}
            <div className="market">
              <span>Giá thị trường</span>
              <i>
                <b
                  style={{ width: `${clamp((input.currentPrice / comparisonMax) * 100, 2, 100)}%` }}
                />
              </i>
              <strong>{price(input.currentPrice)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="vlab-model-shell">
        <nav className="vlab-model-nav" aria-label="Các mô hình định giá">
          {MODEL_META.map((model) => (
            <button
              key={model.id}
              className={activeModel === model.id ? 'active' : ''}
              onClick={() => setActiveModel(model.id)}
            >
              <span>{model.label}</span>
              <small>{model.short}</small>
              {profileMeta.recommended.includes(model.id) && <i>Đề xuất</i>}
            </button>
          ))}
        </nav>

        <div className="vlab-model-body">
          {activeModel === 'fcff' && (
            <>
              <ModelIntro id="fcff" recommended={profileMeta.recommended.includes('fcff')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>OPERATING ASSUMPTIONS</span>
                      <h4>Dòng tiền và WACC</h4>
                    </div>
                    <small>Đơn vị tài chính: tỷ VNĐ</small>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="FCFF 12 tháng gần nhất"
                      unit="tỷ VNĐ"
                      value={input.baseFcff}
                      step={100}
                      onChange={(value) => update('baseFcff', value)}
                    />
                    <NumberField
                      label="NOPAT chuẩn hóa"
                      unit="tỷ VNĐ"
                      value={input.nopat}
                      step={100}
                      onChange={(value) => update('nopat', value)}
                    />
                    <NumberField
                      label="Tăng trưởng FCFF N1–N5"
                      unit="% / năm"
                      value={input.fcffGrowth}
                      step={0.5}
                      onChange={(value) => update('fcffGrowth', value)}
                    />
                    <NumberField
                      label="ROIC trên vốn tái đầu tư"
                      unit="%"
                      value={input.incrementalRoic}
                      step={0.5}
                      onChange={(value) => update('incrementalRoic', value)}
                    />
                    <NumberField
                      label="Tăng trưởng dài hạn"
                      unit="% / năm"
                      value={input.terminalGrowth}
                      step={0.1}
                      onChange={(value) => update('terminalGrowth', value)}
                    />
                    <NumberField
                      label="ROIC giai đoạn ổn định"
                      unit="%"
                      value={input.terminalRoic}
                      step={0.1}
                      onChange={(value) => update('terminalRoic', value)}
                    />
                    <NumberField
                      label="Nợ vay"
                      unit="tỷ VNĐ"
                      value={input.debt}
                      step={100}
                      min={0}
                      onChange={(value) => update('debt', value)}
                    />
                    <NumberField
                      label="Tiền & tương đương"
                      unit="tỷ VNĐ"
                      value={input.cash}
                      step={100}
                      min={0}
                      onChange={(value) => update('cash', value)}
                    />
                    <NumberField
                      label="Nợ / lợi ích khác"
                      unit="tỷ VNĐ"
                      value={input.otherLiabilities}
                      step={100}
                      min={0}
                      onChange={(value) => update('otherLiabilities', value)}
                    />
                  </div>
                  <div className="vlab-driver-strip">
                    <div>
                      <span>Tái đầu tư hàm ý</span>
                      <strong>{reinvestmentRate.toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span>Growth theo reinvestment × ROIC</span>
                      <strong>{fundamentalGrowth.toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span>Tái đầu tư terminal</span>
                      <strong>{terminalReinvestment.toFixed(1)}%</strong>
                    </div>
                  </div>
                  <div className="vlab-subhead">
                    <span>WACC BUILDER</span>
                    <strong>{discountRate.toFixed(2)}%</strong>
                  </div>
                  {sharedCapitalFields}
                  <div className="vlab-input-grid compact">
                    <NumberField
                      label="Chi phí nợ trước thuế"
                      unit="%"
                      value={input.preTaxDebtCost}
                      step={0.1}
                      onChange={(value) => update('preTaxDebtCost', value)}
                    />
                    <NumberField
                      label="Thuế suất"
                      unit="%"
                      value={input.taxRate}
                      step={1}
                      min={0}
                      max={100}
                      onChange={(value) => update('taxRate', value)}
                    />
                    <NumberField
                      label="Tỷ trọng vốn chủ"
                      unit="%"
                      value={input.equityWeight}
                      step={1}
                      min={0}
                      max={100}
                      onChange={(value) => update('equityWeight', value)}
                    />
                  </div>
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>FCFF OUTPUT</span>
                      <h4>Enterprise → Equity bridge</h4>
                    </div>
                    <small>3 giai đoạn · Gordon terminal</small>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị nội tại / cổ phiếu</span>
                    <strong>{price(fcff.perShare)}</strong>
                    <small>{upside >= 0 ? 'Tiềm năng cao hơn' : 'Thấp hơn'} giá thị trường</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric label="Giá trị hoạt động (EV)" value={moneyBn(fcff.enterpriseValue)} />
                    <Metric label="Giá trị vốn chủ" value={moneyBn(fcff.equityValue)} />
                    <Metric label="PV giai đoạn rõ" value={moneyBn(fcff.pvExplicit)} />
                    <Metric
                      label="PV terminal"
                      value={moneyBn(fcff.pvTerminal)}
                      note={`${fcff.terminalShare.toFixed(1)}% EV`}
                      tone={fcff.terminalShare > 75 ? 'negative' : 'neutral'}
                    />
                    <Metric label="Chi phí vốn chủ" value={`${coe.toFixed(2)}%`} />
                    <Metric label="WACC" value={`${discountRate.toFixed(2)}%`} tone="gold" />
                  </div>
                  <p className="vlab-audit-note">
                    FCFF phải là dòng tiền sau thuế dành cho cả chủ nợ và cổ đông. Nợ, tiền mặt và
                    lợi ích thiểu số chỉ điều chỉnh sau khi đã tính enterprise value.
                  </p>
                </aside>
              </div>
              <article className="vlab-panel">
                <div className="vlab-panel-head">
                  <div>
                    <span>EXPLICIT FORECAST</span>
                    <h4>Dự phóng 10 năm và fade tăng trưởng</h4>
                  </div>
                  <small>N1–N5 giữ giả định · N6–N10 hội tụ dần</small>
                </div>
                <CashFlowTable rows={fcff.rows} label="FCFF" />
              </article>
              <div className="vlab-two-col lower">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>SENSITIVITY MATRIX</span>
                      <h4>WACC × tăng trưởng dài hạn</h4>
                    </div>
                    <small>VNĐ / cổ phiếu</small>
                  </div>
                  <div
                    className="vlab-table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Bảng định giá có thể cuộn"
                  >
                    <table className="vlab-sensitivity">
                      <thead>
                        <tr>
                          <th>WACC \ g</th>
                          {[-1, -0.5, 0, 0.5, 1].map((offset) => (
                            <th key={offset}>{(input.terminalGrowth + offset).toFixed(1)}%</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[-2, -1, 0, 1, 2].map((waccOffset) => (
                          <tr key={waccOffset}>
                            <th>{(discountRate + waccOffset).toFixed(1)}%</th>
                            {[-1, -0.5, 0, 0.5, 1].map((growthOffset) => {
                              const value = discountedCashFlow(
                                input.baseFcff,
                                input.fcffGrowth,
                                input.terminalGrowth + growthOffset,
                                discountRate + waccOffset,
                                input,
                                false,
                              );
                              const ratio = input.currentPrice
                                ? value.perShare / input.currentPrice
                                : 1;
                              return (
                                <td
                                  key={growthOffset}
                                  className={
                                    ratio > 1.15 ? 'cheap' : ratio < 0.85 ? 'expensive' : 'fair'
                                  }
                                >
                                  {value.valid ? price(value.perShare) : 'N/A'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>MONTE CARLO · 1,200 RUNS</span>
                      <h4>Phân phối giá trị, không phải điểm đơn</h4>
                    </div>
                    <small>Growth · WACC · terminal g</small>
                  </div>
                  <div className="vlab-probability-grid">
                    <Metric label="P10 · thận trọng" value={price(simulation.p10)} />
                    <Metric label="P50 · trung vị" value={price(simulation.p50)} tone="gold" />
                    <Metric label="P90 · tích cực" value={price(simulation.p90)} />
                    <Metric
                      label="Xác suất cao hơn thị giá"
                      value={`${simulation.probabilityAboveMarket.toFixed(1)}%`}
                      tone={simulation.probabilityAboveMarket >= 50 ? 'positive' : 'negative'}
                    />
                  </div>
                  <div className="vlab-histogram" role="img" aria-label="Phân phối mô phỏng">
                    {simulation.bins.map((count, index) => (
                      <i
                        key={index}
                        style={{
                          height: `${Math.max(5, (count / Math.max(...simulation.bins)) * 100)}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="vlab-histogram-axis">
                    <span>{price(simulation.min)}</span>
                    <span>{price(simulation.max)}</span>
                  </div>
                </article>
              </div>
            </>
          )}

          {activeModel === 'fcfe' && (
            <>
              <ModelIntro id="fcfe" recommended={profileMeta.recommended.includes('fcfe')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>EQUITY CASH FLOW</span>
                      <h4>Giả định FCFE</h4>
                    </div>
                    <small>FCFE = NI + D&A − Capex − ΔWC + vay ròng</small>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="FCFE 12 tháng gần nhất"
                      unit="tỷ VNĐ"
                      value={input.baseFcfe}
                      step={100}
                      onChange={(value) => update('baseFcfe', value)}
                    />
                    <NumberField
                      label="Tăng trưởng FCFE N1–N5"
                      unit="% / năm"
                      value={input.fcfeGrowth}
                      step={0.5}
                      onChange={(value) => update('fcfeGrowth', value)}
                    />
                    <NumberField
                      label="Tăng trưởng dài hạn"
                      unit="% / năm"
                      value={input.terminalGrowth}
                      step={0.1}
                      onChange={(value) => update('terminalGrowth', value)}
                    />
                    <NumberField
                      label="Cổ phiếu lưu hành"
                      unit="triệu CP"
                      value={input.shares}
                      min={1}
                      onChange={(value) => update('shares', value)}
                    />
                  </div>
                  <div className="vlab-subhead">
                    <span>COST OF EQUITY · CAPM + CRP</span>
                    <strong>{coe.toFixed(2)}%</strong>
                  </div>
                  {sharedCapitalFields}
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>FCFE OUTPUT</span>
                      <h4>Định giá trực tiếp vốn chủ</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị / cổ phiếu</span>
                    <strong>{price(fcfe.perShare)}</strong>
                    <small>Không trừ nợ lần thứ hai</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric label="Giá trị vốn chủ" value={moneyBn(fcfe.equityValue)} />
                    <Metric label="PV FCFE 10 năm" value={moneyBn(fcfe.pvExplicit)} />
                    <Metric
                      label="PV terminal"
                      value={moneyBn(fcfe.pvTerminal)}
                      note={`${fcfe.terminalShare.toFixed(1)}% tổng giá trị`}
                    />
                    <Metric label="Chi phí vốn chủ" value={`${coe.toFixed(2)}%`} tone="gold" />
                  </div>
                  <p className="vlab-audit-note">
                    FCFE chỉ đáng tin khi chính sách nợ và vay ròng có thể dự báo. Nếu leverage thay
                    đổi mạnh, chuyển sang FCFF hoặc APV.
                  </p>
                </aside>
              </div>
              <article className="vlab-panel">
                <div className="vlab-panel-head">
                  <div>
                    <span>MULTISTAGE FCFE</span>
                    <h4>Dòng tiền cổ đông 10 năm</h4>
                  </div>
                </div>
                <CashFlowTable rows={fcfe.rows} label="FCFE" />
              </article>
            </>
          )}

          {activeModel === 'ddm' && (
            <>
              <ModelIntro id="ddm" recommended={profileMeta.recommended.includes('ddm')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>DIVIDEND POLICY</span>
                      <h4>Cổ tức đa giai đoạn</h4>
                    </div>
                    <small>VND / cổ phiếu</small>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="Cổ tức 12 tháng gần nhất"
                      unit="VNĐ / CP"
                      value={input.dividendPerShare}
                      step={100}
                      min={0}
                      onChange={(value) => update('dividendPerShare', value)}
                    />
                    <NumberField
                      label="Tăng trưởng cổ tức N1–N5"
                      unit="% / năm"
                      value={input.dividendGrowth}
                      step={0.5}
                      onChange={(value) => update('dividendGrowth', value)}
                    />
                    <NumberField
                      label="Tăng trưởng dài hạn"
                      unit="% / năm"
                      value={input.terminalGrowth}
                      step={0.1}
                      onChange={(value) => update('terminalGrowth', value)}
                    />
                  </div>
                  <div className="vlab-subhead">
                    <span>REQUIRED RETURN</span>
                    <strong>{coe.toFixed(2)}%</strong>
                  </div>
                  {sharedCapitalFields}
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>DDM OUTPUT</span>
                      <h4>Present value of dividends</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị / cổ phiếu</span>
                    <strong>{price(ddm.perShare)}</strong>
                    <small>Hai giai đoạn + fade 5 năm</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric label="PV cổ tức 10 năm" value={price(ddm.pvExplicit)} />
                    <Metric label="PV terminal" value={price(ddm.pvTerminal)} />
                    <Metric label="Tỷ trọng terminal" value={`${ddm.terminalShare.toFixed(1)}%`} />
                    <Metric label="Chi phí vốn chủ" value={`${coe.toFixed(2)}%`} tone="gold" />
                  </div>
                  <p className="vlab-audit-note">
                    DDM phù hợp khi cổ tức phản ánh sức tạo tiền thật. Không dùng riêng lẻ nếu cổ
                    tức bị neo bởi chính sách ngắn hạn hoặc thấp xa FCFE.
                  </p>
                </aside>
              </div>
              <article className="vlab-panel">
                <CashFlowTable rows={ddm.rows} label="Cổ tức / CP" unit="VNĐ / cổ phiếu" />
              </article>
            </>
          )}

          {activeModel === 'residual' && (
            <>
              <ModelIntro
                id="residual"
                recommended={profileMeta.recommended.includes('residual')}
              />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>CLEAN SURPLUS MODEL</span>
                      <h4>Vốn sổ sách và ROE</h4>
                    </div>
                    <small>Đơn vị: tỷ VNĐ</small>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="Vốn chủ sở hữu đầu kỳ"
                      unit="tỷ VNĐ"
                      value={input.bookEquity}
                      step={100}
                      min={0}
                      onChange={(value) => update('bookEquity', value)}
                    />
                    <NumberField
                      label="Lợi nhuận ròng hiện tại"
                      unit="tỷ VNĐ"
                      value={input.netIncome}
                      step={100}
                      onChange={(value) => update('netIncome', value)}
                    />
                    <NumberField
                      label="ROE bền vững N10"
                      unit="%"
                      value={input.stableRoe}
                      step={0.1}
                      onChange={(value) => update('stableRoe', value)}
                    />
                    <NumberField
                      label="Tỷ lệ chi trả"
                      unit="%"
                      value={input.payoutRatio}
                      step={1}
                      min={0}
                      max={100}
                      onChange={(value) => update('payoutRatio', value)}
                    />
                    <NumberField
                      label="Tăng trưởng dài hạn"
                      unit="%"
                      value={input.terminalGrowth}
                      step={0.1}
                      onChange={(value) => update('terminalGrowth', value)}
                    />
                  </div>
                  <div className="vlab-subhead">
                    <span>EQUITY CHARGE</span>
                    <strong>{coe.toFixed(2)}%</strong>
                  </div>
                  {sharedCapitalFields}
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>RESIDUAL INCOME OUTPUT</span>
                      <h4>Book value + economic profit</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị / cổ phiếu</span>
                    <strong>{price(residual.perShare)}</strong>
                    <small>Giá trị sổ sách + PV lợi nhuận vượt CoE</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric label="Vốn sổ sách hiện tại" value={moneyBn(input.bookEquity)} />
                    <Metric label="PV residual income" value={moneyBn(residual.pvResidual)} />
                    <Metric label="PV continuing value" value={moneyBn(residual.pvContinuing)} />
                    <Metric label="ROE hiện tại" value={`${residual.startingRoe.toFixed(1)}%`} />
                    <Metric label="ROE bền vững" value={`${input.stableRoe.toFixed(1)}%`} />
                    <Metric label="CoE" value={`${coe.toFixed(2)}%`} tone="gold" />
                  </div>
                  <p className="vlab-audit-note">
                    Điểm quyết định là ROE có duy trì cao hơn chi phí vốn chủ hay không. Chuẩn hóa
                    one-off, dự phòng và thay đổi chuẩn mực kế toán trước khi nhập.
                  </p>
                </aside>
              </div>
              <article className="vlab-panel">
                <CashFlowTable rows={residual.rows} label="Residual income" />
              </article>
            </>
          )}

          {activeModel === 'multiples' && (
            <>
              <ModelIntro
                id="multiples"
                recommended={profileMeta.recommended.includes('multiples')}
              />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>NORMALIZED FUNDAMENTALS</span>
                      <h4>Số liệu doanh nghiệp</h4>
                    </div>
                    <small>TTM hoặc forward cùng kỳ</small>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="Doanh thu"
                      unit="tỷ VNĐ"
                      value={input.revenue}
                      step={100}
                      onChange={(value) => update('revenue', value)}
                    />
                    <NumberField
                      label="EBITDA chuẩn hóa"
                      unit="tỷ VNĐ"
                      value={input.ebitda}
                      step={100}
                      onChange={(value) => update('ebitda', value)}
                    />
                    <NumberField
                      label="Lợi nhuận ròng chuẩn hóa"
                      unit="tỷ VNĐ"
                      value={input.netIncome}
                      step={100}
                      onChange={(value) => update('netIncome', value)}
                    />
                    <NumberField
                      label="Vốn chủ sở hữu"
                      unit="tỷ VNĐ"
                      value={input.bookEquity}
                      step={100}
                      onChange={(value) => update('bookEquity', value)}
                    />
                    <NumberField
                      label="Nợ vay"
                      unit="tỷ VNĐ"
                      value={input.debt}
                      step={100}
                      onChange={(value) => update('debt', value)}
                    />
                    <NumberField
                      label="Tiền mặt"
                      unit="tỷ VNĐ"
                      value={input.cash}
                      step={100}
                      onChange={(value) => update('cash', value)}
                    />
                  </div>
                  <div className="vlab-subhead">
                    <span>PEER MEDIAN / FORWARD MULTIPLE</span>
                    <strong>Điều chỉnh khác biệt tăng trưởng & ROIC</strong>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="EV / Revenue"
                      unit="x"
                      value={input.peerEvSales}
                      step={0.1}
                      onChange={(value) => update('peerEvSales', value)}
                    />
                    <NumberField
                      label="EV / EBITDA"
                      unit="x"
                      value={input.peerEvEbitda}
                      step={0.1}
                      onChange={(value) => update('peerEvEbitda', value)}
                    />
                    <NumberField
                      label="P / E"
                      unit="x"
                      value={input.peerPe}
                      step={0.5}
                      onChange={(value) => update('peerPe', value)}
                    />
                    <NumberField
                      label="P / B"
                      unit="x"
                      value={input.peerPb}
                      step={0.1}
                      onChange={(value) => update('peerPb', value)}
                    />
                  </div>
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>RELATIVE VALUE OUTPUT</span>
                      <h4>Khoảng định giá chéo</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Trung tâm robust</span>
                    <strong>{price(multiples.perShare)}</strong>
                    <small>Trung bình hai kết quả giữa, giảm ảnh hưởng ngoại lệ</small>
                  </div>
                  <div className="vlab-range">
                    <span
                      style={{
                        left: `${clamp((multiples.low / Math.max(multiples.high, 1)) * 100, 0, 100)}%`,
                      }}
                    />
                    <i
                      style={{
                        left: `${clamp((multiples.perShare / Math.max(multiples.high, 1)) * 100, 0, 100)}%`,
                      }}
                    />
                    <b
                      style={{
                        left: `${clamp((input.currentPrice / Math.max(multiples.high, input.currentPrice, 1)) * 100, 0, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="vlab-range-labels">
                    <span>Thấp {price(multiples.low)}</span>
                    <span>Cao {price(multiples.high)}</span>
                  </div>
                  <div className="vlab-output-table">
                    {multiples.rows.map((row) => (
                      <div key={row.label}>
                        <span>
                          {row.label}
                          <small>{row.multiple.toFixed(1)}x</small>
                        </span>
                        <strong>{price(row.price)}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="vlab-audit-note">
                    So sánh tốt phải cùng ngành, cùng kỳ, cùng chuẩn kế toán và gần nhau về tăng
                    trưởng, biên lợi nhuận, ROIC, đòn bẩy. Median ngành không tự động là “fair
                    multiple”.
                  </p>
                </aside>
              </div>
            </>
          )}

          {activeModel === 'sotp' && (
            <>
              <ModelIntro id="sotp" recommended={profileMeta.recommended.includes('sotp')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>SEGMENT VALUATION</span>
                      <h4>Định giá từng bộ phận / tài sản</h4>
                    </div>
                    <small>Metric × multiple · tỷ VNĐ</small>
                  </div>
                  <div className="vlab-segment-table">
                    <div className="head">
                      <span>Bộ phận</span>
                      <span>Metric / NAV</span>
                      <span>Hệ số</span>
                      <span>Giá trị</span>
                    </div>
                    {input.segments.map((segment, index) => (
                      <div key={index}>
                        <input
                          aria-label={`Tên bộ phận ${index + 1}`}
                          value={segment.name}
                          onChange={(event) => updateSegment(index, { name: event.target.value })}
                        />
                        <input
                          aria-label={`Metric bộ phận ${index + 1}`}
                          type="number"
                          value={segment.metric}
                          onFocus={selectNumericInput}
                          onChange={(event) =>
                            updateSegment(index, { metric: Number(event.target.value) || 0 })
                          }
                        />
                        <input
                          aria-label={`Hệ số bộ phận ${index + 1}`}
                          type="number"
                          value={segment.multiple}
                          step="0.1"
                          onFocus={selectNumericInput}
                          onChange={(event) =>
                            updateSegment(index, { multiple: Number(event.target.value) || 0 })
                          }
                        />
                        <strong>{moneyBn(segment.metric * segment.multiple)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="vlab-input-grid compact">
                    <NumberField
                      label="Nợ vay"
                      unit="tỷ VNĐ"
                      value={input.debt}
                      step={100}
                      onChange={(value) => update('debt', value)}
                    />
                    <NumberField
                      label="Tiền mặt"
                      unit="tỷ VNĐ"
                      value={input.cash}
                      step={100}
                      onChange={(value) => update('cash', value)}
                    />
                    <NumberField
                      label="Nợ / lợi ích khác"
                      unit="tỷ VNĐ"
                      value={input.otherLiabilities}
                      step={100}
                      onChange={(value) => update('otherLiabilities', value)}
                    />
                  </div>
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>SOTP OUTPUT</span>
                      <h4>Enterprise → Equity bridge</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị / cổ phiếu</span>
                    <strong>{price(sotp.perShare)}</strong>
                    <small>Trước chiết khấu holding / thanh khoản</small>
                  </div>
                  <div className="vlab-output-table">
                    {sotp.rows.map((row) => (
                      <div key={row.name}>
                        <span>
                          {row.name}
                          <small>
                            {NUMBER.format(row.metric)} × {row.multiple.toFixed(1)}x
                          </small>
                        </span>
                        <strong>{moneyBn(row.value)}</strong>
                      </div>
                    ))}
                    <div className="total">
                      <span>Tổng EV</span>
                      <strong>{moneyBn(sotp.enterpriseValue)}</strong>
                    </div>
                    <div>
                      <span>Giá trị vốn chủ sau điều chỉnh</span>
                      <strong>{moneyBn(sotp.equityValue)}</strong>
                    </div>
                  </div>
                  <p className="vlab-audit-note">
                    Kiểm tra sở hữu chéo, thuế tiềm ẩn, chi phí công ty mẹ, lợi ích thiểu số và
                    double counting. NAV nên dùng giá trị tài sản ròng sau nghĩa vụ, không chỉ giá
                    trị gộp.
                  </p>
                </aside>
              </div>
            </>
          )}

          {activeModel === 'apv' && (
            <>
              <ModelIntro id="apv" recommended={profileMeta.recommended.includes('apv')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>UNLEVERED VALUE + FINANCING EFFECTS</span>
                      <h4>Giả định APV</h4>
                    </div>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="FCFF không đòn bẩy"
                      unit="tỷ VNĐ"
                      value={input.baseFcff}
                      step={100}
                      onChange={(value) => update('baseFcff', value)}
                    />
                    <NumberField
                      label="Tăng trưởng N1–N5"
                      unit="%"
                      value={input.fcffGrowth}
                      step={0.5}
                      onChange={(value) => update('fcffGrowth', value)}
                    />
                    <NumberField
                      label="Tăng trưởng dài hạn"
                      unit="%"
                      value={input.terminalGrowth}
                      step={0.1}
                      onChange={(value) => update('terminalGrowth', value)}
                    />
                    <NumberField
                      label="Chi phí vốn không đòn bẩy"
                      unit="%"
                      value={input.unleveredCost}
                      step={0.1}
                      onChange={(value) => update('unleveredCost', value)}
                    />
                    <NumberField
                      label="Nợ vay ban đầu"
                      unit="tỷ VNĐ"
                      value={input.debt}
                      step={100}
                      onChange={(value) => update('debt', value)}
                    />
                    <NumberField
                      label="Chi phí nợ"
                      unit="%"
                      value={input.preTaxDebtCost}
                      step={0.1}
                      onChange={(value) => update('preTaxDebtCost', value)}
                    />
                    <NumberField
                      label="Thuế suất"
                      unit="%"
                      value={input.taxRate}
                      step={1}
                      onChange={(value) => update('taxRate', value)}
                    />
                    <NumberField
                      label="Thời gian trả nợ"
                      unit="năm"
                      value={input.debtRepaymentYears}
                      step={1}
                      min={1}
                      onChange={(value) => update('debtRepaymentYears', value)}
                    />
                  </div>
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>APV OUTPUT</span>
                      <h4>Tách hoạt động và tài trợ</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị / cổ phiếu</span>
                    <strong>{price(apv.perShare)}</strong>
                    <small>Unlevered value + PV tax shield − net debt</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric
                      label="Giá trị hoạt động không nợ"
                      value={moneyBn(apv.operations.enterpriseValue)}
                    />
                    <Metric
                      label="PV lá chắn thuế"
                      value={moneyBn(apv.pvTaxShield)}
                      tone="positive"
                    />
                    <Metric
                      label="Adjusted enterprise value"
                      value={moneyBn(apv.adjustedEnterprise)}
                    />
                    <Metric label="Giá trị vốn chủ" value={moneyBn(apv.equityValue)} />
                    <Metric
                      label="Unlevered cost"
                      value={`${input.unleveredCost.toFixed(2)}%`}
                      tone="gold"
                    />
                    <Metric
                      label="Kỳ trả nợ"
                      value={`${Math.round(input.debtRepaymentYears)} năm`}
                    />
                  </div>
                  <p className="vlab-audit-note">
                    Bản APV này định giá riêng lá chắn thuế theo lịch trả nợ tuyến tính. Với LBO
                    thực tế, cần thêm phí distress, trợ cấp, issue cost và lịch nợ từng tranche.
                  </p>
                </aside>
              </div>
            </>
          )}

          {activeModel === 'reverse' && (
            <>
              <ModelIntro id="reverse" recommended={profileMeta.recommended.includes('reverse')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>MARKET-IMPLIED EXPECTATIONS</span>
                      <h4>Giá hiện tại đang phản ánh điều gì?</h4>
                    </div>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="Giá thị trường"
                      unit="VNĐ / CP"
                      value={input.currentPrice}
                      step={100}
                      onChange={(value) => update('currentPrice', value)}
                    />
                    <NumberField
                      label="FCFF hiện tại"
                      unit="tỷ VNĐ"
                      value={input.baseFcff}
                      step={100}
                      onChange={(value) => update('baseFcff', value)}
                    />
                    <NumberField
                      label="Tăng trưởng dài hạn"
                      unit="%"
                      value={input.terminalGrowth}
                      step={0.1}
                      onChange={(value) => update('terminalGrowth', value)}
                    />
                    <NumberField
                      label="Nợ vay"
                      unit="tỷ VNĐ"
                      value={input.debt}
                      step={100}
                      onChange={(value) => update('debt', value)}
                    />
                    <NumberField
                      label="Tiền mặt"
                      unit="tỷ VNĐ"
                      value={input.cash}
                      step={100}
                      onChange={(value) => update('cash', value)}
                    />
                  </div>
                  <div className="vlab-subhead">
                    <span>DISCOUNT RATE</span>
                    <strong>WACC {discountRate.toFixed(2)}%</strong>
                  </div>
                  {sharedCapitalFields}
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>REVERSE DCF OUTPUT</span>
                      <h4>Ngưỡng kỳ vọng thị trường</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>FCFF CAGR hàm ý N1–N5</span>
                    <strong>{reverse.impliedGrowth.toFixed(2)}%</strong>
                    <small>Để mô hình khớp đúng {price(input.currentPrice)}</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric label="FCFF năm 5 hàm ý" value={moneyBn(reverse.impliedYear5Fcff)} />
                    <Metric label="EV thị trường hàm ý" value={moneyBn(reverse.targetEnterprise)} />
                    <Metric
                      label="Tăng trưởng cơ sở của bạn"
                      value={`${input.fcffGrowth.toFixed(2)}%`}
                    />
                    <Metric
                      label="Khoảng kỳ vọng"
                      value={`${(input.fcffGrowth - reverse.impliedGrowth).toFixed(2)} điểm %`}
                      tone={input.fcffGrowth >= reverse.impliedGrowth ? 'positive' : 'negative'}
                    />
                  </div>
                  <div className="vlab-expectation">
                    <span>Diễn giải</span>
                    <p>
                      {input.fcffGrowth >= reverse.impliedGrowth
                        ? 'Luận điểm cơ sở của bạn cao hơn ngưỡng mà thị trường đang định giá. Hãy kiểm tra khả năng chuyển tăng trưởng thành ROIC và tiền thật.'
                        : 'Giá đang đòi hỏi tăng trưởng cao hơn luận điểm cơ sở. Biên an toàn phụ thuộc vào việc doanh nghiệp vượt kỳ vọng.'}
                    </p>
                  </div>
                  {!reverse.inRange && (
                    <p className="vlab-audit-note danger">
                      Mức giá nằm ngoài miền tăng trưởng −50% đến 100% của mô hình. Kiểm tra lại đơn
                      vị và giả định vốn.
                    </p>
                  )}
                </aside>
              </div>
            </>
          )}

          {activeModel === 'options' && (
            <>
              <ModelIntro id="options" recommended={profileMeta.recommended.includes('options')} />
              <div className="vlab-two-col">
                <article className="vlab-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>OPTION TO DELAY / EXPAND</span>
                      <h4>Giá trị linh hoạt chiến lược</h4>
                    </div>
                    <small>Black–Scholes điều chỉnh carry</small>
                  </div>
                  <div className="vlab-input-grid">
                    <NumberField
                      label="PV dòng tiền nếu đầu tư"
                      unit="tỷ VNĐ"
                      value={input.optionAssetValue}
                      step={100}
                      onChange={(value) => update('optionAssetValue', value)}
                    />
                    <NumberField
                      label="Chi phí đầu tư / strike"
                      unit="tỷ VNĐ"
                      value={input.optionInvestment}
                      step={100}
                      onChange={(value) => update('optionInvestment', value)}
                    />
                    <NumberField
                      label="Thời hạn quyền"
                      unit="năm"
                      value={input.optionYears}
                      step={0.5}
                      min={0.1}
                      onChange={(value) => update('optionYears', value)}
                    />
                    <NumberField
                      label="Biến động giá trị tài sản"
                      unit="% / năm"
                      value={input.optionVolatility}
                      step={1}
                      min={0.1}
                      onChange={(value) => update('optionVolatility', value)}
                    />
                    <NumberField
                      label="Lãi suất phi rủi ro"
                      unit="%"
                      value={input.riskFree}
                      step={0.1}
                      onChange={(value) => update('riskFree', value)}
                    />
                    <NumberField
                      label="Chi phí trì hoãn / carry"
                      unit="%"
                      value={input.optionCarryCost}
                      step={0.1}
                      onChange={(value) => update('optionCarryCost', value)}
                    />
                  </div>
                </article>
                <aside className="vlab-panel vlab-result-panel">
                  <div className="vlab-panel-head">
                    <div>
                      <span>REAL OPTION OUTPUT</span>
                      <h4>Giá trị quyền, không phải nghĩa vụ</h4>
                    </div>
                  </div>
                  <div className="vlab-primary">
                    <span>Giá trị quyền chọn thực</span>
                    <strong>{moneyBn(option.optionValue)}</strong>
                    <small>Quyền trì hoãn / triển khai dự án</small>
                  </div>
                  <div className="vlab-metric-grid">
                    <Metric
                      label="NPV nếu đầu tư ngay"
                      value={moneyBn(option.staticNpv)}
                      tone={option.staticNpv >= 0 ? 'positive' : 'negative'}
                    />
                    <Metric
                      label="Premium linh hoạt"
                      value={moneyBn(option.flexibilityPremium)}
                      tone="gold"
                    />
                    <Metric label="DCF + option / CP" value={price(optionAdjustedPerShare)} />
                    <Metric
                      label="Xác suất chuẩn hóa N(d2)"
                      value={`${(normalCdf(option.d2) * 100).toFixed(1)}%`}
                    />
                  </div>
                  <p className="vlab-audit-note">
                    Chỉ cộng option vào DCF nếu dòng tiền của tài sản tùy chọn chưa nằm trong dự
                    phóng cơ sở. Volatility của tài sản không giao dịch là đầu vào khó nhất; cần
                    scenario hoặc simulation để hiệu chỉnh.
                  </p>
                </aside>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="vlab-method-map">
        <div className="vlab-panel-head">
          <div>
            <span>MODEL GOVERNANCE</span>
            <h4>Quy trình định giá cấp chuyên gia</h4>
          </div>
          <small>Chất lượng đầu vào quan trọng hơn số chữ số thập phân</small>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Chuẩn hóa số liệu</strong>
              <p>Loại one-off, vốn hóa R&D / lease khi cần, đồng bộ TTM và forward.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Chọn mô hình theo economics</strong>
              <p>FCFF cho hoạt động; residual income cho tài chính; SOTP cho tài sản khác biệt.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Ràng buộc tăng trưởng với ROIC</strong>
              <p>Growth chỉ tạo giá trị khi ROIC vượt chi phí vốn và có tái đầu tư tương ứng.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>Kiểm tra terminal value</strong>
              <p>
                g phải hội tụ, ROIC bền vững hợp lý và terminal share không lấn át toàn bộ luận
                điểm.
              </p>
            </div>
          </li>
          <li>
            <span>05</span>
            <div>
              <strong>Reverse + probability</strong>
              <p>
                Đọc kỳ vọng trong giá, sau đó dùng sensitivity và Monte Carlo để biểu diễn bất định.
              </p>
            </div>
          </li>
        </ol>
        <div className="vlab-sources">
          <span>Nền tảng phương pháp</span>
          <a
            href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/spreadsh.htm"
            target="_blank"
            rel="noreferrer"
          >
            NYU Stern · Damodaran
          </a>
          <a
            href="https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/free-cash-flow-valuation"
            target="_blank"
            rel="noreferrer"
          >
            CFA · Free Cash Flow
          </a>
          <a
            href="https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/residual-income-valuation"
            target="_blank"
            rel="noreferrer"
          >
            CFA · Residual Income
          </a>
        </div>
        <p className="vlab-disclaimer">
          Công cụ phục vụ nghiên cứu và xây luận điểm, không phải khuyến nghị mua bán. Kết quả phụ
          thuộc vào dữ liệu đã chuẩn hóa, giả định chu kỳ, chi phí vốn và khả năng duy trì lợi thế
          cạnh tranh.
        </p>
      </section>
      {notice && (
        <div className="dcf-toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}
