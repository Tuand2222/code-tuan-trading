import { z } from "zod";

export const cloudMutationSchema = z
  .object({
    expectedOwner: z.string().min(1).max(512),
    expectedRevision: z.number().int().min(0),
    mutationId: z.string().uuid(),
    records: z
      .array(
        z
          .object({
            collection: z.enum([
              "journals",
              "trades",
              "sources",
              "setups",
              "errorTags",
              "plans",
              "cashFlows",
              "batches",
              "notes",
              "plannedTrades",
              "altStrategies",
              "customStatDefs",
              "preferences",
              "classic",
              "chunks",
            ]),
            id: z.string().min(1).max(256),
            period: z
              .string()
              .regex(/^\d{4}(?:-\d{2})?$/)
              .optional(),
            value: z.unknown().optional(),
            deleted: z.boolean().default(false),
          })
          .strict(),
      )
      .min(1)
      .max(16),
  })
  .strict();
export type CloudMutation = z.infer<typeof cloudMutationSchema>;
export const cloudKey = (collection: string, id: string) =>
  collection + ":" + id;
export async function cloudHash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function stableJSON(value: unknown): string {
  const normalize = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(normalize)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => a.localeCompare(b, "en"))
              .map(([k, x]) => [k, normalize(x)]),
          )
        : v;
  return JSON.stringify(normalize(value)) ?? "null";
}
export function classifyChange(
  base: string | undefined,
  local: string | undefined,
  remote: string | undefined,
) {
  if (local === remote) return "same";
  if (local === base) return "pull";
  if (remote === base) return "push";
  return "conflict";
}
