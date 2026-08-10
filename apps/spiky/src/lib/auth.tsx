import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";

const STORAGE_KEY = "nook.session";

export type Session = {
  username: string;
  userId: Id<"users">;
  name: string;
  /** Opaque Convex-backed UI session; required for MCP OAuth approve. */
  sessionToken: string;
};

type AuthContextValue = {
  session: Session | null;
  isAuthenticated: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.username !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.sessionToken !== "string"
    ) {
      return null;
    }
    return {
      username: parsed.username,
      userId: parsed.userId as Id<"users">,
      name: parsed.name,
      sessionToken: parsed.sessionToken,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const createUser = useMutation(api.users.create);
  const createUiSession = useMutation(api.mcpOauth.createUiSession);
  const revokeUiSession = useMutation(api.mcpOauth.revokeUiSession);
  const [session, setSession] = useState<Session | null>(() =>
    readStoredSession(),
  );

  const login = useCallback(
    async (rawUsername: string) => {
      const username = rawUsername.trim();
      if (!username) {
        throw new Error("Username is required");
      }

      await createUser({ username, name: username });
      const minted = await createUiSession({ username });
      const next: Session = {
        username: minted.username,
        userId: minted.userId,
        name: minted.name,
        sessionToken: minted.sessionToken,
      };
      writeStoredSession(next);
      setSession(next);
    },
    [createUser, createUiSession],
  );

  const logout = useCallback(() => {
    const current = readStoredSession();
    writeStoredSession(null);
    setSession(null);
    if (current?.sessionToken) {
      void hashToken(current.sessionToken)
        .then((tokenHash) => revokeUiSession({ tokenHash }))
        .catch(() => {
          // Best-effort revoke; local logout still succeeds.
        });
    }
  }, [revokeUiSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
