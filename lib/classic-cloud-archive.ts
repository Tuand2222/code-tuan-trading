import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { trades, tradeImages, tradeAudit } from "../db/schema";
import { cloudHash, stableJSON, type CloudMutation } from "./journal-cloud";
import { commitJournalRecords } from "./server-journal-cloud";

type RecordInput = CloudMutation["records"][number];
export async function drainClassicArchive(owner: string, attempt = 0): Promise<{ archived: number; pending: number }> {
  if (attempt >= 4) throw Error("Kho cloud đang thay đổi; sẽ thử lưu lại.");
  const db = getDb();
  const queue = await env.DB.prepare(
    "SELECT record_key,token FROM classic_archive_queue WHERE owner_id=? ORDER BY updated_at,record_key LIMIT 8",
  )
    .bind(owner)
    .all<{ record_key: string; token: string }>();
  const selected = queue.results[0]?.record_key.startsWith("image:")
    ? queue.results.slice(0, 1)
    : queue.results.filter((r) => r.record_key.startsWith("trade:"));
  const docs: RecordInput[] = [];
  for (const item of selected) {
    if (item.record_key.startsWith("trade:")) {
      const [row] = await db
        .select()
        .from(trades)
        .where(
          and(
            eq(trades.userId, owner),
            eq(trades.id, item.record_key.slice(6)),
          ),
        )
        .limit(1);
      if (row)
        docs.push({
          collection: "classic",
          id: "trade:" + row.id,
          period: row.date.slice(0, 7),
          value: row,
          deleted: false,
        });
    } else {
      const id = item.record_key.slice(6);
      let [image] = await db
        .select()
        .from(tradeImages)
        .where(and(eq(tradeImages.userId, owner), eq(tradeImages.id, id)))
        .limit(1);
      let archivedImage = false;
      if (!image) {
        const [archived] = await db
          .select()
          .from(tradeAudit)
          .where(
            and(
              eq(tradeAudit.userId, owner),
              eq(tradeAudit.action, "IMAGE_ARCHIVE"),
              eq(tradeAudit.batchId, id),
            ),
          )
          .limit(1);
        if (archived) {
          image = JSON.parse(archived.detailsJson);
          archivedImage = true;
        }
      }
      if (!image) throw Error("Archived image metadata unavailable");
      const object = await env.BUCKET.get(image.objectKey);
      if (!object)
        throw Error(
          "Ảnh gốc chưa có trong kho; hàng đợi được giữ để đối chiếu.",
        );
      const bytes = new Uint8Array(await object.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768)
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const encoded = btoa(binary),
        chunks: string[] = [];
      for (let i = 0; i < encoded.length; i += 1000000) {
        const value = encoded.slice(i, i + 1000000),
          hash = await cloudHash(value);
        chunks.push(hash);
        docs.push({
          collection: "classic",
          id: "image-chunk:" + hash,
          value,
          deleted: false,
        });
      }
      docs.push({
        collection: "classic",
        id: "image:" + image.id,
        value: {
          ...image,
          encoding: "base64",
          chunks,
          archived: archivedImage,
        },
        deleted: false,
      });
    }
  }
  const unique = [...new Map(docs.map((d) => ["classic:" + d.id, d])).values()];
  if (unique.length) {
    const keys = unique.map((d) => "classic:" + d.id);
    const existing = await env.DB.prepare(
      "SELECT record_key,hash FROM journal_cloud_records WHERE owner_id=? AND record_key IN (" +
        keys.map(() => "?").join(",") +
        ")",
    )
      .bind(owner, ...keys)
      .all<{ record_key: string; hash: string }>();
    const hashes = new Map(existing.results.map((r) => [r.record_key, r.hash])),
      changed: RecordInput[] = [];
    for (const doc of unique)
      if (
        hashes.get("classic:" + doc.id) !==
        (await cloudHash(stableJSON(doc.value)))
      )
        changed.push(doc);
    for (let i = 0; i < changed.length; i += 16) {
        const head = await env.DB.prepare(
          "SELECT revision FROM journal_cloud_heads WHERE owner_id=?",
        )
          .bind(owner)
          .first<{ revision: number }>();
        const response = await commitJournalRecords(owner, {
          expectedOwner: owner,
          expectedRevision: head?.revision ?? 0,
          mutationId: crypto.randomUUID(),
          records: changed.slice(i, i + 16),
        }, selected.map(r => ({key: r.record_key, token: r.token})));
        // A queue token is checked in the same transaction as the head CAS.
        // Re-read the source after a conflict; never retry an older captured row.
        if (response.status === 409) return drainClassicArchive(owner, attempt + 1);
        if (!response.ok)
          throw Error(
            "Không hoàn tất bản sao dài hạn; dữ liệu sổ chính và hàng đợi vẫn được giữ.",
          );
    }
  }
  if (selected.length)
    await env.DB.batch(
      selected.map((r) =>
        env.DB.prepare(
          "DELETE FROM classic_archive_queue WHERE owner_id=? AND record_key=? AND token=?",
        ).bind(owner, r.record_key, r.token),
      ),
    );
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM classic_archive_queue WHERE owner_id=?",
  )
    .bind(owner)
    .first<{ n: number }>();
  return { archived: selected.length, pending: count?.n ?? 0 };
}
