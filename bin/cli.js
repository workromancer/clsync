#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import os from "os";
import { join } from "path";
import { loadConfig } from "../src/config.js";
import { trackDocs } from "../src/index.js";
import { 
  initClsync,
  stageItem,
  stageAll,
  listStaged,
  applyItem,
  applyAll,
  unstageItem,
  pullFromGitHub,
  browseRepo,
  getStatus,
  exportForPush,
  setRemote,
  loadManifest
} from "../src/repo-sync.js";

// Banner
const smallBanner = `
${chalk.cyan.bold('  ┌───────────────────────────────────────┐')}
${chalk.cyan.bold('  │')}  ${chalk.white.bold('CLSYNC')} ${chalk.dim('v1.0.0')}                       ${chalk.cyan.bold('│')}
${chalk.cyan.bold('  │')}  ${chalk.dim('Claude Code Environment Sync')}        ${chalk.cyan.bold('│')}
${chalk.cyan.bold('  └───────────────────────────────────────┘')}
`;

function showBanner() { console.log(smallBanner); }

function showSuccess(msg = 'Complete!') {
  console.log(`
${chalk.green.bold('  ┌───────────────────────────────────────┐')}
${chalk.green.bold('  │')}  ${chalk.white('✓')} ${chalk.green.bold(msg.padEnd(33))}${chalk.green.bold('│')}
${chalk.green.bold('  └───────────────────────────────────────┘')}
`);
}

function showError(msg) {
  console.log(`\n${chalk.red('  ✗ Error:')} ${msg}\n`);
}

// Main program
program
  .name("clsync")
  .description("Sync Claude Code settings via ~/.clsync staging area")
  .version("1.0.0");

// ============================================================================
// DOCS SYNC (default)
// ============================================================================
program
  .command("sync", { isDefault: true })
  .description("Sync documentation from configured sources")
  .option("-c, --config <path>", "Config file", "clsync.config.json")
  .option("-u, --user", "Save to ~/.claude/clsync (default)")
  .option("-p, --project", "Save to .claude/clsync")
  .option("-v, --verbose", "Verbose output")
  .option("-d, --dry-run", "Preview")
  .option("-f, --force", "Overwrite existing")
  .action(async (options) => {
    try {
      showBanner();
      const config = await loadConfig(options.config);
      const scope = options.project ? "project" : "user";
      
      config.output.directory = options.project 
        ? "./.claude/clsync" 
        : join(os.homedir(), ".claude", "clsync");
      
      console.log(chalk.dim(`  📁 Scope: ${scope === 'project' ? '.claude' : '~/.claude'}\n`));
      
      if (options.verbose) config.options.verbose = true;
      if (options.force) config.options.overwrite = true;

      await trackDocs(config, { dryRun: options.dryRun });
      showSuccess('Sync Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// STATUS
// ============================================================================
program
  .command("status")
  .description("Show ~/.clsync status and staged items")
  .action(async () => {
    try {
      showBanner();
      const status = await getStatus();
      
      console.log(chalk.cyan('  📊 Staging Area Status\n'));
      console.log(chalk.dim(`  Location: ~/.clsync`));
      console.log(chalk.dim(`  Remote:   ${status.remote || 'Not set'}`));
      console.log(chalk.dim(`  Last pull: ${status.last_pull || 'Never'}`));
      console.log(chalk.dim(`  Last push: ${status.last_push || 'Never'}`));
      console.log(chalk.dim(`  Staged:   ${status.staged_count} items\n`));
      
      if (status.staged.length > 0) {
        console.log(chalk.white.bold('  📦 Staged Items:'));
        for (const item of status.staged) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          console.log(chalk.dim(`     ${icon} ${item.name} (${item.type})`));
        }
      } else {
        console.log(chalk.dim('  No items staged. Use:'));
        console.log(chalk.dim('    clsync stage <name> -u   # Stage from ~/.claude'));
        console.log(chalk.dim('    clsync stage <name> -p   # Stage from .claude'));
        console.log(chalk.dim('    clsync pull <repo>       # Pull from GitHub'));
      }
      console.log();
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// STAGE: Copy to ~/.clsync
// ============================================================================
program
  .command("stage [name]")
  .description("Stage item to ~/.clsync (copy from ~/.claude or .claude)")
  .option("-u, --user", "From ~/.claude (default)")
  .option("-p, --project", "From .claude")
  .option("-a, --all", "Stage all items")
  .action(async (name, options) => {
    try {
      showBanner();
      const scope = options.project ? "project" : "user";
      const sourceLabel = scope === 'project' ? '.claude' : '~/.claude';
      
      if (options.all) {
        console.log(chalk.cyan(`  📤 Staging all from ${sourceLabel}...\n`));
        const spinner = ora('Staging...').start();
        const results = await stageAll(scope);
        spinner.succeed(`Staged ${results.length} items to ~/.clsync`);
        
        for (const r of results) {
          if (r.error) {
            console.log(chalk.red(`     ✗ ${r.item.name}: ${r.error}`));
          } else {
            console.log(chalk.dim(`     ✓ ${r.item.name}`));
          }
        }
      } else if (name) {
        console.log(chalk.cyan(`  📤 Staging: ${name} from ${sourceLabel}\n`));
        const result = await stageItem(name, scope);
        console.log(chalk.dim(`     ✓ Staged to: ~/.clsync/${result.item.path}`));
      } else {
        showError('Specify item name or use --all');
        process.exit(1);
      }
      
      showSuccess('Stage Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// APPLY: Copy from ~/.clsync to destination
// ============================================================================
program
  .command("apply [name]")
  .description("Apply item from ~/.clsync to ~/.claude, .claude, or custom directory")
  .option("-u, --user", "To ~/.claude (default)")
  .option("-p, --project", "To .claude (current directory)")
  .option("-d, --dir <path>", "To custom directory (e.g., /path/to/project/.claude)")
  .option("-a, --all", "Apply all staged items")
  .action(async (name, options) => {
    try {
      showBanner();
      
      let destLabel, scope;
      if (options.dir) {
        destLabel = options.dir;
        scope = { custom: options.dir };
      } else if (options.project) {
        destLabel = '.claude';
        scope = 'project';
      } else {
        destLabel = '~/.claude';
        scope = 'user';
      }
      
      if (options.all) {
        console.log(chalk.cyan(`  📥 Applying all to ${destLabel}...\n`));
        const spinner = ora('Applying...').start();
        const results = await applyAll(scope);
        spinner.succeed(`Applied ${results.length} items to ${destLabel}`);
        
        for (const r of results) {
          if (r.error) {
            console.log(chalk.red(`     ✗ ${r.item.name}: ${r.error}`));
          } else {
            console.log(chalk.dim(`     ✓ ${r.item.name}`));
          }
        }
      } else if (name) {
        console.log(chalk.cyan(`  📥 Applying: ${name} to ${destLabel}\n`));
        const result = await applyItem(name, scope);
        console.log(chalk.dim(`     ✓ Applied to: ${destLabel}/${result.item.path}`));
      } else {
        showError('Specify item name or use --all');
        process.exit(1);
      }
      
      showSuccess('Apply Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// UNSTAGE: Remove from ~/.clsync
// ============================================================================
program
  .command("unstage <name>")
  .description("Remove item from ~/.clsync staging")
  .action(async (name) => {
    try {
      showBanner();
      console.log(chalk.cyan(`  🗑️  Unstaging: ${name}\n`));
      await unstageItem(name);
      console.log(chalk.dim(`     ✓ Removed from ~/.clsync`));
      showSuccess('Unstage Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// PULL: GitHub → ~/.clsync
// ============================================================================
program
  .command("pull <repo>")
  .description("Pull settings from GitHub to ~/.clsync")
  .option("-f, --force", "Overwrite existing")
  .option("-v, --verbose", "Verbose output")
  .action(async (repo, options) => {
    try {
      showBanner();
      console.log(chalk.cyan(`  📥 Pulling from: ${repo}\n`));
      
      const spinner = ora('Fetching from GitHub...').start();
      const results = await pullFromGitHub(repo, {
        force: options.force,
        onProgress: msg => { if (options.verbose) spinner.text = msg; }
      });
      
      spinner.succeed(`Downloaded ${results.downloaded} files to ~/.clsync` +
        (results.skipped > 0 ? ` (skipped ${results.skipped})` : ''));
      
      if (options.verbose && results.files.length > 0) {
        for (const f of results.files) {
          console.log(chalk.dim(`     ✓ ${f}`));
        }
      }
      
      console.log(chalk.dim('\n  Next: clsync apply --all -u  # Apply to ~/.claude'));
      showSuccess('Pull Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// BROWSE: View GitHub repo contents
// ============================================================================
program
  .command("browse <repo>")
  .description("Browse available settings in a GitHub repository")
  .action(async (repo) => {
    try {
      showBanner();
      console.log(chalk.cyan(`  🔍 Browsing: ${repo}\n`));
      
      const spinner = ora('Fetching...').start();
      const items = await browseRepo(repo);
      spinner.stop();
      
      if (items.length === 0) {
        console.log(chalk.dim('  No settings found.\n'));
        return;
      }
      
      const skills = items.filter(i => i.type === 'skill');
      const agents = items.filter(i => i.type === 'agent');
      const styles = items.filter(i => i.type === 'output-style');
      
      if (skills.length > 0) {
        console.log(chalk.white.bold('  🎯 Skills'));
        for (const s of skills) console.log(chalk.dim(`     - ${s.name}`));
        console.log();
      }
      if (agents.length > 0) {
        console.log(chalk.white.bold('  🤖 Subagents'));
        for (const a of agents) console.log(chalk.dim(`     - ${a.name}`));
        console.log();
      }
      if (styles.length > 0) {
        console.log(chalk.white.bold('  ✨ Output Styles'));
        for (const s of styles) console.log(chalk.dim(`     - ${s.name}`));
        console.log();
      }
      
      console.log(chalk.dim(`  Use: clsync pull ${repo}\n`));
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// LIST: Show staged items
// ============================================================================
program
  .command("list")
  .alias("ls")
  .description("List staged items in ~/.clsync")
  .action(async () => {
    try {
      showBanner();
      console.log(chalk.cyan('  📋 Staged in ~/.clsync\n'));
      
      const staged = await listStaged();
      
      if (staged.length === 0) {
        console.log(chalk.dim('  No items staged.\n'));
        return;
      }
      
      const skills = staged.filter(i => i.type === 'skill');
      const agents = staged.filter(i => i.type === 'agent');
      const styles = staged.filter(i => i.type === 'output-style');
      
      if (skills.length > 0) {
        console.log(chalk.white.bold('  🎯 Skills'));
        for (const s of skills) console.log(chalk.dim(`     - ${s.name}`));
        console.log();
      }
      if (agents.length > 0) {
        console.log(chalk.white.bold('  🤖 Subagents'));
        for (const a of agents) console.log(chalk.dim(`     - ${a.name}`));
        console.log();
      }
      if (styles.length > 0) {
        console.log(chalk.white.bold('  ✨ Output Styles'));
        for (const s of styles) console.log(chalk.dim(`     - ${s.name}`));
        console.log();
      }
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// EXPORT: For manual git push
// ============================================================================
program
  .command("export <dir>")
  .description("Export ~/.clsync contents to a directory for git push")
  .action(async (dir) => {
    try {
      showBanner();
      console.log(chalk.cyan(`  📤 Exporting to: ${dir}\n`));
      
      const spinner = ora('Exporting...').start();
      const results = await exportForPush(dir);
      spinner.succeed(`Exported ${results.exported} items`);
      
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

// ============================================================================
// REMOTE: Set GitHub remote
// ============================================================================
program
  .command("remote [repo]")
  .description("Set or show GitHub remote repository")
  .action(async (repo) => {
    try {
      showBanner();
      
      if (repo) {
        await setRemote(repo);
        console.log(chalk.cyan(`  🔗 Remote set: ${repo}\n`));
      } else {
        const manifest = await loadManifest();
        console.log(chalk.cyan(`  🔗 Remote: ${manifest.remote || 'Not set'}\n`));
      }
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// INIT: Initialize ~/.clsync
// ============================================================================
program
  .command("init")
  .description("Initialize ~/.clsync directory")
  .action(async () => {
    try {
      showBanner();
      await initClsync();
      console.log(chalk.cyan('  ✓ Initialized ~/.clsync\n'));
      console.log(chalk.dim('  Structure:'));
      console.log(chalk.dim('    ~/.clsync/'));
      console.log(chalk.dim('    ├── manifest.json'));
      console.log(chalk.dim('    ├── skills/'));
      console.log(chalk.dim('    ├── agents/'));
      console.log(chalk.dim('    └── output-styles/\n'));
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

program.parse();
