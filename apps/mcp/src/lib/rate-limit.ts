type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/** Simple fixed-window rate limit. Returns true if allowed. */
export function rateLimitAllow(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= max) return false;
  existing.count += 1;
  return true;
}

export function rateLimitHeaders(
  key: string,
  max: number,
): Record<string, string> {
  const b = buckets.get(key);
  const remaining = b ? Math.max(0, max - b.count) : max;
  return {
    "x-ratelimit-limit": String(max),
    "x-ratelimit-remaining": String(remaining),
  };
}
