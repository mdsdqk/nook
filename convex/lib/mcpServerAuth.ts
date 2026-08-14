/**
 * Shared secret between apps/mcp and Convex mcpOauth/mcpApi.
 * Set the same value via MCP process env and `bunx convex env set MCP_SERVER_SECRET`.
 *
 * Uses Web Crypto (Convex default runtime) — do not import `node:crypto` here.
 */
export async function assertMcpServerSecret(
  serverSecret: string,
): Promise<void> {
  const expected = process.env.MCP_SERVER_SECRET;
  if (!expected || expected.length < 16) {
    throw new Error("MCP_SERVER_SECRET is not configured on Convex");
  }

  const enc = new TextEncoder();
  const [aBuf, bBuf] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(serverSecret)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const a = new Uint8Array(aBuf);
  const b = new Uint8Array(bBuf);

  // Digests are fixed-length; constant-time compare.
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  if (diff !== 0) {
    throw new Error("Unauthorized");
  }
}
