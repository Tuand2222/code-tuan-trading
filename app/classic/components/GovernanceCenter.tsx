"use client";
import { useEffect, useState } from "react";
import type { RiskSettings } from "../../../lib/risk-analytics";
import {
  listLocal,
  readLocal,
  removeLocal,
} from "../../../lib/classic-persistence";
import type { ReportTrade } from "../../../lib/governance-report";
import type { QueuedMutation } from "../../../lib/classic-persistence";
type Props = {
  accountId: string;
  dataMode: string;
  settings: RiskSettings;
  exportReport: (kind: "xlsx" | "pdf" | "zip") => Promise<unknown>;
  queue: QueuedMutation[];
  refreshQueue: () => void;
  discardQueued: (id: string) => Promise<void>;
  onRestore: (trade?: ReportTrade) => Promise<void>;
  setSettings: (s: RiskSettings) => void;
};
export default function GovernanceCenter({
  accountId,
  setSettings,
  dataMode,
  settings,
  exportReport,
  queue,
  refreshQueue,
  discardQueued,
  onRestore,
}: Props) {
  const [prefs, setPrefs] = useState({
    enabled: false,
    cadence: "daily",
    hour: 22,
    channel: "telegram",
    chatId: "",
    email: "",
    from: "",
  });
  const [secret, setSecret] = useState(""),
    [configured, setConfigured] = useState(false),
    [status, setStatus] = useState(""),
    [trash, setTrash] = useState<
      Array<{
        id: string;
        symbol: string;
        date: string;
        version: number;
        localKey?: string;
        original?: ReportTrade;
      }>
    >([]);
  const [jobs, setJobs] = useState<
    Array<{ period: string; status: string; error?: string | null }>
  >([]);
  useEffect(() => {
    if (dataMode !== "cloud") return;
    void fetch("/api/reports/preferences")
      .then(async (r) => {
        if (r.ok) {
          const p = (await r.json()) as {
            preferences?: typeof prefs;
            configured?: boolean;
            jobs?: Array<{
              period: string;
              status: string;
              error?: string | null;
            }>;
            error?: string;
          };
          if (p.preferences) setPrefs((v) => ({ ...v, ...p.preferences }));
          setConfigured(!!p.configured);
          setJobs(p.jobs ?? []);
        }
      })
      .catch(() => undefined);
  }, [dataMode]);
  const save = async () => {
    setStatus("Đang lưu...");
    try {
      const r = await fetch("/api/reports/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: prefs,
          riskSettings: settings,
          secret: secret || undefined,
        }),
      });
      const p = (await r.json()) as {
        preferences?: typeof prefs;
        configured?: boolean;
        error?: string;
      };
      if (!r.ok) throw Error(p.error ?? "Không thể lưu");
      setSecret("");
      setConfigured(!!p.configured);
      setStatus(
        "Đã lưu tùy chọn. Chỉ gửi khi bạn bật và cấu hình đủ kênh nhận.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Không thể lưu.");
    }
  };
  const loadTrash = async () => {
    const local = await listLocal<{ trade: ReportTrade; deletedAt: string }>(
      "trash:" + accountId + ":",
    );
    const items = local
      .filter(
        (r) => Date.now() - Date.parse(r.value.deletedAt) <= 30 * 86400000,
      )
      .map((r) => ({
        id: r.value.trade.id,
        symbol: r.value.trade.symbol,
        date: r.value.trade.date,
        version: 0,
        localKey: r.key,
        original: r.value.trade,
      }));
    if (dataMode === "cloud") {
      const r = await fetch("/api/trades?trash=1");
      if (r.ok) {
        const p = (await r.json()) as { trades: typeof trash };
        setTrash([
          ...p.trades,
          ...items.filter((x) => !p.trades.some((t) => t.id === x.id)),
        ]);
        return;
      }
    }
    setTrash(items);
  };
  return (
    <section className="governance-center">
      <section className="cockpit-panel">
        <span className="eyebrow">BÁO CÁO & BẢO TOÀN DỮ LIỆU</span>
        <h2>Kết quả luôn ở trong tay bạn</h2>
        <label className="cockpit-check">
          <input
            type="checkbox"
            checked={settings.weeklyAutoPack !== false}
            onChange={(e) =>
              setSettings({ ...settings, weeklyAutoPack: e.target.checked })
            }
          />
          Tự tạo gói cuối tuần khi mở web sau 22h Chủ nhật (múi giờ tài khoản)
        </label>
        <div className="report-actions">
          <button
            className="gold-button compact"
            onClick={() => void exportReport("xlsx")}
          >
            Excel · 5 trang tính
          </button>
          <button
            className="ghost-button"
            onClick={() => void exportReport("pdf")}
          >
            PDF · 1 trang
          </button>
          <button
            className="ghost-button"
            onClick={() => void exportReport("zip")}
          >
            Sao lưu JSON + CSV (ZIP)
          </button>
        </div>
        <p>
          Excel dùng cùng phép tính với buồng lái; dòng thiếu dữ kiện để trống.
          Bản sao không có khóa API, token hoặc mật khẩu kết nối.
        </p>
      </section>
      <section className="cockpit-panel">
        <h3>Hàng đợi đồng bộ · {queue.length} mục</h3>
        {queue.length === 0 ? (
          <p>Không có thay đổi đang chờ.</p>
        ) : (
          queue.map((item) => (
            <article className="queue-item" key={item.id}>
              <b>
                {item.method} ·{" "}
                {item.status === "conflict" ? "Cần đối soát" : "Chờ kết nối"}
              </b>
              <p>
                {item.error ??
                  "Tự thử lại khi có mạng và tài khoản đã đăng nhập."}
              </p>
              <button
                onClick={() => {
                  const b = new Blob([JSON.stringify(item, null, 2)], {
                      type: "application/json",
                    }),
                    url = URL.createObjectURL(b),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = "sync-conflict.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Tải dữ kiện để đối soát
              </button>
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      "Bỏ yêu cầu này khỏi hàng đợi? Bản ghi trên thiết bị vẫn được giữ.",
                    )
                  )
                    return;
                  await discardQueued(item.id);
                  refreshQueue();
                }}
              >
                Bỏ yêu cầu chờ
              </button>
            </article>
          ))
        )}
      </section>
      <section className="cockpit-panel">
        <h3>Báo cáo định kỳ qua Telegram / email</h3>
        <p>
          {dataMode === "cloud"
            ? "Cấu hình kênh nhận riêng, lưu khóa dưới dạng mã hóa."
            : "Đăng nhập để lưu cấu hình báo cáo định kỳ vào cloud."}{" "}
          Lịch chạy phía máy chủ cần được kích hoạt; lưu cấu hình chưa có nghĩa
          đã gửi báo cáo.
        </p>
        <div className="cockpit-form">
          <label>
            Kênh
            <select
              value={prefs.channel}
              onChange={(e) => setPrefs({ ...prefs, channel: e.target.value })}
            >
              <option value="telegram">Telegram Bot</option>
              <option value="email">Email · Resend</option>
            </select>
          </label>
          <label>
            Chu kỳ
            <select
              value={prefs.cadence}
              onChange={(e) => setPrefs({ ...prefs, cadence: e.target.value })}
            >
              <option value="daily">Hằng ngày</option>
              <option value="weekly">Chủ nhật hằng tuần</option>
            </select>
          </label>
          <label>
            Giờ gửi ({settings.timezone})
            <input
              type="number"
              min="0"
              max="23"
              value={prefs.hour}
              onChange={(e) =>
                setPrefs({ ...prefs, hour: Number(e.target.value) })
              }
            />
          </label>
          {prefs.channel === "telegram" ? (
            <label>
              Telegram chat ID
              <input
                value={prefs.chatId}
                onChange={(e) => setPrefs({ ...prefs, chatId: e.target.value })}
              />
            </label>
          ) : (
            <>
              <label>
                Email nhận
                <input
                  type="email"
                  value={prefs.email}
                  onChange={(e) =>
                    setPrefs({ ...prefs, email: e.target.value })
                  }
                />
              </label>
              <label>
                Email gửi đã xác minh với Resend
                <input
                  type="email"
                  value={prefs.from}
                  onChange={(e) => setPrefs({ ...prefs, from: e.target.value })}
                />
              </label>
            </>
          )}
          <label>
            {prefs.channel === "telegram" ? "Bot token" : "Resend API key"}
            {configured ? " (đã lưu, để trống để giữ)" : ""}
            <input
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
        </div>
        <label className="cockpit-check">
          <input
            type="checkbox"
            checked={prefs.enabled}
            onChange={(e) => setPrefs({ ...prefs, enabled: e.target.checked })}
          />
          Tôi bật gửi báo cáo tới địa chỉ/chat ID ở trên
        </label>
        <button
          disabled={dataMode !== "cloud"}
          className="gold-button compact"
          onClick={() => void save()}
        >
          Lưu cấu hình báo cáo
        </button>
        <p role="status">{status}</p>
        {jobs.map((j) => (
          <p key={j.period}>
            {j.period} · {j.status}
            {j.error ? " · " + j.error : ""}
          </p>
        ))}
      </section>
      <section className="cockpit-panel">
        <h3>Thùng rác · cửa sổ khôi phục 30 ngày</h3>
        <button
          className="ghost-button"
          onClick={async () => {
            const restored = await readLocal<RiskSettings>(
              "restored-risk:" + accountId,
            );
            if (restored) {
              if (
                confirm(
                  "Áp dụng cấu hình rủi ro trong bản sao? Cấu hình hiện tại được giữ trong bản trước khôi phục.",
                )
              ) {
                setSettings({ ...settings, ...restored });
                setStatus("Đã áp dụng cấu hình rủi ro khôi phục.");
              }
            } else setStatus("Chưa có cấu hình rủi ro từ bản sao ZIP/JSON.");
          }}
        >
          Áp dụng cấu hình từ bản sao đã nhập
        </button>
        <button className="ghost-button" onClick={() => void loadTrash()}>
          Xem giao dịch đã xóa
        </button>
        {trash.map((t) => (
          <p key={t.id}>
            {t.date} · {t.symbol}{" "}
            <button
              onClick={async () => {
                if (t.localKey && t.original) {
                  await onRestore(t.original);
                  await removeLocal(t.localKey);
                  await loadTrash();
                  return;
                }
                const r = await fetch("/api/trades", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    trade: { id: t.id, version: t.version },
                    restore: true,
                  }),
                });
                if (r.ok) {
                  await loadTrash();
                  await onRestore();
                } else setStatus("Khôi phục thất bại: " + (await r.text()));
              }}
            >
              Khôi phục
            </button>
          </p>
        ))}
      </section>
      <details className="cockpit-settings">
        <summary>Tài khoản & bảo mật</summary>
        <p>
          Dữ liệu cloud được phân quyền theo tài khoản đăng nhập. Khóa sàn chỉ
          đọc lịch sử, lưu mã hóa trên máy chủ. Lưu nháp và hàng đợi được tách
          riêng theo tài khoản trên thiết bị.
        </p>
        <a href="/dang-nhap">Đăng nhập / quản lý tài khoản</a> ·{" "}
        <a href="/bao-mat">Chính sách bảo mật</a>
      </details>
    </section>
  );
}
