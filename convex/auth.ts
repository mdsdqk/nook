import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { buildTrustedOrigins } from "./lib/trustedOrigins";

declare const process: {
  env: Record<string, string | undefined>;
};

const siteUrl = process.env["SITE_URL"]!;
const trustedOrigins = buildTrustedOrigins(
  siteUrl,
  process.env["TRUSTED_ORIGINS"],
);

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const googleClientId = process.env["GOOGLE_CLIENT_ID"];
  const googleClientSecret = process.env["GOOGLE_CLIENT_SECRET"];

  return betterAuth({
    baseURL: process.env["CONVEX_SITE_URL"] as string,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    ...(googleClientId && googleClientSecret
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          },
        }
      : {}),
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  });
};
