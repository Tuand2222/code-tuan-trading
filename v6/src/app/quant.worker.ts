import {
  observeTrades,
  quantReport,
  type QuantSettings,
  type QuantObservation,
} from '../core/quantLab';
import type { Trade } from '../data/schema';
self.onmessage = (
  e: MessageEvent<{
    trades?: Trade[];
    observations?: QuantObservation[];
    settings: QuantSettings;
    timezone: string;
    scope: { from?: string; to?: string };
  }>,
) => {
  try {
    const { settings, timezone, scope } = e.data;
    self.postMessage({
      ok: true,
      report: quantReport(
        e.data.observations ?? observeTrades(e.data.trades ?? []),
        settings,
        timezone,
        scope,
      ),
    });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
