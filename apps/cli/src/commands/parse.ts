import { Command } from "commander";
import { parseFile } from "@nook/pipeline";
import { JsonWriter, ConvexStatementWriter } from "@nook/persistence";
import type { ConvexWritePayload } from "@nook/persistence";
import { resolveFiles, printSuccess, printFail, printInfo } from "./shared";

export const parseCommand = new Command("parse")
  .description("Parse a bank statement (full pipeline)")
  .argument("<path>", "PDF file or directory")
  .option("--out <dir>", "Write JSON results to directory")
  .option("--dry-run", "Run pipeline without writing output")
  .option("--convex", "Upsert to Convex statement store")
  .option("--sync-ledger", "Promote to ledger (implies --convex)")
  .option("--user <username>", "Username for Convex operations")
  .action(
    async (
      inputPath: string,
      opts: {
        out?: string;
        dryRun?: boolean;
        convex?: boolean;
        syncLedger?: boolean;
        user?: string;
      },
    ) => {
      const useConvex = opts.convex || opts.syncLedger;

      if (useConvex && !opts.user) {
        printFail("--user is required for Convex operations");
        process.exit(1);
      }

      let convexClient: ConvexClientHelper | null = null;
      if (useConvex && !opts.dryRun) {
        convexClient = await initConvexClient();
      }

      const files = resolveFiles(inputPath);

      for (const file of files) {
        console.log(`\n${file}`);
        const result = await parseFile(file);

        if (result.detection) {
          printSuccess(
            `Detected ${result.detection.bank} ${result.detection.accountType}`,
          );
        }

        if (result.statement) {
          printSuccess(
            `Parsed ${result.statement.transactions.length} transactions`,
          );
          printInfo(
            `Period: ${result.statement.metadata.statementPeriod.from} to ${result.statement.metadata.statementPeriod.to}`,
          );
          printInfo(
            `Opening: ${result.statement.openingBalance.toFixed(2)} → Closing: ${result.statement.closingBalance.toFixed(2)}`,
          );
        }

        if (result.validation) {
          if (result.validation.passed) {
            printSuccess("Validation passed");
          } else {
            printFail("Validation failed");
            for (const entry of result.validation.entries) {
              if (!entry.passed) {
                printFail(`  ${entry.category}: ${entry.message}`);
              }
            }
          }
        }

        for (const err of result.errors) {
          printFail(`${err.code}: ${err.message}`);
        }

        if (opts.dryRun) continue;

        // JSON output
        if (opts.out) {
          const writer = new JsonWriter(opts.out);
          await writer.write(result);
          printSuccess(`Written to ${opts.out}/`);
        }

        // Convex output
        if (convexClient && result.statement) {
          try {
            const userId = await convexClient.resolveUser(opts.user!);
            const writer = new ConvexStatementWriter(
              async (payload: ConvexWritePayload) => {
                const stmtResult = await convexClient!.upsertStatement(
                  userId,
                  payload,
                );
                printSuccess(
                  `Stored in Convex (${stmtResult.action})`,
                );

                if (opts.syncLedger) {
                  if (!result.validation?.passed) {
                    printFail(
                      "Skipping ledger sync because validation did not pass",
                    );
                    return;
                  }
                  const syncResult = await convexClient!.syncLedger(
                    userId,
                    stmtResult.statementId,
                    payload,
                  );
                  printSuccess(
                    `Ledger sync: ${syncResult.assertionsUpserted} assertions, ${syncResult.transactionsUpserted} txns upserted, ${syncResult.transactionsSkipped} skipped`,
                  );
                }
              },
            );
            await writer.write(result);
          } catch (err) {
            printFail(
              `Convex error: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      if (convexClient) {
        await convexClient.close();
      }
    },
  );

interface ConvexClientHelper {
  resolveUser(username: string): Promise<string>;
  upsertStatement(
    userId: string,
    payload: ConvexWritePayload,
  ): Promise<{ statementId: string; action: string }>;
  syncLedger(
    userId: string,
    statementId: string,
    payload: ConvexWritePayload,
  ): Promise<{
    accountId: string;
    assertionsUpserted: number;
    transactionsUpserted: number;
    transactionsSkipped: number;
  }>;
  close(): Promise<void>;
}

async function initConvexClient(): Promise<ConvexClientHelper> {
  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("@nook/convex/_generated/api");

  const url = process.env["CONVEX_URL"];
  if (!url) {
    throw new Error(
      "CONVEX_URL environment variable is required for Convex operations",
    );
  }

  const client = new ConvexHttpClient(url);

  return {
    async resolveUser(username: string): Promise<string> {
      const user = await client.query(api.users.getByUsername, { username });
      if (!user) {
        const userId = await client.mutation(api.users.create, {
          username,
          name: username,
        });
        return userId;
      }
      return user._id;
    },

    async upsertStatement(
      userId: string,
      payload: ConvexWritePayload,
    ) {
      return await client.mutation(api.statements.upsertStatement, {
        userId: userId as never,
        ...payload,
      });
    },

    async syncLedger(
      userId: string,
      statementId: string,
      payload: ConvexWritePayload,
    ) {
      return await client.mutation(api.ledgerSync.syncFromStatement, {
        userId: userId as never,
        statementId: statementId as never,
        bank: payload.bank,
        accountFingerprint: payload.accountFingerprint,
        accountNumberMasked: payload.accountNumberMasked,
        currency: payload.currency,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        openingBalance: payload.openingBalance,
        closingBalance: payload.closingBalance,
        transactions: payload.transactions.map((t) => ({
          date: t.date,
          narration: t.narration,
          debit: t.debit,
          credit: t.credit,
          externalKey: t.externalKey,
        })),
      });
    },

    async close() {
      // ConvexHttpClient doesn't need explicit close
    },
  };
}
