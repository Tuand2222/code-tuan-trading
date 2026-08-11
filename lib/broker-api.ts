import { getPublicBridgeUrl } from "./bridge-url";

export type BrokerAccess = {
  provider: string;
  accountType: string;
  apiKey?: string;
  apiSecret?: string;
  bridgeUrl?: string;
  bridgeToken?: string;
};

type JsonObject = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 12_000;
const BINANCE_SPOT_HOSTS = [
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
] as const;
const BINANCE_FUTURES_HOSTS = ["https://fapi.binance.com"] as const;
const BYBIT_HOST = "https://api.bybit.com";

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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.replace(/\s+/g, " ").trim().slice(0, 400) };
  }
}

function payloadCode(payload: unknown) {
  if (!isJsonObject(payload)) return undefined;
  const value = payload.code ?? payload.retCode;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function payloadMessage(payload: unknown) {
  if (!isJsonObject(payload)) return undefined;
  const value = payload.msg ?? payload.retMsg ?? payload.message ?? payload.error;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function providerHint(provider: string, status: number, code?: string) {
  if (provider === "Binance") {
    if (status === 403) return "Request bị Binance WAF/IP/region/rate-limit chặn từ server website. Nếu các endpoint dự phòng cũng bị chặn, hãy dùng bridge/VPS có IP tĩnh.";
    if (status === 418 || status === 429) return "Server đang bị Binance rate-limit hoặc auto-ban tạm thời. Chờ rồi thử lại, đồng thời giảm tần suất đồng bộ.";
    if (code === "-2015") return "Kiểm tra API key, quyền USER_DATA, IP whitelist và loại tài khoản Spot/Futures.";
    if (code === "-1021") return "Đồng hồ server lệch quá nhiều so với Binance; cần đồng bộ thời gian hoặc tăng recvWindow hợp lý.";
    if (code === "-1022") return "Chữ ký API không hợp lệ; hãy kiểm tra API Secret và loại key HMAC.";
  }
  if (provider === "Bybit") {
    if (status === 403) return "Bybit có thể chặn do IP rate-limit hoặc khu vực của server. Hãy thử lại sau; nếu lặp lại, dùng bridge/VPS IP tĩnh ở khu vực được hỗ trợ.";
    if (code === "10003") return "API key không khớp môi trường/domain (mainnet, testnet hoặc demo).";
    if (code === "10005") return "API key thiếu quyền cần thiết.";
    if (code === "10006") return "Đã vượt rate limit của Bybit.";
    if (code === "10009") return "Dịch vụ bị hạn chế theo khu vực của server.";
    if (code === "10010") return "IP server không khớp IP whitelist của API key.";
  }
  if (status === 401 || status === 403) return "Kiểm tra token, IP whitelist và quyền truy cập của nguồn dữ liệu.";
  if (status === 408 || status === 504) return "Nguồn dữ liệu phản hồi quá chậm; hãy thử lại hoặc kiểm tra bridge/VPS.";
  if (status === 429) return "Đã vượt giới hạn request; hãy chờ rồi thử lại.";
  if (status >= 500) return "Dịch vụ phía nhà cung cấp đang lỗi hoặc tạm thời không khả dụng.";
  return undefined;
}

function providerError(provider: string, response: Response, payload: unknown, endpoint: string) {
  const code = payloadCode(payload);
  const message = payloadMessage(payload) ?? response.statusText ?? "Kết nối thất bại";
  const hint = providerHint(provider, response.status, code);
  const parts = [`HTTP ${response.status} ${response.statusText || "Error"}`];
  if (code) parts.push(`code ${code}`);
  if (message && message !== response.statusText) parts.push(message);
  if (hint) parts.push(hint);
  parts.push(`Endpoint: ${endpoint}`);
  return new Error(`${provider}: ${parts.join(" · ")}`);
}

function networkError(provider: string, error: unknown, endpoint: string) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${provider}: không thể kết nối tới ${endpoint} · ${message}`);
}

function canTryNextEndpoint(status: number) {
  return status === 403 || status === 408 || status === 418 || status === 429 || status >= 500;
}

export async function binanceSignedJson<T>(
  access: BrokerAccess,
  paths: { spot: string; futures: string },
  params: Record<string, string> = {},
): Promise<{ payload: T; endpoint: string }> {
  if (!access.apiKey || !access.apiSecret) throw new Error("Binance: thiếu API key hoặc API secret");
  const futures = access.accountType !== "spot";
  const hosts = futures ? BINANCE_FUTURES_HOSTS : BINANCE_SPOT_HOSTS;
  const path = futures ? paths.futures : paths.spot;
  const query = new URLSearchParams({
    ...params,
    timestamp: String(Date.now()),
    recvWindow: "5000",
  }).toString();
  const signature = await hmacHex(access.apiSecret, query);
  let lastError: Error | undefined;

  for (const host of hosts) {
    const endpoint = `${host}${path}`;
    try {
      const response = await fetch(`${endpoint}?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": access.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await responsePayload(response);
      if (response.ok) return { payload: payload as T, endpoint };
      const error = providerError("Binance", response, payload, endpoint);
      if (!futures && canTryNextEndpoint(response.status)) {
        lastError = error;
        continue;
      }
      throw error;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Binance: HTTP")) throw error;
      const wrapped = networkError("Binance", error, endpoint);
      if (!futures) {
        lastError = wrapped;
        continue;
      }
      throw wrapped;
    }
  }

  throw new Error(
    `Binance: tất cả endpoint Spot đều thất bại (${BINANCE_SPOT_HOSTS.map((host) => new URL(host).host).join(", ")}) · ${lastError?.message ?? "Không có phản hồi"}`,
  );
}

export async function bybitSignedJson<T>(
  access: BrokerAccess,
  path: string,
  params: Record<string, string> = {},
): Promise<{ payload: T; endpoint: string }> {
  if (!access.apiKey || !access.apiSecret) throw new Error("Bybit: thiếu API key hoặc API secret");
  const query = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const receiveWindow = "5000";
  const signature = await hmacHex(access.apiSecret, `${timestamp}${access.apiKey}${receiveWindow}${query}`);
  const endpoint = `${BYBIT_HOST}${path}`;

  let response: Response;
  try {
    response = await fetch(query ? `${endpoint}?${query}` : endpoint, {
      headers: {
        "X-BAPI-API-KEY": access.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": receiveWindow,
        "X-BAPI-SIGN": signature,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkError("Bybit", error, endpoint);
  }

  const payload = await responsePayload(response);
  const retCode = isJsonObject(payload) && typeof payload.retCode === "number" ? payload.retCode : undefined;
  if (!response.ok || (retCode !== undefined && retCode !== 0)) {
    throw providerError("Bybit", response, payload, endpoint);
  }
  return { payload: payload as T, endpoint };
}

export async function fetchBrokerBridgeJson(access: BrokerAccess): Promise<{ payload: unknown; endpoint: string }> {
  if (!access.bridgeUrl || !access.bridgeToken) throw new Error("Bridge: thiếu HTTPS URL hoặc token");
  const url = getPublicBridgeUrl(access.bridgeUrl);
  const endpoint = `${url.origin}${url.pathname}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${access.bridgeToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkError("Bridge", error, endpoint);
  }

  const payload = await responsePayload(response);
  if (!response.ok) throw providerError("Bridge", response, payload, endpoint);
  return { payload, endpoint };
}

async function verifyBinance(access: BrokerAccess) {
  const futures = access.accountType !== "spot";
  const { endpoint } = await binanceSignedJson<JsonObject>(access, {
    spot: "/api/v3/account",
    futures: "/fapi/v3/account",
  });
  return {
    detail: futures ? "Binance Futures API đã xác thực" : "Binance Spot API đã xác thực",
    endpoint,
  };
}

async function verifyBybit(access: BrokerAccess) {
  const { payload, endpoint } = await bybitSignedJson<{
    retCode?: number;
    retMsg?: string;
    result?: { readOnly?: number };
  }>(access, "/v5/user/query-api");
  if (payload.result?.readOnly !== 1) {
    throw new Error("Bybit: API key phải ở chế độ Read-Only. Hãy tắt quyền đặt lệnh và rút tiền rồi thử lại");
  }
  return { detail: "Bybit Read-Only API đã xác thực", endpoint };
}

async function verifyPullBridge(access: BrokerAccess) {
  const { payload, endpoint } = await fetchBrokerBridgeJson(access);
  const rows = Array.isArray(payload)
    ? payload
    : isJsonObject(payload) && Array.isArray(payload.trades)
      ? payload.trades
      : undefined;
  if (!rows) throw new Error("Bridge: phản hồi phải là một mảng hoặc object có trường trades");
  return { detail: "Bridge HTTPS đã phản hồi hợp lệ", endpoint };
}

export async function verifyBrokerAccess(access: BrokerAccess) {
  if (access.provider === "binance") return verifyBinance(access);
  if (access.provider === "bybit") return verifyBybit(access);
  if (access.accountType === "pull") return verifyPullBridge(access);
  return { detail: "Đã tạo endpoint; đang chờ dữ liệu đầu tiên" };
}
