import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { trades, reportJobs, reportPreferences } from "../db/schema";
import { decryptBrokerSecrets } from "./broker-crypto";
import {
  workbookBytes,
  buildGovernanceWorkbook,
  executivePdf,
  backupArchive,
  type ReportTrade,
} from "./governance-report";
import { DEFAULT_RISK, dayInZone, type RiskSettings } from "./risk-analytics";
import { sha256 } from "./unified-ingestion";
import { zipSync } from "fflate";
export interface DeliveryPreferences {
  enabled: boolean;
  cadence: "daily" | "weekly";
  hour: number;
  channel: "telegram" | "email";
  chatId: string;
  email: string;
  from: string;
}
export interface ReportConfig {
  preferences: DeliveryPreferences;
  riskSettings: RiskSettings;
}
export function duePeriod(config: ReportConfig, now: Date) {
  const p = config.preferences;
  if (!p.enabled) return null;
  const zone = config.riskSettings.timezone;
  const day = dayInZone(now, zone);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < p.hour) return null;
  if (p.cadence === "weekly" && new Date(day + "T12:00:00Z").getUTCDay() !== 0)
    return null;
  return p.cadence + ":" + day + ":" + p.channel;
}
const base64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
export async function deliverReport(
  p: DeliveryPreferences,
  secret: string,
  files: { name: string; bytes: Uint8Array }[],
  jobId: string,
) {
  if (p.channel === "telegram") {
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(secret) || !/^[-\d]+$/.test(p.chatId))
      throw Error("Invalid Telegram destination");
    // One archive = one notification per job; retries never emit separate PDF/XLSX messages.
    const form = new FormData();
    form.set("chat_id", p.chatId);
    form.set("caption", "Tuấn Nhật Ký · Báo cáo định kỳ");
    const zip = zipSync(
      Object.fromEntries(files.map((f) => [f.name, f.bytes])),
    );
    form.set(
      "document",
      new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
      "TuanNhatKy_Report.zip",
    );
    const r = await fetch(
      `https://api.telegram.org/bot${secret}/sendDocument`,
      { method: "POST", body: form, signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw Error("Telegram từ chối gửi: HTTP " + r.status);
  } else {
    if (!p.email || !p.from || !secret)
      throw Error("Email destination required");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
        "Idempotency-Key": jobId,
      },
      body: JSON.stringify({
        from: p.from,
        to: [p.email],
        subject: "Tuấn Nhật Ký · Báo cáo quản trị định kỳ",
        text: "Báo cáo Excel và PDF của tài khoản được đính kèm.",
        attachments: files.map((f) => ({
          filename: f.name,
          content: base64(f.bytes),
        })),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw Error("Email provider từ chối gửi: HTTP " + r.status);
  }
}
export async function runDueReports(
  env: { ASSETS: Fetcher; BUCKET: R2Bucket },
  now = new Date(),
  onlyUser?: string,
) {
  const db = getDb();
  const configs = await db
    .select()
    .from(reportPreferences)
    .where(onlyUser ? eq(reportPreferences.userId, onlyUser) : undefined)
    .limit(50);
  const results: Array<{ id: string; status: string }> = [];
  for (const row of configs) {
    const config = JSON.parse(row.settingsJson) as ReportConfig;
    const period = duePeriod(config, now);
    if (!period || !row.destinationCiphertext) continue;
    const id = await sha256(row.userId + ":" + period);
    const claimed = await db
      .insert(reportJobs)
      .values({
        id,
        userId: row.userId,
        period,
        status: "running",
        createdAt: now.toISOString(),
      })
      .onConflictDoNothing()
      .returning();
    if (!claimed.length) continue;
    try {
      const data = await db
        .select()
        .from(trades)
        .where(and(eq(trades.userId, row.userId), isNull(trades.deletedAt)))
        .limit(5001);
      if (data.length > 5000)
        throw Error("Tài khoản vượt biên 5000; chia kỳ báo cáo trước khi gửi.");
      const source = data as ReportTrade[];
      const settings = { ...DEFAULT_RISK, ...config.riskSettings };
      const xlsx = workbookBytes(
        buildGovernanceWorkbook(
          source,
          settings,
          { source: "Scheduled report" },
          now,
        ),
      );
      const font = await env.ASSETS.fetch(
        new Request("https://site.internal/fonts/BeVietnamPro-Regular.ttf"),
      );
      if (!font.ok) throw Error("Report font unavailable");
      const pdf = await executivePdf(
        source,
        settings,
        new Uint8Array(await font.arrayBuffer()),
        now,
      );
      const backup = backupArchive(source, settings, "");
      const files = [
        { name: "TuanNhatKy_Report.xlsx", bytes: xlsx },
        { name: "TuanNhatKy_Report.pdf", bytes: pdf },
        { name: "TuanNhatKy_Backup.zip", bytes: backup },
      ];
      const objectKey =
        "reports/" + (await sha256(row.userId)) + "/" + id + ".zip";
      await env.BUCKET.put(
        objectKey,
        zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes]))),
        { httpMetadata: { contentType: "application/zip" } },
      );
      const secrets = await decryptBrokerSecrets(row.destinationCiphertext);
      await deliverReport(config.preferences, secrets.apiKey ?? "", files, id);
      await db
        .update(reportJobs)
        .set({ status: "sent", objectKey })
        .where(eq(reportJobs.id, id));
      results.push({ id, status: "sent" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Report generation failed";
      // No blind resend after an ambiguous network failure: Telegram has no idempotency key.
      await db
        .update(reportJobs)
        .set({ status: "needs-review", error: message.slice(0, 300) })
        .where(eq(reportJobs.id, id));
      results.push({ id, status: "needs-review" });
    }
  }
  return results;
}
