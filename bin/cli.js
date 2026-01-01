#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import os from "os";
import { join } from "path";
import { loadConfig } from "../src/config.js";
import { trackDocs } from "../src/index.js";
import { pullSettings, listLocalSettings, exportSettings } from "../src/repo-sync.js";

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

function showSuccess(message = 'Sync Complete!') {
  console.log(`
${chalk.green.bold('  ┌───────────────────────────────────────┐')}
${chalk.green.bold('  │')}  ${chalk.white('✓')} ${chalk.green.bold(message.padEnd(33))}${chalk.green.bold('│')}
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

// Main program
program
  .name("clsync")
  .description("Sync your Claude Code environment across machines")
  .version("1.0.0");

// Default command: sync docs
program
  .command("sync", { isDefault: true })
  .description("Sync documentation from configured sources")
  .option("-c, --config <path>", "Path to config file", "clsync.config.json")
  .option("-u, --user", "Save to ~/.claude/clsync (default)")
  .option("-p, --project", "Save to .claude/clsync (current directory)")
  .option("-v, --verbose", "Enable verbose output")
  .option("-d, --dry-run", "Show what would be done without making changes")
  .option("-f, --force", "Force overwrite existing files")
  .action(async (options) => {
    try {
      showBanner(options.verbose);

      const config = await loadConfig(options.config);

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

      if (options.verbose) config.options.verbose = true;
      if (options.force) config.options.overwrite = true;

      await trackDocs(config, { dryRun: options.dryRun });

      showSuccess('Sync Complete!');
    } catch (error) {
      showError(error.message);
      if (options.verbose) console.error(chalk.dim(error.stack));
      process.exit(1);
    }
  });

// Pull command: pull settings from GitHub repo
program
  .command("pull <repo>")
  .description("Pull settings from a GitHub repository (e.g., owner/repo)")
  .option("-u, --user", "Save to ~/.claude (default)")
  .option("-p, --project", "Save to .claude (current directory)")
  .option("-v, --verbose", "Enable verbose output")
  .option("-d, --dry-run", "Show what would be done without making changes")
  .option("-f, --force", "Force overwrite existing files")
  .action(async (repo, options) => {
    try {
      showBanner(options.verbose);
      
      const scope = options.project ? "project" : "user";
      const scopePath = options.project ? ".claude" : "~/.claude";
      
      console.log(chalk.cyan(`  📥 Pulling from: ${chalk.white(repo)}`));
      showScope(scope, scopePath);

      const spinner = ora('Fetching repository...').start();

      const results = await pullSettings(repo, {
        scope,
        force: options.force,
        dryRun: options.dryRun,
        onProgress: (msg) => {
          if (options.verbose) {
            spinner.text = msg;
          }
        }
      });

      if (options.dryRun) {
        spinner.succeed(`Would download ${results.downloaded} files`);
      } else {
        spinner.succeed(`Downloaded ${results.downloaded} files` + 
          (results.skipped > 0 ? `, skipped ${results.skipped} existing` : '') +
          (results.failed > 0 ? `, ${results.failed} failed` : ''));
      }

      if (options.verbose && results.files.length > 0) {
        console.log(chalk.dim('\n  Files:'));
        for (const file of results.files) {
          const icon = file.status === 'downloaded' ? '✓' : 
                       file.status === 'skipped' ? '○' : 
                       file.status === 'would-download' ? '◊' : '✗';
          const color = file.status === 'failed' ? chalk.red : chalk.dim;
          console.log(color(`    ${icon} ${file.path}`));
        }
      }

      showSuccess('Pull Complete!');
    } catch (error) {
      showError(error.message);
      if (options.verbose) console.error(chalk.dim(error.stack));
      process.exit(1);
    }
  });

// List command: list local settings
program
  .command("list")
  .description("List local Claude Code settings")
  .option("-u, --user", "List from ~/.claude (default)")
  .option("-p, --project", "List from .claude (current directory)")
  .action(async (options) => {
    try {
      showBanner(false);
      
      const scope = options.project ? "project" : "user";
      const files = await listLocalSettings(scope);

      if (files.length === 0) {
        console.log(chalk.dim('  No settings found.'));
        return;
      }

      console.log(chalk.cyan(`  📋 Local settings (${files.length} files):\n`));

      let currentDir = '';
      for (const file of files) {
        if (file.dir !== currentDir) {
          currentDir = file.dir;
          console.log(chalk.white.bold(`  ${currentDir}/`));
        }
        console.log(chalk.dim(`    - ${file.path.replace(file.dir + '/', '')}`));
      }

      console.log();
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// Export command: export settings to a directory
program
  .command("export <dir>")
  .description("Export local settings to a directory (for git push)")
  .option("-u, --user", "Export from ~/.claude (default)")
  .option("-p, --project", "Export from .claude (current directory)")
  .action(async (dir, options) => {
    try {
      showBanner(false);
      
      const scope = options.project ? "project" : "user";
      const spinner = ora('Exporting settings...').start();

      const results = await exportSettings(dir, scope);

      spinner.succeed(`Exported ${results.exported} files to ${dir}`);

      console.log(chalk.dim('\n  You can now:'));
      console.log(chalk.dim(`    cd ${dir}`));
      console.log(chalk.dim('    git init && git add . && git commit -m "Claude Code settings"'));
      console.log(chalk.dim('    git remote add origin <your-repo-url>'));
      console.log(chalk.dim('    git push -u origin main'));

      showSuccess('Export Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

program.parse();
