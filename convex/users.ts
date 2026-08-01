import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAppUserOrNull, requireIdentity } from "./lib/auth";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  authSubject: v.string(),
  email: v.string(),
  name: v.string(),
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
    const name = identity.name?.trim() || email;
    const image = identity.pictureUrl;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      const patch: {
        email?: string;
        name?: string;
        image?: string;
      } = {};
      if (email && existing.email !== email) patch.email = email;
      if (existing.name !== name) patch.name = name;
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
      name,
      ...(image !== undefined ? { image } : {}),
    });

    const created = await ctx.db.get(userId);
    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  },
});
