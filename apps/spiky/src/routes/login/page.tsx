import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { RedirectIfAuthed } from "@/components/require-auth";
import { sanitizeAppPath } from "@/lib/safe-path";

export function LoginPage() {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  );
}

function LoginForm() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    googleEnabled,
    ensureError,
    retryEnsureUser,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const redirectTo = sanitizeAppPath(
    new URLSearchParams(window.location.search).get("redirect"),
    "/dashboard",
  );

  async function onGoogle() {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, name.trim() || undefined);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[280px] w-[360px] rounded-full bg-tertiary/10 blur-[100px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-stack-md flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-title-md font-semibold text-white">
            N
          </div>
          <span className="text-title-md font-medium text-white">Nook</span>
        </div>

        <h1 className="text-headline-lg font-semibold tracking-[-0.02em] text-white max-md:text-headline-lg-mobile">
          Sign in
        </h1>
        <p className="mt-2 text-body-sm text-on-surface/60">
          {googleEnabled
            ? "Continue with Google, or use email and password."
            : "Sign in with email and password."}
        </p>

        {ensureError ? (
          <div className="mt-4 flex flex-col gap-2 rounded-md border border-error/40 p-3">
            <p className="text-body-sm text-error" role="alert">
              {ensureError}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-body-sm text-on-surface/70 underline-offset-2 hover:underline"
                onClick={() => retryEnsureUser()}
              >
                Retry linking account
              </button>
              <button
                type="button"
                className="text-body-sm text-on-surface/70 underline-offset-2 hover:underline"
                onClick={() => {
                  void logout();
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-stack-md flex flex-col gap-3">
          {googleEnabled ? (
            <>
              <Button type="button" onClick={onGoogle} disabled={pending}>
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-label-caps text-on-surface-variant">
                  or
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </>
          ) : null}

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {mode === "signup" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-label-caps text-on-surface-variant">
                  Name
                </span>
                <Input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={pending}
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="text-label-caps text-on-surface-variant">
                Email
              </span>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={pending}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label-caps text-on-surface-variant">
                Password
              </span>
              <Input
                name="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={pending}
                required
                minLength={8}
              />
            </label>

            {error ? (
              <p className="text-body-sm text-error" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={pending || !email.trim() || password.length < 8}
            >
              {pending
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Sign in with email"
                  : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            className="text-body-sm text-on-surface/60 underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            disabled={pending}
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
