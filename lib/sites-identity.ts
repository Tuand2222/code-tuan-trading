// These headers are trusted only behind Sites dispatch with native auth enabled.
export function sitesIdentity(headers: Headers, enabled: boolean) {
  if (!enabled) return null;
  const id = headers.get("oai-authenticated-user-id");
  const email = headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!id || !email) return null;
  let name = headers.get("oai-authenticated-user-full-name") || email;
  if (headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { name = decodeURIComponent(name); } catch { name = email; }
  }
  return { id: `sites:${id}`, email, name };
}
