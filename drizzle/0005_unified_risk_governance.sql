ALTER TABLE trades ADD opened_at text;
--> statement-breakpoint
ALTER TABLE trades ADD closed_at text;
--> statement-breakpoint
ALTER TABLE trades ADD dedup_hash text;
--> statement-breakpoint
ALTER TABLE trades ADD semantic_hash text;
--> statement-breakpoint
ALTER TABLE trades ADD source_type text NOT NULL DEFAULT 'MANUAL';
--> statement-breakpoint
ALTER TABLE trades ADD raw_payload_json text;
--> statement-breakpoint
ALTER TABLE trades ADD version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE trades ADD deleted_at text;
--> statement-breakpoint
ALTER TABLE trades ADD mae real;
--> statement-breakpoint
ALTER TABLE trades ADD mfe real;
--> statement-breakpoint
ALTER TABLE trades ADD rules_json text;
--> statement-breakpoint
ALTER TABLE trades ADD record_kind text NOT NULL DEFAULT 'position';
--> statement-breakpoint
ALTER TABLE trades ADD risk_known integer NOT NULL DEFAULT 1;
--> statement-breakpoint
DROP INDEX IF EXISTS trades_external_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX trades_dedup_unique ON trades(user_id,dedup_hash);
--> statement-breakpoint
CREATE INDEX trades_semantic_idx ON trades(user_id,semantic_hash);
--> statement-breakpoint
ALTER TABLE broker_connections ADD sync_cursor_json text;
--> statement-breakpoint
ALTER TABLE broker_connections ADD retry_after text;
--> statement-breakpoint
CREATE TABLE trade_audit (id text PRIMARY KEY NOT NULL,user_id text NOT NULL,trade_id text,batch_id text NOT NULL,action text NOT NULL,details_json text NOT NULL,created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX trade_audit_user_idx ON trade_audit(user_id,created_at);
--> statement-breakpoint
CREATE TABLE report_preferences (user_id text PRIMARY KEY NOT NULL,settings_json text NOT NULL,destination_ciphertext text,updated_at text NOT NULL);
--> statement-breakpoint
CREATE TABLE report_jobs (id text PRIMARY KEY NOT NULL,user_id text NOT NULL,period text NOT NULL,status text NOT NULL,object_key text,error text,created_at text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX report_jobs_period_unique ON report_jobs(user_id,period);

--> statement-breakpoint
ALTER TABLE trades ADD fees_known integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE trades ADD pnl_known integer NOT NULL DEFAULT 1;

--> statement-breakpoint
ALTER TABLE trades ADD swap real NOT NULL DEFAULT 0;
