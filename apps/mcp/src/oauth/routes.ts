import { config, mcpResourceUrl, authUiOrigin } from "../lib/config";
import { getConvex, resolveUserFromBetterAuthSession } from "../lib/convex";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";
import {
  randomToken,
  sha256Hex,
  signConsentTicket,
  verifyConsentTicket,
  timingSafeEqualStr,
} from "../lib/crypto";
import { clientIp, rateLimitAllow } from "../lib/rate-limit";
import { putConsent, takeConsent } from "../lib/consent-store";
import { SUPPORTED_SCOPES, resolveGrantedScopes } from "../lib/scopes";

function serverAuth() {
  return { serverSecret: config.serverSecret() };
}

function json(
  data: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(undefined),
      ...headers,
    },
  });
}

function corsHeaders(reqOrigin: string | null | undefined): HeadersInit {
  const allowOrigin =
    reqOrigin && reqOrigin === authUiOrigin() ? reqOrigin : authUiOrigin();
  // Metadata/token endpoints are called by non-browser clients; still echo
  // Spiky origin when present so browser approve works without *.
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, content-type, mcp-session-id",
    "access-control-expose-headers": "www-authenticate, mcp-session-id",
    vary: "Origin",
  };
}

export function oauthChallengeHeaders(): HeadersInit {
  const resourceMetadata = `${config.mcpPublicUrl}/.well-known/oauth-protected-resource`;
  return {
    "WWW-Authenticate": `Bearer realm="nook", resource_metadata="${resourceMetadata}"`,
  };
}

export function handleOptions(req?: Request): Response {
  const origin = req?.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export function protectedResourceMetadata(): Response {
  return json({
    resource: mcpResourceUrl(),
    authorization_servers: [config.mcpPublicUrl],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ["header"],
  });
}

export function authorizationServerMetadata(): Response {
  return json({
    issuer: config.mcpPublicUrl,
    authorization_endpoint: `${config.mcpPublicUrl}/authorize`,
    token_endpoint: `${config.mcpPublicUrl}/token`,
    registration_endpoint: `${config.mcpPublicUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: [...SUPPORTED_SCOPES],
  });
}

function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  if (
    config.allowInsecureLocalhostRedirects &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]")
  ) {
    return true;
  }
  return false;
}

function rateLimited(req: Request, bucket: string): Response | null {
  const key = `${bucket}:${clientIp(req)}`;
  if (
    !rateLimitAllow(key, config.rateLimitMax, config.rateLimitWindowMs)
  ) {
    return json({ error: "slow_down", error_description: "Rate limit exceeded" }, 429);
  }
  return null;
}

export async function handleRegister(req: Request): Promise<Response> {
  const limited = rateLimited(req, "register");
  if (limited) return limited;

  if (config.dcrSharedSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${config.dcrSharedSecret}`;
    if (!timingSafeEqualStr(auth, expected)) {
      return json({ error: "invalid_client", error_description: "DCR unauthorized" }, 401);
    }
  } else if (!config.allowOpenDcr) {
    return json(
      {
        error: "invalid_client",
        error_description:
          "Dynamic client registration is disabled. Set MCP_DCR_SHARED_SECRET or MCP_ALLOW_OPEN_DCR=true for local dev.",
      },
      401,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_client_metadata" }, 400);
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (redirectUris.length === 0) {
    return json({ error: "invalid_redirect_uri" }, 400);
  }
  if (!redirectUris.every(isAllowedRedirectUri)) {
    return json(
      {
        error: "invalid_redirect_uri",
        error_description:
          "redirect_uris must be https (or http localhost in development)",
      },
      400,
    );
  }

  const clientId = randomToken(16);
  const tokenEndpointAuthMethod =
    typeof body.token_endpoint_auth_method === "string"
      ? body.token_endpoint_auth_method
      : "none";

  let clientSecret: string | undefined;
  let clientSecretHash: string | undefined;
  if (tokenEndpointAuthMethod !== "none") {
    clientSecret = randomToken(24);
    clientSecretHash = sha256Hex(clientSecret);
  }

  const clientName =
    typeof body.client_name === "string" ? body.client_name : undefined;
  const grantTypes = Array.isArray(body.grant_types)
    ? body.grant_types.filter((g): g is string => typeof g === "string")
    : ["authorization_code", "refresh_token"];

  await getConvex().mutation(api.mcpOauth.registerClient, {
    ...serverAuth(),
    clientId,
    ...(clientSecretHash ? { clientSecretHash } : {}),
    ...(clientName ? { clientName } : {}),
    redirectUris,
    grantTypes,
    tokenEndpointAuthMethod,
  });

  return json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      ...(clientSecret ? { client_secret: clientSecret } : {}),
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      ...(clientName ? { client_name: clientName } : {}),
    },
    201,
  );
}

export async function handleAuthorize(req: Request): Promise<Response> {
  const limited = rateLimited(req, "authorize");
  if (limited) return limited;

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const resource = url.searchParams.get("resource");
  const scope = url.searchParams.get("scope");

  if (!clientId || !redirectUri || responseType !== "code" || !codeChallenge) {
    return json(
      {
        error: "invalid_request",
        error_description:
          "client_id, redirect_uri, response_type=code, and code_challenge are required",
      },
      400,
    );
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return json(
      {
        error: "invalid_request",
        error_description: "Only S256 PKCE is supported",
      },
      400,
    );
  }

  const client = await getConvex().query(api.mcpOauth.getClient, { clientId });
  if (!client) {
    return json({ error: "invalid_client" }, 400);
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return json(
      { error: "invalid_request", error_description: "redirect_uri mismatch" },
      400,
    );
  }
  if (!isAllowedRedirectUri(redirectUri)) {
    return json({ error: "invalid_request", error_description: "redirect_uri not allowed" }, 400);
  }

  const ticketPayload = {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256" as const,
    ...(resource ? { resource } : {}),
    ...(scope ? { scope } : {}),
    ...(state ? { state } : {}),
    exp: Date.now() + config.consentTicketTtlSec * 1000,
  };
  const ticket = signConsentTicket(ticketPayload, config.consentSecret());
  const consentId = randomToken(16);
  putConsent(
    consentId,
    ticket,
    ticketPayload,
    config.consentTicketTtlSec * 1000,
  );

  const consent = new URL(`${config.authUiPublicUrl}/oauth/consent`);
  consent.searchParams.set("client_id", clientId);
  consent.searchParams.set("redirect_uri", redirectUri);
  consent.searchParams.set("code_challenge", codeChallenge);
  consent.searchParams.set("code_challenge_method", "S256");
  consent.searchParams.set("consent_id", consentId);
  if (state) consent.searchParams.set("state", state);
  if (resource) consent.searchParams.set("resource", resource);
  if (scope) consent.searchParams.set("scope", scope);
  if (client.clientName) consent.searchParams.set("client_name", client.clientName);

  return Response.redirect(consent.toString(), 302);
}

export async function handleApprove(req: Request): Promise<Response> {
  const limited = rateLimited(req, "approve");
  if (limited) return limited;

  const origin = req.headers.get("origin");
  // Browser calls from Spiky must come from AUTH_UI origin (when Origin is sent).
  if (origin && origin !== authUiOrigin()) {
    return json(
      { error: "invalid_request", error_description: "Origin not allowed" },
      403,
      corsHeaders(origin),
    );
  }

  let body: {
    client_id?: string;
    redirect_uri?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    session_token?: string;
    resource?: string;
    scope?: string;
    state?: string;
    consent_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_request" }, 400, corsHeaders(origin));
  }

  if (
    !body.client_id ||
    !body.redirect_uri ||
    !body.code_challenge ||
    !body.session_token ||
    !body.consent_id
  ) {
    return json(
      {
        error: "invalid_request",
        error_description:
          "consent_id, session_token, and OAuth fields are required",
      },
      400,
      corsHeaders(origin),
    );
  }

  const stored = takeConsent(body.consent_id);
  if (!stored) {
    return json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired consent",
      },
      400,
      corsHeaders(origin),
    );
  }

  const ticket = verifyConsentTicket(stored.ticket, config.consentSecret());
  if (!ticket) {
    return json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired consent ticket",
      },
      400,
      corsHeaders(origin),
    );
  }

  if (
    ticket.client_id !== body.client_id ||
    ticket.redirect_uri !== body.redirect_uri ||
    ticket.code_challenge !== body.code_challenge
  ) {
    return json(
      {
        error: "invalid_request",
        error_description: "Request does not match consent ticket",
      },
      400,
      corsHeaders(origin),
    );
  }

  const session = await resolveUserFromBetterAuthSession(body.session_token);
  if (!session) {
    return json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired Better Auth session",
      },
      401,
      corsHeaders(origin),
    );
  }

  const client = await getConvex().query(api.mcpOauth.getClient, {
    clientId: body.client_id,
  });
  if (!client) {
    return json({ error: "invalid_client" }, 400, corsHeaders(origin));
  }
  if (!client.redirectUris.includes(body.redirect_uri)) {
    return json(
      { error: "invalid_request", error_description: "redirect_uri mismatch" },
      400,
      corsHeaders(origin),
    );
  }

  const ticketCeiling = resolveGrantedScopes(ticket.scope);
  if (!ticketCeiling) {
    return json(
      { error: "invalid_scope", error_description: "No valid scopes on consent" },
      400,
      corsHeaders(origin),
    );
  }
  const scopes = resolveGrantedScopes(body.scope, ticketCeiling);
  if (!scopes) {
    return json(
      {
        error: "invalid_scope",
        error_description: "Requested scopes exceed consent",
      },
      400,
      corsHeaders(origin),
    );
  }

  const code = randomToken(32);
  const codeHash = sha256Hex(code);

  await getConvex().mutation(api.mcpOauth.createAuthorizationCode, {
    ...serverAuth(),
    codeHash,
    clientId: body.client_id,
    userId: session,
    redirectUri: body.redirect_uri,
    codeChallenge: body.code_challenge,
    codeChallengeMethod: body.code_challenge_method ?? "S256",
    ...(ticket.resource || body.resource
      ? { resource: body.resource ?? ticket.resource }
      : {}),
    scopes,
    expiresAt: Date.now() + config.authCodeTtlSec * 1000,
  });

  const redirect = new URL(body.redirect_uri);
  redirect.searchParams.set("code", code);
  const state = body.state ?? ticket.state;
  if (state) redirect.searchParams.set("state", state);

  return json({ redirect_to: redirect.toString() }, 200, corsHeaders(origin));
}

export async function handleToken(req: Request): Promise<Response> {
  const limited = rateLimited(req, "token");
  if (limited) return limited;

  const contentType = req.headers.get("content-type") ?? "";
  let params: URLSearchParams;
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Record<string, string>;
    params = new URLSearchParams(body);
  } else {
    params = new URLSearchParams(await req.text());
  }

  const grantType = params.get("grant_type");
  if (grantType === "refresh_token") {
    return handleRefreshToken(params);
  }
  if (grantType !== "authorization_code") {
    return json({ error: "unsupported_grant_type" }, 400);
  }

  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const clientId = params.get("client_id");
  const codeVerifier = params.get("code_verifier");
  const resource = params.get("resource");

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return json({ error: "invalid_request" }, 400);
  }

  const consumed = await getConvex().mutation(
    api.mcpOauth.consumeAuthorizationCode,
    {
      ...serverAuth(),
      codeHash: sha256Hex(code),
      clientId,
      redirectUri,
      codeVerifier,
    },
  );
  if (!consumed) {
    return json({ error: "invalid_grant" }, 400);
  }

  return issueTokenPair({
    clientId,
    userId: consumed.userId,
    scopes: consumed.scopes,
    resource: resource ?? consumed.resource ?? mcpResourceUrl(),
  });
}

async function handleRefreshToken(params: URLSearchParams): Promise<Response> {
  const refreshToken = params.get("refresh_token");
  const clientId = params.get("client_id");
  if (!refreshToken || !clientId) {
    return json({ error: "invalid_request" }, 400);
  }

  const accessToken = randomToken(32);
  const newRefresh = randomToken(32);
  const rotated = await getConvex().mutation(api.mcpOauth.rotateRefreshToken, {
    ...serverAuth(),
    refreshTokenHash: sha256Hex(refreshToken),
    clientId,
    newAccessTokenHash: sha256Hex(accessToken),
    newRefreshTokenHash: sha256Hex(newRefresh),
    accessExpiresAt: Date.now() + config.accessTokenTtlSec * 1000,
    refreshExpiresAt: Date.now() + config.refreshTokenTtlSec * 1000,
  });
  if (!rotated) {
    return json({ error: "invalid_grant" }, 400);
  }

  return json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: config.accessTokenTtlSec,
    refresh_token: newRefresh,
    scope: rotated.scopes.join(" "),
  });
}

async function issueTokenPair(args: {
  clientId: string;
  userId: Id<"users">;
  scopes: string[];
  resource: string;
}): Promise<Response> {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  const expiresIn = config.accessTokenTtlSec;

  await getConvex().mutation(api.mcpOauth.storeAccessToken, {
    ...serverAuth(),
    tokenHash: sha256Hex(accessToken),
    clientId: args.clientId,
    userId: args.userId,
    scopes: args.scopes,
    resource: args.resource,
    expiresAt: Date.now() + expiresIn * 1000,
    refreshTokenHash: sha256Hex(refreshToken),
    refreshExpiresAt: Date.now() + config.refreshTokenTtlSec * 1000,
  });

  return json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: args.scopes.join(" "),
  });
}
