#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import os from "os";
import { join } from "path";
import { loadConfig } from "../src/config.js";
import { trackDocs } from "../src/index.js";
import { 
  pullSettings, 
  listLocalSettings, 
  exportSettings,
  browseRepo,
  installItem,
  copyItem,
  generateManifest
} from "../src/repo-sync.js";

// ASCII Art Banners
const smallBanner = `
${chalk.cyan.bold('  ┌───────────────────────────────────────┐')}
${chalk.cyan.bold('  │')}  ${chalk.white.bold('CLSYNC')} ${chalk.dim('v1.0.0')}                       ${chalk.cyan.bold('│')}
${chalk.cyan.bold('  │')}  ${chalk.dim('Claude Code Environment Sync')}        ${chalk.cyan.bold('│')}
${chalk.cyan.bold('  └───────────────────────────────────────┘')}
`;

function showBanner() {
  console.log(smallBanner);
}

function showSuccess(message = 'Complete!') {
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
  console.log(chalk.red(`  ${message}\n`));
}

function showScope(scope) {
  const icon = scope === "project" ? "📁" : "🏠";
  const label = scope === "project" ? "Project (.claude)" : "User (~/.claude)";
  console.log(chalk.dim(`  ${icon} Scope: ${chalk.white(label)}\n`));
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
  .option("-p, --project", "Save to .claude/clsync")
  .option("-v, --verbose", "Verbose output")
  .option("-d, --dry-run", "Preview without changes")
  .option("-f, --force", "Overwrite existing")
  .action(async (options) => {
    try {
      showBanner();
      const config = await loadConfig(options.config);
      const scope = options.project ? "project" : "user";
      
      if (options.project) {
        config.output.directory = "./.claude/clsync";
      } else {
        config.output.directory = join(os.homedir(), ".claude", "clsync");
      }
      
      showScope(scope);
      if (options.verbose) config.options.verbose = true;
      if (options.force) config.options.overwrite = true;

      await trackDocs(config, { dryRun: options.dryRun });
      showSuccess('Sync Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// Pull: Download all settings from GitHub repo
program
  .command("pull <repo>")
  .description("Pull all settings from a GitHub repository")
  .option("-u, --user", "Save to ~/.claude (default)")
  .option("-p, --project", "Save to .claude")
  .option("-f, --force", "Overwrite existing files")
  .option("-d, --dry-run", "Preview")
  .option("-v, --verbose", "Verbose output")
  .action(async (repo, options) => {
    try {
      showBanner();
      const scope = options.project ? "project" : "user";
      
      console.log(chalk.cyan(`  📥 Pulling from: ${chalk.white(repo)}`));
      showScope(scope);

      const spinner = ora('Fetching repository...').start();

      const results = await pullSettings(repo, {
        scope,
        force: options.force,
        dryRun: options.dryRun,
        onProgress: (msg) => { if (options.verbose) spinner.text = msg; }
      });

      if (options.dryRun) {
        spinner.succeed(`Would download ${results.downloaded} files`);
      } else {
        spinner.succeed(`Downloaded ${results.downloaded} files` + 
          (results.skipped > 0 ? `, skipped ${results.skipped}` : ''));
      }

      if (options.verbose) {
        console.log(chalk.dim('\n  Files:'));
        for (const f of results.files) {
          const icon = f.status === 'downloaded' ? '✓' : '○';
          console.log(chalk.dim(`    ${icon} ${f.path}`));
        }
      }

      showSuccess('Pull Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// Browse: View available items in a repo
program
  .command("browse <repo>")
  .description("Browse available settings in a GitHub repository")
  .action(async (repo) => {
    try {
      showBanner();
      console.log(chalk.cyan(`  🔍 Browsing: ${chalk.white(repo)}\n`));

      const spinner = ora('Fetching...').start();
      const { items, hasManifest } = await browseRepo(repo);
      spinner.stop();

      if (items.length === 0) {
        console.log(chalk.dim('  No settings found.\n'));
        return;
      }

      if (!hasManifest) {
        console.log(chalk.yellow('  ⚠ No manifest found. Limited metadata.\n'));
      }

      // Group by type
      const skills = items.filter(i => i.type === 'skill');
      const agents = items.filter(i => i.type === 'agent');
      const styles = items.filter(i => i.type === 'output-style');

      if (skills.length > 0) {
        console.log(chalk.white.bold('  🎯 Skills'));
        for (const s of skills) {
          console.log(chalk.dim(`     - ${s.name}`) + (s.description ? chalk.gray(` : ${s.description}`) : ''));
        }
        console.log();
      }

      if (agents.length > 0) {
        console.log(chalk.white.bold('  🤖 Subagents'));
        for (const a of agents) {
          console.log(chalk.dim(`     - ${a.name}`) + (a.description ? chalk.gray(` : ${a.description}`) : ''));
        }
        console.log();
      }

      if (styles.length > 0) {
        console.log(chalk.white.bold('  ✨ Output Styles'));
        for (const s of styles) {
          console.log(chalk.dim(`     - ${s.name}`) + (s.description ? chalk.gray(` : ${s.description}`) : ''));
        }
        console.log();
      }

      console.log(chalk.dim(`  Install with: ${chalk.cyan(`clsync install ${repo} <name>`)}\n`));
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// Install: Install specific item from repo
program
  .command("install <repo> <name>")
  .description("Install a specific item from a GitHub repository")
  .option("-u, --user", "Install to ~/.claude (default)")
  .option("-p, --project", "Install to .claude")
  .option("-f, --force", "Overwrite existing")
  .action(async (repo, name, options) => {
    try {
      showBanner();
      const scope = options.project ? "project" : "user";
      
      console.log(chalk.cyan(`  📦 Installing: ${chalk.white(name)} from ${repo}`));
      showScope(scope);

      const spinner = ora('Installing...').start();
      const results = await installItem(repo, name, { scope, force: options.force });
      spinner.succeed(`Installed ${results.item.type}: ${results.item.name}`);

      console.log(chalk.dim('\n  Files:'));
      for (const f of results.files) {
        console.log(chalk.dim(`    ✓ ${f}`));
      }

      showSuccess('Install Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// List: List local settings
program
  .command("list")
  .description("List local Claude Code settings")
  .option("-u, --user", "List from ~/.claude (default)")
  .option("-p, --project", "List from .claude")
  .action(async (options) => {
    try {
      showBanner();
      const scope = options.project ? "project" : "user";
      showScope(scope);

      const items = await listLocalSettings(scope);

      if (items.length === 0) {
        console.log(chalk.dim('  No settings found.\n'));
        return;
      }

      const skills = items.filter(i => i.type === 'skill');
      const agents = items.filter(i => i.type === 'agent');
      const styles = items.filter(i => i.type === 'output-style');

      if (skills.length > 0) {
        console.log(chalk.white.bold('  🎯 Skills'));
        for (const s of skills) {
          console.log(chalk.dim(`     - ${s.name}`) + (s.description ? chalk.gray(` : ${s.description}`) : ''));
        }
        console.log();
      }

      if (agents.length > 0) {
        console.log(chalk.white.bold('  🤖 Subagents'));
        for (const a of agents) {
          console.log(chalk.dim(`     - ${a.name}`) + (a.description ? chalk.gray(` : ${a.description}`) : ''));
        }
        console.log();
      }

      if (styles.length > 0) {
        console.log(chalk.white.bold('  ✨ Output Styles'));
        for (const s of styles) {
          console.log(chalk.dim(`     - ${s.name}`) + (s.description ? chalk.gray(` : ${s.description}`) : ''));
        }
        console.log();
      }
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// Copy: Copy item between user and project scope
program
  .command("copy <name>")
  .description("Copy a setting between user and project scope")
  .option("--to-project", "Copy from ~/.claude to .claude")
  .option("--to-user", "Copy from .claude to ~/.claude")
  .action(async (name, options) => {
    try {
      showBanner();
      
      let fromScope, toScope;
      if (options.toProject) {
        fromScope = 'user';
        toScope = 'project';
      } else if (options.toUser) {
        fromScope = 'project';
        toScope = 'user';
      } else {
        showError('Specify --to-project or --to-user');
        process.exit(1);
      }

      console.log(chalk.cyan(`  📋 Copying: ${chalk.white(name)}`));
      console.log(chalk.dim(`     From: ${fromScope === 'user' ? '~/.claude' : '.claude'}`));
      console.log(chalk.dim(`     To:   ${toScope === 'user' ? '~/.claude' : '.claude'}\n`));

      const spinner = ora('Copying...').start();
      const results = await copyItem(name, fromScope, toScope);
      spinner.succeed(`Copied ${results.item.type}: ${results.item.name}`);

      showSuccess('Copy Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// Export: Export settings to directory with manifest
program
  .command("export <dir>")
  .description("Export settings to a directory with manifest (for git push)")
  .option("-u, --user", "Export from ~/.claude (default)")
  .option("-p, --project", "Export from .claude")
  .action(async (dir, options) => {
    try {
      showBanner();
      const scope = options.project ? "project" : "user";
      showScope(scope);

      const spinner = ora('Exporting...').start();
      const results = await exportSettings(dir, scope);
      spinner.succeed(`Exported ${results.exported} files to ${dir}`);

      console.log(chalk.dim('\n  Next steps:'));
      console.log(chalk.dim(`    cd ${dir}`));
      console.log(chalk.dim('    git init && git add . && git commit -m "Claude settings"'));
      console.log(chalk.dim('    git remote add origin <repo-url> && git push\n'));

      showSuccess('Export Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

program.parse();
