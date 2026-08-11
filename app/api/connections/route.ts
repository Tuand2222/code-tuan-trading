­r‡^Ñf¥–Ø¦{NìyÊ'vÃ®¶›­import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { brokerConnections } from "../../../db/schema";
import { verifyBrokerAccess } from "../../../lib/broker-api";
import { encryptBrokerSecrets } from "../../../lib/broker-crypto";
import { getPublicBridgeUrl } from "../../../lib/bridge-url";
import { requireUser, routeError } from "../../../lib/server-auth";

const PROVIDERS = new Set([
  "vps",
  "ssi",
  "tcx",
  "mt5",
  "cqg",
  "binance",
  "bybit",
  "tradingview",
  "vn-broker",
  "webhook",
]);
const BRIDGE_PROVIDERS = new Set(["vps", "ssi", "tcx", "mt5", "cqg"]);

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const rows = await getDb()
      .select({
        id: brokerConnections.id,
        provider: brokerConnections.provider,
        label: brokerConnections.label,
        accountType: brokerConnections.accountType,
        status: brokerConnections.status,
        lastSyncAt: brokerConnections.lastSyncAt,
        createdAt: brokerConnections.createdAt,
      })
      .from(brokerConnections)
      .where(eq(brokerConnections.userId, accountUser.id))
      .orderBy(desc(brokerConnections.createdAt));
    return Response.json({ connections: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const body = (await request.json()) as {
      provider?: string;
      label?: string;
      accountType?: string;
      apiKey?: string;
      apiSecret?: string;
      symbols?: string[];
      fxRate?: number;
      bridgeUrl?: string;
      bridgeToken?: string;
      brokerName?: string;
    };
    const provider = String(body.provider ?? "");
    if (!PROVIDERS.has(provider)) throw new Error("Unsupported broker provider");
    const requestedAccountType = String(body.accountType ?? "default");
    const accountType = BRIDGE_PROVIDERS.has(provider)
      ? (requestedAccountType === "pull" ? "pull" : "push")
      : requestedAccountType;
    if (["binance", "bybit"].includes(provider) && (!body.apiKey || !body.apiSecret)) {
      throw new Error("API key and secret are required");
    }
    if (BRIDGE_PROVIDERS.has(provider) && accountType === "pull" && (!body.bridgeUrl || !body.bridgeToken)) {
      throw new Error("Bridge HTTPS URL and token are required for pull sync");
    }
    if (BRIDGE_PROVIDERS.has(provider) && accountType === "pull" && body.bridgeUrl) {
      getPublicBridgeUrl(body.bridgeUrl.trim());
    }
    const label = String(body.label ?? provider).trim().slice(0, 80);
    const id = crypto.randomUUID();
    const webhookToken = provider === "webhook" || (BRIDGE_PROVIDERS.has(provider) && accountType === "push")
      ? `tpp_${bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))}`
      : undefined;
    const webhookTokenHash = webhookToken ? await sha256Hex(webhookToken) : null;
    const secrets = {
      apiKey: body.apiKey?.trim(),
      apiSecret: body.apiSecret?.trim(),
      symbols: body.symbols?.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
      fxRate: ["vps", "ssi", "tcx"].includes(provider) ? 1 : Math.max(1, Number(body.fxRate) || 1),
      bridgeUrl: body.bridgeUrl?.trim(),
      bridgeToken: body.bridgeToken?.trim(),
      brokerName: body.brokerName?.trim(),
    };
    const needsVerification = ["binance", "bybit"].includes(provider)
      || (BRIDGE_PROVIDERS.has(provider) && accountType === "pull");
    const verification = await verifyBrokerAccess({
      provider,
      accountType,
      apiKey: secrets.apiKey,
      apiSecret: secrets.apiSecret,
      bridgeUrl: secrets.bridgeUrl,
      bridgeToken: secrets.bridgeToken,
    });
    const status = needsVerification ? "connected" : "awaiting-data";
    const credentialsCiphertext = await encryptBrokerSecrets(secrets);
    const [connection] = await getDb()
      .insert(brokerConnections)
      .values({
        id,
        userId: accountUser.id,
        userEmail: accountUser.email,
        provider,
        label,
        accountType,
        credentialsCiphertext,
        webhookTokenHash,
        status,
      })
      .onConflictDoUpdate({
        target: [brokerConnections.userEmail, brokerConnections.provider, brokerConnections.label],
        set: {
          userId: accountUser.id,
          accountType,
          credentialsCiphertext,
          webhookTokenHash,
          status,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({
        id: brokerConnections.id,
        provider: brokerConnections.provider,
        label: brokerConnections.label,
        accountType: brokerConnections.accountType,
        status: brokerConnections.status,
        lastSyncAt: brokerConnections.lastSyncAt,
      });
    return Response.json({ connection, webhookToken, verification }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const accountUser = await requireUser(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Connection id is required");
    await getDb()
      .delete(brokerConnections)
      .where(and(eq(brokerConnections.id, id), eq(brokerConnections.userId, accountUser.id)));
    return Response.json({ deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
