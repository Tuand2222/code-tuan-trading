import { env } from "cloudflare:workers";
import { and, eq, desc, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { tradeAudit, tradeImages, trades } from "../../../db/schema";
import { requireUser, routeError } from "../../../lib/server-auth";
export async function GET(request: Request) {
  try {
    const owner = await requireUser(request),
      q = new URL(request.url).searchParams,
      id = q.get("id");
    const rows = await getDb()
      .select()
      .from(tradeAudit)
      .where(
        and(
          eq(tradeAudit.userId, owner.id),
          eq(tradeAudit.action, "IMAGE_ARCHIVE"),
          id ? eq(tradeAudit.batchId, id) : undefined,
          q.get("before") ? lt(tradeAudit.id, q.get("before")!) : undefined,
        ),
      )
      .orderBy(desc(tradeAudit.id))
      .limit(id ? 1 : 51);
    if (id) {
      const row = rows[0];
      if (!row) return Response.json({ error: "Not found" }, { status: 404 });
      const image = JSON.parse(row.detailsJson) as {
        objectKey: string;
        filename: string;
        contentType: string;
      };
      const object = await env.BUCKET.get(image.objectKey);
      if (!object)
        return Response.json(
          { error: "Archived image unavailable" },
          { status: 404 },
        );
      return new Response(object.body, {
        headers: {
          "Content-Type": image.contentType,
          "Content-Disposition":
            'attachment; filename="' +
            image.filename.replace(/[\r\n"\\]/g, "_") +
            '"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return Response.json({
      images: rows.slice(0, 50).map((r) => {
        const image = JSON.parse(r.detailsJson) as {
          filename: string;
          tradeId: string;
          sizeBytes: number;
        };
        return {
          id: r.batchId,
          filename: image.filename,
          tradeId: image.tradeId,
          sizeBytes: image.sizeBytes,
          archivedAt: r.createdAt,
        };
      }),
      next: rows.length > 50 ? rows[49].id : null,
    });
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await requireUser(request),
      body = (await request.json()) as { id?: string; expectedOwner?: string };
    if (body.expectedOwner !== owner.id)
      return Response.json({ error: "Account changed" }, { status: 409 });
    const db = getDb();
    const [audit] = await db
      .select()
      .from(tradeAudit)
      .where(
        and(
          eq(tradeAudit.userId, owner.id),
          eq(tradeAudit.action, "IMAGE_ARCHIVE"),
          eq(tradeAudit.batchId, String(body.id ?? "")),
        ),
      )
      .limit(1);
    if (!audit) return Response.json({ error: "Not found" }, { status: 404 });
    const image = JSON.parse(
      audit.detailsJson,
    ) as typeof tradeImages.$inferInsert;
    const [trade] = await db
      .select({ id: trades.id })
      .from(trades)
      .where(and(eq(trades.id, image.tradeId), eq(trades.userId, owner.id)))
      .limit(1);
    if (!trade)
      return Response.json(
        { error: "Khôi phục giao dịch gốc trước khi khôi phục ảnh." },
        { status: 409 },
      );
    const existing = await db
      .select({ id: tradeImages.id })
      .from(tradeImages)
      .where(
        and(
          eq(tradeImages.userId, owner.id),
          eq(tradeImages.tradeId, image.tradeId),
        ),
      )
      .limit(6);
    if (existing.some((r) => r.id === image.id))
      return Response.json({ restored: true });
    if (existing.length >= 6)
      return Response.json(
        { error: "Giao dịch đã có 6 ảnh; bản lưu trữ vẫn được giữ." },
        { status: 409 },
      );
    if (!(await env.BUCKET.head(image.objectKey)))
      throw Error("Archived image unavailable");
    await db
      .insert(tradeImages)
      .values({ ...image, userId: owner.id, userEmail: owner.email })
      .onConflictDoNothing();
    return Response.json({ restored: true });
  } catch (e) {
    return routeError(e);
  }
}
