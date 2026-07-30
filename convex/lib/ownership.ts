import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function requireUserAccount(
  ctx: Ctx,
  userId: Id<"users">,
  accountId: Id<"accounts">,
): Promise<Doc<"accounts">> {
  const account = await ctx.db.get(accountId);
  if (!account || account.userId !== userId) {
    throw new Error("Account not found");
  }
  return account;
}
