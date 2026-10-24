import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { brokerConnections, tradeImages, trades, user } from "../db/schema";
import { getAuth } from "./auth";
import { env } from "cloudflare:workers";
import { sitesIdentity } from "./sites-identity";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

async function claimLegacyData(accountUser: AuthenticatedUser) {
  const db = getDb();
  const [owner] = await db
    .select({ legacyClaimedAt: user.legacyClaimedAt })
    .from(user)
    .where(eq(user.id, accountUser.id))
    .limit(1);
  if (!owner || owner.legacyClaimedAt) return;

  const email = accountUser.email.trim().toLowerCase();
  await db
    .update(trades)
    .set({ userId: accountUser.id, userEmail: email })
    .where(and(isNull(trades.userId), eq(trades.userEmail, email)));
  await db
    .update(tradeImages)
    .set({ userId: accountUser.id, userEmail: email })
    .where(and(isNull(tradeImages.userId), eq(tradeImages.userEmail, email)));
  await db
    .update(brokerConnections)
    .set({ userId: accountUser.id, userEmail: email })
    .where(and(isNull(brokerConnections.userId), eq(brokerConnections.userEmail, email)));
  await db
    .update(user)
    .set({ legacyClaimedAt: new Date() })
    .where(eq(user.id, accountUser.id));
}

export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const nativeAuth = (env as unknown as Record<string, string>).SITES_NATIVE_AUTH === "1";
  if (nativeAuth) {
    const identity = sitesIdentity(request.headers, true);
    if (!identity) throw Response.json({ error: "Authentication required" }, { status: 401 });
    await getDb().insert(user).values({ ...identity, emailVerified: true })
      .onConflictDoUpdate({ target: user.id, set: { name: identity.name, updatedAt: new Date() } });
    await claimLegacyData(identity);
    return identity;
  }
  const authSession = await getAuth(request).api.getSession({ headers: request.headers });
  if (!authSession?.user) {
    throw Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const accountUser: AuthenticatedUser = {
    id: authSession.user.id,
    email: authSession.user.email.trim().toLowerCase(),
    name: authSession.user.name,
    image: authSession.user.image,
  };
  await claimLegacyData(accountUser);
  return accountUser;
}

export function routeError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /authentication required/i.test(message)
    ? 401
    : /required|invalid|unsupported/i.test(message)
      ? 400
      : 500;
  return Response.json({ error: message }, { status });
}
