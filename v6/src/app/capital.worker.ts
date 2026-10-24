import { capitalReport, simulateCapital } from '../core/capitalPro';
import type { QuantObservation } from '../core/quantLab';
import type { CapitalLab } from '../data/capitalSettings';
self.onmessage = (
  e: MessageEvent<{
    kind: 'report' | 'simulation';
    observations: QuantObservation[];
    settings: CapitalLab;
    timezone?: string;
  }>,
) => {
  try {
    const report = capitalReport(e.data.observations, e.data.settings, e.data.timezone);
    self.postMessage({
      ok: true,
      result: e.data.kind === 'report' ? report : simulateCapital(report.values, e.data.settings),
    });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
