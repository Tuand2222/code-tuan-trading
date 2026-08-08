import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { tradeImages, trades } from "../../../db/schema";
import { requireUserEmail, routeError } from "../../../lib/server-auth";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES_PER_TRADE = 6;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getBucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Image storage is unavailable");
  return env.BUCKET;
}

function clientImage(row: {
  id: string;
  tradeId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}) {
  return {
    ...row,
    url: `/api/trade-images?id=${encodeURIComponent(row.id)}`,
  };
}

export async function GET(request: Request) {
  try {
    const userEmail = requireUserEmail(request);
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get("id");
    const tradeId = searchParams.get("tradeId");
    const db = getDb();

    if (id) {
      const [row] = await db
        .select()
        .from(tradeImages)
        .where(and(eq(tradeImages.id, id), eq(tradeImages.userEmail, userEmail)))
        .limit(1);
      if (!row) return new Response("Image not found", { status: 404 });

      const object = await getBucket().get(row.objectKey);
      if (!object) return new Response("Image not found", { status: 404 });
      const headers = new Headers({
        "Content-Type": row.contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        "X-Content-Type-Options": "nosniff",
      });
      if (object.httpEtag) headers.set("ETag", object.httpEtag);
      return new Response(object.body, { headers });
    }

    const rows = await db
      .select({
        id: tradeImages.id,
        tradeId: tradeImages.tradeId,
        filename: tradeImages.filename,
        contentType: tradeImages.contentType,
        sizeBytes: tradeImages.sizeBytes,
        createdAt: tradeImages.createdAt,
      })
      .from(tradeImages)
      .where(tradeId
        ? and(eq(tradeImages.userEmail, userEmail), eq(tradeImages.tradeId, tradeId))
        : eq(tradeImages.userEmail, userEmail))
      .orderBy(desc(tradeImages.createdAt))
      .limit(300);

    return Response.json({ images: rows.map(clientImage) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = requireUserEmail(request);
    const formData = await request.formData();
    const tradeId = String(formData.get("tradeId") ?? "").trim();
    const file = formData.get("file");
    if (!tradeId || !(file instanceof File)) throw new Error("Trade and image are required");
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error("Unsupported image type");
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("Invalid image size; max 6 MB");

    const db = getDb();
    const [ownedTrade] = await db
      .select({ id: trades.id })
      .from(trades)
      .where(and(eq(trades.id, tradeId), eq(trades.userEmail, userEmail)))
      .limit(1);
    if (!ownedTrade) return new Response("Trade not found", { status: 404 });

    const existing = await db
      .select({ id: tradeImages.id })
      .from(tradeImages)
      .where(and(eq(tradeImages.tradeId, tradeId), eq(tradeImages.userEmail, userEmail)))
      .limit(MAX_IMAGES_PER_TRADE);
    if (existing.length >= MAX_IMAGES_PER_TRADE) throw new Error("Invalid image limit; each trade can store up to 6 images");

    const id = crypto.randomUUID();
    const objectKey = `trade-images/${id}`;
    const filename = file.name.trim().slice(0, 180) || `chart-${id}.jpg`;
    await getBucket().put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    try {
      const [inserted] = await db
        .insert(tradeImages)
        .values({
          id,
          userEmail,
          tradeId,
          objectKey,
          filename,
          contentType: file.type,
          sizeBytes: file.size,
        })
        .returning({
          id: tradeImages.id,
          tradeId: tradeImages.tradeId,
          filename: tradeImages.filename,
          contentType: tradeImages.contentType,
          sizeBytes: tradeImages.sizeBytes,
          createdAt: tradeImages.createdAt,
        });
      return Response.json({ image: clientImage(inserted) }, { status: 201 });
    } catch (error) {
      await getBucket().delete(objectKey);
      throw error;
    }
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const userEmail = requireUserEmail(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Image id is required");

    const db = getDb();
    const [row] = await db
      .select()
      .from(tradeImages)
      .where(and(eq(tradeImages.id, id), eq(tradeImages.userEmail, userEmail)))
      .limit(1);
    if (!row) return new Response("Image not found", { status: 404 });

    await getBucket().delete(row.objectKey);
    await db
      .delete(tradeImages)
      .where(and(eq(tradeImages.id, id), eq(tradeImages.userEmail, userEmail)));
    return Response.json({ deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
