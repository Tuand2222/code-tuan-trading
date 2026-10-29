import { cloudHash } from "../../../lib/journal-cloud";
import { env } from "cloudflare:workers";
import { requireUser, routeError } from "../../../lib/server-auth";
import { POST as saveCloud } from "../journal-cloud/route";
import {normalizeRiskSettings,riskSettingsSchema} from '../../../lib/risk-settings-schema';
export async function GET(request: Request) {
  try {
    const owner = await requireUser(request);
    if (
      request.headers.get("X-Journal-Owner") &&
      request.headers.get("X-Journal-Owner") !== owner.id
    )
      return Response.json({ error: "Account changed" }, { status: 409 });
    const row = await env.DB.prepare(
      "SELECT object_key,revision,hash FROM journal_cloud_records WHERE owner_id=? AND record_key='preferences:risk' AND deleted=0",
    )
      .bind(owner.id)
      .first<{ object_key: string; revision: number; hash: string }>();
    if (!row)
      return Response.json({ owner: owner.id, settings: null, version: 0 });
    const object = await env.BUCKET.get(row.object_key);
    if (!object) throw Error("Risk settings unavailable");
    const raw = await object.text();
    if ((await cloudHash(raw)) !== row.hash)
      throw Error("Risk checksum mismatch");
    return Response.json({
      owner: owner.id,
      settings: normalizeRiskSettings(JSON.parse(raw)),
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
    const settings = riskSettingsSchema.parse(body.settings);
    const head = await env.DB.prepare(
      "SELECT revision FROM journal_cloud_heads WHERE owner_id=?",
    )
      .bind(owner.id)
      .first<{ revision: number }>();
    const current = await env.DB.prepare(
      "SELECT revision FROM journal_cloud_records WHERE owner_id=? AND record_key='preferences:risk'",
    )
      .bind(owner.id)
      .first<{ revision: number }>();
    if (body.version !== (current?.revision ?? 0))
      return Response.json(
        {
          error:
            "Cấu hình vốn đã thay đổi ở nơi khác; hãy tải lại trước khi lưu.",
        },
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
          records: [{ collection: "preferences", id: "risk", value: settings }],
        }),
      }),
    );
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError")
      return Response.json({ error: "Invalid risk settings" }, { status: 400 });
    return routeError(e);
  }
}
