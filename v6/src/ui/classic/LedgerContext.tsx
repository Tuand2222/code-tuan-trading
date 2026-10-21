import { createContext, useContext, type ReactNode } from 'react';
import type { ClassicSource } from '../../core/classic';
import type { Filters } from '../../core/filters';
const Context = createContext<{ derived: { result: ClassicSource }; filters: Filters } | null>(
  null,
);
export const ClassicProvider = ({
  source,
  filters,
  children,
}: {
  source: ClassicSource;
  filters: Filters;
  children: ReactNode;
}) => (
  <Context.Provider value={{ derived: { result: source }, filters }}>{children}</Context.Provider>
);
export function useLedger() {
  return useContext(Context)!;
}
