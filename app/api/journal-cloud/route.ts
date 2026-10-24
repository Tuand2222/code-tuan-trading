import { commitJournalRecords } from "../../../lib/server-journal-cloud";
import { env } from "cloudflare:workers";
import {
  cloudHash,
  cloudMutationSchema,
  cloudKey,
} from "../../../lib/journal-cloud";
import { requireUser, routeError } from "../../../lib/server-auth";

const bindings = () => {
  const e = env as unknown as { DB: D1Database; BUCKET: R2Bucket };
  if (!e.DB || !e.BUCKET) throw Error("Cloud storage unavailable");
  return e;
};
export async function GET(request: Request) {
  try {
    const owner = await requireUser(request),
      { DB, BUCKET } = bindings();
    if (
      request.headers.get("X-Journal-Owner") &&
      request.headers.get("X-Journal-Owner") !== owner.id
    )
      return Response.json(
        { error: "Account changed; sync stopped" },
        { status: 409 },
      );
    const q = new URL(request.url).searchParams;
    if (q.get("export") === "1") {
      const current = await DB.prepare(
        "SELECT revision FROM journal_cloud_heads WHERE owner_id=?",
      )
        .bind(owner.id)
        .first<{ revision: number }>();
      const at = Number(q.get("at") ?? current?.revision ?? 0),
        after = q.get("after") ?? "";
      if (!Number.isSafeInteger(at) || at < 0 || at > (current?.revision ?? 0))
        throw Error("Invalid archive revision");
      const page = await DB.prepare(
        `SELECT v.*,r.collection,r.record_id FROM journal_cloud_versions v JOIN journal_cloud_records r ON r.owner_id=v.owner_id AND r.record_key=v.record_key WHERE v.owner_id=? AND v.record_key>? AND v.revision=(SELECT MAX(v2.revision) FROM journal_cloud_versions v2 WHERE v2.owner_id=v.owner_id AND v2.record_key=v.record_key AND v2.revision<=?) ORDER BY v.record_key LIMIT 101`,
      )
        .bind(owner.id, after, at)
        .all<{
          record_key: string;
          collection: string;
          record_id: string;
          object_key: string;
          hash: string;
          deleted: number;
        }>();
      const archiveId = (await cloudHash(owner.id)) + ":" + at;
      const encoder = new TextEncoder();
      let index = -1,
        bytes = 0,
        last = after,
        finished = false;
      const stream = new ReadableStream({
        async pull(controller) {
          if (finished) return;
          const write = (v: unknown) => {
            const chunk = encoder.encode(JSON.stringify(v) + "\n");
            bytes += chunk.byteLength;
            controller.enqueue(chunk);
          };
          try {
            if (index === -1) {
              write({
                format: "tuan-cloud-archive",
                version: 1,
                archiveId,
                revision: at,
                after,
                exportedAt: new Date().toISOString(),
              });
              index = 0;
              return;
            }
            if (
              index >= Math.min(100, page.results.length) ||
              (index > 0 && bytes > 8 * 1024 * 1024)
            ) {
              const next = index < page.results.length ? last : null;
              write({ complete: next === null, next, revision: at });
              finished = true;
              controller.close();
              return;
            }
            const row = page.results[index++];
            let value: unknown = null;
            if (!row.deleted) {
              const object = await BUCKET.get(row.object_key);
              if (!object) throw Error("Archive object missing");
              const raw = await object.text();
              if ((await cloudHash(raw)) !== row.hash)
                throw Error("Archive integrity failed");
              value = JSON.parse(raw);
            }
            write({
              collection: row.collection,
              id: row.record_id,
              hash: row.hash,
              deleted: !!row.deleted,
              value,
            });
            last = row.record_key;
          } catch (error) {
            finished = true;
            controller.error(error);
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition":
            'attachment; filename="tuan-journal-cloud.ndjson"',
          "Cache-Control": "no-store",
        },
      });
    }
    const head = await DB.prepare(
      "SELECT revision,updated_at FROM journal_cloud_heads WHERE owner_id=?",
    )
      .bind(owner.id)
      .first();
    const key = q.get("key");
    if (key) {
      const version = q.get("version");
      const row = await DB.prepare(
        version
          ? "SELECT * FROM journal_cloud_versions WHERE owner_id=? AND record_key=? AND revision=?"
          : "SELECT * FROM journal_cloud_records WHERE owner_id=? AND record_key=?",
      )
        .bind(...(version ? [owner.id, key, Number(version)] : [owner.id, key]))
        .first<{
          object_key: string;
          hash: string;
          deleted: number;
          revision: number;
        }>();
      if (!row)
        return Response.json({ error: "Record not found" }, { status: 404 });
      if (row.deleted)
        return Response.json({ deleted: true, revision: row.revision });
      const body = await BUCKET.get(row.object_key);
      if (!body)
        throw Error(
          "Archived object missing; current local data has been preserved",
        );
      const raw = await body.text();
      if ((await cloudHash(raw)) !== row.hash)
        throw Error("Archive checksum mismatch");
      return Response.json({
        owner: owner.id,
        value: JSON.parse(raw),
        hash: row.hash,
        revision: row.revision,
      });
    }
    const history = q.get("history");
    const after = q.get("after") ?? "";
    const period = q.get("period");
    if (period && !/^\d{4}(?:-\d{2})?$/.test(period))
      throw Error("Invalid period");
    if (history) {
      const result = await DB.prepare(
        "SELECT record_key,revision,hash,deleted,size_bytes,updated_at FROM journal_cloud_versions WHERE owner_id=? AND record_key=? AND revision<? ORDER BY revision DESC LIMIT 50",
      )
        .bind(
          owner.id,
          history,
          Number(q.get("before") ?? Number.MAX_SAFE_INTEGER),
        )
        .all();
      return Response.json({ owner: owner.id, versions: result.results });
    }
    const result = await DB.prepare(
      "SELECT record_key,collection,record_id,period,revision,hash,deleted,size_bytes,updated_at FROM journal_cloud_records WHERE owner_id=? AND record_key>?" +
        (period ? " AND period LIKE ?" : "") +
        " ORDER BY record_key LIMIT 201",
    )
      .bind(...(period ? [owner.id, after, period + "%"] : [owner.id, after]))
      .all<{ record_key: string }>();
    const records = result.results.slice(0, 200);
    return Response.json({
      owner: owner.id,
      revision: head?.revision ?? 0,
      updatedAt: head?.updated_at ?? null,
      records,
      next: result.results.length > 200 ? records.at(-1)!.record_key : null,
      retention: "no-automatic-expiry",
    });
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await requireUser(request);
    if (Number(request.headers.get("content-length") ?? 0) > 8 * 1024 * 1024)
      return Response.json(
        { error: "Upload exceeds 8 MB; split into smaller batches" },
        { status: 413 },
      );
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 8 * 1024 * 1024)
      return Response.json({ error: "Upload exceeds 8 MB" }, { status: 413 });
    const m = cloudMutationSchema.parse(JSON.parse(raw));
    if (m.expectedOwner !== owner.id)
      return Response.json(
        { error: "Account changed; sync stopped" },
        { status: 409 },
      );
    if (
      new Set(m.records.map((r) => cloudKey(r.collection, r.id))).size !==
      m.records.length
    )
      throw Error("Invalid duplicate record keys");
    return commitJournalRecords(owner.id, m);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return Response.json({ error: "Invalid cloud record" }, { status: 400 });
    return routeError(error);
  }
}
