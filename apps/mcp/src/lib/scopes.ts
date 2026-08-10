import type { AuthUser } from "./convex";

export function requireScope(user: AuthUser, scope: "nook.read" | "nook.write") {
  if (!user.scopes.includes(scope)) {
    throw new Error(`Missing required scope: ${scope}`);
  }
}
