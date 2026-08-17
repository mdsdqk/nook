import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Command } from "commander";
import {
  clearCredentials,
  createAuthedConvexClient,
  credentialsPath,
  readCredentials,
  writeCredentials,
  type NookCredentials,
} from "../lib/convex-auth";
import {
  buildCallbackAllowedOrigins,
  createLoginState,
  isAllowedCallbackOrigin,
  parseCallbackPayload,
} from "../lib/auth-callback";
import { printFail, printInfo, printSuccess } from "./shared";

/** Injected at bundle time for the published npm package; unset in monorepo runs. */
declare const __NOOK_DEFAULT_SPIKY_URL__: string | undefined;

const PACKAGED_SPIKY_URL =
  typeof __NOOK_DEFAULT_SPIKY_URL__ !== "undefined"
    ? __NOOK_DEFAULT_SPIKY_URL__
    : undefined;

const DEFAULT_SPIKY_URL =
  process.env["NOOK_SPIKY_URL"] ??
  PACKAGED_SPIKY_URL ??
  "http://localhost:5174";
const EXTRA_ALLOWED_ORIGINS = process.env["NOOK_SPIKY_ALLOWED_ORIGINS"];
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function createAuthCommand(): Command {
  const auth = new Command("auth").description(
    "Authenticate the CLI with Better Auth via Spiky",
  );

  auth
    .command("login")
    .description("Open Spiky in a browser and store a CLI session")
    .option("--spiky-url <url>", "Spiky origin", DEFAULT_SPIKY_URL)
    .option(
      "--timeout-ms <ms>",
      "How long to wait for browser callback",
      String(LOGIN_TIMEOUT_MS),
    )
    .action(async (opts: { spikyUrl: string; timeoutMs: string }) => {
      try {
        const timeoutMs = Number(opts.timeoutMs);
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
          throw new Error("Invalid --timeout-ms");
        }
        const credentials = await runBrowserLogin(opts.spikyUrl, timeoutMs);
        await writeCredentials(credentials);
        printSuccess(`Logged in. Credentials saved to ${credentialsPath()}`);
        printInfo(`Convex: ${credentials.convexUrl}`);
      } catch (err) {
        printFail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  auth
    .command("logout")
    .description("Remove stored CLI credentials")
    .action(async () => {
      await clearCredentials();
      printSuccess("Logged out");
    });

  auth
    .command("status")
    .description("Show CLI auth status")
    .action(async () => {
      const credentials = await readCredentials();
      if (!credentials) {
        printInfo("Not logged in");
        return;
      }

      try {
        const { client } = await createAuthedConvexClient();
        const me = await client.query(
          (await import("@nook/convex/_generated/api")).api.users.me,
          {},
        );
        if (!me) {
          printFail(
            "Session present but app user not found. Try logging in again.",
          );
          return;
        }
        printSuccess(`Logged in as ${me.email} (${me.name})`);
        printInfo(`Convex: ${credentials.convexUrl}`);
        printInfo(`Obtained: ${credentials.obtainedAt}`);
      } catch (err) {
        printFail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return auth;
}

/** Single-program entrypoints (statement / wealth) share one instance. */
export const authCommand = createAuthCommand();
async function runBrowserLogin(
  spikyUrl: string,
  timeoutMs: number,
): Promise<NookCredentials> {
  const allowedOrigins = buildCallbackAllowedOrigins(
    spikyUrl,
    EXTRA_ALLOWED_ORIGINS,
  );
  const state = createLoginState();

  return await new Promise<NookCredentials>((resolve, reject) => {
    let settled = false;
    const server = createServer((req, res) => {
      void handleRequest(req, res);
    });

    const timer = setTimeout(() => {
      fail(new Error(`Login timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function succeed(credentials: NookCredentials) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      resolve(credentials);
    }

    function fail(err: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      reject(err instanceof Error ? err : new Error(String(err)));
    }

    async function handleRequest(req: IncomingMessage, res: ServerResponse) {
      const requestOrigin = req.headers.origin;
      const originAllowed = isAllowedCallbackOrigin(
        requestOrigin,
        allowedOrigins,
      );
      // Reflect the request Origin only when allowlisted (required for
      // localhost ↔ 127.0.0.1 and LAN test hosts).
      const cors = originAllowed
        ? corsHeaders(new URL(requestOrigin!).origin)
        : undefined;

      if (req.method === "OPTIONS") {
        if (!cors) {
          res.writeHead(403, { Vary: "Origin" });
          res.end();
          return;
        }
        res.writeHead(204, cors);
        res.end();
        return;
      }

      if (req.method !== "POST" || req.url !== "/callback") {
        res.writeHead(404, cors ?? { Vary: "Origin" });
        res.end("Not found");
        return;
      }

      // Reject without aborting login - a stray/malicious local POST must not
      // DoS the wait (only timeout or a valid nonce+payload should settle).
      if (!cors) {
        res.writeHead(403, {
          Vary: "Origin",
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ error: "Forbidden origin" }));
        return;
      }

      try {
        const body = await readJsonBody(req);
        const parsed = parseCallbackPayload(body, state);
        res.writeHead(200, {
          ...cors,
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ ok: true }));
        succeed(parsed);
      } catch (err) {
        res.writeHead(400, {
          ...cors,
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : "Invalid payload",
          }),
        );
      }
    }

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        fail(new Error("Failed to bind loopback server"));
        return;
      }
      const loginUrl =
        `${spikyUrl.replace(/\/$/, "")}/cli-auth` +
        `?port=${address.port}&state=${encodeURIComponent(state)}`;
      printInfo(`Opening ${loginUrl}`);
      void openBrowser(loginUrl).catch(() => {
        printInfo(`Open this URL manually: ${loginUrl}`);
      });
    });

    server.on("error", fail);
  });
}

function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const { spawn } = await import("node:child_process");
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    child.unref();
    resolve();
  });
}
