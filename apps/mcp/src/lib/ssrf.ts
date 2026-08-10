/** Block SSRF to private / link-local / metadata addresses. */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIpv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true; // treat invalid as blocked
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "::1" ||
    h === "::" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80")
  );
}

export function assertSafeFileUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid fileUrl");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("fileUrl must be http(s)");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("fileUrl host is not allowed");
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("fileUrl host is not allowed");
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new Error("fileUrl must not target private or link-local addresses");
  }

  // Prefer HTTPS in production; allow http only for non-private hosts (already checked).
  return url;
}

export async function fetchUrlWithLimit(
  rawUrl: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const url = assertSafeFileUrl(rawUrl);
  const res = await fetch(url, {
    redirect: "error",
    headers: { accept: "*/*" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch fileUrl: HTTP ${res.status}`);
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`File exceeds max size of ${maxBytes} bytes`);
  }

  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new Error(`File exceeds max size of ${maxBytes} bytes`);
    }
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`File exceeds max size of ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
