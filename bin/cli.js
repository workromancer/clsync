#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import os from "os";
import { join } from "path";
import { loadConfig } from "../src/config.js";
import { trackDocs } from "../src/index.js";

// ASCII Art Banner
const banner = `
${chalk.cyan.bold(`
   ╔═══════════════════════════════════════════════════════════╗
   ║                                                           ║
   ║       ██████╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗  ║
   ║      ██╔════╝██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝  ║
   ║      ██║     ██║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║       ║
   ║      ██║     ██║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║       ║
   ║      ╚██████╗███████╗███████║   ██║   ██║ ╚████║╚██████╗  ║
   ║       ╚═════╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝  ║
   ║                                                           ║
   ╚═══════════════════════════════════════════════════════════╝
`)}
${chalk.dim('   Sync your Claude Code environment across machines')}
${chalk.dim('   ─────────────────────────────────────────────────────────────')}
`;

const smallBanner = `
${chalk.cyan.bold('  ┌───────────────────────────────────────┐')}
${chalk.cyan.bold('  │')}  ${chalk.white.bold('CLSYNC')} ${chalk.dim('v1.0.0')}                       ${chalk.cyan.bold('│')}
${chalk.cyan.bold('  │')}  ${chalk.dim('Claude Code Environment Sync')}        ${chalk.cyan.bold('│')}
${chalk.cyan.bold('  └───────────────────────────────────────┘')}
`;

function showBanner(verbose = false) {
  if (verbose) {
    console.log(banner);
  } else {
    console.log(smallBanner);
  }
}

function showSuccess() {
  console.log(`
${chalk.green.bold('  ┌───────────────────────────────────────┐')}
${chalk.green.bold('  │')}  ${chalk.white('✓')} ${chalk.green.bold('Sync Complete!')}                     ${chalk.green.bold('│')}
${chalk.green.bold('  └───────────────────────────────────────┘')}
`);
}

function showError(message) {
  console.log(`
${chalk.red.bold('  ┌───────────────────────────────────────┐')}
${chalk.red.bold('  │')}  ${chalk.white('✗')} ${chalk.red.bold('Error')}                               ${chalk.red.bold('│')}
${chalk.red.bold('  └───────────────────────────────────────┘')}
`);
  console.log(chalk.red(`  ${message}`));
}

function showScope(scope, path) {
  const icon = scope === "project" ? "📁" : "🏠";
  const label = scope === "project" ? "Project" : "User";
  console.log(chalk.dim(`  ${icon} Scope: ${chalk.white(label)} → ${chalk.cyan(path)}`));
  console.log();
}

program
  .name("clsync")
  .description("Sync your Claude Code environment across machines")
  .version("1.0.0")
  .option(
    "-c, --config <path>",
    "Path to config file",
    "clsync.config.json"
  )
  .option("-u, --user", "Save to ~/.claude/clsync (default)")
  .option("-p, --project", "Save to .claude/clsync (current directory)")
  .option("-v, --verbose", "Enable verbose output")
  .option("-d, --dry-run", "Show what would be done without making changes")
  .option("-f, --force", "Force overwrite existing files")
  .action(async (options) => {
    try {
      showBanner(options.verbose);

      const config = await loadConfig(options.config);

      // Determine output scope
      let scopePath;
      if (options.project) {
        config.output.directory = "./.claude/clsync";
        scopePath = ".claude/clsync";
        showScope("project", scopePath);
      } else {
        config.output.directory = join(os.homedir(), ".claude", "clsync");
        scopePath = "~/.claude/clsync";
        showScope("user", scopePath);
      }

      if (options.verbose) {
        config.options.verbose = true;
      }

      if (options.force) {
        config.options.overwrite = true;
      }

      await trackDocs(config, { dryRun: options.dryRun });

      showSuccess();
    } catch (error) {
      showError(error.message);
      if (options.verbose) {
        console.error(chalk.dim(error.stack));
      }
      process.exit(1);
    }
  });

program.parse();
