import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Miniflare } from "miniflare";
const binding = vi.hoisted(() => ({ DB: undefined as unknown }));
vi.mock("cloudflare:workers", () => ({ env: binding }));
vi.mock("../../lib/server-auth", () => ({
  requireUser: async () => ({
    id: "owner",
    email: "owner@example.test",
    name: "Owner",
  }),
  routeError: (e: unknown) =>
    e instanceof Response
      ? e
      : Response.json({ error: String(e) }, { status: 500 }),
}));
vi.mock("../../lib/broker-crypto", () => ({
  decryptBrokerSecrets: async () => ({ apiKey: "123:synthetic_token" }),
}));
import { runDueReports, duePeriod } from "../../lib/scheduled-reports";
import { DEFAULT_RISK } from "../../lib/risk-analytics";
import { ingestTrades } from "../../lib/server-ingestion";
import { PATCH, DELETE } from "../../app/api/trades/route";
const row = (id: string, extra = {}) => ({
  id,
  userId: "owner",
  userEmail: "owner@example.test",
  date: "2026-10-23",
  symbol: "BTCUSDT",
  side: "Buy",
  market: "Crypto",
  session: "London",
  setup: "Trend",
  timeframe: "H1",
  pnl: 100,
  risk: 10,
  fees: 1,
  note: "keep private note",
  externalId: id,
  source: "Binance",
  accountId: "account",
  ...extra,
});
describe("D1 atomic ingestion, conflict control and recovery", () => {
  let mf: Miniflare;
  let db: D1Database;
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-01",
    });
    db = (await mf.getD1Database("DB")) as unknown as D1Database;
    binding.DB = db;
    for (const name of readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      for (const statement of readFileSync("drizzle/" + name, "utf8")
        .split("--> statement-breakpoint")
        .filter((s) => s.trim()))
        await db.prepare(statement.trim()).run();
  }, 60000);
  afterAll(async () => {
    await mf?.dispose();
  });
  it("replays IDs across transports, enriches financial facts and preserves annotations", async () => {
    const a = await ingestTrades([row("exact")], "BROKER_API");
    expect(a.imported).toBe(1);
    const b = await ingestTrades(
      [
        row("another-id", {
          externalId: "exact",
          source: "Binance CSV",
          note: "do not overwrite",
          fees: 3,
        }),
      ],
      "FILE",
    );
    expect(b.imported).toBe(0);
    expect(b.updated).toBe(1);
    expect(b.trades[0].note).toBe("keep private note");
    expect(b.trades[0].fees).toBe(3);
    expect(b.trades[0].version).toBe(2);
    const c = await ingestTrades(
      [row("other-account", { externalId: "exact", accountId: "second" })],
      "FILE",
    );
    expect(c.imported).toBe(1);
  });
  it("rolls back every trade, audit and sync cursor when one row fails", async () => {
    await db
      .prepare(
        "INSERT INTO broker_connections(id,user_id,user_email,provider,label,credentials_ciphertext) VALUES('cx','owner','owner@example.test','binance','test','encrypted')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO trades(id,user_id,user_email,date,symbol,side,market,session,setup,timeframe) VALUES('foreign','other','x@example.test','2026-10-23','ETHUSDT','Buy','Crypto','London','Trend','H1')",
      )
      .run();
    const before = await db
      .prepare("SELECT COUNT(*) AS n FROM trade_audit")
      .first<{ n: number }>();
    await expect(
      ingestTrades(
        [row("before-error"), row("foreign", { externalId: "new-key" })],
        "FILE",
        { id: "cx", cursor: '{"time":123}' },
      ),
    ).rejects.toThrow();
    expect(
      await db.prepare("SELECT id FROM trades WHERE id='before-error'").first(),
    ).toBeNull();
    expect(
      await db
        .prepare(
          "SELECT sync_cursor_json FROM broker_connections WHERE id='cx'",
        )
        .first(),
    ).toEqual({ sync_cursor_json: null });
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM trade_audit").first(),
    ).toEqual(before);
    await expect(
      ingestTrades(
        Array.from({ length: 501 }, (_, i) => row("limit-" + i)),
        "FILE",
      ),
    ).rejects.toThrow();
    expect(
      await db.prepare("SELECT id FROM trades WHERE id='limit-0'").first(),
    ).toBeNull();
  });
  it("rejects a stale edit and keeps soft-deleted data recoverable", async () => {
    await ingestTrades([row("editable")], "MANUAL");
    const patch = (version: number, note: string) =>
      PATCH(
        new Request("https://test/api/trades", {
          method: "PATCH",
          body: JSON.stringify({ trade: { id: "editable", version, note } }),
        }),
      );
    const edits = await Promise.all([
      patch(1, "first edit"),
      patch(1, "second edit"),
    ]);
    expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (
        await DELETE(
          new Request("https://test/api/trades?id=editable", {
            method: "DELETE",
          }),
        )
      ).status,
    ).toBe(200);
    const saved = await db
      .prepare("SELECT version,deleted_at,note FROM trades WHERE id='editable'")
      .first<{ version: number; deleted_at: string; note: string }>();
    expect(saved?.deleted_at).toBeTruthy();
    expect(saved?.note).toContain("edit");
    const restored = await PATCH(
      new Request("https://test/api/trades", {
        method: "PATCH",
        body: JSON.stringify({
          trade: { id: "editable", version: saved!.version },
          restore: true,
        }),
      }),
    );
    expect(restored.status).toBe(200);
    expect(
      await db
        .prepare("SELECT deleted_at FROM trades WHERE id='editable'")
        .first(),
    ).toEqual({ deleted_at: null });
  });
  it("only delivers opted-in due reports once, and retains ambiguous failures for review", async () => {
    const prefs = {
      enabled: true,
      cadence: "daily" as const,
      hour: 0,
      channel: "telegram" as const,
      chatId: "123",
      email: "",
      from: "",
    };
    const config = { preferences: prefs, riskSettings: DEFAULT_RISK };
    const now = new Date("2026-10-23T18:00:00Z");
    expect(duePeriod(config, now)).toContain("2026-10-24");
    expect(
      duePeriod(
        { ...config, preferences: { ...prefs, cadence: "weekly" } },
        now,
      ),
    ).toBeNull();
    await db
      .prepare(
        "INSERT INTO report_preferences(user_id,settings_json,destination_ciphertext,updated_at) VALUES(?,?,?,?)",
      )
      .bind(
        "owner",
        JSON.stringify(config),
        "synthetic_ciphertext",
        now.toISOString(),
      )
      .run();
    const outgoing = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", outgoing);
    const font = readFileSync("public/fonts/BeVietnamPro-Regular.ttf");
    const env = {
      ASSETS: { fetch: async () => new Response(font) } as unknown as Fetcher,
      BUCKET: { put: async () => ({}) } as unknown as R2Bucket,
    };
    try {
      const a = await runDueReports(env, now, "owner");
      expect(a[0].status).toBe("sent");
      expect(outgoing).toHaveBeenCalledTimes(1);
      expect(await runDueReports(env, now, "owner")).toEqual([]);
      expect(outgoing).toHaveBeenCalledTimes(1);
      outgoing.mockResolvedValue(new Response("{}", { status: 500 }));
      const next = new Date("2026-10-24T18:00:00Z");
      expect((await runDueReports(env, next, "owner"))[0].status).toBe(
        "needs-review",
      );
      expect(await runDueReports(env, next, "owner")).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
