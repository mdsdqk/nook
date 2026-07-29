import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  AuthRedirect,
  RequireAuth,
} from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/routes/login/page";
import { DashboardPage } from "@/routes/dashboard/page";
import { MoneyPage } from "@/routes/money/page";
import { GalleryPage } from "@/routes/gallery/page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/money" element={<MoneyPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
