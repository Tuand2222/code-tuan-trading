import { useState } from 'react';
import { useLedger } from '../app/LedgerContext';
import type { Journal } from '../data/schema';
export function CustomDefinitions({ journal }: { journal: Journal }) {
  const { data, mutate, busy, revision } = useLedger();
  const [names, setNames] = useState(() =>
    Array.from(
      { length: 20 },
      (_, i) =>
        data.customStatDefs.find((d) => d.journalId === journal.id && d.slot === i + 1)?.name ?? '',
    ),
  );
  const [version, setVersion] = useState<number>(),
    [message, setMessage] = useState('');
  return (
    <details>
      <summary>Đặt tên 20 thống kê tùy chỉnh</summary>
      <p>
        Tên trống giữ nguyên định nghĩa cũ; các trường mới dùng kiểu văn bản, số được tổng hợp riêng
        với n/N.
      </p>
      {names.map((name, i) => (
        <label key={i}>
          Tên thống kê {i + 1}
          <input
            value={name}
            onChange={(e) => {
              setVersion((v) => v ?? revision);
              setNames(names.map((n, k) => (k === i ? e.target.value : n)));
            }}
          />
        </label>
      ))}
      <button
        disabled={busy}
        onClick={() =>
          void mutate(
            (s) => ({
              ...s,
              customStatDefs: [
                ...s.customStatDefs.filter((d) => d.journalId !== journal.id),
                ...names.flatMap((name, i) => {
                  const old = s.customStatDefs.find(
                    (d) => d.journalId === journal.id && d.slot === i + 1,
                  );
                  return name.trim()
                    ? [
                        {
                          ...old,
                          journalId: journal.id,
                          slot: i + 1,
                          name: name.trim(),
                          kind: old?.kind ?? ('text' as const),
                        },
                      ]
                    : old
                      ? [old]
                      : [];
                }),
              ],
            }),
            version ?? revision,
          )
            .then(() => {
              setVersion(undefined);
              setMessage('Đã lưu tên thống kê.');
            })
            .catch((e) => setMessage(String(e)))
        }
      >
        Lưu tên thống kê
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
