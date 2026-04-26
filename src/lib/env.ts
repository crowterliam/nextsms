declare global {
  var __cloudflareEnv: CloudflareEnv | undefined;
}

export function getEnv(): CloudflareEnv {
  const env = globalThis.__cloudflareEnv;
  if (!env) {
    throw new Error('Cloudflare environment bindings not available. Ensure worker/index.ts stores env on globalThis.');
  }
  return env;
}
