import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const trades = sqliteTable(
  "trades",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    externalId: text("external_id"),
    market: text("market").notNull(),
    source: text("source").notNull().default("Thủ công"),
    accountId: text("account_id"),
    date: text("date").notNull(),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    session: text("session").notNull(),
    setup: text("setup").notNull(),
    timeframe: text("timeframe").notNull(),
    risk: real("risk").notNull().default(0),
    pnl: real("pnl").notNull().default(0),
    fees: real("fees").notNull().default(0),
    quantity: real("quantity").notNull().default(0),
    entryPrice: real("entry_price").notNull().default(0),
    exitPrice: real("exit_price").notNull().default(0),
    discipline: integer("discipline").notNull().default(100),
    psychology: text("psychology").notNull().default("Đồng bộ"),
    note: text("note").notNull().default(""),
    durationMin: integer("duration_min").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("trades_user_date_idx").on(table.userEmail, table.date),
    uniqueIndex("trades_external_unique").on(
      table.userEmail,
      table.source,
      table.externalId,
    ),
  ],
);

export const tradeImages = sqliteTable(
  "trade_images",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    tradeId: text("trade_id").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("trade_images_user_trade_idx").on(table.userEmail, table.tradeId),
    uniqueIndex("trade_images_object_key_unique").on(table.objectKey),
  ],
);

export const brokerConnections = sqliteTable(
  "broker_connections",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    accountType: text("account_type").notNull().default("default"),
    credentialsCiphertext: text("credentials_ciphertext").notNull(),
    webhookTokenHash: text("webhook_token_hash"),
    status: text("status").notNull().default("configured"),
    lastSyncAt: text("last_sync_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("connections_user_idx").on(table.userEmail),
    uniqueIndex("connections_user_provider_unique").on(
      table.userEmail,
      table.provider,
      table.label,
    ),
    uniqueIndex("connections_webhook_token_unique").on(table.webhookTokenHash),
  ],
);
