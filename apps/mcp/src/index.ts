import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveBearerToken } from "./lib/convex";
import { registerTools } from "./tools/register";
import {
  authorizationServerMetadata,
  handleApprove,
  handleAuthorize,
  handleOptions,
  handleRegister,
  handleToken,
  oauthChallengeHeaders,
  protectedResourceMetadata,
} from "./oauth/routes";
import { config, authUiOrigin } from "./lib/config";

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": authUiOrigin(),
      vary: "Origin",
      ...headers,
    },
  });
}

async function handleMcp(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return handleOptions(req);

  const user = await resolveBearerToken(req.headers.get("authorization"));
  if (!user) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": authUiOrigin(),
          vary: "Origin",
          ...oauthChallengeHeaders(),
        },
      },
    );
  }

  const mcpServer = new McpServer({ name: "nook", version: "0.1.0" });
  registerTools(mcpServer, () => user);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await mcpServer.connect(transport);
  return transport.handleRequest(req);
}

export async function startServer(): Promise<void> {
  const server = Bun.serve({
    port: config.port,
    async fetch(req) {
      try {
        return await route(req);
      } catch (err) {
        console.error(err);
        return json(
          {
            error: "server_error",
            error_description: "Internal server error",
          },
          500,
        );
      }
    },
  });

  console.log(`Nook MCP listening on ${server.url}`);
  console.log(`  MCP endpoint: ${config.mcpPublicUrl}/mcp`);
  console.log(`  Auth UI:      ${config.authUiPublicUrl}`);
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  if (path === "/health") {
    return json({ ok: true, service: "nook-mcp" });
  }

  if (path === "/.well-known/oauth-protected-resource") {
    return protectedResourceMetadata();
  }
  if (path === "/.well-known/oauth-authorization-server") {
    return authorizationServerMetadata();
  }
  if (path === "/.well-known/oauth-protected-resource/mcp") {
    return protectedResourceMetadata();
  }

  if (path === "/register" && req.method === "POST") {
    return handleRegister(req);
  }
  if (path === "/authorize" && req.method === "GET") {
    return handleAuthorize(req);
  }
  if (path === "/approve" && req.method === "POST") {
    return handleApprove(req);
  }
  if (path === "/token" && req.method === "POST") {
    return handleToken(req);
  }

  if (path === "/mcp") {
    return handleMcp(req);
  }

  return new Response("Not Found", { status: 404 });
}

await startServer();
