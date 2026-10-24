import { useEffect, useState } from 'react';
import { journalSchema, type Journal, type Plan, type AlertRule } from '../data/schema';

import { useLedger } from '../app/LedgerContext';
import { ensureCatalog } from '../data/tradeCommands';
import { cloneJournalTemplate, archiveJournal } from '../data/journalCommands';
import { viewRepository } from '../data/views';
import {
  exportWorkspace,
  previewWorkspace,
  restoreWorkspace,
  recoverWorkspaceRestore,
} from '../data/workspaceBackup';
import { formatDate } from '../ui/format';
import { CashFlowSettings } from './CashFlowSettings';
import { BinanceImport } from './BinanceImport';
import { LegEditor } from './LegEditor';
import { BackupSecurity } from './BackupSecurity';
import { FeeProfiles } from './FeeProfiles';
import { FifoImport } from './FifoImport';
import { DirectoryBackup } from '../ui/DirectoryBackup';
import vi from '../i18n/vi.json';
import { WorkspaceMerge } from './WorkspaceMerge';
const t = vi.s3;
const download = (raw: string) => {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tuan-trader-workspace.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function NewJournal({ onCreated }: { onCreated: (id: string) => void }) {
  const { mutate, busy } = useLedger(),
    [name, setName] = useState(''),
    [currency, setCurrency] = useState<'VND' | 'USD' | 'USDT'>('VND'),
    [error, setError] = useState('');
  async function create() {
    try {
      const j = journalSchema.parse({
        id: crypto.randomUUID(),
        name,
        currency,
        timezone: 'Asia/Ho_Chi_Minh',
        settings: {},
        isDemo: false,
        createdAt: new Date().toISOString(),
        schemaVersion: 4,
      });
      await mutate((s) => ensureCatalog({ ...s, journals: [...s.journals, j] }, j.id));
      onCreated(j.id);
    } catch {
      setError(t.error);
    }
  }
  return (
    <section className="panel">
      <h2>{t.createJournal}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label>
          {t.name}
          <input
            aria-label={t.name}
            value={name}
            required
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t.currency}
          <select
            aria-label={t.currency}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
          >
            {['VND', 'USD', 'USDT'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy}>
          {t.createJournal}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function Settings({
  journal,
  onCreated,
}: {
  journal?: Journal;
  onCreated: (id: string) => void;
}) {
  const { repo, revision, busy, data } = useLedger(),
    [message, setMessage] = useState(''),
    [last, setLast] = useState(''),
    [backupCount, setBackupCount] = useState(0),
    [preview, setPreview] = useState<Awaited<ReturnType<typeof previewWorkspace>>>(),
    [raw, setRaw] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [previewRevision, setPreviewRevision] = useState(0);
  useEffect(() => {
    void viewRepository.meta.get('lastBackupAt').then((r) => setLast(r?.value ?? ''));
    void viewRepository.meta
      .get('backupTradeCount')
      .then((r) => setBackupCount(Number(r?.value ?? 0)));
  }, []);
  async function exportFile() {
    try {
      download(await exportWorkspace(repo));
      const date = new Date().toISOString();
      await viewRepository.meta.put({ key: 'lastBackupAt', value: date });
      await viewRepository.meta.put({ key: 'backupTradeCount', value: String(data.trades.length) });
      setBackupCount(data.trades.length);
      setLast(date);
      setMessage(t.saved);
    } catch {
      setMessage(t.error);
    }
  }
  const [openedAt] = useState(() => Date.now());
  const days = last ? (openedAt - Date.parse(last)) / 86400000 : Infinity;
  return (
    <>
      <WorkspaceMerge />
      <section className="panel">
        <h2>{t.settings}</h2>
        <p>{t.backupInfo}</p>
        <p>{last ? t.lastBackup + ': ' + formatDate(last, journal?.timezone) : t.backupNever}</p>
        {(days >= (journal?.settings.backupReminderDays ?? 7) ||
          data.trades.length - backupCount >= 20) && <p className="notice">{t.backupDue}</p>}
        <div className="actions">
          <button
            onClick={() =>
              void viewRepository.meta
                .get('before-workspace-restore')
                .then((record) => {
                  if (record) download(record.value);
                  else setMessage('Chưa có bản sao trước khôi phục.');
                })
                .catch(() => setMessage(t.error))
            }
          >
            Tải bản sao trước khôi phục
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void recoverWorkspaceRestore(repo)
                .then((recovered) =>
                  setMessage(
                    recovered ? 'Đã hoàn tất khôi phục Views.' : 'Không có khôi phục dở dang.',
                  ),
                )
                .catch(() =>
                  setMessage(
                    'Chưa thể hoàn tất khôi phục. Hãy giữ bản sao trước khôi phục và kiểm tra dữ liệu hiện tại.',
                  ),
                )
            }
          >
            Hoàn tất khôi phục dở dang
          </button>
          <button className="primary" onClick={() => void exportFile()}>
            {t.backup}
          </button>
          <button
            onClick={() =>
              void navigator.storage
                ?.persist?.()
                .then((ok) => setMessage(ok ? t.persistGranted : t.persistDenied))
                .catch(() => setMessage(t.persistDenied))
            }
          >
            {t.persist}
          </button>
        </div>
        <label>
          {t.restore}
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(undefined);
              setConfirmed(false);
              setRaw('');
              if (!file) return;
              if (file.size > 100 * 1024 * 1024) {
                setMessage(t.error);
                return;
              }
              void file
                .text()
                .then(async (raw) => {
                  const next = await previewWorkspace(raw, repo);
                  setPreview(next);
                  setRaw(raw);
                  setPreviewRevision(revision);
                  setConfirmed(false);
                  setMessage('');
                })
                .catch(() => setMessage(t.error));
            }}
          />
        </label>
        {preview && (
          <section className="preview">
            <h3>{t.restorePreview}</h3>
            <p>
              {preview.data.journals.length} {vi.debug.journals} · {preview.data.trades.length}{' '}
              {vi.debug.trades}
            </p>
            <button
              onClick={() =>
                void previewWorkspace(raw, repo)
                  .then(() => setMessage(t.verifyOk))
                  .catch(() => setMessage(t.error))
              }
            >
              {t.verify}
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t.restoreConfirm}
            </label>
            <button
              disabled={!confirmed || busy}
              onClick={() =>
                void restoreWorkspace(raw, repo, previewRevision)
                  .then(() => {
                    setPreview(undefined);
                    setMessage(t.saved);
                  })
                  .catch(() => setMessage(t.error))
              }
            >
              {t.restoreButton}
            </button>
          </section>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      {journal && <JournalSettings key={journal.id + ':' + revision} journal={journal} />}
      {journal && <CashFlowSettings key={journal.id} journal={journal} />}
      {journal && <FeeProfiles key={'fees:' + journal.id} journal={journal} />}
      {journal && <FifoImport key={'fifo:' + journal.id} journal={journal} />}
      {journal && <BinanceImport key={'import:' + journal.id} journal={journal} />}
      {journal && <LegEditor key={'legs:' + journal.id} journal={journal} />}
      <NewJournal onCreated={onCreated} />
      <JournalManagement onCreated={onCreated} />
      <BackupSecurity />
      <DirectoryBackup />
      <section className="panel">
        <h2>{t.demo}</h2>
        <p>{t.demoHelp}</p>
        <button
          onClick={() =>
            void import('../../tests/golden/fixture-30-trades.json?raw')
              .then(async (m) => {
                await repo.importV3(m.default, revision);
                setMessage(t.saved);
              })
              .catch((e) =>
                setMessage(
                  String(e).includes('JOURNAL_ALREADY_EXISTS')
                    ? 'Sổ minh họa đã tồn tại.'
                    : t.error,
                ),
              )
          }
        >
          {t.demo}
        </button>
      </section>
    </>
  );
}
function JournalManagement({ onCreated }: { onCreated: (id: string) => void }) {
  const { data, mutate, busy } = useLedger();
  const [message, setMessage] = useState('');
  return (
    <section className="panel">
      <h2>Quản lý sổ</h2>
      <p>
        Nhân bản cấu hình tạo sổ trống cùng tiền tệ, setup, lỗi và quy tắc. Vốn và lịch sử giao dịch
        không được sao chép.
      </p>
      {data.journals.map((j) => (
        <div className="actions" key={j.id}>
          <span>
            {j.name} · {j.currency}
            {j.archivedAt ? ' · Đã lưu trữ' : ''}
          </span>
          <button
            disabled={busy}
            onClick={() => {
              try {
                const cloned = cloneJournalTemplate(
                  data,
                  j.id,
                  j.name.slice(0, 185) + ' (bản sao)',
                );
                void mutate(() => cloned.data)
                  .then(() => onCreated(cloned.journal.id))
                  .catch(() => setMessage(t.error));
              } catch {
                setMessage(t.error);
              }
            }}
          >
            Nhân bản cấu hình {j.name}
          </button>
          <button
            disabled={
              busy || (!j.archivedAt && data.journals.filter((x) => !x.archivedAt).length <= 1)
            }
            onClick={() =>
              void mutate((s) => archiveJournal(s, j.id, !j.archivedAt))
                .then(() => setMessage(t.saved))
                .catch(() => setMessage(t.error))
            }
          >
            {j.archivedAt ? 'Khôi phục sổ' : 'Lưu trữ sổ'} {j.name}
          </button>
        </div>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
function JournalSettings({ journal }: { journal: Journal }) {
  const { data, mutate, busy } = useLedger();
  const [name, setName] = useState(journal.name),
    [capital, setCapital] = useState(journal.startingBalance ?? ''),
    [sample, setSample] = useState(String(journal.settings.minSample)),
    [zone, setZone] = useState(journal.timezone),
    [message, setMessage] = useState('');
  const old = data.plans.find((p) => p.journalId === journal.id);
  const initial: Plan = old ?? {
    journalId: journal.id,
    allowedSetupIds: [],
    sessionWindows: [],
    alertRules: [
      {
        id: 'loss-over-r',
        kind: 'loss-over-r',
        enabled: true,
        threshold: '1',
        toleranceR: '0.10',
        unit: 'R',
        severity: 'warning',
      },
      {
        id: 'daily-loss',
        kind: 'daily-loss',
        enabled: false,
        threshold: '2',
        unit: 'R',
        severity: 'warning',
      },
      {
        id: 'daily-count',
        kind: 'daily-count',
        enabled: false,
        threshold: '2',
        unit: 'count',
        severity: 'warning',
      },
      {
        id: 'drawdown',
        kind: 'drawdown',
        enabled: false,
        threshold: '3',
        unit: 'R',
        severity: 'critical',
      },
      {
        id: 'missing-data',
        kind: 'missing-data',
        enabled: true,
        threshold: '48',
        unit: 'hours',
        severity: 'info',
      },
    ],
  };
  const [rules, setRules] = useState(initial.alertRules);
  async function save() {
    try {
      const j = journalSchema.parse({
        ...journal,
        name,
        timezone: zone,
        startingBalance: capital || undefined,
        settings: { ...journal.settings, minSample: Number(sample) },
      });
      await mutate((s) => ({
        ...s,
        journals: s.journals.map((x) => (x.id === j.id ? j : x)),
        plans: [...s.plans.filter((p) => p.journalId !== j.id), { ...initial, alertRules: rules }],
      }));
      setMessage(t.saved);
    } catch {
      setMessage(t.error);
    }
  }
  return (
    <section className="panel">
      <h2>{t.saveSettings}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="filter-grid">
          <label>
            {t.name}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t.starting}
            <input value={capital} onChange={(e) => setCapital(e.target.value)} />
          </label>
          <label>
            {t.minSample}
            <input
              type="number"
              min={1}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
          </label>
          <label>
            {t.timezone}
            <input value={zone} onChange={(e) => setZone(e.target.value)} />
          </label>
        </div>
        <h3>{t.rules}</h3>
        {rules.map((rule, i) => (
          <fieldset key={rule.id}>
            <legend>{t.alertNames[rule.kind]}</legend>
            <div className="actions">
              <label className="check">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    setRules(
                      rules.map((r, k) => (k === i ? { ...r, enabled: e.target.checked } : r)),
                    )
                  }
                />
                {t.enabled}
              </label>
              <label>
                {t.threshold}
                <input
                  aria-label={`${t.threshold} ${t.alertNames[rule.kind]}`}
                  value={rule.threshold}
                  onChange={(e) =>
                    setRules(
                      rules.map((r, k) => (k === i ? { ...r, threshold: e.target.value } : r)),
                    )
                  }
                />
              </label>
              {rule.kind === 'loss-over-r' && (
                <label>
                  {t.tolerance}
                  <input
                    value={rule.toleranceR ?? '0.10'}
                    onChange={(e) =>
                      setRules(
                        rules.map((r, k) => (k === i ? { ...r, toleranceR: e.target.value } : r)),
                      )
                    }
                  />
                </label>
              )}
              {rule.kind === 'missing-data' && <span>giờ</span>}
              {rule.kind !== 'loss-over-r' &&
                rule.kind !== 'daily-count' &&
                rule.kind !== 'missing-data' &&
                rule.kind !== 'loss-streak' && (
                  <label>
                    {t.ruleUnit}
                    <select
                      value={rule.unit}
                      onChange={(e) =>
                        setRules(
                          rules.map((r, k) =>
                            k === i ? { ...r, unit: e.target.value as AlertRule['unit'] } : r,
                          ),
                        )
                      }
                    >
                      <option value="R">R</option>
                      <option value="money">{journal.currency}</option>
                      {rule.kind === 'drawdown' && <option value="percent">%</option>}
                    </select>
                  </label>
                )}
            </div>
          </fieldset>
        ))}
        <button className="primary" disabled={busy}>
          {t.saveSettings}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
