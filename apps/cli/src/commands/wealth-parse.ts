import { Command } from "commander";
import { parseWealthFile } from "@nook/pipeline";
import {
  WealthJsonWriter,
  toKuveraConvexPayload,
} from "@nook/persistence";
import type { KuveraConvexWritePayload } from "@nook/persistence";
import {
  resolveWealthFiles,
  printSuccess,
  printFail,
  printInfo,
} from "./shared";

export const wealthParseCommand = new Command("parse")
  .description("Parse a Kuvera (or wealth) capital-gains XLSX")
  .argument("<path>", "XLSX file or directory")
  .option("--out <dir>", "Write JSON results to directory")
  .option("--dry-run", "Run pipeline without writing output")
  .option("--convex", "Upsert to Convex wealth store")
  .option("--user <username>", "Username for Convex operations")
  .action(
    async (
      inputPath: string,
      opts: {
        out?: string;
        dryRun?: boolean;
        convex?: boolean;
        user?: string;
      },
    ) => {
      if (opts.convex && !opts.user) {
        printFail("--user is required for Convex operations");
        process.exit(1);
      }

      let convexClient: WealthConvexClient | null = null;
      if (opts.convex && !opts.dryRun) {
        convexClient = await initWealthConvexClient();
      }

      const files = resolveWealthFiles(inputPath);
      if (files.length === 0) {
        printFail("No .xlsx files found");
        process.exit(1);
      }

      for (const file of files) {
        console.log(`\n${file}`);
        const result = await parseWealthFile(file);

        if (result.detection) {
          printSuccess(
            `Detected ${result.detection.provider} ${result.detection.statementType}`,
          );
        }

        if (result.wealthStatement) {
          const lotCount = result.wealthStatement.schemes.reduce(
            (n, s) => n + s.lots.length,
            0,
          );
          printSuccess(
            `Parsed ${result.wealthStatement.schemes.length} schemes, ${lotCount} lots`,
          );
          printInfo(
            `Period: ${result.wealthStatement.period.label} (${result.wealthStatement.period.start} → ${result.wealthStatement.period.end})`,
          );
          printInfo(
            "Note: capital-gains lots are closed FIFO pairs; open holdings may be zero after import",
          );
        }

        for (const err of result.errors) {
          printFail(`${err.code}: ${err.message}`);
        }

        if (opts.dryRun) continue;

        if (opts.out && result.wealthStatement) {
          const writer = new WealthJsonWriter(opts.out);
          const outPath = await writer.write(result);
          printSuccess(`Written ${outPath}`);
        }

        if (convexClient && result.wealthStatement) {
          try {
            const userId = await convexClient.resolveUser(opts.user!);
            const payload = toKuveraConvexPayload(result);
            const upsert = await convexClient.upsertKuveraCapitalGains(
              userId,
              payload,
            );
            printSuccess(
              `Convex ${upsert.action}: instruments=${upsert.instrumentsUpserted}, txns+${upsert.transactionsUpserted}/skip ${upsert.transactionsSkipped}, holdings=${upsert.holdingsRecomputed}`,
            );
          } catch (err) {
            printFail(
              `Convex error: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    },
  );

interface WealthConvexClient {
  resolveUser(username: string): Promise<string>;
  upsertKuveraCapitalGains(
    userId: string,
    payload: KuveraConvexWritePayload,
  ): Promise<{
    documentId: string;
    action: string;
    instrumentsUpserted: number;
    transactionsUpserted: number;
    transactionsSkipped: number;
    holdingsRecomputed: number;
  }>;
}

async function initWealthConvexClient(): Promise<WealthConvexClient> {
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
        return await client.mutation(api.users.create, {
          username,
          name: username,
        });
      }
      return user._id;
    },

    async upsertKuveraCapitalGains(userId, payload) {
      return await client.mutation(api.wealth.upsertKuveraCapitalGains, {
        userId: userId as never,
        ...payload,
      });
    },
  };
}
