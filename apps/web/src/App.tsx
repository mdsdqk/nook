import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RootLayout } from "./routes/root-layout";
import { DashboardPage } from "./routes/dashboard/page";
import { AccountsPage } from "./routes/dashboard/accounts/page";
import { NewAccountPage } from "./routes/dashboard/accounts/new/page";
import { NewTransactionPage } from "./routes/dashboard/transactions/new/page";
import { OnboardingPage } from "./routes/onboarding/page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<OnboardingPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard/accounts" element={<AccountsPage />} />
          <Route path="dashboard/accounts/new" element={<NewAccountPage />} />
          <Route
            path="dashboard/transactions/new"
            element={<NewTransactionPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
