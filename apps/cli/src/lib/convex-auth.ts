import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@nook/convex/_generated/api";

export type NookCredentials = {
  sessionToken: string;
  convexUrl: string;
  convexSiteUrl: string;
  obtainedAt: string;
};

const CONFIG_DIR = join(homedir(), ".config", "nook");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export function credentialsPath(): string {
  return CREDENTIALS_PATH;
}

export async function readCredentials(): Promise<NookCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<NookCredentials>;
    if (
      typeof parsed.sessionToken !== "string" ||
      typeof parsed.convexUrl !== "string" ||
      typeof parsed.convexSiteUrl !== "string" ||
      typeof parsed.obtainedAt !== "string"
    ) {
      return null;
    }
    return parsed as NookCredentials;
  } catch {
    return null;
  }
}

export async function writeCredentials(
  credentials: NookCredentials,
): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(
    CREDENTIALS_PATH,
    `${JSON.stringify(credentials, null, 2)}\n`,
    { mode: 0o600 },
  );
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(CREDENTIALS_PATH);
  } catch {
    // already gone
  }
}

export async function fetchConvexJwt(
  credentials: NookCredentials,
): Promise<string> {
  const response = await fetch(
    `${credentials.convexSiteUrl}/api/auth/convex/token`,
    {
      headers: {
        Authorization: `Bearer ${credentials.sessionToken}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to refresh Convex token (${response.status}). Run: bun run statement auth login`,
    );
  }
  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Convex token response missing token");
  }
  return data.token;
}

/** ConvexHttpClient only accepts a string JWT — refresh before each use. */
export async function createAuthedConvexClient(): Promise<{
  client: ConvexHttpClient;
  credentials: NookCredentials;
  refreshAuth: () => Promise<void>;
}> {
  const credentials = await readCredentials();
  if (!credentials) {
    throw new Error("Not logged in. Run: bun run statement auth login");
  }

  const url = process.env["CONVEX_URL"] ?? credentials.convexUrl;
  const client = new ConvexHttpClient(url);

  const refreshAuth = async () => {
    const token = await fetchConvexJwt(credentials);
    client.setAuth(token);
  };

  await refreshAuth();
  await client.mutation(api.users.ensureCurrentUser, {});

  return { client, credentials, refreshAuth };
}
