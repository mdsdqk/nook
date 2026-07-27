#!/usr/bin/env bun
import { Command } from "commander";
import { parseCommand } from "./commands/parse";
import { detectCommand } from "./commands/detect";
import { validateCommand } from "./commands/validate";

const program = new Command();

program
  .name("statement")
  .description("Bank statement parsing CLI")
  .version("0.1.0");

program.addCommand(parseCommand);
program.addCommand(detectCommand);
program.addCommand(validateCommand);

program.parse();
