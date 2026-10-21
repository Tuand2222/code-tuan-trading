import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import { JournalRepository } from '../data/repository';
import { emptySnapshot, type Snapshot } from '../data/snapshot';
interface Ledger {
  data: Snapshot;
  revision: number;
  loading: boolean;
  busy: boolean;
  error: string;
  repo: JournalRepository;
  mutate: (fn: (data: Snapshot) => Snapshot, revision?: number) => Promise<void>;
}
const Context = createContext<Ledger | null>(null);
export function LedgerProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => new JournalRepository(), []),
    [state, setState] = useState({ data: emptySnapshot(), revision: 0 }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const subscription = liveQuery(() => repo.snapshot()).subscribe({
      next: (s) => {
        setState(s);
        setLoading(false);
      },
      error: (e) => {
        setError(String(e));
        setLoading(false);
      },
    });
    return () => {
      subscription.unsubscribe();
      repo.close();
    };
  }, [repo]);
  async function mutate(fn: (data: Snapshot) => Snapshot, revision = state.revision) {
    setBusy(true);
    setError('');
    try {
      await repo.commit(fn(state.data), revision);
      setState(await repo.snapshot());
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider value={{ ...state, repo, loading, busy, error, mutate }}>
      {children}
    </Context.Provider>
  );
}
export function useLedger() {
  const c = useContext(Context);
  if (!c) throw Error('LEDGER_PROVIDER_REQUIRED');
  return c;
}
