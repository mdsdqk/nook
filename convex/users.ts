import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { getAppUser, getAppUserOrNull, requireIdentity } from "./lib/auth";
import { normalizeProfileUpdate } from "./lib/profile";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  authSubject: v.string(),
  email: v.string(),
  name: v.string(),
  username: v.optional(v.string()),
  image: v.optional(v.string()),
});

export const me = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    return await getAppUserOrNull(ctx);
  },
});

export const ensureCurrentUser = mutation({
  args: {},
  returns: userValidator,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const email = identity.email?.trim() ?? "";
    if (!email) {
      throw new Error("Authenticated identity is missing an email address");
    }

    let username: string | undefined;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      const raw =
        authUser &&
        typeof authUser === "object" &&
        "username" in authUser &&
        typeof (authUser as { username?: unknown }).username === "string"
          ? (authUser as { username: string }).username.trim()
          : "";
      if (raw) username = raw;
    } catch {
      // Google / social sessions may not expose a Better Auth username yet.
    }

    const nameFromIdentity =
      identity.name?.trim() || username || email.split("@")[0] || email;
    const image = identity.pictureUrl;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      // Never clobber a user-edited name/username — only fill empties / sync email+image.
      const patch: {
        email?: string;
        name?: string;
        username?: string;
        image?: string;
      } = {};
      if (email && existing.email !== email) patch.email = email;
      if (!existing.name.trim() && nameFromIdentity) {
        patch.name = nameFromIdentity;
      }
      if (
        username !== undefined &&
        (existing.username === undefined || existing.username === "")
      ) {
        patch.username = username;
      }
      if (image !== undefined && existing.image !== image) {
        patch.image = image;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      const updated = await ctx.db.get(existing._id);
      if (!updated) {
        throw new Error("User not found after update");
      }
      return updated;
    }

    const userId = await ctx.db.insert("users", {
      authSubject: identity.tokenIdentifier,
      email,
      name: nameFromIdentity,
      ...(username !== undefined ? { username } : {}),
      ...(image !== undefined ? { image } : {}),
    });

    const created = await ctx.db.get(userId);
    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    /**
     * Omit to leave username unchanged.
     * `null` clears username (rollback / explicit clear).
     * Empty string is rejected when the user already has a username.
     */
    username: v.optional(v.union(v.string(), v.null())),
  },
  returns: userValidator,
  handler: async (ctx, args) => {
    const user = await getAppUser(ctx);
    const hadUsername = Boolean(user.username?.trim());
    const normalized = normalizeProfileUpdate({
      name: args.name,
      ...(args.username !== undefined ? { username: args.username } : {}),
      usernameRequired: hadUsername && args.username !== null,
    });

    const previousUsername = user.username;

    if (normalized.username.kind === "set") {
      const next = normalized.username.username;
      if (next !== user.username) {
        const taken = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", next))
          .unique();
        if (taken && taken._id !== user._id) {
          throw new Error("Username is already taken");
        }
      }
      await ctx.db.patch(user._id, {
        name: normalized.name,
        username: next,
      });

      // Narrow race window: revert if another row claimed the same username.
      const claimants = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", next))
        .collect();
      if (claimants.length > 1) {
        await ctx.db.patch(user._id, {
          name: user.name,
          ...(previousUsername !== undefined
            ? { username: previousUsername }
            : { username: undefined }),
        });
        throw new Error("Username is already taken");
      }
    } else if (normalized.username.kind === "clear") {
      await ctx.db.patch(user._id, {
        name: normalized.name,
        username: undefined,
      });
    } else {
      await ctx.db.patch(user._id, { name: normalized.name });
    }

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new Error("User not found after update");
    }
    return updated;
  },
});
