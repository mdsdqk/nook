import { v } from "convex/values";
import { query } from "./_generated/server";

declare const process: {
  env: Record<string, string | undefined>;
};

/** Public, non-sensitive feature flags for auth UI. */
export const providers = query({
  args: {},
  returns: v.object({
    google: v.boolean(),
    emailPassword: v.boolean(),
  }),
  handler: async () => {
    const google = Boolean(
      process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"],
    );
    return {
      google,
      emailPassword: true,
    };
  },
});
