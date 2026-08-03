import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

if (!siteUrl) {
  throw new Error(
    "VITE_CONVEX_SITE_URL is required. Set it in apps/spiky/.env.local",
  );
}

export const authClient = createAuthClient({
  baseURL: siteUrl,
  plugins: [usernameClient(), convexClient(), crossDomainClient()],
});

export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}
