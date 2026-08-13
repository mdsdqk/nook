import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthBusy } from "@/components/auth-busy";
import { useAuth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { sanitizeAppPath } from "@/lib/safe-path";

const MCP_URL =
  import.meta.env.VITE_MCP_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";

type ConsentParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  consentId: string;
  state: string | null;
  resource: string | null;
  scope: string | null;
  clientName: string | null;
};

function readParams(search: URLSearchParams): ConsentParams | null {
  const clientId = search.get("client_id");
  const redirectUri = search.get("redirect_uri");
  const codeChallenge = search.get("code_challenge");
  const consentId = search.get("consent_id");
  if (!clientId || !redirectUri || !codeChallenge || !consentId) return null;
  return {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: search.get("code_challenge_method") ?? "S256",
    consentId,
    state: search.get("state"),
    resource: search.get("resource"),
    scope: search.get("scope"),
    clientName: search.get("client_name"),
  };
}

export function OAuthConsentPage() {
  const {
    isAuthenticated,
    isLoading,
    session,
    logout,
    ensureError,
    retryEnsureUser,
  } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const params = useMemo(() => readParams(search), [search]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!params) {
    return (
      <Shell>
        <h1 className="text-headline-lg font-semibold text-white">
          Invalid OAuth request
        </h1>
        <p className="mt-2 text-body-sm text-on-surface/60">
          Missing client_id, redirect_uri, code_challenge, or consent_id.
        </p>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <AuthBusy
        onSignOut={() => {
          void logout();
        }}
      />
    );
  }

  if (ensureError && !isAuthenticated) {
    return (
      <Shell>
        <p className="text-body-sm text-error" role="alert">
          {ensureError}
        </p>
        <button
          type="button"
          className="mt-3 text-body-sm text-on-surface/70 underline-offset-2 hover:underline"
          onClick={() => retryEnsureUser()}
        >
          Retry
        </button>
      </Shell>
    );
  }

  if (!isAuthenticated || !session) {
    const redirect = sanitizeAppPath(
      `/oauth/consent?${search.toString()}`,
      "/oauth/consent",
    );
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  const consent = params;
  const currentSession = session;

  async function onApprove(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const sessionResult = await authClient.getSession();
      const sessionToken = sessionResult.data?.session?.token;
      if (!sessionToken) {
        throw new Error("No session token available — sign in again");
      }

      const body: Record<string, string> = {
        client_id: consent.clientId,
        redirect_uri: consent.redirectUri,
        code_challenge: consent.codeChallenge,
        code_challenge_method: consent.codeChallengeMethod,
        consent_id: consent.consentId,
        session_token: sessionToken,
      };
      if (consent.resource) body.resource = consent.resource;
      if (consent.scope) body.scope = consent.scope;
      if (consent.state) body.state = consent.state;

      const res = await fetch(`${MCP_URL}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        redirect_to?: string;
        error?: string;
        error_description?: string;
      };
      if (!res.ok || !data.redirect_to) {
        throw new Error(
          data.error_description ?? data.error ?? `Approve failed (${res.status})`,
        );
      }
      window.location.assign(data.redirect_to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve");
      setPending(false);
    }
  }

  function onDeny() {
    const deny = new URL(consent.redirectUri);
    deny.searchParams.set("error", "access_denied");
    if (consent.state) deny.searchParams.set("state", consent.state);
    window.location.assign(deny.toString());
  }

  const displayName =
    currentSession.username ?? currentSession.name ?? currentSession.email;

  return (
    <Shell>
      <h1 className="text-headline-lg font-semibold tracking-[-0.02em] text-white max-md:text-headline-lg-mobile">
        Connect assistant
      </h1>
      <p className="mt-2 text-body-sm text-on-surface/60">
        <span className="text-white">
          {consent.clientName ?? "An AI assistant"}
        </span>{" "}
        wants access to your Nook ledger and wealth data as{" "}
        <span className="text-white">{displayName}</span>.
      </p>

      <ul className="mt-stack-md list-disc space-y-1 pl-5 text-body-sm text-on-surface/70">
        <li>Read accounts, transactions, cashflow, and portfolio</li>
        <li>Ingest bank statements and Kuvera exports into your books</li>
        <li>Record manual wealth instruments and transactions</li>
      </ul>

      <form onSubmit={onApprove} className="mt-stack-md flex flex-col gap-3">
        {error ? (
          <p className="text-body-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Approving…" : "Allow access"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onDeny}
        >
          Deny
        </Button>
        <button
          type="button"
          className="text-left text-label-caps text-on-surface/40 hover:text-on-surface/70"
          onClick={() => navigate("/money")}
        >
          Back to Spiky
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-stack-md flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-title-md font-semibold text-white">
            N
          </div>
          <span className="text-title-md font-medium text-white">Nook</span>
        </div>
        {children}
      </div>
    </div>
  );
}
