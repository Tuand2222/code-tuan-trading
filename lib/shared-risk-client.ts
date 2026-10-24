import { useEffect, useRef } from "react";
import { stableJSON } from "./journal-cloud";
import { readLocal, saveLocal } from "./classic-persistence";
import { DEFAULT_RISK, type RiskSettings } from "./risk-analytics";
function useSharedValue<T>(
  owner: string | undefined,
  settings: T,
  change: (s: T) => void,
  notify: (m: string) => void,
  path: string,
  fallback: T,
) {
  const current = useRef({ owner, settings, change, notify });
  current.current = { owner, settings, change, notify };
  const pump = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!owner) return;
    let active = true,
      version = 0,
      base = "",
      ready = false,
      pulling = false,
      writing = false,
      conflict = false;
    const isCurrent = () => active && current.current.owner === owner;
    const push = async () => {
      if (!isCurrent() || !ready || pulling || writing || conflict) return;
      writing = true;
      try {
        while (isCurrent()) {
          const raw = stableJSON(current.current.settings);
          if (raw === base) break;
          const response = await fetch(path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedOwner: owner,
              settings: current.current.settings,
              version,
            }),
          });
          if (!response.ok) {
            if (response.status === 409) conflict = true;
            throw Error(
              "Cấu hình vốn chưa đồng bộ. Bản trên thiết bị được giữ; hãy tải lại và đối chiếu cấu hình cloud.",
            );
          }
          const result = (await response.json()) as { revision: number };
          if (!isCurrent()) return;
          version = result.revision;
          base = raw;
          await saveLocal(path + ":base:" + owner, { version, raw });
        }
      } catch (e) {
        if (isCurrent()) current.current.notify(String(e));
      } finally {
        writing = false;
      }
    };
    pump.current = push;
    const pull = async () => {
      if (!isCurrent() || pulling || writing || conflict) return;
      if (ready && stableJSON(current.current.settings) !== base) {
        await push();
        return;
      }
      const started = stableJSON(current.current.settings);
      let needsPush = false;
      pulling = true;
      try {
        const response = await fetch(path, {
          cache: "no-store",
          headers: { "X-Journal-Owner": owner },
        });
        if (!response.ok) return;
        const result = (await response.json()) as {
          owner: string;
          settings: T | null;
          version: number;
        };
        if (!isCurrent() || result.owner !== owner) return;
        if (stableJSON(current.current.settings) !== started) return;
        if (result.settings !== null) {
          const remote = stableJSON(result.settings),
            saved = await readLocal<{ raw: string; version: number }>(
              path + ":base:" + owner,
            );
          if (!isCurrent() || stableJSON(current.current.settings) !== started) return;
          version = result.version;
          ready = true;
          if (saved && started !== saved.raw && saved.version === version) {
            base = saved.raw;
            needsPush = true;
            return;
          }
          if (
            (saved && started !== saved.raw && started !== remote) ||
            (!saved && started !== stableJSON(fallback) && started !== remote)
          ) {
            conflict = true;
            current.current.notify(
              "Dữ liệu trên thiết bị và cloud khác nhau. Cả hai bản được giữ; hãy đối chiếu trước khi thay thế.",
            );
            return;
          }
          base = remote;
          current.current.change(result.settings);
          await saveLocal(path + ":base:" + owner, { version, raw: base });
        } else {
          version = result.version;
          ready = true;
          base = "";
          needsPush = true;
        }
      } catch {
        /* cached state remains available */
      } finally {
        pulling = false;
        if (needsPush && isCurrent() && ready && !conflict) void push();
      }
    };
    void pull();
    const run = () => {
      void pull();
      if (path === "/api/risk-settings")
        void fetch("/api/classic-archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedOwner: owner }),
        }).catch(() => {});
    };
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    const timer = setInterval(run, 30000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      pump.current = async () => {};
    };
  }, [owner, path]);
  useEffect(() => {
    const timer = setTimeout(() => void pump.current(), 800);
    return () => clearTimeout(timer);
  }, [settings, owner]);
}

export function useSharedRisk(
  owner: string | undefined,
  settings: RiskSettings,
  change: (s: RiskSettings) => void,
  notify: (m: string) => void,
) {
  useSharedValue(
    owner,
    settings,
    change,
    notify,
    "/api/risk-settings",
    DEFAULT_RISK,
  );
}
export function useSharedNotes(
  owner: string | undefined,
  notes: string,
  change: (s: string) => void,
  notify: (m: string) => void,
  template: string,
) {
  useSharedValue(owner, notes, change, notify, "/api/journal-notes", template);
}
