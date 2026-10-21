import { useState } from 'react';
import type { Journal } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
import { ensureCatalog, parseChecklist } from '../data/tradeCommands';
import vi from '../i18n/vi.json';
const t = vi.s3;
export function Playbook({ journal }: { journal: Journal }) {
  const { data, mutate, busy } = useLedger(),
    [name, setName] = useState(''),
    [text, setText] = useState(''),
    [editing, setEditing] = useState(''),
    [message, setMessage] = useState('');
  const catalog = ensureCatalog(data, journal.id);
  async function save() {
    try {
      const checklist = parseChecklist(text, data.setups.find((s) => s.id === editing)?.checklist),
        id = editing || crypto.randomUUID();
      await mutate((s) => {
        const c = ensureCatalog(s, journal.id);
        return {
          ...c,
          setups: [
            ...c.setups.filter((x) => x.id !== id),
            { id, journalId: journal.id, name, checklist },
          ],
        };
      });
      setName('');
      setText('');
      setEditing('');
      setMessage(t.saved);
    } catch {
      setMessage(t.error);
    }
  }
  return (
    <section className="panel">
      <h2>{t.playbook}</h2>
      <p>{t.setupHelp}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          {t.setupName}
          <input
            aria-label={t.setupName}
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t.checklist}
          <textarea
            aria-label={t.checklist}
            placeholder={t.checklistPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button disabled={busy} className="primary">
          {t.saveSetup}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <div className="catalog-grid">
        {catalog.setups
          .filter((s) => s.journalId === journal.id)
          .map((setup) => (
            <article className="panel" key={setup.id}>
              <h3>
                {setup.name}
                {setup.disabledAt ? ' · ' + t.hide : ''}
              </h3>
              <ul>
                {setup.checklist.map((c) => (
                  <li key={c.id}>
                    {c.text} · {c.weight}
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button
                  onClick={() => {
                    setEditing(setup.id);
                    setName(setup.name);
                    setText(setup.checklist.map((c) => c.text + ' | ' + c.weight).join('\n'));
                  }}
                >
                  {t.edit}
                </button>
                <button
                  onClick={() =>
                    void mutate((s) => ({
                      ...ensureCatalog(s, journal.id),
                      setups: ensureCatalog(s, journal.id).setups.map((x) =>
                        x.id === setup.id
                          ? {
                              ...x,
                              disabledAt: x.disabledAt ? undefined : new Date().toISOString(),
                            }
                          : x,
                      ),
                    })).catch(() => setMessage(t.error))
                  }
                >
                  {setup.disabledAt ? t.unhide : t.hide}
                </button>
              </div>
            </article>
          ))}
      </div>
      <p>{t.noDelete}</p>
      <a href="#edge">{t.edge} →</a>
    </section>
  );
}
