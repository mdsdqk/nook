import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import {
  AuthRedirect,
  RequireAuth,
} from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/routes/login/page";
import { AuthBusy } from "@/components/auth-busy";

const CliAuthPage = lazy(() =>
  import("@/routes/cli-auth/page").then((m) => ({ default: m.CliAuthPage })),
);
const MoneyPage = lazy(() =>
  import("@/routes/money/page").then((m) => ({ default: m.MoneyPage })),
);
const GalleryPage = lazy(() =>
  import("@/routes/gallery/page").then((m) => ({ default: m.GalleryPage })),
);
const SettingsPage = lazy(() =>
  import("@/routes/settings/page").then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return <AuthBusy message="Loading…" />;
}

function ShellOutlet() {
  return (
    <Suspense
      fallback={<AuthBusy message="Loading…" fullScreen={false} />}
    >
      <Outlet />
    </Suspense>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/cli-auth"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CliAuthPage />
            </Suspense>
          }
        />
        <Route
          path="/gallery"
          element={
            <Suspense fallback={<RouteFallback />}>
              <GalleryPage />
            </Suspense>
          }
        />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route element={<ShellOutlet />}>
              <Route
                path="/dashboard"
                element={<Navigate to="/money" replace />}
              />
              <Route path="/money" element={<MoneyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
