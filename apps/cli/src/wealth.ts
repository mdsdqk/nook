#!/usr/bin/env bun
import { Command } from "commander";
import { wealthParseCommand } from "./commands/wealth-parse";
import { authCommand } from "./commands/auth";

const program = new Command();

program
  .name("wealth")
  .description("Wealth statement import CLI (Kuvera capital gains, etc.)")
  .version("0.1.0");

program.addCommand(wealthParseCommand);
program.addCommand(authCommand);

program.parse();
