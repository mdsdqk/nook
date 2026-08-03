import { useState, type FormEvent } from "react";
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
    signInWithIdentifier,
    signUpWithUsername,
    googleEnabled,
    ensureError,
    retryEnsureUser,
    logout,
  } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const redirectTo = sanitizeAppPath(
    new URLSearchParams(window.location.search).get("redirect"),
    "/dashboard",
  );

  const title = mode === "signin" ? "Sign in" : "Sign up";
  const subtitle =
    mode === "signin"
      ? googleEnabled
        ? "Continue with Google, or use your username or email."
        : "Sign in with your username or email."
      : "Create a Nook account with a username and email.";

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
        await signInWithIdentifier(identifier, password);
      } else {
        const displayName = name.trim();
        await signUpWithUsername({
          username,
          email,
          password,
          ...(displayName ? { name: displayName } : {}),
        });
      }
      // Do not navigate here. AuthProvider keeps isLoading until the app user
      // is linked; RedirectIfAuthed then sends us to the destination once.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "signin"
            ? "Could not sign in"
            : "Could not sign up",
      );
      setPending(false);
    }
  }

  const canSubmit =
    mode === "signin"
      ? identifier.trim().length > 0 && password.length >= 8
      : username.trim().length >= 3 &&
        email.trim().includes("@") &&
        password.length >= 8;

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
          {title}
        </h1>
        <p className="mt-2 text-body-sm text-on-surface/60">{subtitle}</p>

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
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-label-caps text-on-surface-variant">
                    Username
                  </span>
                  <Input
                    name="username"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="yourname"
                    disabled={pending}
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9_]+"
                    title="Letters, numbers, and underscores only"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-label-caps text-on-surface-variant">
                    Email
                  </span>
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={pending}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-label-caps text-on-surface-variant">
                    Display name
                    <span className="ml-1 text-on-surface/40">(optional)</span>
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
              </>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-label-caps text-on-surface-variant">
                  Username or email
                </span>
                <Input
                  name="identifier"
                  autoComplete="username"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="yourname or you@example.com"
                  disabled={pending}
                  required
                />
              </label>
            )}

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

            <Button type="submit" disabled={pending || !canSubmit}>
              {pending
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Sign in"
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
