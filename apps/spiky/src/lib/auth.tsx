import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";
import { authClient } from "./auth-client";
import { sanitizeAppPath } from "./safe-path";

export type Session = {
  userId: Id<"users">;
  email: string;
  name: string;
  image?: string;
};

type AuthContextValue = {
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  ensureError: string | null;
  googleEnabled: boolean;
  signInWithGoogle: (callbackURL?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  retryEnsureUser: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const betterAuthSession = authClient.useSession();
  const ensureUser = useMutation(api.users.ensureCurrentUser);
  const providers = useQuery(api.authPublic.providers, {});
  // Keep last-known providers across Convex reconnects so logout → login
  // doesn't flash Loading (useQuery returns undefined while reconnecting).
  const providersRef = useRef(providers);
  if (providers !== undefined) {
    providersRef.current = providers;
  }
  const resolvedProviders = providers ?? providersRef.current;

  const appUser = useQuery(
    api.users.me,
    betterAuthSession.data?.session ? {} : "skip",
  );
  const [ensuring, setEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const ensureAttemptedRef = useRef(false);

  const hasBetterAuthSession = Boolean(betterAuthSession.data?.session);
  const isSessionPending = betterAuthSession.isPending;
  // After the first session resolution, ignore later isPending flickers
  // (e.g. get-session after sign-out) so the login screen doesn't remount.
  const sessionResolvedRef = useRef(false);
  if (!isSessionPending) {
    sessionResolvedRef.current = true;
  }
  const waitingOnSession = isSessionPending && !sessionResolvedRef.current;

  useEffect(() => {
    if (!hasBetterAuthSession) {
      ensureAttemptedRef.current = false;
      setEnsureError(null);
    }
  }, [hasBetterAuthSession]);

  useEffect(() => {
    if (!hasBetterAuthSession) return;
    if (appUser === undefined) return; // still loading
    if (appUser !== null) return; // already linked
    if (ensuring || ensureAttemptedRef.current) return;

    ensureAttemptedRef.current = true;
    setEnsuring(true);
    setEnsureError(null);
    void ensureUser()
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to create app user";
        console.error("Failed to ensure app user", err);
        setEnsureError(message);
      })
      .finally(() => {
        setEnsuring(false);
      });
  }, [hasBetterAuthSession, appUser, ensureUser, ensuring]);

  const retryEnsureUser = useCallback(() => {
    ensureAttemptedRef.current = false;
    setEnsureError(null);
  }, []);

  const session: Session | null = useMemo(() => {
    if (!appUser) return null;
    const mapped: Session = {
      userId: appUser._id,
      email: appUser.email,
      name: appUser.name,
    };
    if (appUser.image !== undefined) mapped.image = appUser.image;
    return mapped;
  }, [appUser]);

  const signInWithGoogle = useCallback(async (callbackURL = "/dashboard") => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: sanitizeAppPath(callbackURL),
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message ?? "Could not sign in");
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name?.trim() || email.split("@")[0] || "User",
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not sign up");
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await authClient.signOut();
  }, []);

  // Do not gate on providers: that public query goes undefined on Convex
  // reconnect after sign-out and remounts the login screen ("refresh").
  const isLoading =
    waitingOnSession ||
    (hasBetterAuthSession && (appUser === undefined || ensuring));

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isLoading,
      ensureError,
      googleEnabled: resolvedProviders?.google ?? false,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      retryEnsureUser,
    }),
    [
      session,
      isLoading,
      ensureError,
      resolvedProviders?.google,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      retryEnsureUser,
    ],
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
