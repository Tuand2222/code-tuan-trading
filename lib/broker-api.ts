�r�^�f��ئ{O,y�'vî���import { getPublicBridgeUrl } from "./bridge-url";

export type BrokerAccess = {
  provider: string;
  accountType: string;
  apiKey?: string;
  apiSecret?: string;
  bridgeUrl?: string;
  bridgeToken?: string;
};

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

async function responsePayload(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function providerError(provider: string, response: Response, payload: Record<string, unknown>) {
  const message = String(payload.msg ?? payload.retMsg ?? response.statusText ?? "Kết nối thất bại");
  return new Error(`${provider}: ${message}`);
}

async function verifyBinance(access: BrokerAccess) {
  if (!access.apiKey || !access.apiSecret) throw new Error("Binance: thiếu API key hoặc API secret");
  const futures = access.accountType !== "spot";
  const host = futures ? "https://fapi.binance.com" : "https://api.binance.com";
  const path = futures ? "/fapi/v3/account" : "/api/v3/account";
  const query = new URLSearchParams({
    timestamp: String(Date.now()),
    recvWindow: "5000",
  }).toString();
  const signature = await hmacHex(access.apiSecret, query);
  const response = await fetch(`${host}${path}?${query}&signature=${signature}`, {
    headers: { "X-MBX-APIKEY": access.apiKey },
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw providerError("Binance", response, payload);
  return { detail: futures ? "Binance Futures API đã xác thực" : "Binance Spot API đã xác thực" };
}

async function verifyBybit(access: BrokerAccess) {
  if (!access.apiKey || !access.apiSecret) throw new Error("Bybit: thiếu API key hoặc API secret");
  const timestamp = String(Date.now());
  const receiveWindow = "5000";
  const signature = await hmacHex(
    access.apiSecret,
    `${timestamp}${access.apiKey}${receiveWindow}`,
  );
  const response = await fetch("https://api.bybit.com/v5/user/query-api", {
    headers: {
      "X-BAPI-API-KEY": access.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": receiveWindow,
      "X-BAPI-SIGN": signature,
    },
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await responsePayload(response) as {
    retCode?: number;
    retMsg?: string;
    result?: { readOnly?: number };
  };
  if (!response.ok || payload.retCode !== 0) throw providerError("Bybit", response, payload as Record<string, unknown>);
  if (payload.result?.readOnly !== 1) {
    throw new Error("Bybit: API key phải ở chế độ Read-Only. Hãy tắt quyền đặt lệnh và rút tiền rồi thử lại");
  }
  return { detail: "Bybit Read-Only API đã xác thực" };
}

async function verifyPullBridge(access: BrokerAccess) {
  if (!access.bridgeUrl || !access.bridgeToken) throw new Error("Bridge: thiếu HTTPS URL hoặc token");
  const url = getPublicBridgeUrl(access.bridgeUrl);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${access.bridgeToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Bridge: ${response.status} ${response.statusText}`);
  const payload = await response.json() as { trades?: unknown } | unknown[];
  const rows = Array.isArray(payload) ? payload : payload.trades;
  if (!Array.isArray(rows)) throw new Error("Bridge: phản hồi phải là một mảng hoặc object có trường trades");
  return { detail: "Bridge HTTPS đã phản hồi hợp lệ" };
}

export async function verifyBrokerAccess(access: BrokerAccess) {
  if (access.provider === "binance") return verifyBinance(access);
  if (access.provider === "bybit") return verifyBybit(access);
  if (access.accountType === "pull") return verifyPullBridge(access);
  return { detail: "Đã tạo endpoint; đang chờ dữ liệu đầu tiên" };
}
