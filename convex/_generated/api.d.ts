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
import type * as convex__generated_api from "../convex/_generated/api.js";
import type * as convex__generated_server from "../convex/_generated/server.js";
import type * as dashboard from "../dashboard.js";
import type * as ledgerSync from "../ledgerSync.js";
import type * as lib_balances from "../lib/balances.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_holdings from "../lib/holdings.js";
import type * as lib_ownership from "../lib/ownership.js";
import type * as lib_transferLinks from "../lib/transferLinks.js";
import type * as lib_transferMatch from "../lib/transferMatch.js";
import type * as migrations from "../migrations.js";
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
  "convex/_generated/api": typeof convex__generated_api;
  "convex/_generated/server": typeof convex__generated_server;
  dashboard: typeof dashboard;
  ledgerSync: typeof ledgerSync;
  "lib/balances": typeof lib_balances;
  "lib/dates": typeof lib_dates;
  "lib/holdings": typeof lib_holdings;
  "lib/ownership": typeof lib_ownership;
  "lib/transferLinks": typeof lib_transferLinks;
  "lib/transferMatch": typeof lib_transferMatch;
  migrations: typeof migrations;
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

export declare const components: {};
