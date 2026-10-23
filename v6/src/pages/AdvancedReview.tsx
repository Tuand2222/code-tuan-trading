import { useState, useMemo } from 'react';
import { planSchema, tradeSchema, type Journal, type Trade } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
import { compliance, exitAnalysis, sessionFindings, tilt } from '../core/advanced';
import { formatValue } from '../ui/format';
import { prepareImage, imageDataURL } from '../data/images';
import { chartbookZip } from '../data/chartbookZip';
import { exportWorkspace, previewWorkspace } from '../data/workspaceBackup';
export function AdvancedReview({ journal, trades }: { journal: Journal; trades: Trade[] }) {
  const { data, mutate, revision, busy, repo } = useLedger();
  const [imageBusy, setImageBusy] = useState(false),
    [imageSources, setImageSources] = useState<{ id: string; raw: string; createdAt: string }[]>(
      [],
    );
  const [id, setId] = useState(''),
    [draft, setDraft] = useState<Trade>(),
    [version, setVersion] = useState(0),
    [message, setMessage] = useState('');
  const [max, setMax] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const plan = data.plans.find((p) => p.journalId === journal.id),
    findings = useMemo(
      () => sessionFindings(journal, data.trades, plan),
      [journal, data.trades, plan],
    );
  const setup = data.setups.find((s) => s.id === draft?.setupId);
  let exit: ReturnType<typeof exitAnalysis> = null;
  try {
    if (draft) exit = exitAnalysis(draft);
  } catch {
    /* Incomplete form values are not valid facts yet. */
  }
  const put = (patch: Partial<Trade>) => {
    if (draft) setDraft({ ...draft, ...patch });
  };
  return (
    <section className="panel">
      <h2>Kỷ luật · Plan · Chartbook</h2>
      <p>
        Điểm checklist tính theo trọng số tiêu chí đã đánh dấu. Tỷ lệ chip lỗi = số chip tiêu cực /
        số chip đã gắn của từng khâu; không thay điểm kỷ luật legacy.
      </p>
      <ul>
        {tilt(trades, data.errorTags).map((s) => (
          <li key={s.stage}>
            {s.stage}: {s.negative}/{s.n} chip tiêu cực ·{' '}
            {s.negativePercent === null ? '—' : s.negativePercent.toFixed(1) + '%'}
          </li>
        ))}
      </ul>
      <h3>Phiên giao dịch</h3>
      <p>
        Múi giờ {journal.timezone}.{' '}
        {plan?.sessionWindows.map((w) => w.from + '–' + w.to).join(', ') || 'Chưa giới hạn phiên'} ·
        tối đa {plan?.maxTradesPerDay ?? '—'} lệnh/ngày. Áp dụng cho toàn sổ.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const next = planSchema.parse({
              ...plan,
              journalId: journal.id,
              allowedSetupIds: plan?.allowedSetupIds ?? [],
              alertRules: plan?.alertRules ?? [],
              maxTradesPerDay: max ? Number(max) : undefined,
              sessionWindows: from && to ? [{ from, to }] : [],
            });
            void mutate((s) => ({
              ...s,
              plans: [...s.plans.filter((p) => p.journalId !== journal.id), next],
            }))
              .then(() => setMessage('Đã lưu giới hạn phiên.'))
              .catch((e) => setMessage(String(e)));
          } catch (e) {
            setMessage(String(e));
          }
        }}
      >
        <label>
          Giới hạn lệnh/ngày
          <input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label>
          Bắt đầu phiên
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Kết thúc phiên
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button disabled={busy}>Thay giới hạn phiên</button>
      </form>
      <ul>
        {findings.slice(0, 100).map((f) => (
          <li key={f.tradeId}>
            {f.tradeId}: {f.outside ? 'Ngoài phiên · ' : ''}
            {f.count} lệnh ngày {f.date}
          </li>
        ))}
      </ul>
      <label>
        Hồ sơ phân tích lệnh
        <select
          value={id}
          disabled={imageBusy}
          onChange={(e) => {
            const t = trades.find((t) => t.id === e.target.value);
            setId(t?.id ?? '');
            setDraft(t ? structuredClone(t) : undefined);
            setVersion(revision);
            setImageSources([]);
          }}
        >
          <option value="">Chọn lệnh</option>
          {trades.map((t) => (
            <option key={t.id} value={t.id}>
              {t.symbol} · {t.id}
            </option>
          ))}
        </select>
      </label>
      {draft && (
        <>
          <label>
            Tags (phân cách dấu phẩy)
            <input
              value={draft.tags.join(',')}
              onChange={(e) =>
                put({
                  tags: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            Cảm xúc
            <input
              value={draft.emotion ?? ''}
              onChange={(e) => put({ emotion: e.target.value || undefined })}
            />
          </label>
          {(['highestPrice', 'lowestPrice', 'plannedSL', 'plannedTP'] as const).map((field) => (
            <label key={field}>
              {
                {
                  highestPrice: 'Giá cao nhất đã quan sát',
                  lowestPrice: 'Giá thấp nhất đã quan sát',
                  plannedSL: 'SL kế hoạch',
                  plannedTP: 'TP kế hoạch',
                }[field]
              }
              <input
                value={draft[field] ?? ''}
                onChange={(e) => put({ [field]: e.target.value || undefined })}
              />
            </label>
          ))}
          <p>
            Exit Analysis chỉ tính lệnh hai legs có đủ 1R và cực trị do bạn nhập; không suy diễn
            OHLC. MFE/MAE là biến động giá trước phí.
          </p>
          <p>
            MFE: {formatValue(exit?.mfeR ?? null, 'R')} · MAE:{' '}
            {formatValue(exit?.maeR ?? null, 'R')} · OTP chạm:{' '}
            {exit?.otpHit === null || exit?.otpHit === undefined
              ? '—'
              : exit.otpHit
                ? 'Có'
                : 'Không'}{' '}
            · Hiệu suất: {formatValue(exit?.efficiencyPercent ?? null, 'percent')} · Tác động quản
            lý: {formatValue(exit?.managementEffectR ?? null, 'R')}
          </p>
          <h3>Checklist</h3>
          {setup?.checklist.map((c) => (
            <label className="check" key={c.id}>
              <input
                type="checkbox"
                checked={draft.checklist?.some((x) => x.criterionId === c.id && x.checked) ?? false}
                onChange={(e) =>
                  put({
                    checklist: [
                      ...(draft.checklist?.filter((x) => x.criterionId !== c.id) ?? []),
                      { criterionId: c.id, checked: e.target.checked },
                    ],
                  })
                }
              />
              {c.text} · trọng số {c.weight}
            </label>
          ))}
          <p>Tuân thủ: {compliance(draft, setup)?.toFixed(1) ?? '—'}%</p>
          <h3>Chip 3 khâu</h3>
          {(['entry', 'management', 'exit'] as const).map((stage) => (
            <fieldset key={stage}>
              <legend>{stage}</legend>
              {data.errorTags
                .filter((e) => e.journalId === journal.id && e.stage === stage && !e.disabledAt)
                .map((error) => (
                  <label key={error.id}>
                    <input
                      type="checkbox"
                      checked={draft.stageChips?.[stage]?.includes(error.id) ?? false}
                      onChange={(e) => {
                        const chips = draft.stageChips ?? { entry: [], management: [], exit: [] };
                        const next = {
                          ...chips,
                          [stage]: e.target.checked
                            ? [...chips[stage], error.id]
                            : chips[stage].filter((id) => id !== error.id),
                        };
                        put({
                          stageChips: next,
                          errorTagIds: [
                            ...new Set([
                              ...draft.errorTagIds.filter((id) => id !== error.id),
                              ...(e.target.checked && error.tone === 'neg' ? [error.id] : []),
                            ]),
                          ],
                        });
                      }}
                    />
                    {error.name} ({error.tone})
                  </label>
                ))}
            </fieldset>
          ))}
          <h3>20 custom slots</h3>
          {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((slot) => (
            <label key={slot}>
              {data.customStatDefs.find(
                (d) => d.journalId === journal.id && String(d.slot) === slot,
              )?.name ?? 'Thống kê ' + slot}
              <input
                value={draft.customStats[slot] ?? ''}
                onChange={(e) => {
                  const stats = { ...draft.customStats };
                  if (e.target.value) stats[slot] = e.target.value;
                  else delete stats[slot];
                  put({ customStats: stats });
                }}
              />
            </label>
          ))}
          <h3>Chartbook · tối đa 6 ảnh hoặc URL</h3>
          <p>
            Ảnh PNG/JPEG/WebP tối đa 8 MB được nén về cạnh dài 2048 px, tối đa 2 MB/ảnh, lưu và sao
            lưu cùng workspace.
          </p>
          <label>
            Tải ảnh chart
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={busy || imageBusy || draft.attachments.length >= 6}
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                if (files.length + draft.attachments.length > 6) {
                  setMessage('Tối đa 6 ảnh hoặc URL mỗi lệnh.');
                  return;
                }
                const tradeId = draft.id;
                setImageBusy(true);
                void (async () => {
                  for (const file of files) {
                    const source = await prepareImage(file);
                    setImageSources((s) => [...s.filter((x) => x.id !== source.id), source]);
                    setDraft((t) =>
                      t?.id === tradeId
                        ? {
                            ...t,
                            attachments: [
                              ...t.attachments,
                              {
                                id: crypto.randomUUID(),
                                kind: 'blob',
                                blobKey: source.id,
                                caption: file.name,
                              },
                            ],
                          }
                        : t,
                    );
                  }
                })()
                  .catch((e) => setMessage(String(e)))
                  .finally(() => setImageBusy(false));
              }}
            />
          </label>
          <p>Dùng HTTPS từ nguồn bạn tin cậy. Các link chỉ được mở khi bạn chọn xem.</p>
          {Array.from({ length: 6 }, (_, i) => (
            <label key={i}>
              URL chart {i + 1}
              <input
                value={draft.attachments[i]?.kind === 'url' ? draft.attachments[i].url : ''}
                disabled={draft.attachments[i]?.kind === 'blob'}
                onChange={(e) => {
                  const attachments = [...draft.attachments];
                  if (e.target.value)
                    attachments[i] = {
                      id: attachments[i]?.id ?? crypto.randomUUID(),
                      kind: 'url',
                      url: e.target.value,
                      caption: attachments[i]?.caption ?? '',
                    };
                  else attachments.splice(i, 1);
                  put({ attachments: attachments.filter(Boolean) });
                }}
              />
            </label>
          ))}
          <button
            disabled={busy || imageBusy}
            onClick={() => {
              try {
                const parsed = tradeSchema.parse({ ...draft, updatedAt: new Date().toISOString() });
                void mutate(
                  (s) => ({
                    ...s,
                    sources: [
                      ...s.sources,
                      ...imageSources.filter(
                        (source) =>
                          !s.sources.some((x) => x.id === source.id) &&
                          parsed.attachments.some(
                            (a) => a.kind === 'blob' && a.blobKey === source.id,
                          ),
                      ),
                    ],
                    trades: s.trades.map((t) => (t.id === id ? parsed : t)),
                  }),
                  version,
                )
                  .then(() => {
                    setDraft(undefined);
                    setId('');
                    setMessage('Đã lưu hồ sơ.');
                  })
                  .catch((e) => setMessage(String(e)));
              } catch (e) {
                setMessage(String(e));
              }
            }}
          >
            Lưu hồ sơ nâng cao
          </button>
        </>
      )}
      <div>
        {trades
          .filter((t) => t.attachments.length)
          .map((t) => (
            <article key={t.id}>
              <h3>
                {t.symbol} · {t.id}
              </h3>
              {t.attachments.map((a) =>
                a.kind === 'url' ? (
                  <p key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.caption || 'Mở chart'}
                    </a>
                  </p>
                ) : (
                  <figure key={a.id}>
                    <img
                      alt={a.caption || 'Chart giao dịch'}
                      loading="lazy"
                      style={{ maxWidth: '100%' }}
                      src={imageDataURL(data.sources.find((s) => s.id === a.blobKey)!.raw)}
                    />
                    <figcaption>{a.caption}</figcaption>
                  </figure>
                ),
              )}
            </article>
          ))}
      </div>
      <button
        onClick={() =>
          void exportWorkspace(repo)
            .then(async (raw) => {
              const preview = await previewWorkspace(raw, repo);
              return chartbookZip(preview.data, journal.id, raw);
            })
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'chartbook-and-workspace.zip';
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
            .catch((e) => setMessage(String(e)))
        }
      >
        Tải ZIP Chartbook và backup toàn bộ workspace
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
