import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { sanitizeAppPath } from "@/lib/safe-path";
import { AuthBusy } from "@/components/auth-busy";

export function RequireAuth() {
  const {
    isAuthenticated,
    isLoading,
    ensureError,
    retryEnsureUser,
    logout,
  } = useAuth();
  const location = useLocation();

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
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <AuthBusy
        onSignOut={() => {
          void logout();
        }}
      />
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
  const { isAuthenticated, isLoading, logout } = useAuth();
  if (isLoading) {
    return (
      <AuthBusy
        message="Loading…"
        onSignOut={() => {
          void logout();
        }}
      />
    );
  }
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}
