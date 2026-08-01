import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { sanitizeAppPath } from "@/lib/safe-path";

export function RequireAuth() {
  const { isAuthenticated, isLoading, ensureError, retryEnsureUser, logout } =
    useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-on-surface/60">
        Loading…
      </div>
    );
  }

  if (ensureError && !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-body-sm text-error" role="alert">
          {ensureError}
        </p>
        <button
          type="button"
          className="text-body-sm text-on-surface/70 underline-offset-2 hover:underline"
          onClick={() => retryEnsureUser()}
        >
          Retry
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
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-on-surface/60">
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    const redirect = sanitizeAppPath(
      new URLSearchParams(window.location.search).get("redirect"),
      "/dashboard",
    );
    return <Navigate to={redirect} replace />;
  }

  return children;
}

export function AuthRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-on-surface/60">
        Loading…
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}
