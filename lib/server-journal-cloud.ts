import { env } from "cloudflare:workers";
import {
  cloudHash,
  cloudKey,
  stableJSON,
  type CloudMutation,
} from "./journal-cloud";
const bindings = () => {
  const value = env as unknown as { DB: D1Database; BUCKET: R2Bucket };
  if (!value.DB || !value.BUCKET) throw Error("Cloud storage unavailable");
  return value;
};
export async function commitJournalRecords(
  ownerId: string,
  m: CloudMutation,
  queueGuards: { key: string; token: string }[] = [],
) {
  if (m.expectedOwner !== ownerId)
    return Response.json({ error: "Account changed" }, { status: 409 });
  const owner = { id: ownerId },
    { DB, BUCKET } = bindings();
  const ownerPath = await cloudHash(owner.id),
    now = new Date().toISOString();
  const docs = [];
  for (const r of m.records) {
    if (!r.deleted && r.value === undefined)
      throw Error("Record value required");
    const json = stableJSON(r.deleted ? null : r.value),
      hash = await cloudHash(json),
      objectKey = `journal-archive/${ownerPath}/${hash}`;
    const size = new TextEncoder().encode(json).length;
    if (size > 6 * 1024 * 1024)
      return Response.json(
        { error: "Individual record exceeds 6 MB" },
        { status: 413 },
      );
    if (!r.deleted && !(await BUCKET.head(objectKey)))
      await BUCKET.put(objectKey, json, {
        httpMetadata: { contentType: "application/json" },
        sha256: Uint8Array.from(hash.match(/../g)!, (h) => parseInt(h, 16)),
      });
    docs.push({
      ...r,
      key: cloudKey(r.collection, r.id),
      hash,
      objectKey,
      size,
    });
  }
  await DB.prepare(
    "INSERT OR IGNORE INTO journal_cloud_heads(owner_id,revision,mutation_id,updated_at) VALUES(?,0,'',?)",
  )
    .bind(owner.id, now)
    .run();
  const previous = await DB.prepare(
    "SELECT revision,mutation_id FROM journal_cloud_heads WHERE owner_id=?",
  )
    .bind(owner.id)
    .first<{ revision: number; mutation_id: string }>();
  if (previous?.mutation_id === m.mutationId)
    return Response.json({ revision: previous.revision, replayed: true });
  const revision = m.expectedRevision + 1;
  const queueCondition = queueGuards.length
    ? " AND (SELECT COUNT(*) FROM classic_archive_queue WHERE owner_id=? AND (" +
      queueGuards.map(() => "(record_key=? AND token=?)").join(" OR ") +
      "))=?"
    : "";
  const statements = [
    DB.prepare(
      "UPDATE journal_cloud_heads SET revision=?,mutation_id=?,updated_at=? WHERE owner_id=? AND revision=?" + queueCondition,
    ).bind(revision, m.mutationId, now, owner.id, m.expectedRevision,
      ...(queueGuards.length ? [owner.id, ...queueGuards.flatMap(g => [g.key, g.token]), queueGuards.length] : [])),
  ];
  for (const d of docs) {
    const values = [
      owner.id,
      d.key,
      d.collection,
      d.id,
      d.period ?? null,
      revision,
      d.hash,
      d.deleted ? 1 : 0,
      d.objectKey,
      d.size,
      now,
      owner.id,
      m.mutationId,
    ];
    statements.push(
      DB.prepare(
        "INSERT INTO journal_cloud_records(owner_id,record_key,collection,record_id,period,revision,hash,deleted,object_key,size_bytes,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM journal_cloud_heads WHERE owner_id=? AND mutation_id=?) ON CONFLICT(owner_id,record_key) DO UPDATE SET period=excluded.period,revision=excluded.revision,hash=excluded.hash,deleted=excluded.deleted,object_key=excluded.object_key,size_bytes=excluded.size_bytes,updated_at=excluded.updated_at",
      ).bind(...values),
    );
    statements.push(
      DB.prepare(
        "INSERT INTO journal_cloud_versions(owner_id,record_key,revision,hash,deleted,object_key,size_bytes,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM journal_cloud_heads WHERE owner_id=? AND mutation_id=?)",
      ).bind(
        owner.id,
        d.key,
        revision,
        d.hash,
        d.deleted ? 1 : 0,
        d.objectKey,
        d.size,
        now,
        owner.id,
        m.mutationId,
      ),
    );
  }
  // D1 batch is transactional; no record can advance when the head CAS fails.
  const result = await DB.batch(statements);
  if (!result[0].meta.changes)
    return Response.json(
      { error: "Cloud changed on another device. Reconcile before retrying." },
      { status: 409 },
    );
  return Response.json({
    revision,
    updatedAt: now,
    records: docs.map((d) => ({ key: d.key, hash: d.hash })),
  });
}
