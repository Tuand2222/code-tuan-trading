import { and, eq, isNull, sql } from "drizzle-orm";
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
  const statements = prepared.map((row) =>
    db
      .insert(trades)
      .values(row)
      .onConflictDoUpdate({
        target: [trades.userId, trades.dedupHash],
        // Repeated receipts may add broker facts; private annotations and images are untouched.
        set: {
          pnl: sql`CASE WHEN excluded.pnl_known = 1 THEN excluded.pnl ELSE ${trades.pnl} END`,
          fees: sql`CASE WHEN excluded.fees_known = 1 THEN excluded.fees ELSE ${trades.fees} END`,
          pnlKnown: sql`MAX(${trades.pnlKnown},excluded.pnl_known)`,
          feesKnown: sql`MAX(${trades.feesKnown},excluded.fees_known)`,
          quantity: sql`excluded.quantity`,
          exitPrice: sql`excluded.exit_price`,
          rawPayloadJson: sql`excluded.raw_payload_json`,
          version: sql`${trades.version}+1`,
        },
        setWhere: sql`${trades.deletedAt} IS NULL AND (${trades.pnl} != excluded.pnl OR ${trades.fees} != excluded.fees OR ${trades.quantity} != excluded.quantity OR ${trades.exitPrice} != excluded.exit_price OR ${trades.feesKnown} != excluded.fees_known OR ${trades.pnlKnown} != excluded.pnl_known)`,
      })
      .returning(),
  );
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
  if (!statements.length)
    return {
      trades: [],
      imported: 0,
      updated: 0,
      duplicates: 0,
      scanned: 0,
      batchId,
    };
  // D1 batch is one transaction; cursor/audit roll back with all records on any error.
  const all = [...backfill, ...statements];
  const results = await db.batch([all[0], ...all.slice(1)]);
  const changed = results
    .slice(backfill.length, backfill.length + prepared.length)
    .flat() as (typeof trades.$inferSelect)[];
  return {
    trades: changed,
    imported: changed.filter((t) => t.version === 1).length,
    updated: changed.filter((t) => t.version > 1).length,
    duplicates: input.length - changed.length,
    scanned: input.length,
    batchId,
  };
}
