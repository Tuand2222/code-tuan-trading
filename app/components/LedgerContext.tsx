'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { DexieLedgerStore } from '../../lib/trading/storage/DexieLedgerStore';
import type { LedgerSnapshot } from '../../lib/trading/domain/types';
import { type Filters } from '../../lib/trading/selectors';

import type { Derived } from '../../lib/trading/application/deriveLedger';
export type { Derived } from '../../lib/trading/application/deriveLedger';

type Context = { store: DexieLedgerStore | null; snapshot?: { version: number; data: LedgerSnapshot }; derived?: Derived; filters: Filters; setFilters: (f: Filters) => void; busy: boolean; error: string };
const LedgerContext = createContext<Context | null>(null);
export const useLedger = () => { const value = useContext(LedgerContext); if (!value) throw new Error('LedgerProvider missing'); return value; };
export function LedgerProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DexieLedgerStore | null>(null), [snapshot, setSnapshot] = useState<Context['snapshot']>(), [derived, setDerived] = useState<Derived>(), [filters, setFilters] = useState<Filters>({ timezone: 'Asia/Ho_Chi_Minh' }), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const worker = useRef<Worker | null>(null), sequence = useRef(0);
  useEffect(() => {
    const db = new DexieLedgerStore(); setStore(db);
    const w = new Worker(new URL('../../lib/trading/application/ledgerWorker.ts', import.meta.url), { type: 'module' }); worker.current = w;
    w.onmessage = ({ data }) => { if (data.id !== sequence.current) return; setBusy(false); if (data.error) setError(data.error); else { setDerived(data.value); setError(''); } };
    w.onerror = () => { setBusy(false); setError('Không thể tính sổ dữ liệu. Tải lại trang để thử lại.'); };
    const subscription = liveQuery(() => db.snapshot()).subscribe({ next: setSnapshot, error: e => { setError(String(e)); setBusy(false); } });
    return () => { subscription.unsubscribe(); w.terminate(); db.close(); };
  }, []);
  useEffect(() => { if (snapshot && worker.current) { setBusy(true); worker.current.postMessage({ id: ++sequence.current, version: snapshot.version, ledger: snapshot.data, filters }); } }, [snapshot, filters]);
  useEffect(() => { if (!snapshot) return; const timezone = snapshot.data.settings.timezone, band = snapshot.data.settings.breakevenBandVND; setFilters(current => ({ ...current, ...(typeof timezone === 'string' ? { timezone } : {}), ...(typeof band === 'string' ? { breakevenBandVND: band } : {}) })); }, [snapshot?.data.settings.timezone, snapshot?.data.settings.breakevenBandVND]);
  return <LedgerContext.Provider value={{ store, snapshot, derived, filters, setFilters, busy, error }}>{children}</LedgerContext.Provider>;
}
