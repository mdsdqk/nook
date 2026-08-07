import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
  );
}

function parseCallbackPort(raw: string | null): number | null {
  if (!raw) return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

export function CliAuthPage() {
  const { isAuthenticated, isLoading, signInWithGoogle, googleEnabled } =
    useAuth();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const port = parseCallbackPort(params.get("port"));
  const state = params.get("state");

  useEffect(() => {
    if (!isAuthenticated || isLoading || status !== "idle") return;
    if (port === null) {
      setStatus("error");
      setError("Missing or invalid port query parameter.");
      return;
    }
    if (!state) {
      setStatus("error");
      setError("Missing login state. Restart: bun run statement auth login");
      return;
    }

    let cancelled = false;
    setStatus("sending");

    void (async () => {
      try {
        const sessionResult = await authClient.getSession();
        const sessionToken = sessionResult.data?.session?.token;
        if (!sessionToken) {
          throw new Error("No session token available");
        }

        const callbackUrl = `http://127.0.0.1:${port}/callback`;
        const parsed = new URL(callbackUrl);
        if (!isLoopbackHost(parsed.hostname)) {
          throw new Error("Callback host must be loopback only");
        }

        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
        if (!convexUrl || !convexSiteUrl) {
          throw new Error("Missing Convex URL env vars");
        }

        const response = await fetch(callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state,
            sessionToken,
            convexUrl,
            convexSiteUrl,
            obtainedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`CLI callback failed (${response.status})`);
        }

        if (!cancelled) setStatus("sent");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "CLI auth failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, port, state, status]);

  const cliReturnPath = `/cli-auth?port=${encodeURIComponent(String(port ?? ""))}&state=${encodeURIComponent(state ?? "")}`;

  if (isLoading) {
    return (
      <CliAuthShell>
        <p className="text-body-sm text-on-surface/60">Checking session…</p>
      </CliAuthShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <CliAuthShell>
        <p className="text-body-sm text-on-surface/60">
          Sign in to authorize the Nook CLI.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {googleEnabled ? (
            <Button
              type="button"
              onClick={() => {
                void signInWithGoogle(cliReturnPath);
              }}
            >
              Continue with Google
            </Button>
          ) : null}
          <Link
            to={`/login?redirect=${encodeURIComponent(cliReturnPath)}`}
            className="text-center text-body-sm text-on-surface/60 underline-offset-2 hover:underline"
          >
            {googleEnabled ? "Or sign in with email" : "Sign in with email"}
          </Link>
        </div>
      </CliAuthShell>
    );
  }

  if (status === "sent") {
    return (
      <CliAuthShell>
        <p className="text-body-sm text-on-surface/80">
          CLI authorized. You can close this tab and return to the terminal.
        </p>
      </CliAuthShell>
    );
  }

  if (status === "error") {
    return (
      <CliAuthShell>
        <p className="text-body-sm text-error" role="alert">
          {error ?? "Something went wrong"}
        </p>
      </CliAuthShell>
    );
  }

  return (
    <CliAuthShell>
      <p className="text-body-sm text-on-surface/60">
        Sending credentials to the CLI…
      </p>
    </CliAuthShell>
  );
}

function CliAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-title-md font-semibold text-white">
            N
          </div>
          <span className="text-title-md font-medium text-white">Nook CLI</span>
        </div>
        <h1 className="text-headline-lg font-semibold text-white max-md:text-headline-lg-mobile">
          Authorize CLI
        </h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
