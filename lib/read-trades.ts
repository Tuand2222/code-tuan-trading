export async function fetchAllTrades(options: RequestInit = {}) {
  let url = "/api/trades?limit=1000";
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
      ? "/api/trades?limit=1000&cursor=" + encodeURIComponent(page.next)
      : "";
  } while (url);
  return Response.json({ owner, trades: [...rows.values()] });
}

/** A file is resumable, not one unbounded transaction. Each receipt is durable. */
export async function saveTradeBatches<T extends {id: string}>(rows:T[],owner:string,onReceipt:(rows:T[],done:number)=>Promise<void>){
  let imported=0,duplicates=0,updated=0;
  for(let offset=0;offset<rows.length;offset+=250){
    const batch=rows.slice(offset,offset+250);
    const response=await fetch('/api/trades',{method:'POST',headers:{'Content-Type':'application/json','X-Journal-Owner':owner},body:JSON.stringify({trades:batch,sourceType:'FILE'})});
    const result=await response.json() as {error?:string;imported?:number;duplicates?:number;updated?:number;trades?:T[]};
    if(!response.ok)throw Error(`Đã lưu ${offset}/${rows.length} dòng; có thể nhập lại cùng file để tiếp tục mà không nhân đôi. ${result.error||'Không thể lưu lô tiếp theo'}`);
    imported+=result.imported||0;duplicates+=result.duplicates||0;updated+=result.updated||0;
    await onReceipt(result.trades||[],offset+batch.length);
  }
  return {imported,duplicates,updated,scanned:rows.length};
}
