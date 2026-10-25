import { and, eq, isNull, sql, getTableColumns } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { trades, tradeAudit, brokerConnections } from "../db/schema";
import { identifyTrade, redactSecrets } from "./unified-ingestion";
type Row = typeof trades.$inferInsert;
export async function ingestTrades(
  input: Row[],
  sourceType: string,
  connection?: { id: string; cursor?: string },
) {
  if (input.length > 500)
    throw Error(
      "Một lô tối đa 500 bản ghi; tách thành các tệp có biên lô rõ ràng.",
    );
  const db = getDb();
  const batchId = crypto.randomUUID();
  const prepared = await Promise.all(
    input.map(async (row) => {
      if (!row.userId) throw Error("Missing owner");
      const t = await identifyTrade(row, row.userId);
      return {
        ...t,
        sourceType,
        version: 1,
        deletedAt: null,
        rawPayloadJson: JSON.stringify(
          redactSecrets(
            row.rawPayloadJson ? JSON.parse(row.rawPayloadJson) : row,
          ),
        ),
      };
    }),
  );
  if (
    prepared.reduce((n, t) => n + (t.rawPayloadJson?.length ?? 0), 0) > 1500000
  )
    throw Error("Invalid batch size: raw payload exceeds safety limit");
  const owner = input[0]?.userId;
  const legacy = owner
    ? await db
        .select()
        .from(trades)
        .where(and(eq(trades.userId, owner), isNull(trades.dedupHash)))
        .limit(5000)
    : [];
  const legacyHashes = await Promise.all(
    legacy.map((row) => identifyTrade(row, row.userId!)),
  );
  const backfill = legacy.map((row, i) =>
    db
      .update(trades)
      .set({
        dedupHash: legacyHashes[i].dedupHash,
        semanticHash: legacyHashes[i].semanticHash,
      })
      .where(
        and(
          eq(trades.id, row.id),
          eq(trades.userId, row.userId!),
          isNull(trades.dedupHash),
        ),
      )
      .returning(),
  );
  const statements: Array<{toSQL():{sql:string;params:unknown[]}}> = [];
  if (owner)
    statements.push(
      db
        .insert(tradeAudit)
        .values({
          id: crypto.randomUUID(),
          userId: owner,
          batchId,
          action: "INGEST",
          detailsJson: JSON.stringify({
            sourceType,
            scanned: input.length,
            receipts: prepared.map((t) => ({
              id: t.id,
              raw: t.rawPayloadJson,
            })),
            hashes: prepared.map((t) => t.dedupHash),
          }),
        })
        .returning() as never,
    );
  if (connection)
    statements.push(
      db
        .update(brokerConnections)
        .set({
          lastSyncAt: new Date().toISOString(),
          status: "connected",
          retryAfter: null,
          ...(connection.cursor ? { syncCursorJson: connection.cursor } : {}),
        })
        .where(
          and(
            eq(brokerConnections.id, connection.id),
            eq(brokerConnections.userId, owner!),
          ),
        )
        .returning() as never,
    );
  if (!prepared.length)
    return {
      trades: [],
      imported: 0,
      updated: 0,
      duplicates: 0,
      scanned: 0,
      batchId,
    };
  // One JSON-bound bulk INSERT avoids hundreds of SQL compilations and stays below
  // D1's parameter limit. Audit/cursor/legacy hashes remain in the same transaction.
  const columns=Object.entries(getTableColumns(trades)).filter(([key])=>key!=='createdAt');
  const defaults=Object.fromEntries(columns.filter(([,column])=>['string','number','boolean'].includes(typeof column.default)).map(([key,column])=>[key,column.default]));
  const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
  const bulk=env.DB.prepare(`INSERT INTO trades (${columns.map(([,c])=>quote(c.name)).join(',')}) SELECT ${columns.map(([key])=>`json_extract(value,'$.${key}')`).join(',')} FROM json_each(?) WHERE 1 ON CONFLICT(user_id,dedup_hash) DO UPDATE SET pnl=CASE WHEN excluded.pnl_known=1 THEN excluded.pnl ELSE trades.pnl END,fees=CASE WHEN excluded.fees_known=1 THEN excluded.fees ELSE trades.fees END,pnl_known=MAX(trades.pnl_known,excluded.pnl_known),fees_known=MAX(trades.fees_known,excluded.fees_known),quantity=excluded.quantity,exit_price=excluded.exit_price,raw_payload_json=json_set(excluded.raw_payload_json,'$.unifiedV6',COALESCE(CASE WHEN json_valid(trades.raw_payload_json) THEN json_extract(trades.raw_payload_json,'$.unifiedV6') END,json_extract(excluded.raw_payload_json,'$.unifiedV6'),json('{}'))),version=trades.version+1 WHERE trades.deleted_at IS NULL AND (trades.pnl!=excluded.pnl OR trades.fees!=excluded.fees OR trades.quantity!=excluded.quantity OR trades.exit_price!=excluded.exit_price OR trades.fees_known!=excluded.fees_known OR trades.pnl_known!=excluded.pnl_known) RETURNING *`).bind(JSON.stringify(prepared.map(row=>({...defaults,...row}))));
  const native=(query:{toSQL():{sql:string;params:unknown[]}})=>{const q=query.toSQL();return env.DB.prepare(q.sql).bind(...q.params);};
  const trailing=statements;
  const results=await env.DB.batch([...backfill.map(native),bulk,...trailing.map(q=>native(q as never))]);
  const allColumns=Object.entries(getTableColumns(trades));
  const changed=results[backfill.length].results.map(value=>{const row=value as Record<string,unknown>;return Object.fromEntries(allColumns.map(([key,col])=>[key,col.dataType==='boolean'?Boolean(row[col.name]):row[col.name]]));}) as (typeof trades.$inferSelect)[];
  return {
    trades: changed,
    imported: changed.filter((t) => t.version === 1).length,
    updated: changed.filter((t) => t.version > 1).length,
    duplicates: input.length - changed.length,
    scanned: input.length,
    batchId,
  };
}
