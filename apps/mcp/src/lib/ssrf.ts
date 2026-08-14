/** Block SSRF to private / link-local / metadata addresses. */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

export function isPrivateIpv4(hostname: string): boolean {
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

export function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "::1" ||
    h === "::" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80") ||
    (h.startsWith("::ffff:") && isPrivateIpv4(h.slice("::ffff:".length)))
  );
}

export function isPrivateIpAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) return isPrivateIpv4(address);
  if (v === 6) return isPrivateIpv6(address);
  return true; // unknown → block
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

  return url;
}

/** Resolve DNS and reject private/link-local answers (mitigates DNS rebinding). */
export async function assertSafeResolvedUrl(
  raw: string,
  resolveDns: (
    host: string,
  ) => Promise<Array<{ address: string; family: number }> > = (host) =>
    lookup(host, { all: true, verbatim: true }),
): Promise<URL> {
  const url = assertSafeFileUrl(raw);
  const host = url.hostname;
  if (isIP(host)) {
    if (isPrivateIpAddress(host)) {
      throw new Error("fileUrl must not target private or link-local addresses");
    }
    return url;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await resolveDns(host);
  } catch {
    throw new Error("fileUrl host could not be resolved");
  }
  if (records.length === 0) {
    throw new Error("fileUrl host could not be resolved");
  }
  for (const rec of records) {
    if (isPrivateIpAddress(rec.address)) {
      throw new Error("fileUrl must not target private or link-local addresses");
    }
  }
  return url;
}

export async function fetchUrlWithLimit(
  rawUrl: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const url = await assertSafeResolvedUrl(rawUrl);
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
