import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { buildTrustedOrigins } from "./lib/trustedOrigins";

declare const process: {
  env: Record<string, string | undefined>;
};

const http = httpRouter();

const siteUrl = process.env["SITE_URL"]!;
const trustedOrigins = buildTrustedOrigins(
  siteUrl,
  process.env["TRUSTED_ORIGINS"],
);

// Pass allowedOrigins explicitly: the crossDomain plugin overwrites Better Auth's
// trustedOrigins to [SITE_URL] alone, and OPTIONS needs this list for CORS.
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: trustedOrigins,
  },
});

export default http;
