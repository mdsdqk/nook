import { Command } from "commander";
import { parseFile } from "@nook/pipeline";
import { resolveFiles, printSuccess, printFail } from "./shared";

export const validateCommand = new Command("validate")
  .description("Parse and validate a statement")
  .argument("<path>", "PDF file or directory")
  .action(async (inputPath: string) => {
    const files = resolveFiles(inputPath);

    for (const file of files) {
      console.log(`\n${file}`);
      const result = await parseFile(file);

      if (result.errors.length > 0 && !result.validation) {
        for (const err of result.errors) {
          printFail(`${err.code}: ${err.message}`);
        }
        continue;
      }

      if (result.detection) {
        printSuccess(
          `Detected ${result.detection.bank} ${result.detection.accountType}`,
        );
      }

      if (result.validation) {
        for (const entry of result.validation.entries) {
          if (entry.passed) {
            printSuccess(`${entry.category}: ${entry.message}`);
          } else {
            printFail(`${entry.category}: ${entry.message}`);
          }
        }
      }
    }
  });
