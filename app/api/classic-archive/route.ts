import { env } from "cloudflare:workers";
import { requireUser, routeError } from "../../../lib/server-auth";
import { drainClassicArchive } from "../../../lib/classic-cloud-archive";
export async function POST(request: Request) {
  try {
    const owner = await requireUser(request),
      body = (await request.json()) as {
        expectedOwner: string;
        seed?: boolean;
        kind?: string;
        after?: string;
      };
    if (body.expectedOwner !== owner.id)
      return Response.json({ error: "Account changed" }, { status: 409 });
    if (body.seed) {
      const table =
        body.kind === "images"
          ? "trade_images"
          : body.kind === "trades"
            ? "trades"
            : null;
      if (!table) throw Error("Invalid archive source");
      const page = await env.DB.prepare(
        `SELECT id FROM ${table} WHERE user_id=? AND id>? ORDER BY id LIMIT 17`,
      )
        .bind(owner.id, String(body.after ?? ""))
        .all<{ id: string }>();
      const ids = page.results.slice(0, 16);
      if (ids.length)
        await env.DB.batch(
          ids.map((r) =>
            env.DB.prepare(
              "INSERT OR IGNORE INTO classic_archive_queue(owner_id,record_key,token,updated_at) VALUES(?,?,?,?)",
            ).bind(
              owner.id,
              (table === "trades" ? "trade:" : "image:") + r.id,
              crypto.randomUUID(),
              new Date().toISOString(),
            ),
          ),
        );
      return Response.json({
        next: page.results.length > 16 ? ids.at(-1)!.id : null,
      });
    }
    return Response.json(await drainClassicArchive(owner.id));
  } catch (e) {
    return routeError(e);
  }
}
