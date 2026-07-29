import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { RedirectIfAuthed } from "@/components/require-auth";

export function LoginPage() {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(username);
      navigate("/dashboard", { replace: true });
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
          Enter your username to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-stack-md flex flex-col gap-3">
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
              placeholder="your-username"
              disabled={pending}
              required
            />
          </label>

          {error ? (
            <p className="text-body-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending || !username.trim()}>
            {pending ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
