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
  const moneyReady="(excluded.pnl_known=1 AND (excluded.fees_known=1 OR (json_extract(excluded.raw_payload_json,'$.unifiedV6.netPnlSource')='file_net' AND json_extract(excluded.raw_payload_json,'$.unifiedV6.is_net_pnl_verified')=1)) AND json_extract(excluded.raw_payload_json,'$.unifiedV6.is_net_pnl_verified') IS NOT 0)";
  const riskReady="(excluded.risk_known=1 AND excluded.risk>0 AND json_extract(excluded.raw_payload_json,'$.unifiedV6.is_1r_verified') IS NOT 0)";
  const field=(name:string,ready:string)=>name+'=CASE WHEN '+ready+' THEN excluded.'+name+' ELSE trades.'+name+' END';
  // Financial facts are an atomic bundle: a reported net with unknown cost breakdown
  // must never be combined with an older fee and subtracted for a second time.
  const updates=[...['pnl','fees','swap','pnl_known','fees_known'].map(name=>field(name,moneyReady)),...['risk','risk_known'].map(name=>field(name,riskReady)),"quantity=CASE WHEN excluded.quantity>0 THEN excluded.quantity ELSE trades.quantity END","exit_price=CASE WHEN excluded.exit_price>0 THEN excluded.exit_price ELSE trades.exit_price END"];
  const oldMeta="COALESCE(json_extract(trades.raw_payload_json,'$.unifiedV6'),json('{}'))",incomingMeta="COALESCE(json_extract(excluded.raw_payload_json,'$.unifiedV6'),json('{}'))";
  // Keep review/tag/notes from the prior row. Replace only supplied financial provenance.
  const mergedMeta=oldMeta;
  const proofKeys=['batchIncomplete','netPnlSource','is_net_pnl_verified','currency','accountCurrency','sourceCurrency','fxRate','feeCurrency','normalized','asset_class'];
  const proofPatch="json_object("+proofKeys.flatMap(name=>["'"+name+"'","json("+incomingMeta+" -> '$."+name+"')"]).join(',')+")";
  const riskPatch="CASE WHEN "+riskReady+" THEN json_object('is_1r_verified',json('true')) ELSE json('{}') END";
  const financialMeta="json_patch(json_patch("+mergedMeta+",CASE WHEN "+moneyReady+" THEN "+proofPatch+" ELSE json('{}') END),"+riskPatch+")";
  updates.push("raw_payload_json=json_set(excluded.raw_payload_json,'$.unifiedV6',"+financialMeta+")","version=trades.version+1");
  const hasChanges="("+moneyReady+" AND (trades.pnl!=excluded.pnl OR trades.fees!=excluded.fees OR trades.swap!=excluded.swap OR trades.fees_known!=excluded.fees_known OR trades.pnl_known!=excluded.pnl_known)) OR ("+riskReady+" AND (trades.risk!=excluded.risk OR trades.risk_known!=excluded.risk_known)) OR (excluded.quantity>0 AND trades.quantity!=excluded.quantity) OR (excluded.exit_price>0 AND trades.exit_price!=excluded.exit_price)";
  const bulk=env.DB.prepare(`INSERT INTO trades (${columns.map(([,c])=>quote(c.name)).join(',')}) SELECT ${columns.map(([key])=>`json_extract(value,'$.${key}')`).join(',')} FROM json_each(?) WHERE 1 ON CONFLICT(user_id,dedup_hash) DO UPDATE SET ${updates.join(',')} WHERE trades.deleted_at IS NULL AND (${hasChanges}) RETURNING *`).bind(JSON.stringify(prepared.map(row=>({...defaults,...row}))));

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
