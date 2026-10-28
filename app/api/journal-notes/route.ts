import { env } from "cloudflare:workers";
import { requireUser, routeError } from "../../../lib/server-auth";
import { cloudHash } from "../../../lib/journal-cloud";
import { POST as saveCloud } from "../journal-cloud/route";
export async function GET(request: Request) {
  try {
    const owner = await requireUser(request);
    if (
      request.headers.get("X-Journal-Owner") &&
      request.headers.get("X-Journal-Owner") !== owner.id
    )
      return Response.json({ error: "Account changed" }, { status: 409 });
    const row = await env.DB.prepare(
      "SELECT object_key,revision,hash FROM journal_cloud_records WHERE owner_id=? AND record_key='classic:notes' AND deleted=0",
    )
      .bind(owner.id)
      .first<{ object_key: string; revision: number; hash: string }>();
    if (!row)
      return Response.json({ owner: owner.id, settings: null, version: 0 });
    const object = await env.BUCKET.get(row.object_key);
    if (!object) throw Error("Notes archive unavailable");
    const raw = await object.text();
    if ((await cloudHash(raw)) !== row.hash)
      throw Error("Notes checksum mismatch");
    return Response.json({
      owner: owner.id,
      settings: JSON.parse(raw),
      version: row.revision,
    });
  } catch (e) {
    return routeError(e);
  }
}
export async function PUT(request: Request) {
  try {
    const owner = await requireUser(request),
      body = (await request.json()) as {
        expectedOwner: string;
        settings: unknown;
        version: number;
      };
    if (body.expectedOwner !== owner.id)
      return Response.json({ error: "Account changed" }, { status: 409 });
    if (typeof body.settings !== "string" || body.settings.length > 1000000)
      throw Error("Invalid notes size");
    const head = await env.DB.prepare(
      "SELECT revision FROM journal_cloud_heads WHERE owner_id=?",
    )
      .bind(owner.id)
      .first<{ revision: number }>();
    const row = await env.DB.prepare(
      "SELECT revision FROM journal_cloud_records WHERE owner_id=? AND record_key='classic:notes'",
    )
      .bind(owner.id)
      .first<{ revision: number }>();
    if (body.version !== (row?.revision ?? 0))
      return Response.json(
        { error: "Notes changed on another device" },
        { status: 409 },
      );
    return saveCloud(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          expectedOwner: owner.id,
          expectedRevision: head?.revision ?? 0,
          mutationId: crypto.randomUUID(),
          records: [
            { collection: "classic", id: "notes", value: body.settings },
          ],
        }),
      }),
    );
  } catch (e) {
    return routeError(e);
  }
}
