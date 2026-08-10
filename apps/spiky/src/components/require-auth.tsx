import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { safeReturnTo } from "@/lib/safe-return-to";

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RedirectIfAuthed({
  children,
  returnTo,
}: {
  children: ReactNode;
  returnTo?: string | null;
}) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    const dest = safeReturnTo(returnTo) ?? "/dashboard";
    return <Navigate to={dest} replace />;
  }

  return children;
}

export function AuthRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}
