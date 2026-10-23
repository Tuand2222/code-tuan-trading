import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { reportPreferences, reportJobs } from "../../../../db/schema";
import { requireUser, routeError } from "../../../../lib/server-auth";
import { encryptBrokerSecrets } from "../../../../lib/broker-crypto";
import { DEFAULT_RISK } from "../../../../lib/risk-analytics";
import type { ReportConfig } from "../../../../lib/scheduled-reports";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const db = getDb();
    const [row] = await db
      .select()
      .from(reportPreferences)
      .where(eq(reportPreferences.userId, user.id));
    const jobs = await db
      .select({
        id: reportJobs.id,
        period: reportJobs.period,
        status: reportJobs.status,
        error: reportJobs.error,
        createdAt: reportJobs.createdAt,
      })
      .from(reportJobs)
      .where(eq(reportJobs.userId, user.id))
      .orderBy(desc(reportJobs.createdAt))
      .limit(20);
    return Response.json({
      ...(row ? JSON.parse(row.settingsJson) : {}),
      configured: !!row?.destinationCiphertext,
      jobs,
    });
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as ReportConfig & { secret?: string };
    const p = body.preferences;
    if (
      !p ||
      !["telegram", "email"].includes(p.channel) ||
      !["daily", "weekly"].includes(p.cadence) ||
      !Number.isInteger(p.hour) ||
      p.hour < 0 ||
      p.hour > 23
    )
      throw Error("Invalid report preferences");
    if (p.enabled && p.channel === "telegram" && !/^[-\d]+$/.test(p.chatId))
      throw Error("Invalid Telegram chat ID");
    if (
      p.enabled &&
      p.channel === "email" &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.from))
    )
      throw Error("Invalid email address");
    const riskSettings = { ...DEFAULT_RISK, ...body.riskSettings };
    new Intl.DateTimeFormat("en", { timeZone: riskSettings.timezone }).format(
      new Date(),
    );
    for (const key of [
      "initialCapital",
      "riskPercent",
      "dailyLossPercent",
      "defensivePercent",
      "stopPercent",
      "maxDrawdownPercent",
    ] as const)
      if (!Number.isFinite(riskSettings[key]) || riskSettings[key] < 0)
        throw Error("Invalid risk settings");
    const db = getDb();
    const [old] = await db
      .select()
      .from(reportPreferences)
      .where(eq(reportPreferences.userId, user.id));
    const oldConfig = old
      ? (JSON.parse(old.settingsJson) as ReportConfig)
      : null;
    if (
      oldConfig &&
      oldConfig.preferences.channel !== p.channel &&
      !body.secret
    )
      throw Error("New channel secret required");
    const destinationCiphertext = body.secret
      ? await encryptBrokerSecrets({ apiKey: body.secret })
      : (old?.destinationCiphertext ?? null);
    if (p.enabled && !destinationCiphertext)
      throw Error("Channel secret required before enabling delivery");
    await db
      .insert(reportPreferences)
      .values({
        userId: user.id,
        settingsJson: JSON.stringify({ preferences: p, riskSettings }),
        destinationCiphertext,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: reportPreferences.userId,
        set: {
          settingsJson: JSON.stringify({ preferences: p, riskSettings }),
          destinationCiphertext,
          updatedAt: new Date().toISOString(),
        },
      });
    return Response.json({ configured: !!destinationCiphertext });
  } catch (e) {
    return routeError(e);
  }
}
