import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { RedirectIfAuthed } from "@/components/require-auth";
import { sanitizeAppPath } from "@/lib/safe-path";
import { easeOutSoft, fadeUp } from "@/lib/motion";

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
    providersReady,
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
  const [assistantsDialogOpen, setAssistantsDialogOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectTo = sanitizeAppPath(
    searchParams.get("redirect"),
    "/dashboard",
  );
  const assistantsRedirectArmed = redirectTo === "/assistants";

  const title = mode === "signin" ? "Sign in" : "Sign up";
  const subtitle =
    mode === "signin"
      ? !providersReady || googleEnabled
        ? "Continue with Google, or use your username or email."
        : "Sign in with your username or email."
      : !providersReady || googleEnabled
        ? "Create a Nook account with Google, or with a username and email."
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

      <motion.div
        className="relative w-full max-w-sm"
        variants={fadeUp}
        initial={reduceMotion ? false : "initial"}
        animate="animate"
        transition={easeOutSoft}
      >
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
          {!providersReady ? (
            <>
              <div
                aria-hidden
                className="h-10 w-full animate-pulse rounded-md bg-white/5"
              />
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-label-caps text-on-surface-variant">
                  or
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </>
          ) : googleEnabled ? (
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

            <AnimatePresence mode="wait" initial={false}>
              {error ? (
                <motion.p
                  key={error}
                  className="text-body-sm text-error"
                  role="alert"
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>

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

          {assistantsRedirectArmed ? (
            <p className="text-center text-body-sm text-on-surface/50">
              After sign-in you’ll open Assistants.{" "}
              <button
                type="button"
                className="underline-offset-2 hover:text-on-surface/70 hover:underline"
                onClick={() => {
                  void navigate("/login", { replace: true });
                }}
              >
                Undo
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="text-center text-body-sm text-on-surface/40 underline-offset-2 hover:text-on-surface/60 hover:underline"
              onClick={() => setAssistantsDialogOpen(true)}
            >
              Let your AI talk to Nook
            </button>
          )}
        </div>
      </motion.div>

      <Dialog
        open={assistantsDialogOpen}
        onOpenChange={setAssistantsDialogOpen}
        title="Let your AI talk to Nook"
      >
        <p className="text-body-sm leading-relaxed text-on-surface/65">
          Sign in and we’ll show you how to link Claude or ChatGPT. Then you
          can ask about your money from your preferred Chat Assistant - spending, balances, and
          what you own.
        </p>
        <div className="mt-stack-md flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAssistantsDialogOpen(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => {
              void navigate("/login?redirect=/assistants", { replace: true });
              setAssistantsDialogOpen(false);
            }}
          >
            Continue
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
