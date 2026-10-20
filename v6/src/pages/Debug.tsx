import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import vi from '../i18n/vi.json';
import { JournalRepository } from '../data/repository';
import { emptySnapshot, type Snapshot } from '../data/snapshot';
import type { verifyGolden } from '../core/golden';
import type { analyze } from '../core/analyze';
const t = vi.debug;
function download(raw: string, name: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Debug() {
  const repo = useMemo(() => new JournalRepository(), []),
    [state, setState] = useState({ revision: 0, data: emptySnapshot() }),
    [journalId, setJournalId] = useState(''),
    [raw, setRaw] = useState(''),
    [preview, setPreview] = useState<Snapshot>(),
    [version, setVersion] = useState(0),
    [previewRevision, setPreviewRevision] = useState(0),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [detail, setDetail] = useState(''),
    [analysisState, setAnalysisState] = useState<{
      source: Snapshot;
      journalId: string;
      result: ReturnType<typeof analyze>;
      golden: ReturnType<typeof verifyGolden> | null;
    }>(),
    [recoveries, setRecoveries] = useState<{ id: string; at: string; reason: string }[]>([]);
  const data = preview ?? state.data,
    journal = data.journals.find((j) => j.id === journalId) ?? data.journals[0];
  useEffect(() => {
    let active = true;
    void repo
      .snapshot()
      .then((s) => {
        if (active) setState(s);
      })
      .catch((e) => {
        if (active) {
          setMessage(t.error);
          setDetail(String(e));
        }
      });
    return () => {
      active = false;
      repo.close();
    };
  }, [repo]);
  useEffect(() => {
    let active = true;
    void repo
      .recoveries()
      .then((r) => {
        if (active) setRecoveries(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [repo, state]);
  useEffect(() => {
    if (!journal) return;
    const worker = new Worker(new URL('../app/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (
      e: MessageEvent<{
        ok: boolean;
        result?: ReturnType<typeof analyze>;
        golden: ReturnType<typeof verifyGolden> | null;
        error?: string;
      }>,
    ) => {
      if (e.data.ok)
        setAnalysisState({
          source: data,
          journalId: journal.id,
          result: e.data.result!,
          golden: e.data.golden,
        });
      else {
        setMessage(t.error);
        setDetail(e.data.error ?? '');
      }
    };
    worker.postMessage({ journal, trades: data.trades });
    return () => worker.terminate();
  }, [journal, data]);
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setPreview(undefined);
    setMessage('');
    setConfirm(false);
    setDetail('');
    try {
      if (file.size > 100 * 1024 * 1024) throw Error('BACKUP_TOO_LARGE');
      const source = await file.text(),
        parsed = JSON.parse(source) as { schemaVersion: number };
      const next = await repo.previewRestore(source);
      setRaw(source);
      setVersion(parsed.schemaVersion);
      setPreviewRevision(state.revision);
      setPreview(next);
      setJournalId(next.journals[0]?.id ?? '');
    } catch (e) {
      setMessage(t.error);
      setDetail(String(e));
      setRaw('');
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview || !confirm) return;
    setBusy(true);
    try {
      if (version === 3) await repo.importV3(raw, previewRevision);
      else await repo.restore(raw, previewRevision);
      setState(await repo.snapshot());
      setPreview(undefined);
      setConfirm(false);
      setMessage(t.loaded);
    } catch (e) {
      setMessage(t.error);
      setDetail(String(e));
    } finally {
      setBusy(false);
    }
  }
  const currentAnalysis =
    analysisState?.source === data && analysisState.journalId === journal?.id
      ? analysisState
      : undefined;
  const analysis = currentAnalysis?.result,
    golden = currentAnalysis?.golden;
  const labels = vi.metricLabels as Record<string, string>;
  return (
    <div className="debug-shell">
      <header>
        <span>
          {vi.app.brand} · {vi.app.motto}
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
        <a href="https://tuannhatky.fabledcoot2.chatgpt.site/#overview">{t.back}</a>
      </header>
      <section>
        <label>
          {t.file}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => void choose(e)}
            disabled={busy}
          />
        </label>
        {busy && <p role="status">{t.busy}</p>}
        {message && <p role="status">{message}</p>}
        {detail && (
          <details>
            <summary>{t.technical}</summary>
            <pre>{detail}</pre>
          </details>
        )}
        {preview && (
          <>
            <h2>{t.previewCounts}</h2>
            <p>
              {preview.journals.length} {t.journals} · {preview.trades.length} {t.trades}
            </p>
            <p>{version === 3 ? t.merge : t.replace}</p>
            <label>
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
                disabled={busy}
              />
              {t.confirm}
            </label>
            <button onClick={() => void commit()} disabled={!confirm || busy}>
              {t.commit}
            </button>
          </>
        )}
        <button
          disabled={busy || !state.data.journals.length}
          onClick={() => {
            void repo
              .exportJSON()
              .then((raw) => download(raw, 'tuan-trader-v4.json'))
              .catch((e) => {
                setMessage(t.error);
                setDetail(String(e));
              });
          }}
        >
          {t.export}
        </button>
      </section>
      {!journal ? (
        <p>{t.empty}</p>
      ) : (
        <>
          <section>
            {journal.isDemo && <p className="notice">{t.demo}</p>}
            <label>
              {t.journal}
              <select value={journal.id} onChange={(e) => setJournalId(e.target.value)}>
                {data.journals.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} · {j.currency}
                  </option>
                ))}
              </select>
            </label>
            <p>{t.winrate}</p>
            {analysis && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.metric}</th>
                      <th>{t.value}</th>
                      <th>{t.sample}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysis.metrics).map(([id, m]) => (
                      <tr key={id}>
                        <th>{labels[id] ?? id}</th>
                        <td>
                          {m.value === null
                            ? '—'
                            : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(
                                Number(m.value),
                              )}
                        </td>
                        <td>
                          {m.n}/{m.of}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {golden && (
            <section>
              <h2>
                {t.golden}: {golden.pass ? t.pass : t.fail}
              </h2>
              <details>
                <summary>{t.technical}</summary>
                <pre>{JSON.stringify(golden.checks, null, 2)}</pre>
              </details>
            </section>
          )}
          <section>
            <h2>{t.recovery}</h2>
            <p>{t.source}</p>
            {data.sources.map((source) => (
              <button
                key={source.id}
                onClick={() => download(source.raw, 'tuan-trader-v3-original.json')}
              >
                {t.downloadOriginal}
              </button>
            ))}
            {recoveries.map((r) => (
              <p key={r.id}>
                {new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: journal.timezone,
                }).format(new Date(r.at))}{' '}
                <button
                  onClick={() => {
                    void repo.original(r.id).then((raw) => {
                      if (raw) download(raw, 'tuan-trader-recovery.json');
                    });
                  }}
                >
                  {t.downloadRecovery}
                </button>
              </p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
