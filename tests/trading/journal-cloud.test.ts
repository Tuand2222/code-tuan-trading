import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Miniflare } from "miniflare";
const state = vi.hoisted(() => ({
  owner: "cloud-owner",
  DB: undefined as unknown,
  BUCKET: undefined as unknown,
}));
vi.mock("cloudflare:workers", () => ({ env: state }));
vi.mock("../../lib/server-auth", () => ({
  requireUser: async () => ({
    id: state.owner,
    email: state.owner + "@test.invalid",
    name: "Test",
  }),
  routeError: (e: unknown) =>
    e instanceof Response
      ? e
      : Response.json({ error: String(e) }, { status: 500 }),
}));
import { GET, POST } from "../../app/api/journal-cloud/route";
import {
  GET as readRisk,
  PUT as writeRisk,
} from "../../app/api/risk-settings/route";
import { DEFAULT_RISK, riskDesk } from "../../lib/risk-analytics";
import { stableJSON, cloudHash, classifyChange } from "../../lib/journal-cloud";
import { drainClassicArchive } from "../../lib/classic-cloud-archive";
import { DELETE as deleteImage } from "../../app/api/trade-images/route";
import { POST as restoreImage } from "../../app/api/evidence-archive/route";
let mf: Miniflare, db: D1Database;
const request = (path = "", body?: unknown) =>
  new Request("https://test.invalid/api/journal-cloud" + path, {
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
const put = (
  revision: number,
  records: unknown[],
  mutationId = crypto.randomUUID(),
  expectedOwner = state.owner,
) =>
  POST(
    request("", {
      expectedOwner,
      expectedRevision: revision,
      mutationId,
      records,
    }),
  );
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    compatibilityDate: "2026-05-01",
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  state.DB = db;
  state.BUCKET = await mf.getR2Bucket("BUCKET");
  for (const name of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync("drizzle/" + name, "utf8")
      .split("--> statement-breakpoint")
      .filter((s) => s.trim()))
      await db.prepare(sql.trim()).run();
}, 60000);
afterAll(async () => {
  await mf?.dispose();
});
it("stores exact content hashes and isolates owners, including account switches", async () => {
  const value = {
    id: "one",
    customStats: { "2": 1, "10": 2 },
    note: "Tiếng Việt",
  };
  const r = await put(0, [
    { collection: "trades", id: "one", value, period: "2026-10" },
  ]);
  expect(r.status).toBe(200);
  const fetched = (await (await GET(request("?key=trades%3Aone"))).json()) as {
    value: unknown;
    hash: string;
  };
  expect(fetched.value).toEqual(value);
  expect(fetched.hash).toBe(await cloudHash(stableJSON(value)));
  state.owner = "other-owner";
  expect((await GET(request("?key=trades%3Aone"))).status).toBe(404);
  expect(
    (
      await put(
        0,
        [{ collection: "trades", id: "leak", value }],
        crypto.randomUUID(),
        "cloud-owner",
      )
    ).status,
  ).toBe(409);
  const other = (await (await GET(request())).json()) as { records: unknown[] };
  expect(other.records).toEqual([]);
  state.owner = "cloud-owner";
});
it("a stale head cannot partially replace any document and retry is idempotent", async () => {
  const mutation = crypto.randomUUID();
  expect(
    (
      await put(
        1,
        [{ collection: "notes", id: "n", value: { text: "original" } }],
        mutation,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await put(
        1,
        [{ collection: "notes", id: "n", value: { text: "original" } }],
        mutation,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await put(1, [
        { collection: "notes", id: "n", value: { text: "stale" } },
        { collection: "trades", id: "one", deleted: true },
      ])
    ).status,
  ).toBe(409);
  const note = (await (await GET(request("?key=notes%3An"))).json()) as {
    value: { text: string };
  };
  expect(note.value.text).toBe("original");
  expect((await GET(request("?key=trades%3Aone"))).status).toBe(200);
});
it("keeps tombstones and the original version without automatic expiry", async () => {
  expect(
    (await put(2, [{ collection: "trades", id: "one", deleted: true }])).status,
  ).toBe(200);
  const current = (await (await GET(request("?key=trades%3Aone"))).json()) as {
    deleted: boolean;
  };
  expect(current.deleted).toBe(true);
  const old = (await (
    await GET(request("?key=trades%3Aone&version=1"))
  ).json()) as { value: { note: string } };
  expect(old.value.note).toBe("Tiếng Việt");
  const versions = (await (
    await GET(request("?history=trades%3Aone"))
  ).json()) as { versions: { revision: number }[] };
  expect(versions.versions.map((v) => v.revision)).toEqual([3, 1]);
});
it("exports one pinned revision even after later modifications", async () => {
  await put(3, [{ collection: "notes", id: "n", value: { text: "new" } }]);
  const text = await (await GET(request("?export=1&at=2"))).text();
  const lines = text
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  expect(lines[0].revision).toBe(2);
  expect(lines.at(-1).complete).toBe(true);
  expect(lines.find((r) => r.collection === "notes").value.text).toBe(
    "original",
  );
  expect(lines.find((r) => r.collection === "trades").deleted).toBe(false);
});
it("shares actual capital with per-record CAS and rejects another account", async () => {
  const get = (await (await readRisk(request())).json()) as { version: number };
  expect(get.version).toBe(0);
  const write = (version: number, owner = state.owner) =>
    writeRisk(
      new Request("https://test.invalid/api/risk-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedOwner: owner,
          version,
          settings: {
            ...DEFAULT_RISK,
            initialCapital: 100000000,
            cashFlows: [
              { id: "cash", date: "2026-10-24", type: "deposit", amount: 1000 },
            ],
          },
        }),
      }),
    );
  expect((await write(0)).status).toBe(200);
  expect((await write(0)).status).toBe(409);
  expect((await write(5, "somebody-else")).status).toBe(409);
  const stored = (await (await readRisk(request())).json()) as {
    settings: { initialCapital: number };
  };
  expect(stored.settings.initialCapital).toBe(100000000);
});
it("three-way decisions preserve unrelated new local and remote records", () => {
  expect(classifyChange("base", "local", "remote")).toBe("conflict");
  expect(classifyChange(undefined, undefined, "new-cloud")).toBe("pull");
  expect(classifyChange(undefined, "new-local", undefined)).toBe("push");
  expect(classifyChange("base", "base", undefined)).toBe("pull");
});
it("archives Classic edits from the durable queue and preserves removed picture bytes", async () => {
  await db
    .prepare(
      "INSERT INTO trades(id,user_id,user_email,market,date,symbol,side,session,setup,timeframe,pnl,risk) VALUES('archive-trade',?,'test@invalid','Crypto','2026-10-24','BTCUSDT','Buy','Asia','Trend','H1',100,50)",
    )
    .bind(state.owner)
    .run();
  expect((await drainClassicArchive(state.owner)).pending).toBe(0);
  const first = (await (
    await GET(request("?key=classic%3Atrade%3Aarchive-trade"))
  ).json()) as { value: { pnl: number }; revision: number };
  expect(first.value.pnl).toBe(100);
  await db
    .prepare(
      "UPDATE trades SET pnl=120,version=version+1 WHERE id='archive-trade'",
    )
    .run();
  await drainClassicArchive(state.owner);
  const original = (await (
    await GET(
      request("?key=classic%3Atrade%3Aarchive-trade&version=" + first.revision),
    )
  ).json()) as { value: { pnl: number } };
  expect(original.value.pnl).toBe(100);
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmMkAAAAASUVORK5CYII=";
  const bucket = state.BUCKET as R2Bucket;
  await bucket.put(
    "trade-images/archive-image",
    Uint8Array.from(atob(png), (c) => c.charCodeAt(0)),
  );
  await db
    .prepare(
      "INSERT INTO trade_images(id,user_id,user_email,trade_id,object_key,filename,content_type,size_bytes) VALUES('archive-image',?,'test@invalid','archive-trade','trade-images/archive-image','chart.png','image/png',68)",
    )
    .bind(state.owner)
    .run();
  expect(
    (
      await deleteImage(
        new Request("https://test.invalid/api/trade-images?id=archive-image", {
          method: "DELETE",
        }),
      )
    ).status,
  ).toBe(200);
  expect(await bucket.head("trade-images/archive-image")).not.toBeNull();
  await drainClassicArchive(state.owner);
  const descriptor = (await (
    await GET(request("?key=classic%3Aimage%3Aarchive-image"))
  ).json()) as { value: { chunks: string[] } };
  const chunk = (await (
    await GET(
      request(
        "?key=" +
          encodeURIComponent(
            "classic:image-chunk:" + descriptor.value.chunks[0],
          ),
      ),
    )
  ).json()) as { value: string };
  expect(chunk.value).toBe(png);
  const restore = () =>
    restoreImage(
      new Request("https://test.invalid/api/evidence-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "archive-image",
          expectedOwner: state.owner,
        }),
      }),
    );
  expect((await restore()).status).toBe(200);
  expect((await restore()).status).toBe(200);
  expect(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM trade_images WHERE id='archive-image'",
        )
        .first<{ n: number }>()
    )?.n,
  ).toBe(1);
});

it("capital transfers change balance without inventing profit or drawdown", () => {
  const r = riskDesk(
    [
      {
        id: "t",
        date: "2026-10-24",
        symbol: "BTC",
        side: "Buy",
        pnl: -10,
        risk: 10,
        fees: 0,
        swap: 0,
        setup: "x",
        session: "x",
        discipline: 100,
        durationMin: 1,
      },
    ],
    {
      ...DEFAULT_RISK,
      initialCapital: 100,
      cashFlows: [
        { id: "cash", date: "2026-10-23", type: "deposit", amount: 50 },
        { id: "future", date: "2099-01-01", type: "withdrawal", amount: 200 },
      ],
    },
    new Date("2026-10-24T12:00:00Z"),
  );
  expect(r.balance).toBe(140);
  expect(r.curve[0].balance).toBe(140);
  expect(r.net).toBe(-10);
  expect(r.floor).toBe(130);
  expect(r.dailyOpening).toBe(150);
  expect(r.maxDD).toBe(10);
});

it("a slower Classic drain cannot overwrite a newer snapshot after another drain finishes", async () => {
  await drainClassicArchive(state.owner);
  await db.prepare("INSERT INTO trades(id,user_id,user_email,market,date,symbol,side,session,setup,timeframe,pnl,risk) VALUES('race-trade',?,'test@invalid','Crypto','2026-10-24','RACE','Buy','Asia','Trend','H1',10,50)").bind(state.owner).run();
  const bucket = state.BUCKET as R2Bucket;
  let interleaved = false;
  state.BUCKET = {
    head: bucket.head.bind(bucket), get: bucket.get.bind(bucket),
    put: async (key: string, value: string, options: R2PutOptions) => {
      if (!interleaved && value.includes('"id":"race-trade"') && value.includes('"pnl":10')) {
        interleaved = true;
        await db.prepare("UPDATE trades SET pnl=20,version=version+1 WHERE id='race-trade'").run();
        await drainClassicArchive(state.owner);
      }
      return bucket.put(key, value, options);
    },
  };
  try {
    expect((await drainClassicArchive(state.owner)).pending).toBe(0);
    expect(interleaved).toBe(true);
    const r = await (await GET(request('?key=classic%3Atrade%3Arace-trade'))).json() as {value:{pnl:number}};
    expect(r.value.pnl).toBe(20);
  } finally { state.BUCKET = bucket; }
});
it("rejects an offline queue belonging to a different account before reading or mutating trades", async () => {
  const routes = await import('../../app/api/trades/route');
  for (const method of ['GET','POST','PATCH','DELETE'] as const) {
    const response = await routes[method](new Request('https://test.invalid/api/trades?all=1', {
      method, headers: {'X-Journal-Owner':'different-owner', 'Content-Type':'application/json'},
      ...(method === 'POST' || method === 'PATCH' ? {body:'{}'} : {}),
    }));
    expect(response.status).toBe(409);
  }
  expect((await db.prepare("SELECT deleted_at AS d FROM trades WHERE id='race-trade'").first<{d:string|null}>())?.d).toBeNull();
});
