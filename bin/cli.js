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
  listLocalStaged,
  applyItem,
  applyAll,
  unstageItem,
  pullFromGitHub,
  browseRepo,
  getStatus,
  exportForPush,
  loadManifest,
  listPulledRepos,
  listRepoItems,
  promoteItem,
  demoteItem,
  listBothScopes
} from "../src/repo-sync.js";

// ASCII Art Banner - Cool cyberpunk style
const banner = `
${chalk.cyan('   ██████╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗')}
${chalk.cyan('  ██╔════╝██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝')}
${chalk.cyan('  ██║     ██║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║     ')}
${chalk.cyan('  ██║     ██║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║     ')}
${chalk.cyan('  ╚██████╗███████╗███████║   ██║   ██║ ╚████║╚██████╗')}
${chalk.cyan('   ╚═════╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝')}
${chalk.dim('  ───────────────────────────────────────────────────')}
${chalk.dim('   Claude Code Environment Sync')}              ${chalk.cyan('v1.0.0')}
`;

function showBanner() { 
  console.log(banner); 
}

function showSuccess(msg = 'Complete!') {
  console.log(`
${chalk.green('  ╔═══════════════════════════════════════════╗')}
${chalk.green('  ║')}  ${chalk.white('✓')} ${chalk.green.bold(msg.padEnd(38))}${chalk.green('║')}
${chalk.green('  ╚═══════════════════════════════════════════╝')}
`);
}

function showError(msg) {
  console.log(`
${chalk.red('  ╔═══════════════════════════════════════════╗')}
${chalk.red('  ║')}  ${chalk.white('✗')} ${chalk.red('Error')}                                  ${chalk.red('║')}
${chalk.red('  ╚═══════════════════════════════════════════╝')}
${chalk.dim('  ' + msg)}
`);
}

// Show banner only for --version and --help
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-V') || 
    args.includes('--help') || args.includes('-h') || 
    args.length === 0) {
  showBanner();
}

// Main program
program
  .name("clsync")
  .description("Sync Claude Code settings via ~/.clsync staging area")
  .version("1.0.0");

// ============================================================================
// INIT
// ============================================================================
program
  .command("init")
  .description("Initialize ~/.clsync directory")
  .action(async () => {
    try {
      
      await initClsync();
      console.log(chalk.cyan('  ✓ Initialized ~/.clsync\n'));
      console.log(chalk.dim('  Structure:'));
      console.log(chalk.dim('    ~/.clsync/'));
      console.log(chalk.dim('    ├── manifest.json'));
      console.log(chalk.dim('    ├── local/         # Your staged items'));
      console.log(chalk.dim('    │   ├── skills/'));
      console.log(chalk.dim('    │   ├── agents/'));
      console.log(chalk.dim('    │   └── output-styles/'));
      console.log(chalk.dim('    └── repos/         # Pulled repositories'));
      console.log(chalk.dim('        └── owner/repo/\n'));
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
  .description("Show ~/.clsync status")
  .action(async () => {
    try {
      
      const status = await getStatus();
      
      console.log(chalk.cyan('  📊 Staging Area Status\n'));
      console.log(chalk.dim(`  Location: ~/.clsync`));
      console.log(chalk.dim(`  Last updated: ${status.last_updated || 'Never'}\n`));
      
      // Local staged
      console.log(chalk.white.bold('  📦 Local Staged:') + chalk.dim(` ${status.local_count} items`));
      if (status.local_items.length > 0) {
        for (const item of status.local_items) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          console.log(chalk.dim(`     ${icon} ${item.name}`));
        }
      }
      console.log();
      
      // Pulled repos
      console.log(chalk.white.bold('  🔗 Pulled Repositories:') + chalk.dim(` ${status.repos_count} repos`));
      if (status.repos.length > 0) {
        for (const repo of status.repos) {
          console.log(chalk.dim(`     📁 ${repo.name} (${repo.items.length} items)`));
          console.log(chalk.dim(`        Last pulled: ${repo.last_pulled}`));
        }
      } else {
        console.log(chalk.dim('     No repositories pulled yet.'));
      }
      console.log();
      
      if (status.local_count === 0 && status.repos_count === 0) {
        console.log(chalk.dim('  Get started:'));
        console.log(chalk.dim('    clsync stage my-skill -u   # Stage from ~/.claude'));
        console.log(chalk.dim('    clsync pull owner/repo     # Pull from GitHub\n'));
      }
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// STAGE
// ============================================================================
program
  .command("stage [name]")
  .description("Stage item to ~/.clsync/local")
  .option("-u, --user", "From ~/.claude (default)")
  .option("-p, --project", "From .claude")
  .option("-a, --all", "Stage all items")
  .action(async (name, options) => {
    try {
      
      const scope = options.project ? "project" : "user";
      const sourceLabel = scope === 'project' ? '.claude' : '~/.claude';
      
      if (options.all) {
        console.log(chalk.cyan(`  📤 Staging all from ${sourceLabel}...\n`));
        const spinner = ora('Staging...').start();
        const results = await stageAll(scope);
        spinner.succeed(`Staged ${results.length} items to ~/.clsync/local`);
        
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
        console.log(chalk.dim(`     ✓ Staged to: ~/.clsync/local/${result.item.path}`));
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
// APPLY
// ============================================================================
program
  .command("apply [name]")
  .description("Apply item from ~/.clsync to destination")
  .option("-u, --user", "To ~/.claude (default)")
  .option("-p, --project", "To .claude")
  .option("-d, --dir <path>", "To custom directory")
  .option("-s, --source <repo>", "From repo (e.g., owner/repo). Default: local")
  .option("-a, --all", "Apply all items")
  .action(async (name, options) => {
    try {
      
      
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
      
      const source = options.source || 'local';
      const sourceLabel = source === 'local' ? 'local staging' : source;
      
      if (options.all) {
        console.log(chalk.cyan(`  📥 Applying all from ${sourceLabel} to ${destLabel}...\n`));
        const spinner = ora('Applying...').start();
        const results = await applyAll(scope, source);
        spinner.succeed(`Applied ${results.length} items`);
        
        for (const r of results) {
          if (r.error) {
            console.log(chalk.red(`     ✗ ${r.item.name}: ${r.error}`));
          } else {
            console.log(chalk.dim(`     ✓ ${r.item.name}`));
          }
        }
      } else if (name) {
        console.log(chalk.cyan(`  📥 Applying: ${name} from ${sourceLabel}\n`));
        const result = await applyItem(name, scope, source);
        console.log(chalk.dim(`     ✓ Applied to: ${destLabel}/${result.item.path}`));
      } else {
        showError('Specify item name or use --all');
        process.exit(1);
      }
      
      showSuccess('Apply Complete!');
    } catch (error) {
      // Enhanced error message for "not found" errors
      if (error.message.includes('not found')) {
        showError(error.message);
        console.log(chalk.dim('  💡 Tips:\n'));
        
        if (!options.source) {
          // User didn't specify a source, suggest pulled repos
          const repos = await listPulledRepos();
          if (repos.length > 0) {
            console.log(chalk.dim('  You have pulled repositories. Use -s to specify source:\n'));
            for (const repo of repos) {
              console.log(chalk.cyan(`     clsync apply ${name || '<name>'} -s ${repo.name} -u`));
            }
            console.log();
          } else {
            console.log(chalk.dim('  No pulled repositories. Try pulling one first:\n'));
            console.log(chalk.cyan('     clsync pull owner/repo'));
            console.log(chalk.cyan('     clsync apply --all -s owner/repo -u\n'));
          }
        } else {
          console.log(chalk.dim('  Check item name with:\n'));
          console.log(chalk.cyan(`     clsync list ${options.source}\n`));
        }
        process.exit(1);
      }
      
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// UNSTAGE
// ============================================================================
program
  .command("unstage <name>")
  .description("Remove item from ~/.clsync/local")
  .action(async (name) => {
    try {
      
      console.log(chalk.cyan(`  🗑️  Unstaging: ${name}\n`));
      await unstageItem(name);
      console.log(chalk.dim(`     ✓ Removed from local staging`));
      showSuccess('Unstage Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// PULL
// ============================================================================
program
  .command("pull <repo>")
  .description("Pull from GitHub to ~/.clsync/repos/{owner}/{repo}")
  .option("-f, --force", "Overwrite existing")
  .option("-v, --verbose", "Verbose output")
  .action(async (repo, options) => {
    try {
      
      console.log(chalk.cyan(`  📥 Pulling: ${repo}\n`));
      
      const spinner = ora('Fetching from GitHub...').start();
      const results = await pullFromGitHub(repo, {
        force: options.force,
        onProgress: msg => { if (options.verbose) spinner.text = msg; }
      });
      
      spinner.succeed(`Downloaded ${results.downloaded} files to ~/.clsync/repos/${results.repoPath}` +
        (results.skipped > 0 ? ` (skipped ${results.skipped})` : ''));
      
      if (options.verbose && results.files.length > 0) {
        for (const f of results.files) {
          console.log(chalk.dim(`     ✓ ${f}`));
        }
      }
      
      console.log(chalk.dim(`\n  Next: clsync apply --all -s ${results.repoPath} -u`));
      showSuccess('Pull Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// BROWSE
// ============================================================================
program
  .command("browse <repo>")
  .description("Browse available settings in a GitHub repository")
  .action(async (repo) => {
    try {
      
      console.log(chalk.cyan(`  🔍 Browsing: ${repo}\n`));
      
      const spinner = ora('Fetching...').start();
      
      // Try to fetch clsync.json metadata first
      const { fetchRepoMetadata } = await import("../src/repo-sync.js");
      const metadata = await fetchRepoMetadata(repo);
      
      const items = await browseRepo(repo);
      spinner.stop();
      
      // Show repository metadata if available
      if (metadata) {
        console.log(chalk.green('  ✓ clsync repository\n'));
        console.log(chalk.dim(`  Name:        ${metadata.name}`));
        console.log(chalk.dim(`  Description: ${metadata.description}`));
        console.log(chalk.dim(`  Author:      ${metadata.author}`));
        console.log(chalk.dim(`  Created:     ${metadata.created_at}`));
        console.log(chalk.dim(`  Updated:     ${metadata.updated_at}\n`));
      }
      
      if (items.length === 0) {
        console.log(chalk.yellow('  ⚠ No clsync settings found.\n'));
        console.log(chalk.dim('  This repository doesn\'t have the clsync structure:'));
        console.log(chalk.dim('    - skills/'));
        console.log(chalk.dim('    - agents/'));
        console.log(chalk.dim('    - output-styles/\n'));
        console.log(chalk.dim('  Would you like to add clsync settings to this repository?\n'));
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
// LIST
// ============================================================================
program
  .command("list [source]")
  .alias("ls")
  .description("List items (local or from a repo)")
  .action(async (source) => {
    try {
      
      
      let items, label;
      
      if (!source || source === 'local') {
        items = await listLocalStaged();
        label = 'Local Staging (~/.clsync/local)';
      } else {
        items = await listRepoItems(source);
        label = `Repository: ${source}`;
      }
      
      console.log(chalk.cyan(`  📋 ${label}\n`));
      
      if (items.length === 0) {
        console.log(chalk.dim('  No items found.\n'));
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
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// REPOS
// ============================================================================
program
  .command("repos")
  .description("List pulled repositories")
  .action(async () => {
    try {
      
      console.log(chalk.cyan('  📦 Pulled Repositories\n'));
      
      const repos = await listPulledRepos();
      
      if (repos.length === 0) {
        console.log(chalk.dim('  No repositories pulled yet.\n'));
        console.log(chalk.dim('  Use: clsync pull owner/repo\n'));
        return;
      }
      
      for (const repo of repos) {
        console.log(chalk.white.bold(`  📁 ${repo.name}`));
        console.log(chalk.dim(`     Last pulled: ${repo.last_pulled}`));
        console.log(chalk.dim(`     Items: ${repo.items.length}`));
        
        for (const item of repo.items) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          console.log(chalk.dim(`       ${icon} ${item.name}`));
        }
        console.log();
      }
      
      console.log(chalk.dim(`  Apply: clsync apply --all -s owner/repo -u\n`));
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// EXPORT
// ============================================================================
program
  .command("export <dir>")
  .description("Export ~/.clsync/local for git push (creates clsync.json)")
  .option("-a, --author <name>", "Author name for clsync.json")
  .option("-d, --desc <text>", "Description for clsync.json")
  .action(async (dir, options) => {
    try {
      
      console.log(chalk.cyan(`  📤 Exporting to: ${dir}\n`));
      
      const spinner = ora('Exporting...').start();
      const results = await exportForPush(dir, {
        author: options.author,
        description: options.desc
      });
      spinner.succeed(`Exported ${results.exported} items`);
      
      console.log(chalk.dim('\n  Created files:'));
      console.log(chalk.dim(`    📄 clsync.json (repository metadata)`));
      for (const item of results.items) {
        const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
        console.log(chalk.dim(`    ${icon} ${item.path}`));
      }
      
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
// SYNC (legacy - docs)
// ============================================================================
program
  .command("sync")
  .description("Sync documentation from configured sources")
  .option("-c, --config <path>", "Config file", "clsync.config.json")
  .option("-u, --user", "Save to ~/.claude/clsync")
  .option("-p, --project", "Save to .claude/clsync")
  .option("-v, --verbose", "Verbose")
  .option("-d, --dry-run", "Preview")
  .option("-f, --force", "Overwrite")
  .action(async (options) => {
    try {
      
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
// PROMOTE: project → user
// ============================================================================
program
  .command("promote <name>")
  .description("Move setting from .claude (project) → ~/.claude (user)")
  .option("-f, --force", "Overwrite if exists")
  .option("-r, --rename <newname>", "Rename to avoid conflict")
  .action(async (name, options) => {
    try {
      
      console.log(chalk.cyan(`  📤 Promoting: ${name}\n`));
      console.log(chalk.dim(`  From: .claude (project)`));
      console.log(chalk.dim(`  To:   ~/.claude (user)\n`));
      
      const result = await promoteItem(name, {
        force: options.force,
        rename: options.rename
      });
      
      if (result.renamed) {
        console.log(chalk.yellow(`  ⚠ Renamed: ${result.originalName} → ${result.newName}`));
      }
      
      console.log(chalk.dim(`  ✓ ${result.item.type}: ${result.newName}`));
      console.log(chalk.dim(`  Now available globally!\n`));
      
      showSuccess('Promote Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// DEMOTE: user → project
// ============================================================================
program
  .command("demote <name>")
  .description("Move setting from ~/.claude (user) → .claude (project)")
  .option("-f, --force", "Overwrite if exists")
  .option("-r, --rename <newname>", "Rename to avoid conflict")
  .action(async (name, options) => {
    try {
      
      console.log(chalk.cyan(`  📥 Demoting: ${name}\n`));
      console.log(chalk.dim(`  From: ~/.claude (user)`));
      console.log(chalk.dim(`  To:   .claude (project)\n`));
      
      const result = await demoteItem(name, {
        force: options.force,
        rename: options.rename
      });
      
      if (result.renamed) {
        console.log(chalk.yellow(`  ⚠ Renamed: ${result.originalName} → ${result.newName}`));
      }
      
      console.log(chalk.dim(`  ✓ ${result.item.type}: ${result.newName}`));
      console.log(chalk.dim(`  Now project-specific!\n`));
      
      showSuccess('Demote Complete!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// SCOPES: Compare user and project settings
// ============================================================================
program
  .command("scopes")
  .description("Compare settings in user (~/.claude) and project (.claude)")
  .action(async () => {
    try {
      
      console.log(chalk.cyan('  👁 Comparing Scopes\n'));
      
      const { project, user } = await listBothScopes();
      
      // User level
      console.log(chalk.white.bold('  📁 User (~/.claude)'));
      if (user.length === 0) {
        console.log(chalk.dim('     (empty)'));
      } else {
        for (const item of user) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          console.log(chalk.dim(`     ${icon} ${item.name}`));
        }
      }
      console.log();
      
      // Project level
      console.log(chalk.white.bold('  📁 Project (.claude)'));
      if (project.length === 0) {
        console.log(chalk.dim('     (empty)'));
      } else {
        for (const item of project) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          console.log(chalk.dim(`     ${icon} ${item.name}`));
        }
      }
      console.log();
      
      console.log(chalk.dim('  Commands:'));
      console.log(chalk.dim('    clsync promote <name>  # project → user'));
      console.log(chalk.dim('    clsync demote <name>   # user → project\n'));
      
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

program.parse();

