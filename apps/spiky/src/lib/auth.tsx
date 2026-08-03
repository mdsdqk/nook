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
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@nook/convex/_generated/api";
import type { Id } from "@nook/convex/_generated/dataModel";
import { authClient, looksLikeEmail } from "./auth-client";
import { sanitizeAppPath } from "./safe-path";

export type Session = {
  userId: Id<"users">;
  email: string;
  name: string;
  username?: string;
  image?: string;
};

type AuthContextValue = {
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  ensureError: string | null;
  googleEnabled: boolean;
  signInWithGoogle: (callbackURL?: string) => Promise<void>;
  signInWithIdentifier: (identifier: string, password: string) => Promise<void>;
  signUpWithUsername: (args: {
    username: string;
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  retryEnsureUser: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const betterAuthSession = authClient.useSession();
  const {
    isLoading: convexAuthLoading,
    isAuthenticated: convexAuthenticated,
  } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureCurrentUser);

  const providers = useQuery(api.authPublic.providers, {});
  // Keep last-known providers across Convex reconnects so logout → login
  // doesn't flash Loading (useQuery returns undefined while reconnecting).
  const providersRef = useRef(providers);
  if (providers !== undefined) {
    providersRef.current = providers;
  }
  const resolvedProviders = providers ?? providersRef.current;

  const hasBetterAuthSession = Boolean(betterAuthSession.data?.session);
  const isSessionPending = betterAuthSession.isPending;
  // After the first session resolution, ignore later isPending flickers
  // (e.g. get-session after sign-out) so the login screen doesn't remount.
  const sessionResolvedRef = useRef(false);
  if (!isSessionPending) {
    sessionResolvedRef.current = true;
  }
  const waitingOnSession = isSessionPending && !sessionResolvedRef.current;

  // Only query app user once Convex has a JWT — earlier calls fail as unauthenticated.
  const convexReady = convexAuthenticated && !convexAuthLoading;
  const appUser = useQuery(
    api.users.me,
    hasBetterAuthSession && convexReady ? {} : "skip",
  );

  const [ensuring, setEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  // True from the start of email/username auth until the app user is linked
  // (or a hard error). Prevents /dashboard ↔ /login bounce after signup.
  const [authHandoff, setAuthHandoff] = useState(false);
  const ensureAttemptedRef = useRef(false);

  const session: Session | null = useMemo(() => {
    if (!appUser) return null;
    const mapped: Session = {
      userId: appUser._id,
      email: appUser.email,
      name: appUser.name,
    };
    if (appUser.username !== undefined) mapped.username = appUser.username;
    if (appUser.image !== undefined) mapped.image = appUser.image;
    return mapped;
  }, [appUser]);

  useEffect(() => {
    if (!hasBetterAuthSession) {
      ensureAttemptedRef.current = false;
      setEnsureError(null);
      setAuthHandoff(false);
      setEnsuring(false);
    }
  }, [hasBetterAuthSession]);

  // Once the app user is linked, handoff is complete.
  useEffect(() => {
    if (session) {
      setAuthHandoff(false);
      setEnsuring(false);
      setEnsureError(null);
    }
  }, [session]);

  // Link app user when Convex auth is ready and no app user exists yet.
  useEffect(() => {
    if (!hasBetterAuthSession) return;
    if (!convexReady) return;
    if (appUser === undefined) return; // query still loading
    if (appUser !== null) return; // already linked
    if (ensuring || ensureAttemptedRef.current) return;
    if (ensureError) return;

    ensureAttemptedRef.current = true;
    setEnsuring(true);
    setEnsureError(null);

    void ensureUser()
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to create app user";
        console.error("Failed to ensure app user", err);
        setEnsureError(message);
        setAuthHandoff(false);
      })
      .finally(() => {
        setEnsuring(false);
      });
  }, [
    hasBetterAuthSession,
    convexReady,
    appUser,
    ensuring,
    ensureError,
    ensureUser,
  ]);

  const retryEnsureUser = useCallback(() => {
    ensureAttemptedRef.current = false;
    setEnsureError(null);
    setAuthHandoff(true);
  }, []);

  const signInWithGoogle = useCallback(async (callbackURL = "/dashboard") => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: sanitizeAppPath(callbackURL),
    });
  }, []);

  const signInWithIdentifier = useCallback(
    async (identifier: string, password: string) => {
      const value = identifier.trim();
      if (!value) {
        throw new Error("Enter a username or email");
      }
      setAuthHandoff(true);
      setEnsureError(null);
      ensureAttemptedRef.current = false;
      try {
        const result = looksLikeEmail(value)
          ? await authClient.signIn.email({ email: value, password })
          : await authClient.signIn.username({
              username: value.toLowerCase(),
              password,
            });
        if (result.error) {
          throw new Error(result.error.message ?? "Could not sign in");
        }
        // App user linking runs in the effect once useConvexAuth is ready.
      } catch (err) {
        setAuthHandoff(false);
        throw err;
      }
    },
    [],
  );

  const signUpWithUsername = useCallback(
    async (args: {
      username: string;
      email: string;
      password: string;
      name?: string;
    }) => {
      const username = args.username.trim().toLowerCase();
      const email = args.email.trim();
      if (username.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }
      if (!email) {
        throw new Error("Email is required");
      }
      setAuthHandoff(true);
      setEnsureError(null);
      ensureAttemptedRef.current = false;
      try {
        const result = await authClient.signUp.email({
          email,
          password: args.password,
          username,
          name: args.name?.trim() || username,
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Could not sign up");
        }
        // App user linking runs in the effect once useConvexAuth is ready.
      } catch (err) {
        setAuthHandoff(false);
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setAuthHandoff(false);
    await authClient.signOut();
  }, []);

  // Stay in loading until Convex JWT is ready and the app user is linked.
  const waitingForAppUser =
    hasBetterAuthSession && session === null && !ensureError;

  const isLoading =
    waitingOnSession ||
    authHandoff ||
    (hasBetterAuthSession && convexAuthLoading) ||
    waitingForAppUser;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isLoading,
      ensureError,
      googleEnabled: resolvedProviders?.google ?? false,
      signInWithGoogle,
      signInWithIdentifier,
      signUpWithUsername,
      logout,
      retryEnsureUser,
    }),
    [
      session,
      isLoading,
      ensureError,
      resolvedProviders?.google,
      signInWithGoogle,
      signInWithIdentifier,
      signUpWithUsername,
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
