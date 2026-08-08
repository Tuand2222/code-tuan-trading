const cloudflareWorkersStub = new URL(
  "./cloudflare-workers-validation-stub.mjs",
  import.meta.url,
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: cloudflareWorkersStub, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
