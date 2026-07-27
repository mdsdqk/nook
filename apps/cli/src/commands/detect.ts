import { Command } from "commander";
import { detectFile } from "@nook/pipeline";
import { resolveFiles, printSuccess, printFail } from "./shared";

export const detectCommand = new Command("detect")
  .description("Detect bank and account type from a statement")
  .argument("<path>", "PDF file or directory")
  .action(async (inputPath: string) => {
    const files = resolveFiles(inputPath);

    for (const file of files) {
      console.log(`\n${file}`);
      try {
        const detection = await detectFile(file);

        if (detection) {
          printSuccess(`Bank: ${detection.bank}`);
          printSuccess(`Type: ${detection.accountType}`);
          printSuccess(`Format: ${detection.formatVersion}`);
        } else {
          printFail("Could not detect bank");
        }
      } catch (err) {
        printFail(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });
