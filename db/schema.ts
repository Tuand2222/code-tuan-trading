import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const journalCloudHeads = sqliteTable("journal_cloud_heads", {
  ownerId: text("owner_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  mutationId: text("mutation_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const classicArchiveQueue = sqliteTable(
  "classic_archive_queue",
  {
    ownerId: text("owner_id").notNull(),
    recordKey: text("record_key").notNull(),
    token: text("token").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("classic_archive_queue_owner_key").on(t.ownerId, t.recordKey),
    index("classic_archive_queue_order").on(
      t.ownerId,
      t.updatedAt,
      t.recordKey,
    ),
  ],
);
export const journalCloudRecords = sqliteTable(
  "journal_cloud_records",
  {
    ownerId: text("owner_id").notNull(),
    recordKey: text("record_key").notNull(),
    collection: text("collection").notNull(),
    recordId: text("record_id").notNull(),
    period: text("period"),
    revision: integer("revision").notNull(),
    hash: text("hash").notNull(),
    deleted: integer("deleted").notNull().default(0),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("journal_cloud_owner_key").on(t.ownerId, t.recordKey),
    index("journal_cloud_owner_period").on(t.ownerId, t.period, t.recordKey),
  ],
);
export const journalCloudVersions = sqliteTable(
  "journal_cloud_versions",
  {
    ownerId: text("owner_id").notNull(),
    recordKey: text("record_key").notNull(),
    revision: integer("revision").notNull(),
    hash: text("hash").notNull(),
    deleted: integer("deleted").notNull().default(0),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("journal_cloud_version_unique").on(
      t.ownerId,
      t.recordKey,
      t.revision,
    ),
  ],
);

export const trades = sqliteTable(
  "trades",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
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
    swap: real("swap").notNull().default(0),
    quantity: real("quantity").notNull().default(0),
    entryPrice: real("entry_price").notNull().default(0),
    stopLoss: real("stop_loss").notNull().default(0),
    takeProfit: real("take_profit").notNull().default(0),
    exitPrice: real("exit_price").notNull().default(0),
    discipline: integer("discipline").notNull().default(100),
    psychology: text("psychology").notNull().default("Đồng bộ"),
    note: text("note").notNull().default(""),
    durationMin: integer("duration_min").notNull().default(0),
    openedAt: text("opened_at"),
    closedAt: text("closed_at"),
    dedupHash: text("dedup_hash"),
    semanticHash: text("semantic_hash"),
    sourceType: text("source_type").notNull().default("MANUAL"),
    rawPayloadJson: text("raw_payload_json"),
    version: integer("version").notNull().default(1),
    deletedAt: text("deleted_at"),
    mae: real("mae"),
    mfe: real("mfe"),
    rulesJson: text("rules_json"),
    recordKind: text("record_kind").notNull().default("position"),
    feesKnown: integer("fees_known", { mode: "boolean" })
      .notNull()
      .default(true),
    pnlKnown: integer("pnl_known", { mode: "boolean" }).notNull().default(true),
    riskKnown: integer("risk_known", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("trades_user_id_date_idx").on(table.userId, table.date),
    index("trades_user_date_idx").on(table.userEmail, table.date),
    uniqueIndex("trades_dedup_unique").on(table.userId, table.dedupHash),
    index("trades_semantic_idx").on(table.userId, table.semanticHash),
  ],
);

export const tradeImages = sqliteTable(
  "trade_images",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    userEmail: text("user_email").notNull(),
    tradeId: text("trade_id").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("trade_images_user_id_trade_idx").on(table.userId, table.tradeId),
    index("trade_images_user_trade_idx").on(table.userEmail, table.tradeId),
    uniqueIndex("trade_images_object_key_unique").on(table.objectKey),
  ],
);

export const brokerConnections = sqliteTable(
  "broker_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    userEmail: text("user_email").notNull(),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    accountType: text("account_type").notNull().default("default"),
    credentialsCiphertext: text("credentials_ciphertext").notNull(),
    webhookTokenHash: text("webhook_token_hash"),
    status: text("status").notNull().default("configured"),
    lastSyncAt: text("last_sync_at"),
    syncCursorJson: text("sync_cursor_json"),
    retryAfter: text("retry_after"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("connections_user_id_idx").on(table.userId),
    index("connections_user_idx").on(table.userEmail),
    uniqueIndex("connections_user_provider_unique").on(
      table.userEmail,
      table.provider,
      table.label,
    ),
    uniqueIndex("connections_webhook_token_unique").on(table.webhookTokenHash),
  ],
);

export const tradeAudit = sqliteTable(
  "trade_audit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tradeId: text("trade_id"),
    batchId: text("batch_id").notNull(),
    action: text("action").notNull(),
    detailsJson: text("details_json").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("trade_audit_user_idx").on(t.userId, t.createdAt)],
);

export const reportPreferences = sqliteTable("report_preferences", {
  userId: text("user_id").primaryKey(),
  settingsJson: text("settings_json").notNull(),
  destinationCiphertext: text("destination_ciphertext"),
  updatedAt: text("updated_at").notNull(),
});
export const reportJobs = sqliteTable(
  "report_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    period: text("period").notNull(),
    status: text("status").notNull(),
    objectKey: text("object_key"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("report_jobs_period_unique").on(t.userId, t.period)],
);

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .default(false)
      .notNull(),
    image: text("image"),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: integer("phone_number_verified", {
      mode: "boolean",
    }).default(false),
    legacyClaimedAt: integer("legacy_claimed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    uniqueIndex("user_phone_unique").on(table.phoneNumber),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const authRateLimit = sqliteTable(
  "auth_rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("last_request").notNull(),
  },
  (table) => [uniqueIndex("auth_rate_limit_key_unique").on(table.key)],
);
