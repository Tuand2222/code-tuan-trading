'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { adapters, detectSource, getAdapter } from '../../lib/trading/import/adapters';
import { headerKey, errorCSV } from '../../lib/trading/import/tableReader';
import { readFileWorker, parseRowsWorker } from '../../lib/trading/import/workerClient';
import { createBatch, stageImport, stageQueue, type ImportDraft, type StagedImport } from '../../lib/trading/import/stage';
import type { ConnectorId, SheetSample } from '../../lib/trading/import/types';
import { accountSchema, parseConfigSchema, type Account, type Cycle, type ImportWarning, type LedgerSnapshot, type ParseConfig, type ReplayResult } from '../../lib/trading/domain/types';
import { hash } from '../../lib/trading/domain/identity';
import { D, dec, parseDecimal, positive } from '../../lib/trading/domain/decimal';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import { replayLedger, rollbackPreview } from '../../lib/trading/application/replayLedger';
import ImportPreview, { ImportWarnings } from './ImportPreview';
import ImportAccountFields, { OpeningBalanceFields, FeePresetFields } from './ImportAccountFields';
import ImportSummaryCard from './ImportSummaryCard';
import { batchComparison, displayAmount, importSummary, riskOverlay, sourceImpact, type ImportSummaryVM } from '../../lib/trading/import/presentation';
import { groupWarnings } from '../../lib/trading/import/warnings';
import type { SourcePreference } from '../../lib/trading/domain/replayBook';
import { readImportTemplates, type ImportTemplate } from '../../lib/trading/import/templates';
import { useLedger } from './LedgerContext';

type Template = ImportTemplate;
const empty: LedgerSnapshot = { accounts: [], batches: [], fills: [], cashEvents: [], overlays: [], settings: {} };
const tabs = ['Nguồn dữ liệu', 'Tài khoản', 'Lịch sử nhập', 'Mẫu ánh xạ', 'Sức khỏe dữ liệu'];
function download(text: string, name: string, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function HubDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="hub-dialog" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><header><h2>{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label={`Đóng ${title}`}>×</button></header>{children}</dialog>;
}
const stageWarnings = (stage: StagedImport): ImportWarning[] => [...stage.warnings, ...batchComparison(stage).filter(c => c.status === 'mismatch').map(() => ({ code: 'REPORTED_PNL_MISMATCH', severity: 'needs-confirmation' as const, message: 'P&L báo cáo lệch P&L tính từ giá; cần đối chiếu.' }))];
function defaultAccount(connector: ConnectorId): Account {
  const a = getAdapter(connector), ccy = a.platform === 'VN_STOCK' || a.platform === 'GENERIC' ? 'VND' : a.platform === 'MT5' ? 'USD' : 'USDT';
  return { accountId: crypto.randomUUID(), accountKey: '', label: '', platform: a.platform, market: a.platform === 'VN_STOCK' || a.platform === 'GENERIC' ? 'stock' : a.platform === 'MT5' ? 'forex' : 'crypto', baseCcy: ccy, quoteCcy: ccy, costBasis: 'fifo', allowsShort: a.platform !== 'VN_STOCK' && a.platform !== 'GENERIC', bookMode: 'netting', sourceTimezone: a.declare.defaultTimezone ?? '', pnlModel: a.platform === 'MT5' ? 'reported' : 'linear', contractMultiplier: '1', openingBalances: [] };
}
export default function DataConnections({ active }: { active: boolean }) {
  const sharedLedger = useLedger();
  const storeRef = useRef<DexieLedgerStore | null>(null);
  const [ledger, setLedger] = useState({ version: 0, data: empty });
  const [health, setHealth] = useState<ReplayResult>();
  const [tab, setTab] = useState(0), [modal, setModal] = useState(false), [step, setStep] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [sheets, setSheets] = useState<SheetSample[]>([]), [sheetIndex, setSheetIndex] = useState(0), [connector, setConnector] = useState<ConnectorId>('generic-template');
  const [config, setConfig] = useState<ParseConfig>(), [account, setAccount] = useState<Account>(), [rate, setRate] = useState('25500'), [risk, setRisk] = useState('');
  const [paste, setPaste] = useState(''), [staged, setStaged] = useState<StagedImport>(), [confirmed, setConfirmed] = useState<string[]>([]);
  const [summary, setSummary] = useState(''), [detail, setDetail] = useState(''), [rollback, setRollback] = useState<Awaited<ReturnType<typeof rollbackPreview>>>(), [rollbackId, setRollbackId] = useState('');
  const [summaryVM, setSummaryVM] = useState<ImportSummaryVM>();
  const [accountEdit, setAccountEdit] = useState<Account>(), [accountImpact, setAccountImpact] = useState<ReturnType<typeof sourceImpact>>();
  const [preference, setPreference] = useState<{ accountId: string; value: SourcePreference; version: number; impact: ReturnType<typeof sourceImpact> }>();
  const [mappingEdit, setMappingEdit] = useState<Template>(), [stopConfirmed, setStopConfirmed] = useState(false);
  const [queue, setQueue] = useState<StagedImport[]>([]), [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null);
  useEffect(()=>{if(active&&new URLSearchParams(window.location.hash.split('?')[1]).get('tab')==='history')setTab(2);},[active]);
  const sample = sheets[sheetIndex];
  const templates = readImportTemplates(ledger.data.settings.importTemplates);
  const availableAccounts = [...new Map([...ledger.data.accounts, ...queue.map(s => s.account)].map(a => [a.accountId, a])).values()];
  async function refresh() { const current = await storeRef.current!.snapshot(); setLedger(current); setHealth(await replayLedger(current.data)); return current; }
  useEffect(() => { const store = new DexieLedgerStore(); storeRef.current = store; void refresh().catch(e => setError(String(e))); return () => { controller.current?.abort(); store.close(); }; }, []);
  useEffect(() => { if (sharedLedger.snapshot) setLedger(sharedLedger.snapshot); }, [sharedLedger.snapshot]);
  useEffect(() => { if (sharedLedger.derived) setHealth(sharedLedger.derived.result); }, [sharedLedger.derived]);
  useEffect(() => { const fx = sharedLedger.snapshot?.data.settings.defaultFX; if (typeof fx === 'string') setRate(fx); }, [sharedLedger.snapshot?.data.settings.defaultFX]);
  useEffect(() => { if (modal && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [modal]);
  useEffect(() => {
    const drag = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => { if (!e.dataTransfer?.files.length) return; e.preventDefault(); void readFiles([...e.dataTransfer.files]); };
    const onPaste = (e: ClipboardEvent) => { if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]')) return; const text = e.clipboardData?.getData('text/plain'), html = e.clipboardData?.getData('text/html'); if (text?.includes('\t') && text.includes('\n')) { e.preventDefault(); void readFiles([new File([text], 'clipboard.tsv')]); } else if (html && /<table[\s>]/i.test(html)) { e.preventDefault(); void readFiles([new File([html], 'clipboard.html')]); } };
    window.addEventListener('dragover', drag); window.addEventListener('drop', drop); window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('dragover', drag); window.removeEventListener('drop', drop); window.removeEventListener('paste', onPaste); };
  });
  function close() { if (saving) return; controller.current?.abort(); dialog.current?.close(); setModal(false); setBusy(false); }
  async function configure(next: SheetSample, id?: ConnectorId) {
    const detections = detectSource(next), choice = id ? getAdapter(id).detect(next) : detections[0];
    setConnector(choice.connector);
    const existing = availableAccounts.find(a => a.platform === choice.platform), acct = existing ?? defaultAccount(choice.connector); setAccount(acct);
    setConfig({ templateFingerprint: await hash(next.headers.map(headerKey).sort()), platform: choice.platform, reportType: choice.reportType, granularity: choice.granularity, columnMapping: choice.columnMapping, decimalSeparator: '.', thousandSeparator: ',', sourceTimezone: acct.sourceTimezone, priceUnit: { multiplierToCcy: '1', confirmedBy: 'user', crossCheck: 'n/a' }, contractMultiplier: acct.contractMultiplier, pnlBasis: getAdapter(choice.connector).declare.pnlBasis, costCompleteness: 'partial', openingPositionsConfirmed: false });
    setStep(1); setStaged(undefined); setConfirmed([]); setStopConfirmed(false);
  }
  async function readFiles(files: File[]) {
    if (busy) return; setBusy(true); setError(''); setModal(true); setSummary('');
    controller.current?.abort(); controller.current = new AbortController();
    try {
      const all: SheetSample[] = []; for (const file of files) all.push(...await readFileWorker(file, controller.current.signal));
      if (!all.length) throw new Error('File không có bảng.');
      setSheets(all); setSheetIndex(0); setQueue([]); setSummaryVM(undefined); await configure(all[0]);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function preview(override?: Template) {
    if (!sample || !config || !account) return; setBusy(true); setError('');
    try {
      const cfg = parseConfigSchema.parse(override?.config ?? config);
      const acct = override ? ledger.data.accounts.find(a => a.accountId === override.accountId)! : ledger.data.accounts.find(a => a.accountId === account.accountId) ?? accountSchema.parse({ ...account, sourceTimezone: cfg.sourceTimezone, contractMultiplier: cfg.contractMultiplier, label: account.label || account.accountKey });
      if (!cfg.openingPositionsConfirmed) throw new Error('Xác nhận vị thế đầu kỳ trước khi tiếp tục.');
      positive(rate); if (risk) positive(risk);
      const current = await refresh(), id = override?.connector ?? connector;
      const useRate = override?.rate ?? rate, useRisk = override?.fixedRisk ?? risk;
      const batch = await createBatch(id, sample, acct, cfg, current.version, sample.fileSha256 ?? await hash(sample), useRate, useRisk || undefined);
      const parsed = await parseRowsWorker(id, sample.rows, { config: cfg, account: acct, batchId: batch.batchId }, controller.current?.signal);
      const initial = await stageImport(parsed, batch, acct, current.data);
      const overlays = stopConfirmed && !override ? initial.replay.cycles.filter(c => !c.overlay && !c.shadowed && c.status === 'closed' && c.sourceBatchIds.length === 1 && c.sourceBatchIds[0] === batch.batchId).flatMap(c => { const f = parsed.fills.find(f => c.sourceFillIds.includes(f.fillId)); return f?.role === 'reported-position' && f.stopLossPrice ? [riskOverlay(c, batch, undefined, f.stopLossPrice)] : []; }) : [];
      const drafts: ImportDraft[] = queue.filter(s => s.batch.parseConfig.tableName !== sample.name).map(s => ({ parsed: s.parsed, batch: s.batch, account: s.account, overlays: s.overlays }));
      drafts.push({ parsed, batch, account: acct, overlays });
      for (const other of sheets.filter(s => s !== sample && !drafts.some(d => d.batch.parseConfig.tableName === s.name))) {
        if (await hash(other.headers.map(headerKey).sort()) !== cfg.templateFingerprint) continue;
        const b = await createBatch(id, other, acct, cfg, current.version, other.fileSha256 ?? await hash(other), useRate, useRisk || undefined);
        drafts.push({ batch: b, account: acct, parsed: await parseRowsWorker(id, other.rows, { config: cfg, account: acct, batchId: b.batchId }, controller.current?.signal), overlays: [] });
      }
      const results = await stageQueue(drafts, current);
      setQueue(results); setStaged(results.find(s => s.batch.batchId === batch.batchId) ?? results[0]); setConfig(cfg); setAccount(acct); setConnector(id); setConfirmed([]); setStep(3);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!staged || !config || busy) return; setBusy(true); setSaving(true); setError('');
    const committedIds: string[] = [], fillMap = new Map<string, string>();
    let newEntries = 0, duplicates = 0;
    try {
      for (const item of queue) {
        const remap = (id: string) => fillMap.get(id) ?? id;
        const result = await storeRef.current!.commitBatch({ batch: { ...item.batch, warnings: stageWarnings(item) }, fills: item.parsed.fills, cashEvents: item.parsed.cashEvents.map(e => ({ ...e, reconcilesFillId: e.reconcilesFillId ? remap(e.reconcilesFillId) : undefined })), accounts: [item.account], overlays: item.overlays.map(o => ({ ...o, anchorFillIds: o.anchorFillIds.map(remap) })), confirmedWarnings: confirmed }, item.batch.ledgerVersionAtStage);
        committedIds.push(result.batchId); newEntries += result.newEntries; duplicates += result.duplicates;
        Object.entries(result.fillIdMap ?? {}).forEach(([from, to]) => fillMap.set(from, to));
      }
      const current = await refresh();
      let remembered = readImportTemplates(current.data.settings.importTemplates);
      for (const item of queue) remembered = [...remembered.filter(t => !(t.accountId === item.account.accountId && t.config.templateFingerprint === item.batch.parseConfig.templateFingerprint)), { accountId: item.account.accountId, connector: item.batch.connector as ConnectorId, config: item.batch.parseConfig, headers: sheets.find(s => s.name === item.batch.parseConfig.tableName)?.headers ?? [], rate: item.batch.fx.find(f => f.ccy === 'USD')?.rateToVND, fixedRisk: item.batch.fixedRiskVND }];
      await storeRef.current!.setSettings({ ...current.data.settings, importTemplates: remembered }, current.version);
      const latest = await refresh();
      setSummaryVM({ ...importSummary(latest.data, await replayLedger(latest.data), committedIds), newEntries, duplicates });
      setSummary(''); setStaged(undefined); setQueue([]); setModal(false); dialog.current?.close(); setTab(2);
    } catch (e) {
      if (committedIds.length) { const current = await refresh(); setSummaryVM({ ...importSummary(current.data, await replayLedger(current.data), committedIds), newEntries, duplicates }); setModal(false); dialog.current?.close(); }
      setError(`${committedIds.length ? `Đã lưu ${committedIds.length} batch trước khi dừng; có thể hoàn tác trong Lịch sử nhập. ` : ''}${String(e)}. Hãy mở lại Preview sau khi tải dữ liệu mới nhất.`);
    } finally { setBusy(false); setSaving(false); }
  }
  async function rebuild(items: ImportDraft[], current = ledger) {
    const result = await stageQueue(items, current); setQueue(result); setStaged(result.find(s => s.batch.batchId === staged?.batch.batchId) ?? result[0]); setConfirmed([]);
  }
  async function assignRisk(cycle: Cycle, amount: string) {
    if (!staged || busy) return; setBusy(true); setError('');
    try { positive(amount); await rebuild(queue.map(s => ({ ...s, overlays: s.batch.batchId === staged.batch.batchId ? [...s.overlays, riskOverlay(cycle, s.batch, amount)] : s.overlays }))); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function linkCash(eventId: string, fillId: string) {
    setBusy(true); setError('');
    try { await rebuild(queue.map(s => ({ ...s, parsed: { ...s.parsed, cashEvents: s.parsed.cashEvents.map(e => e.eventId === eventId ? { ...e, reconcilesFillId: fillId || undefined } : e) } }))); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function previewPreference(accountId: string, value: SourcePreference) {
    setBusy(true); setError('');
    try {
      const prefs = ledger.data.settings.sourcePreferences as Record<string, SourcePreference> ?? {};
      const next = { ...ledger.data, settings: { ...ledger.data.settings, sourcePreferences: { ...prefs, [accountId]: value } } };
      const before = queue.length ? queue.at(-1)!.replay : await replayLedger(ledger.data);
      const after = queue.length ? (await stageQueue(queue, { version: ledger.version, data: next })).at(-1)!.replay : await replayLedger(next);
      setPreference({ accountId, value, version: ledger.version, impact: sourceImpact(before, after) });
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function applyPreference() {
    if (!preference) return; setBusy(true); setError('');
    try { const prefs = ledger.data.settings.sourcePreferences as Record<string, SourcePreference> ?? {}; await storeRef.current!.setSettings({ ...ledger.data.settings, sourcePreferences: { ...prefs, [preference.accountId]: preference.value } }, preference.version); const current = await refresh(); if (queue.length) await rebuild(queue, current); setPreference(undefined); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function previewAccountChange() {
    if (!accountEdit || busy) return; setBusy(true); setError('');
    try { const parsed = accountSchema.parse(accountEdit); const next = { ...ledger.data, accounts: [...ledger.data.accounts.filter(a => a.accountId !== parsed.accountId), parsed] }; setAccountImpact(sourceImpact(await replayLedger(ledger.data), await replayLedger(next))); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function saveAccountChange() {
    if (!accountEdit || !accountImpact || busy) return; setBusy(true); setError('');
    try { if (ledger.data.accounts.some(a => a.accountId === accountEdit.accountId)) await storeRef.current!.updateAccount(accountEdit, ledger.version); else await storeRef.current!.addAccount(accountEdit, ledger.version); await refresh(); setAccountEdit(undefined); setAccountImpact(undefined); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  const warnings = groupWarnings(queue.flatMap(stageWarnings));
  const blocked = !staged || busy || queue.length !== sheets.length || warnings.some(w => w.severity === 'blocker' || w.severity === 'needs-confirmation' && !confirmed.includes(w.code));
  const patchConfig = (patch: Partial<ParseConfig>) => config && setConfig({ ...config, ...patch });
  const patchAccount = (patch: Partial<Account>) => account && setAccount({ ...account, ...patch });
  const existingAccount = availableAccounts.some(a => a.accountId === account?.accountId);
  const priceExample = (() => { if (!sample || !config) return ''; const key = config.columnMapping.price || config.columnMapping.entry; const raw = sample.rows[0]?.values[key]; if (!raw) return ''; try { return `${raw} → ${dec(D(sample.rows[0]?.numericCells?.includes(key) ? raw : parseDecimal(raw, config.decimalSeparator, config.thousandSeparator)).mul(D(config.priceUnit.multiplierToCcy)))}`; } catch { return `${raw} → chưa đọc được; kiểm tra dấu số`; } })();
  return <>
    <input ref={fileInput} hidden type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.html,.htm" multiple onChange={e => { void readFiles([...e.target.files ?? []]); e.target.value = ''; }} />
    {active && <section className="data-hub">
      <header><div><span className="eyebrow">KẾT NỐI DỮ LIỆU · V3</span><h2>Nhập một lần. Đối chiếu rõ ràng.</h2><p>File được xử lý và lưu trên trình duyệt này. Không cần đăng nhập.</p></div><button className="gold-button compact" disabled={busy} onClick={() => fileInput.current?.click()}>Nhập file</button></header>
      <p className="hub-notice">Bản xem trước Chặng 2: dữ liệu v3 ở trung tâm này. Dashboard và 12 trang sẽ nối vào sổ v3 ở Chặng 3; dữ liệu nhật ký cũ vẫn được giữ riêng.</p>
      {summaryVM && <ImportSummaryCard value={summaryVM} />}
      {summary && <p className="hub-success" role="status">{summary}</p>}
      {error && <p role="alert" className="hub-error">{error}</p>}
      <nav className="hub-tabs" aria-label="Trung tâm kết nối">{tabs.map((t, i) => <button key={t} aria-pressed={tab === i} onClick={() => setTab(i)}>{t}</button>)}</nav>
      {tab === 0 && <><div className="hub-grid">{adapters.map(a => { const batches = ledger.data.batches.filter(b => b.connector === a.id && b.status === 'committed'); const last = batches.sort((a, b) => (b.committedAt ?? '').localeCompare(a.committedAt ?? ''))[0]; return <article key={a.id}><span className="eyebrow">{last ? last.warnings.some(w => w.severity !== 'info') ? 'CẦN KIỂM TRA' : 'SẴN SÀNG' : 'CHƯA CẤU HÌNH'}</span><h3>{a.label}</h3><p>{last ? `Lần nhập: ${new Date(last.committedAt!).toLocaleString('vi-VN')} · ${batches.reduce((s, b) => s + b.counts.newEntries, 0)} dòng` : 'CSV / Excel / HTML · chọn và xác nhận cấu trúc'}</p><button onClick={() => fileInput.current?.click()}>Nhập file</button><button onClick={() => setDetail(`${a.label}\nXuất toàn bộ lịch sử trong khoảng ngày cần nhập, giữ nguyên tiêu đề và mã lệnh. Chọn đúng bảng ${a.id.includes('positions') ? 'Positions' : a.id.includes('deals') ? 'Deals' : 'lịch sử'}.\nKiểm tra tài khoản, múi giờ, đơn vị giá, Gross/Net và phí ở Preview. Không dùng Max Open Interest làm khối lượng đóng. Adapter hiện chỉ có fixture giả lập; luôn đối chiếu tổng với báo cáo của sàn.`)}>Hướng dẫn</button></article>; })}</div><div className="hub-panel"><h3>Dán từ Excel</h3><textarea aria-label="Dán bảng dữ liệu" value={paste} onChange={e => setPaste(e.target.value)} placeholder="Dán cả hàng tiêu đề và dữ liệu…" /><button disabled={!paste.trim() || busy} onClick={() => void readFiles([new File([paste], 'clipboard.tsv')])}>Kiểm tra dữ liệu</button><button onClick={() => download('timestamp_utc,symbol,side,quantity,price,fee,fee_currency,source_id,account_key,note\n2026-10-01T02:00:00Z,FPT,buy,100,25400,2540,VND,fill-001,my-account,Mẫu giả lập\n', 'generic-template.csv', 'text/csv')}>Tải CSV mẫu</button><p>Kết nối API chỉ có ở chế độ máy chủ; bản lưu trên thiết bị không nhận API key.</p></div></>}
      {tab === 1 && <div className="hub-grid">{ledger.data.accounts.map(a => <article key={a.accountId}><h3>{a.label || a.accountKey}</h3><p>{a.platform} · {a.costBasis} · {a.bookMode} · {a.sourceTimezone}</p><p>{a.openingBalances.length} vị thế đầu kỳ</p><button type="button" onClick={() => { setAccountEdit(a); setAccountImpact(undefined); }}>Sửa & xem tác động</button></article>)}<article><h3>Thêm tài khoản</h3><p>Khai tài khoản, biểu phí và số dư đầu kỳ trước khi nhập.</p><button type="button" onClick={() => { setAccountEdit(defaultAccount('generic-template')); setAccountImpact(undefined); }}>Thêm tài khoản</button></article></div>}
      {tab === 2 && <div className="hub-panel">{ledger.data.batches.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(b => <article key={b.batchId}><h3>{b.fileName} · {b.status === 'committed' ? 'Đã lưu' : b.status === 'rolled-back' ? 'Đã hoàn tác' : 'Đang chuẩn bị'}</h3><p>{b.counts.newEntries} mới · {b.counts.duplicates} trùng · {b.counts.conflicts} xung đột · {b.counts.errors} lỗi</p><p>{new Date(b.committedAt ?? b.createdAt).toLocaleString('vi-VN')} · {ledger.data.accounts.find(a => a.accountId === b.accountId)?.accountKey}</p><button type="button" onClick={() => { if (health) setSummaryVM(importSummary(ledger.data, health, [b.batchId])); }}>Xem kết quả</button><button type="button" onClick={() => setDetail(groupWarnings(b.warnings).map(w => w.message).join('\n') || 'Không có cảnh báo. Dòng lỗi được tải tại Preview trước khi nhập và không được ghi vào sổ.')}>Xem cảnh báo</button><button type="button" disabled={b.status !== 'committed' || busy} onClick={() => { setRollbackId(b.batchId); void rollbackPreview(ledger.data, b.batchId).then(setRollback).catch(e => setError(String(e))); }}>Xem tác động hoàn tác</button></article>)}{!ledger.data.batches.length && <p>Chưa có đợt nhập nào.</p>}</div>}
      {tab === 3 && <div className="hub-panel">{templates.map(t => <article key={t.accountId + t.config.templateFingerprint}><h3>{getAdapter(t.connector).label}</h3><p>{ledger.data.accounts.find(a => a.accountId === t.accountId)?.accountKey} · {t.config.sourceTimezone}</p><button type="button" onClick={() => setMappingEdit(t)}>Sửa ánh xạ</button><button type="button" disabled={busy} onClick={() => void storeRef.current!.setSettings({ ...ledger.data.settings, importTemplates: templates.filter(x => !(x.accountId === t.accountId && x.config.templateFingerprint === t.config.templateFingerprint)) }, ledger.version).then(refresh).catch(e => setError(String(e)))}>Xóa mẫu</button></article>)}{!templates.length && <p>Ánh xạ được ghi nhớ sau lần nhập đầu tiên.</p>}</div>}
      {tab === 4 && <div className="hub-panel"><h3>Độ bao phủ dữ liệu</h3><p>{health?.cycles.filter(c => !c.shadowed && c.risk.amountVND).length ?? 0}/{health?.cycles.filter(c => !c.shadowed).length ?? 0} có 1R · {health?.cycles.filter(c => !c.shadowed && c.overlay?.reviewStatus === 'reviewed').length ?? 0} đã review · {health?.cycles.filter(c => !c.shadowed && c.costCompleteness === 'complete').length ?? 0} đủ phí · {health?.openPositions.length ?? 0} lô đang mở</p><ImportWarnings warnings={health?.anomalies ?? []} /><p>{health?.cycles.filter(c => c.shadowed).length ?? 0} bản ghi chỉ dùng đối chiếu; {ledger.data.overlays.filter(o => o.state !== 'attached').length} nhật ký cần gắn lại.</p><h3>Nguồn ưu tiên khi báo cáo chồng lấn</h3><p>Xem trước mức phủ và số tiền sẽ thay đổi. Dòng gốc vẫn được giữ để đổi lựa chọn sau này.</p>{ledger.data.accounts.map(a => <div className="hub-panel" key={a.accountId}><strong>{a.label || a.accountKey}</strong><button type="button" disabled={busy} onClick={() => void previewPreference(a.accountId, 'prefer-fills')}>Ưu tiên lệnh khớp</button><button type="button" disabled={busy} onClick={() => void previewPreference(a.accountId, 'prefer-reports')}>Ưu tiên báo cáo đóng</button><button type="button" disabled={busy} onClick={() => void previewPreference(a.accountId, 'confirm-overlaps')}>Yêu cầu xác minh</button></div>)}<button type="button" onClick={() => void storeRef.current!.exportAll().then(json => { download(json, 'trading-v3-backup.json', 'application/json'); return storeRef.current!.markBackupDownloaded(); }).catch(e => setError(String(e)))}>Sao lưu JSON</button></div>}
    </section>}
    {modal && <dialog ref={dialog} className="hub-dialog" aria-label="Import Wizard" onCancel={e => { e.preventDefault(); close(); }}><header><div><span className="eyebrow">IMPORT WIZARD</span><h2>{['Đọc & xác nhận cấu trúc', 'Chuẩn hóa & rủi ro', 'Preview & đối chiếu'][step - 1]}</h2><p>Bước {step}/3 · {sample?.name ?? 'Đang đọc file'}</p></div><button aria-label="Đóng import" disabled={saving} onClick={close}>×</button></header>
      {busy && <p role="status">Đang xử lý dữ liệu…</p>}{error && <p role="alert" className="hub-error">{error}</p>}
      {sample && config && account && step === 1 && <>
        <div className="hub-fields"><label>Bảng/file<select value={sheetIndex} onChange={e => { const i = Number(e.target.value); setSheetIndex(i); void configure(sheets[i]); }}>{sheets.map((s, i) => <option key={i} value={i}>{s.name} · {s.rows.length} dòng</option>)}</select></label><label>Nguồn báo cáo<select value={connector} onChange={e => void configure(sample, e.target.value as ConnectorId)}>{adapters.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label></div>
        {sheets.length > 1 && <button type="button" disabled={busy} onClick={() => { const remaining = sheets.filter((_, i) => i !== sheetIndex); setSheets(remaining); setSheetIndex(0); setQueue(queue.filter(q => q.batch.parseConfig.tableName !== sample.name)); void configure(remaining[0]); }}>Bỏ bảng này khỏi đợt nhập</button>}
        <p>Độ khớp tiêu đề: {Math.round(getAdapter(connector).detect(sample).confidence * 100)}%. Xác nhận nguồn khi nhiều mẫu có cấu trúc giống nhau.</p>
        {templates.filter(t => t.config.templateFingerprint === config.templateFingerprint).map(t => <button key={t.accountId} onClick={() => void preview(t)}>Dùng cấu hình lần trước · {ledger.data.accounts.find(a => a.accountId === t.accountId)?.accountKey}</button>)}
        <div className="hub-fields"><label>Tài khoản<select value={availableAccounts.some(a => a.accountId === account.accountId) ? account.accountId : 'new'} onChange={e => { const a = availableAccounts.find(a => a.accountId === e.target.value) ?? defaultAccount(connector); setAccount(a); patchConfig({ sourceTimezone: a.sourceTimezone, contractMultiplier: a.contractMultiplier }); }}><option value="new">Tạo mới</option>{availableAccounts.filter(a => a.platform === getAdapter(connector).platform || connector === 'generic-template').map(a => <option key={a.accountId} value={a.accountId}>{a.accountKey}</option>)}</select></label><label>Mã tài khoản<input value={account.accountKey} disabled={availableAccounts.some(a => a.accountId === account.accountId)} onChange={e => patchAccount({ accountKey: e.target.value.trim() })} /></label><label>Múi giờ nguồn<input value={config.sourceTimezone} placeholder="Asia/Ho_Chi_Minh hoặc UTC" onChange={e => patchConfig({ sourceTimezone: e.target.value })} /></label><label>Dấu thập phân<select value={config.decimalSeparator} onChange={e => patchConfig({ decimalSeparator: e.target.value as '.' | ',', thousandSeparator: e.target.value === '.' ? ',' : '.' })}><option>.</option><option>,</option></select></label><label>Đơn vị giá<select value={config.priceUnit.multiplierToCcy} onChange={e => patchConfig({ priceUnit: { ...config.priceUnit, multiplierToCcy: e.target.value } })}><option value="1">Đồng / đơn vị gốc ×1</option><option value="1000">Nghìn đồng ×1.000</option></select></label><label>Hệ số hợp đồng<input value={config.contractMultiplier} onChange={e => patchConfig({ contractMultiplier: e.target.value })} /></label><label>P&L trong file<select value={config.pnlBasis} onChange={e => patchConfig({ pnlBasis: e.target.value as ParseConfig['pnlBasis'] })}><option value="unknown">Chưa xác định</option><option value="gross">Gross — trước phí</option><option value="net">Net — sau phí</option></select></label><label>Độ đầy đủ phí<select value={config.costCompleteness} onChange={e => patchConfig({ costCompleteness: e.target.value as ParseConfig['costCompleteness'] })}><option value="partial">Một phần</option><option value="unknown">Chưa xác định</option><option value="complete">Đã xác nhận đầy đủ</option></select></label><label>Phương pháp giá vốn<select value={account.costBasis} disabled={availableAccounts.some(a => a.accountId === account.accountId)} onChange={e => patchAccount({ costBasis: e.target.value as Account['costBasis'] })}><option value="fifo">FIFO</option><option value="average">Bình quân</option></select></label><label>Sổ vị thế<select value={account.bookMode} disabled={availableAccounts.some(a => a.accountId === account.accountId)} onChange={e => patchAccount({ bookMode: e.target.value as Account['bookMode'] })}><option value="netting">Netting</option><option value="hedging">Hedging (cần ID/chiều vị thế)</option></select></label></div>
        <p>Giá trong file → giá chuẩn: {priceExample || 'Chưa có cột giá'}</p>
        <div className="hub-fields"><label>Dấu phí trong file<select value={config.costSigns?.fee ?? getAdapter(connector).declare.costSigns.fee} onChange={e => patchConfig({ costSigns: { ...config.costSigns, fee: e.target.value as 'positive-is-paid' | 'negative-is-paid' } })}><option value="positive-is-paid">Phí dương = đã trả</option><option value="negative-is-paid">Phí âm = đã trả</option></select></label><label>Hậu tố symbol cần bỏ (phân cách dấu phẩy)<input value={config.symbolSuffixes?.join(',') ?? ''} onChange={e => patchConfig({ symbolSuffixes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder=".m,.pro" /></label></div>
        <div className="hub-fields"><label>Thị trường<select value={account.market} disabled={existingAccount} onChange={e => patchAccount({ market: e.target.value as Account['market'] })}><option value="stock">Chứng khoán</option><option value="crypto">Crypto</option><option value="forex">Forex</option><option value="commodity">Hàng hóa</option></select></label><label>Tiền tài khoản / tiền P&L<input value={account.baseCcy} disabled={existingAccount} onChange={e => patchAccount({ baseCcy: e.target.value.toUpperCase(), quoteCcy: e.target.value.toUpperCase() })} /></label><label>Quy ước phân nhóm hàng nghìn<select value={config.thousandSeparator} onChange={e => patchConfig({ thousandSeparator: e.target.value as ParseConfig['thousandSeparator'] })}><option value=",">Dấu phẩy</option><option value=".">Dấu chấm</option><option value=" ">Khoảng trắng</option><option value="">Không có</option></select></label></div>
        <label className="hub-check"><input type="checkbox" checked={account.allowsShort} disabled={existingAccount || account.platform === 'VN_STOCK'} onChange={e => patchAccount({ allowsShort: e.target.checked })} />Tài khoản cho phép vị thế bán khống (bỏ chọn cho Crypto Spot).</label>
        <details><summary>Ánh xạ cột ({sample.headers.length} cột)</summary><div className="hub-fields">{Object.keys(getAdapter(connector).fields).map(key => <label key={key}>{key}{getAdapter(connector).required.includes(key) ? ' *' : ''}<select value={config.columnMapping[key] ?? ''} onChange={e => patchConfig({ columnMapping: { ...config.columnMapping, [key]: e.target.value } })}><option value="">Không có</option>{sample.headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div></details>
        <details><summary>Vị thế đầu kỳ & biểu phí</summary>{existingAccount && <p>Sửa số dư của tài khoản đã có ở tab Tài khoản để xem trước tác động.</p>}<OpeningBalanceFields account={account} onChange={setAccount} disabled={existingAccount} /><FeePresetFields account={account} onChange={setAccount} disabled={existingAccount} /></details>
        <label className="hub-check"><input type="checkbox" checked={config.openingPositionsConfirmed} onChange={e => patchConfig({ openingPositionsConfirmed: e.target.checked })} />Tôi đã kiểm tra tài khoản, múi giờ, đơn vị giá và vị thế đầu kỳ.</label>
        <button disabled={busy || !account.accountKey || !config.sourceTimezone || !config.openingPositionsConfirmed} onClick={() => setStep(2)}>Tiếp tục</button>
      </>}
      {step === 2 && account && config && <>
        <div className="hub-fields">{account.baseCcy !== 'VND' && <label>Tỷ giá USD/USDT → VNĐ<input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" /></label>}<label>1R cố định cho batch (VNĐ, để trống nếu chưa biết)<input value={risk} onChange={e => setRisk(e.target.value)} inputMode="decimal" /></label></div>
        <p>1R cố định được ghi là ước lượng. Có thể khai 1R riêng cho từng chu kỳ tại Preview. Lệnh mới nhập luôn chờ review.</p>
        {connector === 'mt5-positions' && <label className="hub-check"><input type="checkbox" checked={stopConfirmed} onChange={e => setStopConfirmed(e.target.checked)} />Tôi đã đối chiếu và xác nhận SL trong file là stop ban đầu, chưa bị dời. Chỉ chu kỳ một lần vào và SL đúng phía mới được tính 1R tự động.</label>}
        <details><summary>Tỷ giá cho đồng tiền khác</summary><p>Dùng cho phí BNB hoặc tài khoản EUR… Chỉ nhập tỷ giá đã xác minh.</p>{(config.feeFx ?? []).map((fx, i) => <div className="hub-fields" key={i}><label>Đồng tiền<input value={fx.ccy} onChange={e => patchConfig({ feeFx: config.feeFx!.map((f, n) => n === i ? { ...f, ccy: e.target.value.toUpperCase().trim() } : f) })} /></label><label>Tỷ giá → VNĐ<input inputMode="decimal" value={fx.rateToVND} onChange={e => patchConfig({ feeFx: config.feeFx!.map((f, n) => n === i ? { ...f, rateToVND: e.target.value } : f) })} /></label><button type="button" onClick={() => patchConfig({ feeFx: config.feeFx!.filter((_, n) => n !== i) })}>Bỏ tỷ giá</button></div>)}<button type="button" onClick={() => patchConfig({ feeFx: [...config.feeFx ?? [], { ccy: '', rateToVND: '', source: 'user' }] })}>Thêm đồng tiền</button></details>
        <p>Phí thiếu giữ trạng thái chưa biết. Phí suy ra từ biểu phí được đánh dấu ước tính.</p><button type="button" onClick={() => setStep(1)}>Quay lại</button><button type="button" disabled={busy} onClick={() => void preview()}>Chuẩn hóa & xem Preview</button>
      </>}
      {step === 3 && staged && <>
        <p>Đã chuẩn hóa {queue.length}/{sheets.length} bảng. Các batch được lưu theo thời điểm giao dịch sớm nhất.</p>
        <label className="hub-fields">Batch đang xem<select value={staged.batch.batchId} onChange={e => setStaged(queue.find(s => s.batch.batchId === e.target.value))}>{queue.map((s, i) => <option key={s.batch.batchId} value={s.batch.batchId}>{i + 1}. {s.batch.fileName} · {s.batch.counts.newEntries} mới · {s.batch.counts.errors} lỗi</option>)}</select></label>
        <ImportPreview stage={staged} onDownloadErrors={() => download(errorCSV(staged.parsed.errors), 'import-errors.csv', 'text/csv')} onRisk={(cycle, amount) => void assignRisk(cycle, amount)} onCashLink={(eventId, fillId) => void linkCash(eventId, fillId)} linkTargets={[...ledger.data.fills.filter(f => f.active), ...queue.flatMap(s => s.fills.newEntries)]} />
        <ImportWarnings warnings={warnings} confirmed={confirmed} onConfirm={setConfirmed} />
        {warnings.some(w => w.code === 'POSSIBLE_CROSS_REPORT_OVERLAP') && <div className="hub-panel"><h3>Nguồn ưu tiên · {staged.account.accountKey}</h3><p>Lựa chọn loại toàn bộ chu kỳ chồng lấn của nguồn phụ. Xem mức phủ và tác động trước khi áp dụng.</p><button type="button" disabled={busy} onClick={() => void previewPreference(staged.account.accountId, 'prefer-fills')}>Xem tác động ưu tiên lệnh khớp</button><button type="button" disabled={busy} onClick={() => void previewPreference(staged.account.accountId, 'prefer-reports')}>Xem tác động ưu tiên báo cáo đóng</button></div>}
        {queue.length < sheets.length && <button type="button" disabled={busy} onClick={() => { const i = sheets.findIndex(s => !queue.some(q => q.batch.parseConfig.tableName === s.name)); setSheetIndex(i); void configure(sheets[i]); }}>Cấu hình bảng tiếp theo</button>}
        <div className="hub-dialog-actions"><button type="button" disabled={busy} onClick={() => setStep(1)}>Sửa cấu hình</button><button type="button" className="gold-button compact" disabled={blocked} onClick={() => void save()}>Lưu {queue.length} batch trên thiết bị</button></div>
      </>}
    </dialog>}
    {detail && <HubDialog title="Hướng dẫn & chi tiết" onClose={() => setDetail('')}><pre className="hub-detail-text">{detail}</pre></HubDialog>}
    {accountEdit && <HubDialog title="Tài khoản & giá vốn" busy={busy} onClose={() => { setAccountEdit(undefined); setAccountImpact(undefined); }}><ImportAccountFields account={accountEdit} identityLocked={ledger.data.accounts.some(a => a.accountId === accountEdit.accountId)} onChange={a => { setAccountEdit(a); setAccountImpact(undefined); }} />{error && <p role="alert" className="hub-error">{error}</p>}{accountImpact && <p className="hub-notice">Chu kỳ được dùng: {accountImpact.beforeCount} → {accountImpact.afterCount}. Net đã biết: {displayAmount(accountImpact.beforeNet)} → {displayAmount(accountImpact.afterNet)}. Cấu hình cũ được sao lưu khi sửa tài khoản đã có.</p>}<button type="button" disabled={busy} onClick={() => void previewAccountChange()}>Xem tác động</button><button type="button" disabled={busy || !accountImpact} onClick={() => void saveAccountChange()}>Lưu cấu hình đã kiểm tra</button></HubDialog>}
    {mappingEdit && <HubDialog title="Sửa mẫu ánh xạ" busy={busy} onClose={() => setMappingEdit(undefined)}><p>{getAdapter(mappingEdit.connector).label}</p><div className="hub-fields">{Object.keys(getAdapter(mappingEdit.connector).fields).map(key => <label key={key}>{key}<select value={mappingEdit.config.columnMapping[key] ?? ''} onChange={e => setMappingEdit({ ...mappingEdit, config: { ...mappingEdit.config, columnMapping: { ...mappingEdit.config.columnMapping, [key]: e.target.value } } })}><option value="">Không có</option>{[...new Set([...mappingEdit.headers ?? [], ...Object.values(mappingEdit.config.columnMapping)])].filter(Boolean).map(h => <option key={h}>{h}</option>)}</select></label>)}</div><button type="button" disabled={busy} onClick={() => { setBusy(true); void storeRef.current!.setSettings({ ...ledger.data.settings, importTemplates: templates.map(t => t.accountId === mappingEdit.accountId && t.config.templateFingerprint === mappingEdit.config.templateFingerprint ? mappingEdit : t) }, ledger.version).then(refresh).then(() => setMappingEdit(undefined)).catch(e => setError(String(e))).finally(() => setBusy(false)); }}>Lưu mẫu</button></HubDialog>}
    {preference && <HubDialog title="Tác động nguồn ưu tiên" busy={busy} onClose={() => setPreference(undefined)}><p>{preference.value === 'prefer-fills' ? 'Ưu tiên lệnh khớp' : preference.value === 'prefer-reports' ? 'Ưu tiên báo cáo đóng' : 'Yêu cầu xác minh chồng lấn'}</p><p>Chu kỳ được dùng: {preference.impact.beforeCount} → {preference.impact.afterCount}.</p><p>Net đã biết: {displayAmount(preference.impact.beforeNet)} → {displayAmount(preference.impact.afterNet)}.</p><p>{preference.impact.shadowed} chu kỳ nguồn phụ sẽ chỉ được dùng để đối chiếu.</p>{error && <p role="alert" className="hub-error">{error}</p>}<button type="button" disabled={busy} onClick={() => void applyPreference()}>Áp dụng lựa chọn này</button></HubDialog>}
    {rollback && <div className="modal-overlay"><section className="hub-panel hub-detail" role="dialog" aria-modal="true" aria-label="Tác động hoàn tác"><h2>Xem trước hoàn tác</h2><p>{rollback.affectedBookKeys.length} sổ bị thay đổi · {rollback.before.cycles.length} → {rollback.after.cycles.length} chu kỳ.</p><p>Batch phụ thuộc: {rollback.dependentBatches.join(', ') || 'Không có'}. Nhật ký cần gắn lại: {rollback.affectedOverlays.length}.</p>{rollback.after.anomalies.map((w, i) => <p key={i}>{w.code}: {w.message}</p>)}<button onClick={() => setRollback(undefined)}>Hủy</button><button disabled={busy} onClick={() => { setBusy(true); void storeRef.current!.rollbackBatch(rollbackId, ledger.version).then(refresh).then(() => { setRollback(undefined); setSummaryVM(undefined); }).catch(e => setError(String(e))).finally(() => setBusy(false)); }}>Hoàn tác batch này</button></section></div>}
  </>;
}
