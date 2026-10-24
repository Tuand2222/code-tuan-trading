"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export type EquityChartPoint = {
  date: string;
  money: number;
  percent: number;
};

export type EquityReferenceLine = {
  label: string;
  money: number;
  percent: number;
  color: string;
  style?: "dashed" | "dotted";
};

type NormalizedPoint = EquityChartPoint & { time: UTCTimestamp };

const EMPTY_REFERENCES: EquityReferenceLine[] = [];
const DATE = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "UTC",
});
const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function timestamp(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) as UTCTimestamp;
}

function dateFromTime(time: Time) {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(`${time}T00:00:00Z`);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

function compactMoney(value: number) {
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(1)} tỷ`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)} tr`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${sign}${Math.round(absolute)}`;
}

function percent(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}%`;
}

export default function EquityTimeChart({
  points,
  references = EMPTY_REFERENCES,
  ariaLabel,
  percentLabel = "Tỷ lệ (%)",
  moneyLabel = "Số tiền (VND)",
  emptyMessage = "Chưa có dữ liệu trong khoảng thời gian này.",
}: {
  points: EquityChartPoint[];
  references?: EquityReferenceLine[];
  ariaLabel: string;
  percentLabel?: string;
  moneyLabel?: string;
  emptyMessage?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const percentSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const moneySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const showPercentRef = useRef(true);
  const showMoneyRef = useRef(true);
  const [showPercent, setShowPercent] = useState(true);
  const [showMoney, setShowMoney] = useState(true);
  const [activePoint, setActivePoint] = useState<NormalizedPoint | null>(null);

  const normalizedPoints = useMemo(() => {
    const unique = new Map<string, NormalizedPoint>();
    for (const point of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
      unique.set(point.date, { ...point, time: timestamp(point.date) });
    }
    return [...unique.values()];
  }, [points]);

  const displayedPoint = activePoint && normalizedPoints.some((point) => point.time === activePoint.time)
    ? activePoint
    : normalizedPoints.at(-1) ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !normalizedPoints.length) return;

    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 280),
      height: Math.max(container.clientHeight, 230),
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#697582",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,.035)" },
        horzLines: { color: "rgba(255,255,255,.045)" },
      },
      leftPriceScale: {
        visible: showPercentRef.current,
        borderColor: "#303945",
        scaleMargins: { top: 0.14, bottom: 0.16 },
        entireTextOnly: true,
      },
      rightPriceScale: {
        visible: showMoneyRef.current,
        borderColor: "#303945",
        scaleMargins: { top: 0.14, bottom: 0.16 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: "#303945",
        rightOffset: 0,
        barSpacing: 30,
        minBarSpacing: 8,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => SHORT_DATE.format(dateFromTime(time)),
      },
      localization: {
        locale: "vi-VN",
        timeFormatter: (time: Time) => DATE.format(dateFromTime(time)),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(126,154,206,.58)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2b3b58" },
        horzLine: { color: "rgba(126,154,206,.35)", width: 1, style: LineStyle.Dotted, labelBackgroundColor: "#2b3b58" },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const moneySeries = chart.addSeries(AreaSeries, {
      priceScaleId: "right",
      lineColor: "#3bd890",
      topColor: "rgba(53,213,139,.24)",
      bottomColor: "rgba(53,213,139,0)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "custom", formatter: compactMoney },
      visible: showMoneyRef.current,
    });
    const percentSeries = chart.addSeries(LineSeries, {
      priceScaleId: "left",
      color: "#7da2ff",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "custom", formatter: (value: number) => percent(value) },
      visible: showPercentRef.current,
    });

    moneySeries.setData(normalizedPoints.map((point) => ({ time: point.time, value: point.money })));
    percentSeries.setData(normalizedPoints.map((point) => ({ time: point.time, value: point.percent })));

    for (const reference of references) {
      const style = reference.style === "dotted" ? LineStyle.Dotted : LineStyle.Dashed;
      moneySeries.createPriceLine({
        price: reference.money,
        color: reference.color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title: reference.label,
      });
      percentSeries.createPriceLine({
        price: reference.percent,
        color: reference.color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title: reference.label,
      });
    }

    const pointByTime = new Map(normalizedPoints.map((point) => [Number(point.time), point]));
    const onCrosshairMove = (param: { time?: Time }) => {
      const next = param.time ? pointByTime.get(Number(param.time)) : undefined;
      setActivePoint(next ?? normalizedPoints.at(-1) ?? null);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: Math.max(container.clientWidth, 280),
        height: Math.max(container.clientHeight, 230),
      });
    });
    resizeObserver.observe(container);

    chartRef.current = chart;
    percentSeriesRef.current = percentSeries;
    moneySeriesRef.current = moneySeries;

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      percentSeriesRef.current = null;
      moneySeriesRef.current = null;
    };
  }, [normalizedPoints, references]);

  useEffect(() => {
    showPercentRef.current = showPercent;
    showMoneyRef.current = showMoney;
    percentSeriesRef.current?.applyOptions({ visible: showPercent });
    moneySeriesRef.current?.applyOptions({ visible: showMoney });
    chartRef.current?.priceScale("left").applyOptions({ visible: showPercent });
    chartRef.current?.priceScale("right").applyOptions({ visible: showMoney });
  }, [showMoney, showPercent]);

  function zoom(scale: number) {
    const timeScale = chartRef.current?.timeScale();
    const range = timeScale?.getVisibleLogicalRange();
    if (!timeScale || !range) return;
    const center = (range.from + range.to) / 2;
    const currentSpan = Math.max(range.to - range.from, 2);
    const fullSpan = Math.max(normalizedPoints.length - 1, 2);
    const nextSpan = Math.min(fullSpan, Math.max(2, currentSpan * scale));
    timeScale.setVisibleLogicalRange({ from: center - nextSpan / 2, to: center + nextSpan / 2 });
  }

  function reset() {
    chartRef.current?.timeScale().fitContent();
  }

  return (
    <div className="dual-axis-chart">
      <div className="dual-axis-chart-toolbar">
        <div className="dual-axis-switches" role="group" aria-label="Bật hoặc tắt đơn vị trên biểu đồ">
          <button type="button" className={showPercent ? "active percent" : "percent"} aria-pressed={showPercent} onClick={() => setShowPercent((value) => !value)}><i /> % bên trái</button>
          <button type="button" className={showMoney ? "active money" : "money"} aria-pressed={showMoney} onClick={() => setShowMoney((value) => !value)}><i /> VND bên phải</button>
        </div>
        <div className="dual-axis-zoom" role="group" aria-label="Thu phóng khung thời gian">
          <button type="button" onClick={() => zoom(0.72)} disabled={normalizedPoints.length < 3} aria-label="Phóng to khung thời gian" title="Phóng to"><ZoomIn size={15} /></button>
          <button type="button" onClick={() => zoom(1.38)} disabled={normalizedPoints.length < 3} aria-label="Thu nhỏ khung thời gian" title="Thu nhỏ"><ZoomOut size={15} /></button>
          <button type="button" onClick={reset} disabled={!normalizedPoints.length} aria-label="Đặt lại khung thời gian" title="Đặt lại"><RotateCcw size={14} /></button>
        </div>
      </div>

      <div className="dual-axis-readout" aria-live="polite">
        <span>{displayedPoint ? DATE.format(new Date(`${displayedPoint.date}T00:00:00Z`)) : "Thời gian"}</span>
        <strong className="percent">{displayedPoint ? percent(displayedPoint.percent) : "—"}</strong>
        <strong className="money">{displayedPoint ? VND.format(Math.round(displayedPoint.money)) : "—"}</strong>
        <small>Kéo để pan · Cuộn hoặc chụm để zoom</small>
      </div>

      <div className="dual-axis-chart-frame">
        <span className={`dual-axis-label left ${showPercent ? "" : "hidden"}`}>{percentLabel}</span>
        <span className={`dual-axis-label right ${showMoney ? "" : "hidden"}`}>{moneyLabel}</span>
        <div ref={containerRef} className="dual-axis-chart-canvas" role="img" aria-label={ariaLabel} onDoubleClick={reset} />
        {!normalizedPoints.length && <div className="dual-axis-chart-empty"><span>⌁</span><strong>Chưa có dữ liệu</strong><p>{emptyMessage}</p></div>}
        {!showPercent && !showMoney && normalizedPoints.length > 0 && <div className="dual-axis-chart-empty muted"><strong>Hai trục đang tắt</strong><p>Bật % hoặc VND để hiển thị đường cong vốn.</p></div>}
      </div>
    </div>
  );
}
