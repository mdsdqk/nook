import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertMcpServerSecret } from "./lib/mcpServerAuth";

const SUPPORTED_SCOPES = ["nook.read", "nook.write"] as const;

function requireSupportedScopes(scopes: string[]): string[] {
  const granted = scopes.filter((s) =>
    (SUPPORTED_SCOPES as readonly string[]).includes(s),
  );
  if (granted.length === 0) {
    throw new Error("At least one supported scope is required");
  }
  return granted;
}

const serverSecretArg = {
  serverSecret: v.string(),
};

export const registerClient = mutation({
  args: {
    ...serverSecretArg,
    clientId: v.string(),
    clientSecretHash: v.optional(v.string()),
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    grantTypes: v.array(v.string()),
    tokenEndpointAuthMethod: v.string(),
  },
  returns: v.object({
    clientId: v.string(),
  }),
  handler: async (ctx, args) => {
    await assertMcpServerSecret(args.serverSecret);
    if (args.redirectUris.length === 0) {
      throw new Error("At least one redirect_uri is required");
    }
    const existing = await ctx.db
      .query("mcpOauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (existing) {
      throw new Error("client_id already registered");
    }
    await ctx.db.insert("mcpOauthClients", {
      clientId: args.clientId,
      ...(args.clientSecretHash
        ? { clientSecretHash: args.clientSecretHash }
        : {}),
      ...(args.clientName ? { clientName: args.clientName } : {}),
      redirectUris: args.redirectUris,
      grantTypes: args.grantTypes,
      tokenEndpointAuthMethod: args.tokenEndpointAuthMethod,
      createdAt: Date.now(),
    });
    return { clientId: args.clientId };
  },
});

/** Public client metadata for authorize (no secrets). */
export const getClient = query({
  args: { clientId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("mcpOauthClients"),
      clientId: v.string(),
      clientName: v.optional(v.string()),
      redirectUris: v.array(v.string()),
      grantTypes: v.array(v.string()),
      tokenEndpointAuthMethod: v.string(),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("mcpOauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (!client) return null;
    return {
      _id: client._id,
      clientId: client.clientId,
      ...(client.clientName ? { clientName: client.clientName } : {}),
      redirectUris: client.redirectUris,
      grantTypes: client.grantTypes,
      tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
      createdAt: client.createdAt,
    };
  },
});

export const createAuthorizationCode = mutation({
  args: {
    ...serverSecretArg,
    codeHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    codeChallengeMethod: v.string(),
    resource: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertMcpServerSecret(args.serverSecret);
    const scopes = requireSupportedScopes(args.scopes);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const client = await ctx.db
      .query("mcpOauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (!client) throw new Error("Unknown client_id");
    if (!client.redirectUris.includes(args.redirectUri)) {
      throw new Error("redirect_uri is not registered for this client");
    }
    if (args.codeChallengeMethod !== "S256") {
      throw new Error("Only S256 code_challenge_method is supported");
    }

    await ctx.db.insert("mcpOauthCodes", {
      codeHash: args.codeHash,
      clientId: args.clientId,
      userId: args.userId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      ...(args.resource ? { resource: args.resource } : {}),
      scopes,
      expiresAt: args.expiresAt,
      used: false,
    });
    return null;
  },
});

export const consumeAuthorizationCode = mutation({
  args: {
    ...serverSecretArg,
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.string(),
  },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      scopes: v.array(v.string()),
      resource: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await assertMcpServerSecret(args.serverSecret);
    const now = Date.now();
    const row = await ctx.db
      .query("mcpOauthCodes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .unique();
    if (!row || row.used) return null;
    if (row.clientId !== args.clientId) return null;
    if (row.redirectUri !== args.redirectUri) return null;
    if (row.expiresAt < now) return null;

    // Verify PKCE before marking used so a bad verifier cannot burn the code.
    if (row.codeChallengeMethod !== "S256") return null;
    const challenge = await sha256Base64Url(args.codeVerifier);
    if (challenge !== row.codeChallenge) return null;

    await ctx.db.patch(row._id, { used: true });

    return {
      userId: row.userId,
      scopes: row.scopes,
      ...(row.resource ? { resource: row.resource } : {}),
    };
  },
});

async function sha256Base64Url(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const storeAccessToken = mutation({
  args: {
    ...serverSecretArg,
    tokenHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    scopes: v.array(v.string()),
    resource: v.optional(v.string()),
    expiresAt: v.number(),
    refreshTokenHash: v.optional(v.string()),
    refreshExpiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertMcpServerSecret(args.serverSecret);
    const scopes = requireSupportedScopes(args.scopes);
    await ctx.db.insert("mcpOauthTokens", {
      tokenHash: args.tokenHash,
      clientId: args.clientId,
      userId: args.userId,
      scopes,
      ...(args.resource ? { resource: args.resource } : {}),
      expiresAt: args.expiresAt,
      ...(args.refreshTokenHash
        ? { refreshTokenHash: args.refreshTokenHash }
        : {}),
      ...(args.refreshExpiresAt !== undefined
        ? { refreshExpiresAt: args.refreshExpiresAt }
        : {}),
    });
    return null;
  },
});

export const rotateRefreshToken = mutation({
  args: {
    ...serverSecretArg,
    refreshTokenHash: v.string(),
    clientId: v.string(),
    newAccessTokenHash: v.string(),
    newRefreshTokenHash: v.string(),
    accessExpiresAt: v.number(),
    refreshExpiresAt: v.number(),
  },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      scopes: v.array(v.string()),
      resource: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await assertMcpServerSecret(args.serverSecret);
    const now = Date.now();
    const row = await ctx.db
      .query("mcpOauthTokens")
      .withIndex("by_refresh_hash", (q) =>
        q.eq("refreshTokenHash", args.refreshTokenHash),
      )
      .unique();
    if (!row) return null;
    if (row.clientId !== args.clientId) return null;
    if (row.refreshExpiresAt !== undefined && row.refreshExpiresAt < now) {
      return null;
    }

    await ctx.db.delete(row._id);
    await ctx.db.insert("mcpOauthTokens", {
      tokenHash: args.newAccessTokenHash,
      clientId: row.clientId,
      userId: row.userId,
      scopes: row.scopes,
      ...(row.resource ? { resource: row.resource } : {}),
      expiresAt: args.accessExpiresAt,
      refreshTokenHash: args.newRefreshTokenHash,
      refreshExpiresAt: args.refreshExpiresAt,
    });

    return {
      userId: row.userId,
      scopes: row.scopes,
      ...(row.resource ? { resource: row.resource } : {}),
    };
  },
});

export const resolveAccessToken = query({
  args: {
    ...serverSecretArg,
    tokenHash: v.string(),
  },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      clientId: v.string(),
      scopes: v.array(v.string()),
      resource: v.optional(v.string()),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await assertMcpServerSecret(args.serverSecret);
    const now = Date.now();
    const row = await ctx.db
      .query("mcpOauthTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!row) return null;
    if (row.expiresAt < now) return null;
    return {
      userId: row.userId,
      clientId: row.clientId,
      scopes: row.scopes,
      ...(row.resource ? { resource: row.resource } : {}),
      expiresAt: row.expiresAt,
    };
  },
});
