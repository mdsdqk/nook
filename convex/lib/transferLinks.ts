import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type TransferDocFields = Omit<
  Doc<"transactions">,
  "_id" | "_creationTime" | "linkedTransactionId" | "transferRole"
> & {
  direction: "credit" | "debit";
  type: string;
  category?: string;
};

/** Strip system + link fields for `ctx.db.replace`. */
export function withoutTransferLink(txn: Doc<"transactions">): TransferDocFields {
  const {
    _id: _ignoredId,
    _creationTime: _ignoredCreation,
    linkedTransactionId: _linked,
    transferRole: _role,
    ...rest
  } = txn;
  return {
    ...rest,
    direction:
      rest.direction ??
      (txn.transferRole === "in" ? ("credit" as const) : ("debit" as const)),
  };
}

function restoredType(
  role: "out" | "in" | undefined,
): "expense" | "unclassified_income" {
  return role === "in" ? "unclassified_income" : "expense";
}

function restoredDirection(
  role: "out" | "in" | undefined,
): "credit" | "debit" {
  return role === "in" ? "credit" : "debit";
}

function applyRestore(
  fields: TransferDocFields,
  role: "out" | "in" | undefined,
) {
  fields.type = restoredType(role);
  fields.direction = restoredDirection(role);
  if (fields.category === "Transfer") {
    delete fields.category;
  }
  return fields;
}

/**
 * Clear mutual transfer link on both legs and restore them to
 * expense/unclassified_income with matching direction.
 * No-op if `txn` is not linked.
 */
export async function unlinkTransferPair(
  ctx: MutationCtx,
  txn: Doc<"transactions">,
): Promise<void> {
  if (txn.linkedTransactionId === undefined) return;

  const counterpart = await ctx.db.get(txn.linkedTransactionId);

  const selfRestored = applyRestore(withoutTransferLink(txn), txn.transferRole);
  await ctx.db.replace(txn._id, selfRestored);

  if (
    counterpart &&
    counterpart.userId === txn.userId &&
    counterpart.linkedTransactionId === txn._id
  ) {
    const otherRestored = applyRestore(
      withoutTransferLink(counterpart),
      counterpart.transferRole,
    );
    await ctx.db.replace(counterpart._id, otherRestored);
  }
}

/**
 * Delete one transfer leg and restore/unlink its counterpart (if any).
 */
export async function deleteTransferLeg(
  ctx: MutationCtx,
  txn: Doc<"transactions">,
): Promise<void> {
  if (txn.linkedTransactionId !== undefined) {
    const counterpart = await ctx.db.get(txn.linkedTransactionId);
    if (
      counterpart &&
      counterpart.userId === txn.userId &&
      counterpart.linkedTransactionId === txn._id
    ) {
      const otherRestored = applyRestore(
        withoutTransferLink(counterpart),
        counterpart.transferRole,
      );
      await ctx.db.replace(counterpart._id, otherRestored);
    }
  }
  await ctx.db.delete(txn._id);
}

export function isLinkedTransfer(txn: {
  linkedTransactionId?: string;
}): boolean {
  return txn.linkedTransactionId !== undefined;
}
