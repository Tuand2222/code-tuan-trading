import { useState } from 'react';
import { useLedger } from '../app/LedgerContext';
import type { Journal, PlannedTrade } from '../data/schema';
import { imageDataURL, prepareImage } from '../data/images';
export function PlanImages({ plan }: { plan: PlannedTrade }) {
  const { mutate, busy } = useLedger();
  const [url, setURL] = useState(''),
    [message, setMessage] = useState(''),
    [uploading, setUploading] = useState(false);
  const attachments = plan.attachments ?? [];
  return (
    <details>
      <summary>Ảnh kế hoạch · {attachments.length}/6</summary>
      <label>
        Ảnh kế hoạch trên máy
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={busy || uploading || attachments.length >= 6}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (!files.length) return;
            if (files.length + attachments.length > 6) {
              setMessage('Tối đa 6 ảnh cho mỗi kế hoạch.');
              return;
            }
            setUploading(true);
            void Promise.all(files.map(prepareImage))
              .then((sources) =>
                mutate((s) => ({
                  ...s,
                  sources: [
                    ...s.sources,
                    ...sources.filter((source) => !s.sources.some((x) => x.id === source.id)),
                  ],
                  plannedTrades: s.plannedTrades.map((p) =>
                    p.id === plan.id
                      ? {
                          ...p,
                          attachments: [
                            ...(p.attachments ?? []),
                            ...sources.map((source, i) => ({
                              id: crypto.randomUUID(),
                              kind: 'blob' as const,
                              blobKey: source.id,
                              caption: files[i].name,
                            })),
                          ],
                        }
                      : p,
                  ),
                })),
              )
              .then(() => setMessage('Đã lưu ảnh kế hoạch.'))
              .catch((e) => setMessage(String(e)))
              .finally(() => setUploading(false));
          }}
        />
      </label>
      <label>
        URL ảnh kế hoạch · HTTPS
        <input type="url" value={url} onChange={(e) => setURL(e.target.value)} />
      </label>
      <button
        disabled={busy || !url || attachments.length >= 6}
        onClick={() =>
          void mutate((s) => ({
            ...s,
            plannedTrades: s.plannedTrades.map((p) =>
              p.id === plan.id
                ? {
                    ...p,
                    attachments: [
                      ...(p.attachments ?? []),
                      { id: crypto.randomUUID(), kind: 'url', url, caption: '' },
                    ],
                  }
                : p,
            ),
          }))
            .then(() => setURL(''))
            .catch((e) => setMessage(String(e)))
        }
      >
        Thêm URL ảnh kế hoạch
      </button>
      {attachments.map((a) => (
        <div key={a.id}>
          <label>
            Mô tả ảnh kế hoạch
            <input
              key={a.id + a.caption}
              defaultValue={a.caption}
              maxLength={2000}
              onBlur={(e) =>
                void mutate((s) => ({
                  ...s,
                  plannedTrades: s.plannedTrades.map((p) =>
                    p.id === plan.id
                      ? {
                          ...p,
                          attachments: p.attachments?.map((x) =>
                            x.id === a.id ? { ...x, caption: e.target.value } : x,
                          ),
                        }
                      : p,
                  ),
                })).catch((e) => setMessage(String(e)))
              }
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void mutate((s) => ({
                ...s,
                plannedTrades: s.plannedTrades.map((p) =>
                  p.id === plan.id
                    ? { ...p, attachments: p.attachments?.filter((x) => x.id !== a.id) }
                    : p,
                ),
              })).catch((e) => setMessage(String(e)))
            }
          >
            Bỏ ảnh kế hoạch · {a.caption || a.id}
          </button>
        </div>
      ))}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export function Chartbook({ journal }: { journal: Journal }) {
  const { data } = useLedger(),
    [filter, setFilter] = useState('all');
  const records = [
    ...data.trades
      .filter((t) => t.journalId === journal.id)
      .map((t) => ({ id: t.id, symbol: t.symbol, status: 'actual', attachments: t.attachments })),
    ...data.plannedTrades
      .filter((p) => p.journalId === journal.id)
      .map((p) => ({
        id: p.id,
        symbol: p.symbol,
        status: p.status,
        attachments: p.attachments ?? [],
      })),
  ];
  return (
    <section>
      <h3>Chartbook · Thực / Planned / Missed</h3>
      <label>
        Lọc Chartbook
        <select
          aria-label="Lọc Chartbook"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tất cả</option>
          <option value="actual">Lệnh thực</option>
          <option value="planned">Planned</option>
          <option value="missed">Missed</option>
          <option value="taken">Taken</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      {records
        .filter((r) => (filter === 'all' || r.status === filter) && r.attachments.length)
        .map((r) => (
          <article key={r.id}>
            <h4>
              {r.symbol} · {r.status} · {r.id}
            </h4>
            {r.attachments.map((a) =>
              a.kind === 'url' ? (
                <p key={a.id}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.caption || 'Mở ảnh bên ngoài'}
                  </a>
                </p>
              ) : (
                <figure key={a.id}>
                  {data.sources.find((s) => s.id === a.blobKey) && (
                    <img
                      src={imageDataURL(data.sources.find((s) => s.id === a.blobKey)!.raw)}
                      alt={a.caption || 'Ảnh chart đã lưu'}
                      loading="lazy"
                      style={{ maxWidth: '100%' }}
                    />
                  )}
                  <figcaption>{a.caption}</figcaption>
                </figure>
              ),
            )}
          </article>
        ))}
    </section>
  );
}
