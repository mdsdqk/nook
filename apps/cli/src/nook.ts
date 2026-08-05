#!/usr/bin/env node
import { Command } from "commander";
import { parseCommand } from "./commands/parse";
import { detectCommand } from "./commands/detect";
import { validateCommand } from "./commands/validate";
import { createAuthCommand } from "./commands/auth";
import { wealthParseCommand } from "./commands/wealth-parse";

const program = new Command();

program
  .name("nook")
  .description("Nook CLI — bank statements, wealth import, and auth")
  .version("0.1.0");

const statement = new Command("statement").description(
  "Bank statement parsing CLI",
);
statement.addCommand(parseCommand);
statement.addCommand(detectCommand);
statement.addCommand(validateCommand);
statement.addCommand(createAuthCommand());
program.addCommand(statement);

const wealth = new Command("wealth").description(
  "Wealth statement import CLI (Kuvera capital gains, etc.)",
);
wealth.addCommand(wealthParseCommand);
wealth.addCommand(createAuthCommand());
program.addCommand(wealth);

program.parse();
