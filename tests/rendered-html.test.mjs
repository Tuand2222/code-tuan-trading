import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders production HTML without development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/legacy", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /Xem nhật ký cũ|Xem bản minh họa cũ|Bản xem trước Chặng 2/);
  assert.match(html, /Đã gộp về một ứng dụng/);
  assert.match(html, /href="\/v6\/#settings"/);
});

test("v6 routes serve isolated assets with security headers and preserve missing asset status", async () => {
  const { default: worker } = await import(new URL('../dist/server/index.js', import.meta.url));
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const seen = [];
  const env = { ASSETS: { fetch: async request => {
    seen.push(new URL(request.url).pathname);
    return new Response('asset', { status: request.url.endsWith('missing.js') ? 404 : 200 });
  } } };
  const redirect = await worker.fetch(new Request('https://example.com/v6?demo=1'), env, ctx);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), 'https://example.com/v6/?demo=1');
  const index = await worker.fetch(new Request('https://example.com/v6/'), env, ctx);
  assert.equal(index.status, 200);
  assert.equal(seen[0], '/v6/app-shell.txt');
  assert.equal(index.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(index.headers.get('cache-control'), 'no-cache');
  assert.match(index.headers.get('content-security-policy'), /worker-src 'self' blob:/);
  const missing = await worker.fetch(new Request('https://example.com/v6/missing.js'), env, ctx);
  assert.equal(missing.status, 404);
  assert.equal(seen[1], '/v6/missing.js');
});

test('root opens the consolidated application on the existing origin',async()=>{const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url));const response=await worker.fetch(new Request('https://example.com/?demo=1'),{},{});assert.equal(response.status,308);assert.equal(response.headers.get('location'),'https://example.com/v6/?demo=1');});
