"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { normalizeNumericInput, selectNumericInput } from "./numeric-input";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
};

type Ticker = {
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
};

type FuturesSnapshot = {
  markPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  longShortRatio: number;
};

type MarketPayload = {
  candles: Candle[];
  ticker: Ticker;
  futures: FuturesSnapshot;
  error?: string;
};

type MtfPayload = {
  timeframes: Partial<Record<Interval, Candle[]>>;
  error?: string;
};

type FlowTrade = { time: number; side: "buy" | "sell"; value: number };
type TapeItem = {
  id: string;
  kind: "whale" | "liquidation";
  side: "buy" | "sell";
  value: number;
  price: number;
  time: number;
  label: string;
};

type PriceAlert = {
  id: string;
  direction: "above" | "below";
  target: number;
  triggered: boolean;
  createdAt: number;
};

const INTERVALS: { value: Interval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
];

const MTF_INTERVALS: Interval[] = ["5m", "15m", "1h", "4h", "1d"];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function compactUsd(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return usd.format(value);
}

function ema(values: number[], period: number) {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  let previous = values[0];
  return values.map((value, index) => {
    if (index === 0) return previous;
    previous = value * multiplier + previous * (1 - multiplier);
    return previous;
  });
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const relativeStrength = gains / Math.max(losses, Number.EPSILON);
  return 100 - 100 / (1 + relativeStrength);
}

function atr(candles: Candle[], period = 14) {
  if (candles.length < 2) return 0;
  const ranges = candles.slice(-period).map((candle, index, sliced) => {
    const sourceIndex = candles.length - Math.min(period, candles.length) + index;
    const previousClose = sourceIndex > 0 ? candles[sourceIndex - 1].close : sliced[index].open;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  return ranges.reduce((sum, value) => sum + value, 0) / Math.max(ranges.length, 1);
}

function analyze(candles: Candle[]) {
  if (!candles.length) {
    return {
      side: "neutral" as const,
      label: "Đang tải",
      score: 0,
      strength: 0,
      rsi: 50,
      atr: 0,
      ema20: 0,
      ema50: 0,
      ema200: 0,
      support: 0,
      resistance: 0,
      volumeRatio: 0,
    };
  }
  const closes = candles.map((candle) => candle.close);
  const ema20 = ema(closes, 20).at(-1) ?? closes.at(-1) ?? 0;
  const ema50 = ema(closes, 50).at(-1) ?? closes.at(-1) ?? 0;
  const ema200 = ema(closes, 200).at(-1) ?? closes.at(-1) ?? 0;
  const current = candles.at(-1)!;
  const previous = candles.at(-2) ?? current;
  const rsiValue = rsi(closes);
  const structure = candles.slice(-55, -1).length ? candles.slice(-55, -1) : candles.slice(-55);
  const support = Math.min(...structure.map((candle) => candle.low));
  const resistance = Math.max(...structure.map((candle) => candle.high));
  const averageVolume = candles.slice(-20).reduce((sum, candle) => sum + candle.volume, 0) / Math.max(Math.min(candles.length, 20), 1);
  let score = 0;
  score += ema20 > ema50 ? 1 : -1;
  score += current.close > ema200 ? 1 : -1;
  score += rsiValue >= 52 ? 1 : rsiValue <= 48 ? -1 : 0;
  score += current.close > previous.close ? 1 : -1;
  score += current.close > (support + resistance) / 2 ? 1 : -1;
  const side = score >= 2 ? "long" : score <= -2 ? "short" : "neutral";
  return {
    side,
    label: side === "long" ? "Ưu tiên LONG" : side === "short" ? "Ưu tiên SHORT" : "TRUNG LẬP",
    score,
    strength: Math.min(Math.round(Math.abs(score) / 5 * 100), 100),
    rsi: rsiValue,
    atr: atr(candles),
    ema20,
    ema50,
    ema200,
    support,
    resistance,
    volumeRatio: averageVolume ? current.volume / averageVolume : 0,
  };
}

function signalClass(side: "long" | "short" | "neutral") {
  return side === "long" ? "positive" : side === "short" ? "negative" : "neutral";
}

export default function BtcRealtime() {
  const chartContainer = useRef<HTMLDivElement | null>(null);
  const chartPanel = useRef<HTMLElement | null>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Series = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Series = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Series = useRef<ISeriesApi<"Line"> | null>(null);
  const supportLine = useRef<IPriceLine | null>(null);
  const resistanceLine = useRef<IPriceLine | null>(null);
  const fittedInterval = useRef<Interval | null>(null);
  const recentTrades = useRef<FlowTrade[]>([]);
  const lastFlowRender = useRef(0);
  const alertsRef = useRef<PriceAlert[]>([]);
  const lastAlertPrice = useRef(0);

  const [interval, setIntervalValue] = useState<Interval>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ticker, setTicker] = useState<Ticker>({ lastPrice: 0, priceChangePercent: 0, highPrice: 0, lowPrice: 0, quoteVolume: 0 });
  const [futures, setFutures] = useState<FuturesSnapshot>({ markPrice: 0, fundingRate: 0, nextFundingTime: 0, openInterest: 0, longShortRatio: 0 });
  const [timeframes, setTimeframes] = useState<Partial<Record<Interval, Candle[]>>>({});
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flow, setFlow] = useState({ buy: 0, sell: 0 });
  const [tape, setTape] = useState<TapeItem[]>([]);
  const [whaleThreshold, setWhaleThreshold] = useState(250_000);
  const [alertTarget, setAlertTarget] = useState("");
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsReady, setAlertsReady] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [alertMessage, setAlertMessage] = useState("");
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const analysis = useMemo(() => analyze(candles), [candles]);
  const mtfAnalysis = useMemo(
    () => MTF_INTERVALS.map((timeframe) => ({ timeframe, ...analyze(timeframes[timeframe] ?? []) })),
    [timeframes],
  );
  const buyPercent = flow.buy + flow.sell > 0 ? flow.buy / (flow.buy + flow.sell) * 100 : 50;
  const activeCandle = hoveredCandle ?? candles.at(-1) ?? null;

  useEffect(() => {
    if (!chartContainer.current) return;
    const instance = createChart(chartContainer.current, {
      width: chartContainer.current.clientWidth,
      height: 510,
      layout: { background: { type: ColorType.Solid, color: "#10151b" }, textColor: "#7f8996" },
      grid: { vertLines: { color: "rgba(255,255,255,.035)" }, horzLines: { color: "rgba(255,255,255,.035)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#28313a", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "#28313a", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
      localization: { locale: "vi-VN", priceFormatter: (price: number) => `$${number.format(price)}` },
      handleScroll: true,
      handleScale: true,
    });
    const candlesApi = instance.addSeries(CandlestickSeries, {
      upColor: "#34d78b",
      downColor: "#ff5574",
      borderUpColor: "#34d78b",
      borderDownColor: "#ff5574",
      wickUpColor: "#34d78b",
      wickDownColor: "#ff5574",
    });
    const volumeApi = instance.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeApi.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const ema20Api = instance.addSeries(LineSeries, { color: "#f2b33f", lineWidth: 1, title: "EMA 20", priceLineVisible: false });
    const ema50Api = instance.addSeries(LineSeries, { color: "#6e8fff", lineWidth: 1, title: "EMA 50", priceLineVisible: false });
    const ema200Api = instance.addSeries(LineSeries, { color: "#ba7cff", lineWidth: 1, title: "EMA 200", priceLineVisible: false, visible: false });
    const support = candlesApi.createPriceLine({
      price: 0,
      color: "rgba(52,215,139,.72)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lineVisible: false,
      axisLabelVisible: false,
      title: "Hỗ trợ",
    });
    const resistance = candlesApi.createPriceLine({
      price: 0,
      color: "rgba(255,85,116,.72)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lineVisible: false,
      axisLabelVisible: false,
      title: "Kháng cự",
    });
    const crosshairHandler: Parameters<IChartApi["subscribeCrosshairMove"]>[0] = (parameter) => {
      const point = parameter.seriesData.get(candlesApi);
      if (point && "open" in point && "high" in point && "low" in point && "close" in point) {
        setHoveredCandle({
          time: Number(point.time),
          open: Number(point.open),
          high: Number(point.high),
          low: Number(point.low),
          close: Number(point.close),
          volume: 0,
        });
      } else {
        setHoveredCandle(null);
      }
    };
    instance.subscribeCrosshairMove(crosshairHandler);
    chart.current = instance;
    candleSeries.current = candlesApi;
    volumeSeries.current = volumeApi;
    ema20Series.current = ema20Api;
    ema50Series.current = ema50Api;
    ema200Series.current = ema200Api;
    supportLine.current = support;
    resistanceLine.current = resistance;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      const height = entries[0]?.contentRect.height;
      if (width && height) instance.applyOptions({ width, height });
    });
    observer.observe(chartContainer.current);
    return () => {
      observer.disconnect();
      instance.unsubscribeCrosshairMove(crosshairHandler);
      instance.remove();
      chart.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      ema20Series.current = null;
      ema50Series.current = null;
      ema200Series.current = null;
      supportLine.current = null;
      resistanceLine.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candles.length || !candleSeries.current || !volumeSeries.current || !ema20Series.current || !ema50Series.current || !ema200Series.current) return;
    const candleData: CandlestickData<UTCTimestamp>[] = candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    const volumeData: HistogramData<UTCTimestamp>[] = candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? "rgba(52,215,139,.28)" : "rgba(255,85,116,.28)",
    }));
    const closes = candles.map((candle) => candle.close);
    const ema20Values = ema(closes, 20);
    const ema50Values = ema(closes, 50);
    const ema200Values = ema(closes, 200);
    const line20: LineData<UTCTimestamp>[] = candles.map((candle, index) => ({ time: candle.time as UTCTimestamp, value: ema20Values[index] }));
    const line50: LineData<UTCTimestamp>[] = candles.map((candle, index) => ({ time: candle.time as UTCTimestamp, value: ema50Values[index] }));
    const line200: LineData<UTCTimestamp>[] = candles.map((candle, index) => ({ time: candle.time as UTCTimestamp, value: ema200Values[index] }));
    candleSeries.current.setData(candleData);
    volumeSeries.current.setData(volumeData);
    ema20Series.current.setData(line20);
    ema50Series.current.setData(line50);
    ema200Series.current.setData(line200);
    if (fittedInterval.current !== interval) {
      chart.current?.timeScale().fitContent();
      fittedInterval.current = interval;
    }
  }, [candles, interval]);

  useEffect(() => {
    ema20Series.current?.applyOptions({ visible: showEma20 });
    ema50Series.current?.applyOptions({ visible: showEma50 });
    ema200Series.current?.applyOptions({ visible: showEma200 });
    volumeSeries.current?.applyOptions({ visible: showVolume });
  }, [showEma20, showEma50, showEma200, showVolume]);

  useEffect(() => {
    const visible = showLevels && Boolean(analysis.support && analysis.resistance);
    supportLine.current?.applyOptions({
      price: analysis.support || 0,
      lineVisible: visible,
      axisLabelVisible: visible,
    });
    resistanceLine.current?.applyOptions({
      price: analysis.resistance || 0,
      lineVisible: visible,
      axisLabelVisible: visible,
    });
  }, [analysis.support, analysis.resistance, showLevels]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === chartPanel.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSnapshot = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch(`/api/market/btc?interval=${interval}&limit=500`, { cache: "no-store" });
        const payload = await response.json() as MarketPayload;
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải dữ liệu BTC");
        if (!cancelled) {
          setCandles(payload.candles);
          setTicker(payload.ticker);
          setFutures(payload.futures);
          setError("");
          lastAlertPrice.current = payload.ticker.lastPrice;
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Dữ liệu thị trường tạm gián đoạn");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const loadMtf = async () => {
      try {
        const response = await fetch("/api/market/btc?mode=mtf", { cache: "no-store" });
        const payload = await response.json() as MtfPayload;
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải dữ liệu đa khung");
        if (!cancelled) setTimeframes(payload.timeframes);
      } catch { /* main chart remains usable */ }
    };
    fittedInterval.current = null;
    void loadSnapshot(true);
    void loadMtf();
    const snapshotTimer = window.setInterval(() => void loadSnapshot(), 30_000);
    const mtfTimer = window.setInterval(() => void loadMtf(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(snapshotTimer);
      window.clearInterval(mtfTimer);
    };
  }, [interval]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("tuan-trader-btc-alerts");
        if (stored) setAlerts(JSON.parse(stored) as PriceAlert[]);
      } catch { /* ignore malformed device data */ }
      if ("Notification" in window) setNotificationPermission(Notification.permission);
      setAlertsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (alertsReady) window.localStorage.setItem("tuan-trader-btc-alerts", JSON.stringify(alerts));
  }, [alerts, alertsReady]);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer = 0;
    let spotSocket: WebSocket | null = null;
    let futuresSocket: WebSocket | null = null;

    const checkAlerts = (price: number) => {
      const previous = lastAlertPrice.current;
      lastAlertPrice.current = price;
      if (!previous || previous === price) return;
      const hitIds = alertsRef.current.filter((alert) => {
        if (alert.triggered) return false;
        return alert.direction === "above"
          ? previous < alert.target && price >= alert.target
          : previous > alert.target && price <= alert.target;
      }).map((alert) => alert.id);
      if (!hitIds.length) return;
      const hit = alertsRef.current.find((alert) => hitIds.includes(alert.id));
      setAlerts((current) => current.map((alert) => hitIds.includes(alert.id) ? { ...alert, triggered: true } : alert));
      const message = `BTC đã ${hit?.direction === "above" ? "vượt" : "giảm dưới"} ${usd.format(hit?.target ?? price)}`;
      setAlertMessage(message);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Tuan Trader · Cảnh báo BTC", { body: message });
      }
    };

    const connect = () => {
      if (disposed) return;
      setConnection("connecting");
      const streams = `btcusdt@kline_${interval}/btcusdt@ticker/btcusdt@aggTrade`;
      spotSocket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      futuresSocket = new WebSocket("wss://fstream.binance.com/ws/btcusdt@forceOrder");

      spotSocket.onopen = () => setConnection("live");
      spotSocket.onmessage = (event) => {
        try {
          const packet = JSON.parse(String(event.data)) as { stream?: string; data?: Record<string, unknown> };
          const data = packet.data ?? {};
          if (packet.stream?.includes("@kline_")) {
            const kline = data.k as Record<string, string | number | boolean> | undefined;
            if (!kline) return;
            const next: Candle = {
              time: Math.floor(Number(kline.t) / 1000),
              open: Number(kline.o),
              high: Number(kline.h),
              low: Number(kline.l),
              close: Number(kline.c),
              volume: Number(kline.v),
              quoteVolume: Number(kline.q),
            };
            setCandles((current) => {
              if (!current.length) return [next];
              const last = current.at(-1)!;
              return (last.time === next.time ? [...current.slice(0, -1), next] : [...current, next]).slice(-1000);
            });
          } else if (packet.stream?.endsWith("@ticker")) {
            const price = Number(data.c);
            setTicker({
              lastPrice: price,
              priceChangePercent: Number(data.P),
              highPrice: Number(data.h),
              lowPrice: Number(data.l),
              quoteVolume: Number(data.q),
            });
            checkAlerts(price);
          } else if (packet.stream?.endsWith("@aggTrade")) {
            const price = Number(data.p);
            const quantity = Number(data.q);
            const value = price * quantity;
            const side: "buy" | "sell" = data.m ? "sell" : "buy";
            const now = Date.now();
            recentTrades.current.push({ time: now, side, value });
            recentTrades.current = recentTrades.current.filter((trade) => now - trade.time <= 60_000);
            if (now - lastFlowRender.current > 650) {
              const nextFlow = recentTrades.current.reduce((accumulator, trade) => {
                accumulator[trade.side] += trade.value;
                return accumulator;
              }, { buy: 0, sell: 0 });
              setFlow(nextFlow);
              lastFlowRender.current = now;
            }
            if (value >= whaleThreshold) {
              setTape((current) => [{ id: `W${now}${String(data.a ?? "")}`, kind: "whale", side, value, price, time: now, label: side === "buy" ? "Lệnh mua lớn" : "Lệnh bán lớn" }, ...current].slice(0, 12));
            }
          }
        } catch { /* ignore malformed stream packet */ }
      };
      spotSocket.onerror = () => setConnection("polling");
      spotSocket.onclose = () => {
        if (disposed) return;
        setConnection("polling");
        reconnectTimer = window.setTimeout(connect, 3_500);
      };

      futuresSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as { o?: Record<string, string> };
          const order = data.o;
          if (!order) return;
          const price = Number(order.ap || order.p);
          const value = price * Number(order.q);
          const side: "buy" | "sell" = order.S === "BUY" ? "buy" : "sell";
          const now = Date.now();
          setTape((current) => [{
            id: `L${now}${order.T ?? ""}`,
            kind: "liquidation",
            side,
            value,
            price,
            time: now,
            label: side === "sell" ? "LONG bị thanh lý" : "SHORT bị thanh lý",
          }, ...current].slice(0, 12));
        } catch { /* ignore malformed liquidation packet */ }
      };
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      spotSocket?.close();
      futuresSocket?.close();
    };
  }, [interval, whaleThreshold]);

  function addAlert(event: FormEvent) {
    event.preventDefault();
    const target = Number(alertTarget);
    if (!Number.isFinite(target) || target <= 0) {
      setAlertMessage("Nhập một mức giá BTC hợp lệ.");
      return;
    }
    setAlerts((current) => [{ id: crypto.randomUUID(), direction: alertDirection, target, triggered: false, createdAt: Date.now() }, ...current].slice(0, 12));
    setAlertTarget("");
    setAlertMessage(`Đã tạo cảnh báo tại ${usd.format(target)}.`);
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setAlertMessage("Trình duyệt này chưa hỗ trợ thông báo.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setAlertMessage(permission === "granted" ? "Đã bật thông báo giá BTC." : "Thông báo chưa được cấp quyền.");
  }

  function resetChart() {
    chart.current?.timeScale().fitContent();
    chart.current?.priceScale("right").applyOptions({ autoScale: true });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (chartPanel.current?.requestFullscreen) {
        await chartPanel.current.requestFullscreen();
      } else {
        setAlertMessage("Thiết bị này chưa hỗ trợ chế độ toàn màn hình.");
      }
    } catch {
      setAlertMessage("Không thể mở toàn màn hình trên trình duyệt này.");
    }
  }

  const price = ticker.lastPrice || candles.at(-1)?.close || 0;
  const openInterestNotional = futures.openInterest * price;
  const nextFunding = futures.nextFundingTime ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(futures.nextFundingTime)) : "—";
  const candleMove = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const candleMovePercent = activeCandle?.open ? candleMove / activeCandle.open * 100 : 0;
  const activeCandleTime = activeCandle?.time
    ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(activeCandle.time * 1000))
    : "—";

  return (
    <div className="btc-hub">
      <section className="btc-hero">
        <div className="btc-symbol-block">
          <span className="btc-logo">₿</span>
          <div><small>BINANCE · BTC/USDT</small><h2>Bitcoin</h2><span className={`btc-live ${connection}`}><i />{connection === "live" ? "Realtime" : connection === "polling" ? "Đang dùng dữ liệu dự phòng" : "Đang kết nối"}</span></div>
        </div>
        <div className="btc-price-block">
          <small>GIÁ HIỆN TẠI</small>
          <strong>{price ? usd.format(price) : "—"}</strong>
          <span className={ticker.priceChangePercent >= 0 ? "positive-text" : "negative-text"}>{ticker.priceChangePercent >= 0 ? "▲" : "▼"} {Math.abs(ticker.priceChangePercent).toFixed(2)}% · 24H</span>
        </div>
        <div className="btc-hero-stats">
          <div><span>Cao 24H</span><strong>{ticker.highPrice ? usd.format(ticker.highPrice) : "—"}</strong></div>
          <div><span>Thấp 24H</span><strong>{ticker.lowPrice ? usd.format(ticker.lowPrice) : "—"}</strong></div>
          <div><span>Volume 24H</span><strong>{compactUsd(ticker.quoteVolume)}</strong></div>
          <div><span>Mark price</span><strong>{futures.markPrice ? usd.format(futures.markPrice) : "—"}</strong></div>
        </div>
      </section>

      {error && <div className="btc-data-error"><span>!</span><div><strong>Dữ liệu realtime đang kết nối lại</strong><p>{error}. Biểu đồ sẽ tự thử lại, không ảnh hưởng nhật ký giao dịch.</p></div></div>}
      {alertMessage && <div className="btc-alert-toast"><span>◎</span>{alertMessage}<button onClick={() => setAlertMessage("")} aria-label="Đóng thông báo">×</button></div>}

      <section className="btc-main-grid">
        <article className={`btc-chart-panel panel ${isFullscreen ? "is-fullscreen" : ""}`} ref={chartPanel}>
          <div className="btc-chart-head">
            <div><span className="eyebrow">BIỂU ĐỒ NẾN REALTIME</span><h3>BTC/USDT · {INTERVALS.find((item) => item.value === interval)?.label}</h3></div>
            <div className="btc-chart-head-actions">
              <span className={`btc-live ${connection}`}><i />{connection === "live" ? "Live" : "Fallback"}</span>
              <div className="btc-timeframes" role="group" aria-label="Khung thời gian BTC">
                {INTERVALS.map((item) => <button key={item.value} className={interval === item.value ? "active" : ""} onClick={() => setIntervalValue(item.value)}>{item.label}</button>)}
              </div>
            </div>
          </div>
          <div className="btc-chart-tools">
            <div className="btc-indicator-controls" role="group" aria-label="Chỉ báo trên biểu đồ">
              <button className={showEma20 ? "active ema20" : ""} aria-pressed={showEma20} onClick={() => setShowEma20((value) => !value)}><i />EMA 20</button>
              <button className={showEma50 ? "active ema50" : ""} aria-pressed={showEma50} onClick={() => setShowEma50((value) => !value)}><i />EMA 50</button>
              <button className={showEma200 ? "active ema200" : ""} aria-pressed={showEma200} onClick={() => setShowEma200((value) => !value)}><i />EMA 200</button>
              <button className={showVolume ? "active volume" : ""} aria-pressed={showVolume} onClick={() => setShowVolume((value) => !value)}><i />Volume</button>
              <button className={showLevels ? "active levels" : ""} aria-pressed={showLevels} onClick={() => setShowLevels((value) => !value)}><i />S/R</button>
            </div>
            <div className="btc-chart-actions"><button onClick={resetChart} title="Đưa biểu đồ về vùng nhìn mặc định">⟲ <span>Reset</span></button><button onClick={toggleFullscreen} title="Toàn màn hình">{isFullscreen ? "×" : "⛶"} <span>{isFullscreen ? "Thoát" : "Toàn màn hình"}</span></button></div>
          </div>
          <div className="btc-ohlc-strip">
            <span className="btc-candle-time">{activeCandleTime}</span>
            <span>O <b>{activeCandle ? number.format(activeCandle.open) : "—"}</b></span>
            <span>H <b>{activeCandle ? number.format(activeCandle.high) : "—"}</b></span>
            <span>L <b>{activeCandle ? number.format(activeCandle.low) : "—"}</b></span>
            <span>C <b>{activeCandle ? number.format(activeCandle.close) : "—"}</b></span>
            <strong className={candleMove >= 0 ? "positive-text" : "negative-text"}>{candleMove >= 0 ? "+" : ""}{number.format(candleMove)} ({candleMovePercent >= 0 ? "+" : ""}{candleMovePercent.toFixed(2)}%)</strong>
          </div>
          <div className={`btc-chart ${loading ? "loading" : ""}`} ref={chartContainer} aria-label={`Biểu đồ nến BTC khung ${interval}`} />
          <div className="btc-chart-foot"><span className={showEma20 ? "" : "hidden"}><i className="ema20" /> EMA 20</span><span className={showEma50 ? "" : "hidden"}><i className="ema50" /> EMA 50</span><span className={showEma200 ? "" : "hidden"}><i className="ema200" /> EMA 200</span><span className={showLevels ? "" : "hidden"}><i className="levels" /> Hỗ trợ / Kháng cự</span><small>Nguồn: Binance public market data · Không cần API key</small></div>
        </article>

        <aside className={`btc-signal-panel panel ${signalClass(analysis.side)}`}>
          <div className="panel-title"><div><span className="eyebrow">TÍN HIỆU HIỆN TẠI</span><h3>Xu hướng · Động lượng</h3></div><span className={`btc-signal-badge ${signalClass(analysis.side)}`}>{analysis.label}</span></div>
          <div className="btc-signal-score"><div><strong>{analysis.score > 0 ? "+" : ""}{analysis.score}</strong><span>/ 5 điểm</span></div><p>Tín hiệu được tính từ EMA 20/50/200, RSI, động lượng và vị trí trong vùng giá.</p></div>
          <div className="btc-strength"><div><span>Độ đồng thuận</span><strong>{analysis.strength}%</strong></div><i><b style={{ width: `${analysis.strength}%` }} /></i></div>
          <div className="btc-indicators">
            <div><span>RSI (14)</span><strong className={analysis.rsi >= 70 ? "negative-text" : analysis.rsi <= 30 ? "positive-text" : ""}>{analysis.rsi.toFixed(1)}</strong></div>
            <div><span>ATR (14)</span><strong>{analysis.atr ? usd.format(analysis.atr) : "—"}</strong></div>
            <div><span>Volume / TB20</span><strong>{analysis.volumeRatio.toFixed(2)}×</strong></div>
            <div><span>EMA 200</span><strong>{analysis.ema200 ? usd.format(analysis.ema200) : "—"}</strong></div>
          </div>
          <p className="btc-method-note">Công thức minh bạch, chỉ hỗ trợ đọc thị trường — không phải tín hiệu vào lệnh hay cam kết lợi nhuận.</p>
        </aside>
      </section>

      <section className="btc-mtf panel">
        <div className="panel-title"><div><span className="eyebrow">MULTI-TIMEFRAME</span><h3>Trạng thái xu hướng đa khung</h3></div><small>Tự làm mới mỗi 60 giây</small></div>
        <div className="btc-mtf-grid">
          {mtfAnalysis.map((item) => <article key={item.timeframe} className={signalClass(item.side)}><div><span>{item.timeframe.toUpperCase()}</span><i /></div><strong>{item.label.replace("Ưu tiên ", "")}</strong><small>RSI {item.rsi.toFixed(0)} · {item.score > 0 ? "+" : ""}{item.score}/5</small></article>)}
        </div>
      </section>

      <section className="btc-intel-grid">
        <article className="panel btc-structure">
          <div className="panel-title"><div><span className="eyebrow">MARKET STRUCTURE</span><h3>Vùng giá quan trọng</h3></div><span className="status-chip">55 nến</span></div>
          <div className="btc-level resistance"><span>Kháng cự gần</span><strong>{analysis.resistance ? usd.format(analysis.resistance) : "—"}</strong><small>{price && analysis.resistance ? `${((analysis.resistance / price - 1) * 100).toFixed(2)}% phía trên` : "Đang tính"}</small></div>
          <div className="btc-level current"><span>Giá BTC</span><strong>{price ? usd.format(price) : "—"}</strong><small>Realtime Binance</small></div>
          <div className="btc-level support"><span>Hỗ trợ gần</span><strong>{analysis.support ? usd.format(analysis.support) : "—"}</strong><small>{price && analysis.support ? `${((price / analysis.support - 1) * 100).toFixed(2)}% phía dưới` : "Đang tính"}</small></div>
        </article>

        <article className="panel btc-flow">
          <div className="panel-title"><div><span className="eyebrow">ORDER FLOW · 60 GIÂY</span><h3>Áp lực mua / bán chủ động</h3></div><span className="btc-flow-ratio">{buyPercent.toFixed(0)} / {(100 - buyPercent).toFixed(0)}</span></div>
          <div className="btc-flow-bar"><i className="buy" style={{ width: `${buyPercent}%` }} /><i className="sell" style={{ width: `${100 - buyPercent}%` }} /></div>
          <div className="btc-flow-values"><div><span>MUA</span><strong className="positive-text">{compactUsd(flow.buy)}</strong></div><div><span>BÁN</span><strong className="negative-text">{compactUsd(flow.sell)}</strong></div></div>
          <label className="btc-threshold">Ngưỡng lệnh lớn<select value={whaleThreshold} onChange={(event) => setWhaleThreshold(Number(event.target.value))}><option value={100000}>≥ $100K</option><option value={250000}>≥ $250K</option><option value={500000}>≥ $500K</option><option value={1000000}>≥ $1M</option></select></label>
        </article>

        <article className="panel btc-derivatives">
          <div className="panel-title"><div><span className="eyebrow">FUTURES PULSE</span><h3>Đòn bẩy thị trường</h3></div><span className="status-chip">BTCUSDT</span></div>
          <div className="btc-derivative-row"><span>Funding rate</span><strong className={futures.fundingRate >= 0 ? "positive-text" : "negative-text"}>{(futures.fundingRate * 100).toFixed(4)}%</strong><small>Kỳ kế tiếp {nextFunding}</small></div>
          <div className="btc-derivative-row"><span>Open interest</span><strong>{openInterestNotional ? compactUsd(openInterestNotional) : "—"}</strong><small>{futures.openInterest ? `${number.format(futures.openInterest)} BTC` : "Đang tải"}</small></div>
          <div className="btc-derivative-row"><span>Long / Short</span><strong>{futures.longShortRatio ? futures.longShortRatio.toFixed(2) : "—"}</strong><small>{futures.longShortRatio > 1 ? "Nghiêng Long" : futures.longShortRatio ? "Nghiêng Short" : "Đang tải"}</small></div>
        </article>
      </section>

      <section className="btc-bottom-grid">
        <article className="panel btc-tape">
          <div className="panel-title"><div><span className="eyebrow">LIVE MARKET TAPE</span><h3>Lệnh lớn & thanh lý</h3></div><span className={`btc-live ${connection}`}><i />Live</span></div>
          <div className="btc-tape-list">
            {tape.length ? tape.map((item) => <div key={item.id} className={`${item.kind} ${item.side}`}><span>{item.kind === "liquidation" ? "⚡" : "◆"}</span><div><strong>{item.label}</strong><small>{new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(item.time))}</small></div><div><b>{compactUsd(item.value)}</b><small>@ {usd.format(item.price)}</small></div></div>) : <div className="btc-empty-tape"><span>⌁</span><strong>Đang nghe dữ liệu thị trường</strong><p>Lệnh lớn hoặc thanh lý mới sẽ xuất hiện tại đây.</p></div>}
          </div>
        </article>

        <article className="panel btc-alerts">
          <div className="panel-title"><div><span className="eyebrow">PRICE ALERT</span><h3>Cảnh báo giá BTC</h3></div><button className="btc-notify-button" onClick={enableNotifications}>{notificationPermission === "granted" ? "✓ Đã bật" : "♧ Bật thông báo"}</button></div>
          <form onSubmit={addAlert} className="btc-alert-form">
            <select value={alertDirection} onChange={(event) => setAlertDirection(event.target.value as "above" | "below")} aria-label="Hướng cảnh báo"><option value="above">Vượt lên</option><option value="below">Giảm xuống</option></select>
            <input type="number" min="1" step="0.01" value={alertTarget} onFocus={selectNumericInput} onChange={(event) => setAlertTarget(normalizeNumericInput(event.target.value))} placeholder={price ? String(Math.round(price)) : "Mức giá USD"} aria-label="Mức giá cảnh báo" />
            <button type="submit">＋ Thêm</button>
          </form>
          <div className="btc-alert-list">
            {alerts.length ? alerts.map((alert) => <div key={alert.id} className={alert.triggered ? "triggered" : ""}><span>{alert.triggered ? "✓" : alert.direction === "above" ? "↑" : "↓"}</span><div><strong>{alert.direction === "above" ? "Vượt lên" : "Giảm xuống"} {usd.format(alert.target)}</strong><small>{alert.triggered ? "Đã kích hoạt" : "Đang theo dõi trên thiết bị này"}</small></div><button onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))} aria-label={`Xóa cảnh báo ${alert.target}`}>×</button></div>) : <div className="btc-empty-alerts">Chưa có cảnh báo. Chọn hướng và nhập mức giá cần theo dõi.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}
