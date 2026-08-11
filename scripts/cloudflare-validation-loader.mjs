const cloudflareWorkersStub = new URL(
  "./cloudflare-workers-validation-stub.mjs",
  import.meta.url,
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: cloudflareWorkersStub, shortCircuit: true };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND"
      && specifier.startsWith(".")
      && !/\.[cm]?[jt]sx?$/.test(specifier)
    ) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
}
