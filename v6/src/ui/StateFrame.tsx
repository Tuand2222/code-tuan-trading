import type { ReactNode } from 'react';
import vi from '../i18n/vi.json';
export function StateFrame({
  kind,
  description,
  action,
}: {
  kind: keyof typeof vi.shell.states;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={'state-frame ' + kind}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
    >
      <strong>{vi.shell.states[kind]}</strong>
      <p>{description}</p>
      {kind === 'loading' && <div className="skeleton" aria-hidden="true" />}
      {action}
    </section>
  );
}
