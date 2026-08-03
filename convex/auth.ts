import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { username } from "better-auth/plugins";
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
  const googleEnabled = Boolean(googleClientId && googleClientSecret);

  return betterAuth({
    baseURL: process.env["CONVEX_SITE_URL"] as string,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    account: {
      accountLinking: {
        enabled: true,
        // Google confirms email ownership; allow linking to an existing
        // email/password user with the same address (including when that
        // local account has not completed email verification yet).
        trustedProviders: googleEnabled ? ["google"] : [],
      },
    },
    ...(googleEnabled
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId!,
              clientSecret: googleClientSecret!,
            },
          },
        }
      : {}),
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
      }),
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  });
};
