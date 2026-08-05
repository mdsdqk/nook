/**
 * Shared profile field validation for Convex updateProfile and client forms.
 */

export type ProfileUsernameInput =
  | { kind: "unchanged" }
  | { kind: "set"; username: string }
  | { kind: "clear" };

export type NormalizedProfileUpdate = {
  name: string;
  username: ProfileUsernameInput;
};

export function normalizeProfileUpdate(args: {
  name: string;
  /**
   * `undefined` — leave username unchanged.
   * `null` — clear username (allowed even if one was set; used for rollback).
   * `string` — set or clear-via-empty (empty rejected when `usernameRequired`).
   */
  username?: string | null;
  /** When true, empty-string username is rejected (form “required when set”). */
  usernameRequired?: boolean;
}): NormalizedProfileUpdate {
  const name = args.name.trim();
  if (name.length < 1) {
    throw new Error("Name is required");
  }
  if (name.length > 100) {
    throw new Error("Name must be less than 100 characters");
  }

  if (args.username === undefined) {
    return { name, username: { kind: "unchanged" } };
  }

  if (args.username === null) {
    return { name, username: { kind: "clear" } };
  }

  const username = args.username.trim().toLowerCase();
  if (username.length === 0) {
    if (args.usernameRequired) {
      throw new Error("Username is required");
    }
    return { name, username: { kind: "clear" } };
  }

  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  if (username.length > 30) {
    throw new Error("Username must be at most 30 characters");
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error(
      "Username may only contain letters, numbers, and underscores",
    );
  }

  return { name, username: { kind: "set", username } };
}
