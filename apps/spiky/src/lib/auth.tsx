import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";

const STORAGE_KEY = "nook.session";

export type Session = {
  username: string;
  userId: Id<"users">;
  name: string;
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
    const parsed = JSON.parse(raw) as Session;
    if (
      typeof parsed.username !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.name !== "string"
    ) {
      return null;
    }
    return parsed;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const createUser = useMutation(api.users.create);
  const [session, setSession] = useState<Session | null>(() =>
    readStoredSession(),
  );

  const login = useCallback(
    async (rawUsername: string) => {
      const username = rawUsername.trim();
      if (!username) {
        throw new Error("Username is required");
      }

      const existing = await convex.query(api.users.getByUsername, {
        username,
      });

      if (existing) {
        const next: Session = {
          username: existing.username,
          userId: existing._id,
          name: existing.name,
        };
        writeStoredSession(next);
        setSession(next);
        return;
      }

      const userId = await createUser({ username, name: username });
      const next: Session = { username, userId, name: username };
      writeStoredSession(next);
      setSession(next);
    },
    [convex, createUser],
  );

  const logout = useCallback(() => {
    writeStoredSession(null);
    setSession(null);
  }, []);

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
