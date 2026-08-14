import type { ConsentTicketPayload } from "./crypto";

type Entry = {
  ticket: string;
  payload: ConsentTicketPayload;
  expiresAt: number;
};

/** Opaque consent ids → signed tickets (avoids putting HMAC tickets in URLs). */
const store = new Map<string, Entry>();

export function putConsent(
  id: string,
  ticket: string,
  payload: ConsentTicketPayload,
  ttlMs: number,
): void {
  prune();
  store.set(id, {
    ticket,
    payload,
    expiresAt: Date.now() + ttlMs,
  });
}

export function takeConsent(id: string): Entry | null {
  prune();
  const entry = store.get(id);
  if (!entry) return null;
  store.delete(id);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

function prune(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt < now) store.delete(id);
  }
}
