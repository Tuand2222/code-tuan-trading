// Artifact validation runs under Node, while production runs in Cloudflare Workers.
// Route handlers only read this binding during a request, so an empty import-time
// stub is enough to verify the generated Worker's module shape safely.
export const env = Object.freeze({});
export const waitUntil = (promise) => void Promise.resolve(promise).catch(() => undefined);
