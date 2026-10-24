export async function fetchAllTrades(options: RequestInit = {}) {
  let url = "/api/trades";
  const headers = new Headers(options.headers);
  let owner = headers.get("X-Journal-Owner");
  const rows = new Map<string, unknown>();
  do {
    const r = await fetch(url, { cache: "no-store", ...options, headers });
    if (!r.ok) return r;
    const page = (await r.json()) as {
      trades?: { id: string }[];
      next?: string;
      owner?: string;
    };
    if (!Array.isArray(page.trades))
      return Response.json({ error: "Invalid cloud trades" }, { status: 502 });
    if (page.owner) {
      if (owner && page.owner !== owner)
        return Response.json({ error: "Account changed while loading trades" }, { status: 409 });
      owner = page.owner;
      headers.set("X-Journal-Owner", owner);
    }
    for (const t of page.trades) rows.set(t.id, t);
    url = page.next
      ? "/api/trades?cursor=" + encodeURIComponent(page.next)
      : "";
  } while (url);
  return Response.json({ trades: [...rows.values()] });
}
