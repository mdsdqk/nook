/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as assertions from "../assertions.js";
import type * as auth from "../auth.js";
import type * as authPublic from "../authPublic.js";
import type * as convex__generated_api from "../convex/_generated/api.js";
import type * as convex__generated_server from "../convex/_generated/server.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as importLimitOverrides from "../importLimitOverrides.js";
import type * as importRateLimit from "../importRateLimit.js";
import type * as ledgerSync from "../ledgerSync.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_balances from "../lib/balances.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_holdings from "../lib/holdings.js";
import type * as lib_importPolicy from "../lib/importPolicy.js";
import type * as lib_ownership from "../lib/ownership.js";
import type * as lib_profile from "../lib/profile.js";
import type * as lib_statementImportLimits from "../lib/statementImportLimits.js";
import type * as lib_transferLinks from "../lib/transferLinks.js";
import type * as lib_transferMatch from "../lib/transferMatch.js";
import type * as lib_trustedOrigins from "../lib/trustedOrigins.js";
import type * as migrations from "../migrations.js";
import type * as statementImportActions from "../statementImportActions.js";
import type * as statementUpload from "../statementUpload.js";
import type * as statements from "../statements.js";
import type * as transactions from "../transactions.js";
import type * as transferSync from "../transferSync.js";
import type * as users from "../users.js";
import type * as wealth from "../wealth.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  assertions: typeof assertions;
  auth: typeof auth;
  authPublic: typeof authPublic;
  "convex/_generated/api": typeof convex__generated_api;
  "convex/_generated/server": typeof convex__generated_server;
  crons: typeof crons;
  dashboard: typeof dashboard;
  http: typeof http;
  importLimitOverrides: typeof importLimitOverrides;
  importRateLimit: typeof importRateLimit;
  ledgerSync: typeof ledgerSync;
  "lib/auth": typeof lib_auth;
  "lib/balances": typeof lib_balances;
  "lib/dates": typeof lib_dates;
  "lib/holdings": typeof lib_holdings;
  "lib/importPolicy": typeof lib_importPolicy;
  "lib/ownership": typeof lib_ownership;
  "lib/profile": typeof lib_profile;
  "lib/statementImportLimits": typeof lib_statementImportLimits;
  "lib/transferLinks": typeof lib_transferLinks;
  "lib/transferMatch": typeof lib_transferMatch;
  "lib/trustedOrigins": typeof lib_trustedOrigins;
  migrations: typeof migrations;
  statementImportActions: typeof statementImportActions;
  statementUpload: typeof statementUpload;
  statements: typeof statements;
  transactions: typeof transactions;
  transferSync: typeof transferSync;
  users: typeof users;
  wealth: typeof wealth;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
