import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { authClient } from "./lib/auth-client";
import { AuthProvider } from "./lib/auth";
import { App } from "./App";
import "./index.css";

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) {
  throw new Error(
    "VITE_CONVEX_URL is required. Set it in apps/spiky/.env.local",
  );
}

const convex = new ConvexReactClient(url);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient as unknown as AuthClient}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConvexBetterAuthProvider>
  </StrictMode>,
);
