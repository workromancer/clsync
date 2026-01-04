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
  pushToGitHub,
  browseRepo,
  getStatus,
  exportForPush,
  loadManifest,
  listPulledRepos,
  listRepoItems,
  promoteItem,
  demoteItem,
  listBothScopes,
  fetchOnlineRepoList,
  pullOnlineRepo,
  getGitHubAccountInfo,
  linkLocalRepo,
  unlinkLocalRepo,
  getLocalInfo,
  generateReadmeFromClsyncJson,
  findClaudeDirs,
  scanLocalClaudeDirs,
  getClaudeDirsWithCache,
  getScanCacheInfo,
  clearScanCache,
  scanItems,
  linkSkillToCommand,
  linkSubagentToCommand,
  linkAll
} from "../src/repo-sync.js";

// Get terminal width
function getTerminalWidth() {
  return process.stdout.columns || 80;
}

// ASCII Art Banner - Full version (needs 55+ columns)
const bannerFull = `
${chalk.cyan('   ██████╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗')}
${chalk.cyan('  ██╔════╝██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝')}
${chalk.cyan('  ██║     ██║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║     ')}
${chalk.cyan('  ██║     ██║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║     ')}
${chalk.cyan('  ╚██████╗███████╗███████║   ██║   ██║ ╚████║╚██████╗')}
${chalk.cyan('   ╚═════╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝')}
${chalk.dim('  ───────────────────────────────────────────────────')}
${chalk.dim('   Claude Code Environment Sync')}           ${chalk.cyan('v0.2.4')}
`;

// Compact banner (for 40-54 columns)
const bannerCompact = `
${chalk.cyan.bold('  ╔═══════════════════════════╗')}
${chalk.cyan.bold('  ║')}  ${chalk.white.bold('CLSYNC')} ${chalk.dim('v0.2.4')}      ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ║')}  ${chalk.dim('Claude Code Sync')}        ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ╚═══════════════════════════╝')}
`;

// Minimal banner (for <40 columns)
const bannerMinimal = `
${chalk.cyan.bold('CLSYNC')} ${chalk.dim('v0.2.4')}
${chalk.dim('Claude Code Sync')}
`;

function showBanner() {
  const width = getTerminalWidth();
  if (width >= 55) {
    console.log(bannerFull);
  } else if (width >= 35) {
    console.log(bannerCompact);
  } else {
    console.log(bannerMinimal);
  }
}

function showSuccess(msg = 'Complete!') {
  const width = getTerminalWidth();
  if (width >= 50) {
    console.log(`
${chalk.green('  ╔═══════════════════════════════════════════╗')}
${chalk.green('  ║')}  ${chalk.white('✓')} ${chalk.green.bold(msg.padEnd(38))}${chalk.green('║')}
${chalk.green('  ╚═══════════════════════════════════════════╝')}
`);
  } else {
    console.log(`\n${chalk.green('  ✓')} ${chalk.green.bold(msg)}\n`);
  }
}

function showError(msg) {
  const width = getTerminalWidth();
  if (width >= 50) {
    console.log(`
${chalk.red('  ╔═══════════════════════════════════════════╗')}
${chalk.red('  ║')}  ${chalk.white('✗')} ${chalk.red('Error')}                                  ${chalk.red('║')}
${chalk.red('  ╚═══════════════════════════════════════════╝')}
${chalk.dim('  ' + msg)}
`);
  } else {
    console.log(`\n${chalk.red('  ✗ Error:')} ${msg}\n`);
  }
}

// Interactive mode imports
import inquirer from 'inquirer';

// Alternate screen mode (like vim, less)
const enterAltScreen = () => process.stdout.write('\x1b[?1049h\x1b[H');
const exitAltScreen = () => process.stdout.write('\x1b[?1049l');
const clearScreen = () => process.stdout.write('\x1b[2J\x1b[H');
const hideCursor = () => process.stdout.write('\x1b[?25l');
const showCursor = () => process.stdout.write('\x1b[?25h');

// Cleanup on exit
function setupExitHandlers() {
  const cleanup = () => {
    showCursor();
    exitAltScreen();
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}

// Interactive mode function
async function interactiveMode(isFirstRun = true) {
  if (isFirstRun) {
    enterAltScreen();
    setupExitHandlers();
  }
  clearScreen();
  showBanner();
  
  // Get current status
  const status = await getStatus();
  const repos = await listPulledRepos();
  
  // Show quick status
  console.log(chalk.dim(`  📦 Local: ${status.local_count} items  |  🔗 Repos: ${repos.length}`));
  console.log();
  
  const { action } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📊 View status', value: 'status' },
        { name: '📦 Browse pulled repositories', value: 'repos' },
        { name: '📥 Apply items from repo', value: 'apply' },
        { name: '🔍 Pull new repository', value: 'pull' },
        { name: '🌐 Browse online repositories', value: 'online' },
        { name: '🔀 Compare scopes (user vs project)', value: 'scopes' },
        { name: '📁 Scan local Claude projects', value: 'scan' },
        { name: '❓ Help', value: 'help' },
        { name: '👋 Exit', value: 'exit' }
      ]
    }
  ]);
  
  switch (action) {
    case 'status':
      await showStatusInteractive();
      break;
    case 'repos':
      await browseReposInteractive();
      break;
    case 'apply':
      await applyInteractive();
      break;
    case 'pull':
      await pullInteractive();
      break;
    case 'online':
      await browseOnlineInteractive();
      break;
    case 'scopes':
      await scopesInteractive();
      break;
    case 'scan':
      await scanInteractive();
      break;
    case 'help':
      program.help();
      break;
    case 'exit':
      exitAltScreen();
      showCursor();
      console.log(chalk.dim('\n  Bye! 👋\n'));
      process.exit(0);
  }
}

async function showStatusInteractive() {
  const status = await getStatus();
  
  console.log(chalk.cyan('\n  📊 Staging Area Status\n'));
  console.log(chalk.dim(`  Location: ~/.clsync`));
  console.log(chalk.dim(`  Last updated: ${status.last_updated || 'Never'}\n`));
  
  console.log(chalk.white.bold('  📦 Local Staged:') + chalk.dim(` ${status.local_count} items`));
  console.log(chalk.white.bold('  🔗 Repositories:') + chalk.dim(` ${status.repos_count} repos\n`));
  
  await backToMenu();
}

async function browseReposInteractive() {
  const repos = await listPulledRepos();
  
  if (repos.length === 0) {
    console.log(chalk.yellow('\n  No repositories pulled yet.\n'));
    console.log(chalk.dim('  Pull a repository first: clsync pull owner/repo\n'));
    await backToMenu();
    return;
  }
  
  const { selectedRepo } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'selectedRepo',
      message: 'Select a repository:',
      choices: [
        ...repos.map(r => ({ name: `📁 ${r.name} (${r.items.length} items)`, value: r })),
        new inquirer.Separator(),
        { name: '← Back to menu', value: null }
      ]
    }
  ]);
  
  if (!selectedRepo) {
    await interactiveMode();
    return;
  }
  
  // Show items in selected repo
  console.log(chalk.cyan(`\n  📁 ${selectedRepo.name}\n`));
  
  const skills = selectedRepo.items.filter(i => i.type === 'skill');
  const agents = selectedRepo.items.filter(i => i.type === 'agent');
  const styles = selectedRepo.items.filter(i => i.type === 'output-style');
  
  if (skills.length > 0) console.log(chalk.dim(`  🎯 Skills: ${skills.length}`));
  if (agents.length > 0) console.log(chalk.dim(`  🤖 Subagents: ${agents.length}`));
  if (styles.length > 0) console.log(chalk.dim(`  ✨ Output Styles: ${styles.length}`));
  console.log();
  
  const { repoAction } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'repoAction',
      message: 'What would you like to do?',
      choices: [
        { name: '📥 Apply all to ~/.claude (user)', value: 'apply-user' },
        { name: '📥 Apply all to .claude (project)', value: 'apply-project' },
        { name: '📋 Select specific items to apply', value: 'select' },
        new inquirer.Separator(),
        { name: '← Back', value: 'back' }
      ]
    }
  ]);
  
  if (repoAction === 'back') {
    await browseReposInteractive();
    return;
  }
  
  if (repoAction === 'apply-user' || repoAction === 'apply-project') {
    const scope = repoAction === 'apply-user' ? 'user' : 'project';
    const destLabel = scope === 'user' ? '~/.claude' : '.claude';
    
    console.log(chalk.cyan(`\n  📥 Applying all to ${destLabel}...\n`));
    const spinner = ora('Applying...').start();
    const results = await applyAll(scope, selectedRepo.name);
    spinner.succeed(`Applied ${results.length} items`);
    
    for (const r of results) {
      if (r.error) {
        console.log(chalk.red(`     ✗ ${r.item.name}: ${r.error}`));
      } else {
        console.log(chalk.dim(`     ✓ ${r.item.name}`));
      }
    }
    showSuccess('Apply Complete!');
  }
  
  if (repoAction === 'select') {
    const { items } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'items',
        message: 'Select items to apply:',
        choices: selectedRepo.items.map(item => {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          return { name: `${icon} ${item.name}`, value: item.name };
        }),
        pageSize: 20
      }
    ]);
    
    if (items.length > 0) {
      const { targetScope } = await inquirer.prompt([
        {
          type: 'rawlist',
          name: 'targetScope',
          message: 'Apply to:',
          choices: [
            { name: '~/.claude (user)', value: 'user' },
            { name: '.claude (project)', value: 'project' }
          ]
        }
      ]);
      
      console.log();
      for (const itemName of items) {
        try {
          const result = await applyItem(itemName, targetScope, selectedRepo.name);
          console.log(chalk.dim(`  ✓ ${itemName}`));
        } catch (e) {
          console.log(chalk.red(`  ✗ ${itemName}: ${e.message}`));
        }
      }
      showSuccess('Apply Complete!');
    }
  }
  
  await backToMenu();
}

async function applyInteractive() {
  const repos = await listPulledRepos();
  const localItems = await listLocalStaged();
  
  if (repos.length === 0 && localItems.length === 0) {
    console.log(chalk.yellow('\n  No items available to apply.\n'));
    console.log(chalk.dim('  Pull a repository first: clsync pull owner/repo\n'));
    await backToMenu();
    return;
  }
  
  const sources = [];
  if (localItems.length > 0) {
    sources.push({ name: `📦 Local staging (${localItems.length} items)`, value: 'local' });
  }
  for (const repo of repos) {
    sources.push({ name: `📁 ${repo.name} (${repo.items.length} items)`, value: repo.name });
  }
  sources.push(new inquirer.Separator());
  sources.push({ name: '← Back', value: null });
  
  const { source } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'source',
      message: 'Select source:',
      choices: sources
    }
  ]);
  
  if (!source) {
    await interactiveMode();
    return;
  }
  
  // Redirect to browse repos with this source selected
  const selectedRepo = repos.find(r => r.name === source) || { name: 'local', items: localItems };
  
  const { targetScope } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'targetScope',
      message: 'Apply to:',
      choices: [
        { name: '~/.claude (user)', value: 'user' },
        { name: '.claude (project)', value: 'project' }
      ]
    }
  ]);
  
  const destLabel = targetScope === 'user' ? '~/.claude' : '.claude';
  console.log(chalk.cyan(`\n  📥 Applying all to ${destLabel}...\n`));
  const spinner = ora('Applying...').start();
  const results = await applyAll(targetScope, source);
  spinner.succeed(`Applied ${results.length} items`);
  
  showSuccess('Apply Complete!');
  await backToMenu();
}

async function pullInteractive() {
  const { repo } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo',
      message: 'Enter repository (owner/repo):',
      validate: input => input.includes('/') || 'Please use format: owner/repo'
    }
  ]);
  
  console.log(chalk.cyan(`\n  📥 Pulling: ${repo}\n`));
  const spinner = ora('Fetching from GitHub...').start();
  
  try {
    const results = await pullFromGitHub(repo, { force: false });
    spinner.succeed(`Downloaded ${results.downloaded} files (skipped ${results.skipped})`);
    showSuccess('Pull Complete!');
  } catch (error) {
    spinner.fail('Pull failed');
    showError(error.message);
  }
  
  await backToMenu();
}

async function browseOnlineInteractive() {
  console.log(chalk.cyan('\n  🌐 Browse Online Repositories\n'));
  
  const spinner = ora('Fetching online repository list...').start();
  
  try {
    const repos = await fetchOnlineRepoList();
    spinner.stop();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('  No repositories found online.\n'));
      await backToMenu();
      return;
    }
    
    console.log(chalk.dim(`  Found ${repos.length} repositories:\n`));
    
    const { selectedRepo } = await inquirer.prompt([
      {
        type: 'rawlist',
        name: 'selectedRepo',
        message: 'Select a repository to pull:',
        choices: [
          ...repos.map(r => ({
            name: `📦 ${r.name} - ${chalk.dim(r.description || 'No description')}`,
            value: r,
            short: r.name
          })),
          new inquirer.Separator(),
          { name: '← Back to menu', value: null }
        ],
        pageSize: 10
      }
    ]);
    
    if (!selectedRepo) {
      await interactiveMode();
      return;
    }
    
    // Show repo details and confirm
    console.log(chalk.cyan(`\n  📦 ${selectedRepo.name}\n`));
    console.log(chalk.dim(`  URL:         ${selectedRepo.url}`));
    console.log(chalk.dim(`  Source:      ${selectedRepo.source || 'N/A'}`));
    console.log(chalk.dim(`  Description: ${selectedRepo.description || 'N/A'}`));
    console.log(chalk.dim(`  Added:       ${selectedRepo.addedAt || 'N/A'}\n`));
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Pull this repository to ~/.clsync?`,
        default: true
      }
    ]);
    
    if (confirm) {
      console.log();
      const pullSpinner = ora('Pulling from GitHub...').start();
      
      try {
        const results = await pullOnlineRepo(selectedRepo, { force: false });
        pullSpinner.succeed(`Downloaded ${results.downloaded} files to ~/.clsync/repos/${results.repoPath}`);
        
        showSuccess('Pull Complete!');
        
        // Redirect to browse pulled repos
        console.log(chalk.dim('  Opening pulled repositories...\n'));
        await browseReposInteractive();
        return;
      } catch (error) {
        pullSpinner.fail('Pull failed');
        showError(error.message);
      }
    }
  } catch (error) {
    spinner.fail('Failed to fetch online repositories');
    showError(error.message);
  }
  
  await backToMenu();
}

async function scopesInteractive() {
  const { project, user } = await listBothScopes();
  
  console.log(chalk.cyan('\n  👁 Comparing Scopes\n'));
  
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
  
  await backToMenu();
}

async function scanInteractive() {
  console.log(chalk.cyan('\n  📁 Scan Local Claude Projects\n'));
  
  // Get cached directories
  const { dirs, fromCache, cacheAge } = await getClaudeDirsWithCache({
    useCache: true,
    forceRefresh: false
  });
  
  const homeDir = os.homedir();
  
  // Show project list first
  if (dirs.length > 0) {
    console.log(chalk.white.bold('  📋 Cached Projects') + chalk.dim(` (${dirs.length}, cached ${cacheAge}m ago)`));
    console.log();
    
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const displayPath = dir.startsWith(homeDir) ? dir.replace(homeDir, '~') : dir;
      console.log(chalk.dim(`     ${String(i + 1).padStart(2)}. ${displayPath}`));
    }
    console.log();
  } else {
    console.log(chalk.yellow('  No cached projects found.\n'));
  }
  
  // Build choices
  const choices = [];
  
  // Add project selection options if projects exist
  if (dirs.length > 0) {
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const displayPath = dir.startsWith(homeDir) ? dir.replace(homeDir, '~') : dir;
      choices.push({ 
        name: `📁 ${displayPath}`, 
        value: { type: 'project', dir } 
      });
    }
  }
  
  // Add actions
  choices.push({ name: '🔍 Scan for projects (refresh)', value: { type: 'action', action: 'scan' } });
  choices.push({ name: '🗑️  Clear cache', value: { type: 'action', action: 'clear' } });
  choices.push({ name: '← Back', value: { type: 'action', action: 'back' } });
  
  const { selected } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'selected',
      message: dirs.length > 0 ? 'Select project or action:' : 'Select action:',
      choices,
      pageSize: 20
    }
  ]);
  
  if (selected.type === 'project') {
    await showProjectDetails(selected.dir);
  } else {
    switch (selected.action) {
      case 'scan':
        await scanProjectsInteractive();
        break;
      case 'clear':
        await clearScanCache();
        console.log(chalk.green('\n  ✓ Cache cleared\n'));
        await scanInteractive();
        break;
      case 'back':
        await interactiveMode(false);
        break;
    }
  }
}

async function scanProjectsInteractive() {
  const spinner = ora('Scanning for .claude directories...').start();
  
  const { dirs, fromCache, cacheAge } = await getClaudeDirsWithCache({
    useCache: false,
    forceRefresh: true
  });
  
  spinner.succeed(`Found ${dirs.length} projects ${chalk.dim('(cached)')}`);
  console.log();
  
  if (dirs.length === 0) {
    console.log(chalk.yellow('  No directories with .claude found.\n'));
    console.log(chalk.dim('  Tips:'));
    console.log(chalk.dim('    - Check if you have any Claude Code projects'));
    console.log(chalk.dim('    - Use CLI for custom paths: clsync scan -p ~/Projects\n'));
    await backToMenu();
    return;
  }
  
  // Display found directories
  console.log(chalk.white.bold('  📁 Found Projects:\n'));
  const homeDir = os.homedir();
  for (let i = 0; i < Math.min(dirs.length, 10); i++) {
    const dir = dirs[i];
    const displayPath = dir.startsWith(homeDir) ? dir.replace(homeDir, '~') : dir;
    console.log(chalk.dim(`     ${String(i + 1).padStart(2)}. ${displayPath}`));
  }
  if (dirs.length > 10) {
    console.log(chalk.dim(`     ... and ${dirs.length - 10} more`));
  }
  console.log();
  
  await backToMenu();
}

async function browseProjectsInteractive(page = 0) {
  const { dirs, fromCache, cacheAge } = await getClaudeDirsWithCache({
    useCache: true,
    forceRefresh: false
  });
  
  if (dirs.length === 0) {
    console.log(chalk.yellow('\n  No projects in cache.\n'));
    console.log(chalk.dim('  Run "Scan for .claude projects" first.\n'));
    await backToMenu();
    return;
  }
  
  const homeDir = os.homedir();
  const pageSize = 10;
  const totalPages = Math.ceil(dirs.length / pageSize);
  const currentPage = Math.min(Math.max(0, page), totalPages - 1);
  const startIdx = currentPage * pageSize;
  const endIdx = Math.min(startIdx + pageSize, dirs.length);
  const pageDirs = dirs.slice(startIdx, endIdx);
  
  console.log(chalk.dim(`\n  📦 ${dirs.length} projects ${fromCache ? `(cached ${cacheAge}m ago)` : '(fresh)'}`));
  console.log(chalk.dim(`  📄 Page ${currentPage + 1}/${totalPages}\n`));
  
  const choices = [
    ...pageDirs.map((dir, i) => {
      const displayPath = dir.startsWith(homeDir) ? dir.replace(homeDir, '~') : dir;
      const globalIdx = startIdx + i + 1;
      return { name: `${String(globalIdx).padStart(2)}. ${displayPath}`, value: dir };
    }),
    new inquirer.Separator()
  ];
  
  // Navigation options
  if (totalPages > 1) {
    if (currentPage > 0) {
      choices.push({ name: '◀ Previous page', value: '__prev__' });
    }
    if (currentPage < totalPages - 1) {
      choices.push({ name: '▶ Next page', value: '__next__' });
    }
  }
  choices.push({ name: '← Back', value: null });
  
  const { selectedDir } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedDir',
      message: 'Select a project:',
      choices,
      pageSize: 15
    }
  ]);
  
  if (selectedDir === '__prev__') {
    await browseProjectsInteractive(currentPage - 1);
    return;
  }
  if (selectedDir === '__next__') {
    await browseProjectsInteractive(currentPage + 1);
    return;
  }
  if (!selectedDir) {
    await scanInteractive();
    return;
  }
  
  // Show project details with settings
  await showProjectDetails(selectedDir);
}

async function showProjectDetails(projectDir) {
  const homeDir = os.homedir();
  const displayPath = projectDir.startsWith(homeDir) ? projectDir.replace(homeDir, '~') : projectDir;
  const claudeDir = join(projectDir, '.claude');
  
  console.log(chalk.cyan(`\n  📁 Project: ${displayPath}\n`));
  
  // Scan project-level settings
  let projectItems = [];
  try {
    projectItems = await scanItems(claudeDir);
  } catch {
    projectItems = [];
  }
  
  // Categorize items
  const skills = projectItems.filter(i => i.type === 'skill');
  const agents = projectItems.filter(i => i.type === 'agent');
  const styles = projectItems.filter(i => i.type === 'output-style');
  
  // Also check for slash commands (commands directory)
  const { readdir: readdirAsync } = await import('fs/promises');
  let commands = [];
  try {
    const commandsDir = join(claudeDir, 'commands');
    const commandFiles = await readdirAsync(commandsDir);
    commands = commandFiles
      .filter(f => f.endsWith('.md'))
      .map(f => ({ name: f.replace('.md', ''), type: 'command' }));
  } catch {
    // No commands directory
  }
  
  // Display settings
  if (skills.length > 0) {
    console.log(chalk.white.bold('  🎯 Skills'));
    for (const s of skills) {
      console.log(chalk.dim(`     - ${s.name}`));
    }
    console.log();
  }
  
  if (agents.length > 0) {
    console.log(chalk.white.bold('  🤖 Subagents'));
    for (const a of agents) {
      console.log(chalk.dim(`     - ${a.name}`));
    }
    console.log();
  }
  
  if (commands.length > 0) {
    console.log(chalk.white.bold('  ⚡ Slash Commands'));
    for (const c of commands) {
      console.log(chalk.dim(`     - /${c.name}`));
    }
    console.log();
  }
  
  if (styles.length > 0) {
    console.log(chalk.white.bold('  ✨ Output Styles'));
    for (const s of styles) {
      console.log(chalk.dim(`     - ${s.name}`));
    }
    console.log();
  }
  
  const allItems = [...skills, ...agents, ...styles];
  const totalItems = allItems.length + commands.length;
  
  if (totalItems === 0) {
    console.log(chalk.dim('  (No project-level settings found)\n'));
  }
  
  // Build action choices
  const choices = [];
  
  // Add promote options for project items (only skills, agents, output-styles can be promoted)
  if (allItems.length > 0) {
    choices.push({ name: '📤 Promote setting to user level (~/.claude)', value: 'promote' });
  }
  
  // Add demote option (needs to check user-level items)
  choices.push({ name: '📥 Demote setting from user level', value: 'demote' });
  
  // Other actions
  choices.push({ name: '📋 Copy path to clipboard', value: 'copy' });
  choices.push({ name: '📂 Open in Finder', value: 'open' });
  choices.push({ name: '🤖 Run claude here', value: 'claude' });
  choices.push({ name: '💻 Print cd command', value: 'cd' });
  choices.push({ name: '← Back', value: 'back' });
  
  const { projectAction } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'projectAction',
      message: 'What would you like to do?',
      choices
    }
  ]);
  
  if (projectAction === 'back') {
    await scanInteractive();
    return;
  }
  
  if (projectAction === 'promote') {
    await promoteFromProject(projectDir, allItems);
    return;
  }
  
  if (projectAction === 'demote') {
    await demoteToProject(projectDir);
    return;
  }
  
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);
  const { spawn } = await import('child_process');
  
  switch (projectAction) {
    case 'copy':
      const copyCmd = process.platform === 'darwin' ? 'pbcopy' : 
                     process.platform === 'win32' ? 'clip' : 'xclip -selection clipboard';
      await execPromise(`echo -n "${projectDir}" | ${copyCmd}`);
      console.log(chalk.green(`\n  ✓ Copied to clipboard: ${displayPath}\n`));
      break;
      
    case 'open':
      const openCmd = process.platform === 'darwin' ? 'open' : 
                     process.platform === 'win32' ? 'explorer' : 'xdg-open';
      await execPromise(`${openCmd} "${projectDir}"`);
      console.log(chalk.green(`\n  ✓ Opened: ${displayPath}\n`));
      break;
      
    case 'claude':
      console.log(chalk.cyan(`\n  🤖 Starting Claude in: ${displayPath}\n`));
      exitAltScreen();
      showCursor();
      spawn('claude', [], {
        cwd: projectDir,
        stdio: 'inherit',
        shell: true
      });
      return; // Exit interactive mode
      
    case 'cd':
      console.log(chalk.cyan(`\n  💡 Run this command:\n`));
      console.log(chalk.white.bold(`     cd "${projectDir}"\n`));
      break;
  }
  
  await showProjectDetails(projectDir);
}

async function promoteFromProject(projectDir, projectItems) {
  const homeDir = os.homedir();
  const displayPath = projectDir.startsWith(homeDir) ? projectDir.replace(homeDir, '~') : projectDir;
  
  console.log(chalk.cyan(`\n  📤 Promote to User Level (~/.claude)\n`));
  console.log(chalk.dim(`  From: ${displayPath}/.claude\n`));
  
  if (projectItems.length === 0) {
    console.log(chalk.yellow('  No promotable items found.\n'));
    await showProjectDetails(projectDir);
    return;
  }
  
  const choices = projectItems.map(item => {
    const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
    return { name: `${icon} ${item.name} (${item.type})`, value: item.name };
  });
  choices.push({ name: '← Cancel', value: null });
  
  const { itemToPromote } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'itemToPromote',
      message: 'Select item to promote:',
      choices
    }
  ]);
  
  if (!itemToPromote) {
    await showProjectDetails(projectDir);
    return;
  }
  
  // Change to project directory temporarily and promote
  const originalCwd = process.cwd();
  try {
    process.chdir(projectDir);
    
    const spinner = ora(`Promoting ${itemToPromote}...`).start();
    const result = await promoteItem(itemToPromote, { force: false });
    spinner.succeed(`Promoted: ${result.newName}`);
    
    console.log(chalk.dim(`\n  ✓ ${result.item.type}: ${result.newName}`));
    console.log(chalk.dim(`  Now available globally in ~/.claude\n`));
  } catch (error) {
    console.log(chalk.red(`\n  ✗ ${error.message}\n`));
  } finally {
    process.chdir(originalCwd);
  }
  
  await showProjectDetails(projectDir);
}

async function demoteToProject(projectDir) {
  const homeDir = os.homedir();
  const displayPath = projectDir.startsWith(homeDir) ? projectDir.replace(homeDir, '~') : projectDir;
  const userClaudeDir = join(homeDir, '.claude');
  
  console.log(chalk.cyan(`\n  📥 Demote to Project Level\n`));
  console.log(chalk.dim(`  To: ${displayPath}/.claude\n`));
  
  // Scan user-level settings
  let userItems = [];
  try {
    userItems = await scanItems(userClaudeDir);
  } catch {
    userItems = [];
  }
  
  if (userItems.length === 0) {
    console.log(chalk.yellow('  No user-level items found to demote.\n'));
    await showProjectDetails(projectDir);
    return;
  }
  
  const choices = userItems.map(item => {
    const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
    return { name: `${icon} ${item.name} (${item.type})`, value: item.name };
  });
  choices.push({ name: '← Cancel', value: null });
  
  const { itemToDemote } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'itemToDemote',
      message: 'Select item to demote:',
      choices
    }
  ]);
  
  if (!itemToDemote) {
    await showProjectDetails(projectDir);
    return;
  }
  
  // Change to project directory temporarily and demote
  const originalCwd = process.cwd();
  try {
    process.chdir(projectDir);
    
    const spinner = ora(`Demoting ${itemToDemote}...`).start();
    const result = await demoteItem(itemToDemote, { force: false });
    spinner.succeed(`Demoted: ${result.newName}`);
    
    console.log(chalk.dim(`\n  ✓ ${result.item.type}: ${result.newName}`));
    console.log(chalk.dim(`  Now project-specific in .claude\n`));
  } catch (error) {
    console.log(chalk.red(`\n  ✗ ${error.message}\n`));
  } finally {
    process.chdir(originalCwd);
  }
  
  await showProjectDetails(projectDir);
}

async function backToMenu() {
  const { back } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'back',
      message: 'Back to menu?',
      default: true
    }
  ]);
  
  if (back) {
    await interactiveMode(false);
  } else {
    exitAltScreen();
    showCursor();
    console.log(chalk.dim('\n  Bye! 👋\n'));
  }
}

// Show banner only for --version and --help
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-V') || 
    args.includes('--help') || args.includes('-h')) {
  showBanner();
}

// Handle interactive mode when no arguments
if (args.length === 0) {
  interactiveMode().catch(err => {
    showError(err.message);
    process.exit(1);
  });
} else {
  // Normal CLI mode

// Main program
program
  .name("clsync")
  .description("Sync Claude Code settings via ~/.clsync staging area")
  .version("0.2.3");

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
      console.log(chalk.dim('    │   ├── clsync.json'));
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
// LOCAL (GitHub account & repository link)
// ============================================================================
program
  .command("local")
  .description("Manage local staging area and GitHub repository link")
  .option("-l, --link <repo>", "Link to GitHub repository (owner/repo)")
  .option("-u, --unlink", "Unlink from GitHub repository")
  .option("-a, --account", "Show GitHub account info only")
  .action(async (options) => {
    try {
      if (options.link) {
        // Link to repository
        console.log(chalk.cyan(`\n  🔗 Linking to GitHub repository: ${options.link}\n`));
        const spinner = ora('Connecting...').start();
        
        try {
          const result = await linkLocalRepo(options.link);
          spinner.succeed(`Linked to ${result.repository}`);
          
          console.log(chalk.dim(`\n  Account:    @${result.account.username}`));
          console.log(chalk.dim(`  Repository: ${result.repository}`));
          console.log(chalk.dim(`  Protocol:   ${result.account.protocol}\n`));
          
          showSuccess('Repository Linked!');
        } catch (error) {
          spinner.fail('Failed to link');
          showError(error.message);
          process.exit(1);
        }
        return;
      }

      if (options.unlink) {
        // Unlink from repository
        console.log(chalk.cyan('\n  🔓 Unlinking from repository...\n'));
        
        try {
          const result = await unlinkLocalRepo();
          console.log(chalk.dim(`  Unlinked from: ${result.unlinked.owner}/${result.unlinked.repo}\n`));
          showSuccess('Repository Unlinked!');
        } catch (error) {
          showError(error.message);
          process.exit(1);
        }
        return;
      }

      if (options.account) {
        // Show account info only
        console.log(chalk.cyan('\n  👤 GitHub Account Info\n'));
        
        try {
          const accountInfo = await getGitHubAccountInfo();
          console.log(chalk.white.bold('  Account:  ') + chalk.green(`@${accountInfo.username}`));
          console.log(chalk.white.bold('  Host:     ') + chalk.dim(accountInfo.host));
          console.log(chalk.white.bold('  Protocol: ') + chalk.dim(accountInfo.protocol));
          console.log(chalk.white.bold('  Scopes:   ') + chalk.dim(accountInfo.scopes.join(', ')));
          console.log();
        } catch (error) {
          showError(error.message);
          process.exit(1);
        }
        return;
      }

      // Default: Show local info
      console.log(chalk.cyan('\n  📦 Local Staging Area\n'));
      
      const info = await getLocalInfo();
      
      // Account info
      if (info.account) {
        console.log(chalk.white.bold('  👤 GitHub Account'));
        console.log(chalk.dim(`     @${info.account.username} (${info.account.host})`));
      } else {
        console.log(chalk.yellow('  ⚠️  GitHub CLI not configured'));
        console.log(chalk.dim('     Run: gh auth login'));
      }
      console.log();

      // Repository link
      if (info.repository) {
        console.log(chalk.white.bold('  🔗 Linked Repository'));
        console.log(chalk.dim(`     ${info.repository.owner}/${info.repository.repo}`));
        console.log(chalk.dim(`     ${info.repository.url}`));
        console.log(chalk.dim(`     Linked: ${info.repository.linked_at}`));
      } else {
        console.log(chalk.dim('  📭 No repository linked'));
        console.log(chalk.dim('     Link with: clsync local --link owner/repo'));
      }
      console.log();

      // Staged items
      console.log(chalk.white.bold('  📋 Staged Items:') + chalk.dim(` ${info.staged.length} items`));
      if (info.staged.length > 0) {
        for (const item of info.staged) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          console.log(chalk.dim(`     ${icon} ${item.name}`));
        }
      }
      console.log();

      // Usage hints
      if (info.repository && info.staged.length > 0) {
        console.log(chalk.dim('  💡 Push to GitHub: clsync push'));
      } else if (!info.repository) {
        console.log(chalk.dim('  💡 Link a repo: clsync local --link owner/repo'));
      } else {
        console.log(chalk.dim('  💡 Stage items: clsync stage -u -a'));
      }
      console.log();

    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// README (Generate README.md from clsync.json)
// ============================================================================
program
  .command("readme")
  .description("Generate README.md from clsync.json (template-based, no AI)")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("-s, --save", "Save to ~/.clsync/local/README.md")
  .action(async (options) => {
    try {
      const info = await getLocalInfo();
      
      if (!info.clsyncJson) {
        showError('No clsync.json found. Run: clsync init');
        process.exit(1);
      }

      const readme = generateReadmeFromClsyncJson(info.clsyncJson);

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, readme, 'utf-8');
        console.log(chalk.green(`  ✓ README.md saved to: ${options.output}\n`));
      } else if (options.save) {
        const { writeFile } = await import('fs/promises');
        const path = join(os.homedir(), '.clsync', 'local', 'README.md');
        await writeFile(path, readme, 'utf-8');
        console.log(chalk.green(`  ✓ README.md saved to: ${path}\n`));
      } else {
        // Output to stdout
        console.log(readme);
      }
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
// PUSH
// ============================================================================
program
  .command("push [repo]")
  .description("Push settings to GitHub repository (uses linked repo if not specified)")
  .option("-s, --scope <scope>", "Scope: local, user, or project", "local")
  .option("-m, --message <msg>", "Commit message", "Update clsync settings")
  .option("-f, --force", "Force push (overwrites remote)")
  .option("-v, --verbose", "Verbose output")
  .action(async (repo, options) => {
    try {
      const scope = options.scope;
      const scopeLabel = scope === 'local' ? '~/.clsync/local' : 
                         scope === 'user' ? '~/.claude' : '.claude';
      
      console.log(chalk.cyan(`  📤 Pushing from: ${scopeLabel}\n`));
      
      // Check for linked repository if no repo specified and scope is local
      if (!repo && scope === 'local') {
        const info = await getLocalInfo();
        if (info.repository) {
          console.log(chalk.dim(`  🔗 Using linked repository: ${info.repository.owner}/${info.repository.repo}\n`));
        } else {
          console.log(chalk.yellow('  ⚠️  No repository specified and no linked repository found.\n'));
          console.log(chalk.dim('  Link a repository first:'));
          console.log(chalk.dim('     clsync local --link owner/repo\n'));
          console.log(chalk.dim('  Or specify a repository:'));
          console.log(chalk.dim('     clsync push owner/repo\n'));
          process.exit(1);
        }
      }
      
      const spinner = ora('Preparing settings for push...').start();
      const results = await pushToGitHub(scope, {
        repo,
        message: options.message,
        force: options.force,
        onProgress: msg => { if (options.verbose) spinner.text = msg; }
      });
      
      if (results.pushed) {
        spinner.succeed(`Pushed ${results.pushed} items to ${results.repo}`);
        
        console.log(chalk.dim(`\n  Items pushed:`));
        for (const item of results.items) {
          console.log(chalk.dim(`     ✓ ${item.type}: ${item.name}`));
        }
        
        console.log(chalk.dim(`\n  Others can now use:`));
        console.log(chalk.dim(`     clsync pull ${results.repo}`));
        showSuccess('Push Complete!');
      } else if (results.prepared) {
        spinner.succeed(`Prepared ${results.prepared} items for push`);
        console.log(chalk.yellow(`\n  ${results.instructions}`));
      }
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
// ONLINE (Browse online repository registry)
// ============================================================================
program
  .command("online")
  .description("Browse and pull from online repository registry")
  .action(async () => {
    try {
      console.log(chalk.cyan('  🌐 Online Repository Registry\n'));
      
      const spinner = ora('Fetching online repository list...').start();
      const repos = await fetchOnlineRepoList();
      spinner.stop();
      
      if (repos.length === 0) {
        console.log(chalk.yellow('  No repositories found.\n'));
        return;
      }
      
      console.log(chalk.dim(`  Found ${repos.length} repositories:\n`));
      
      for (const repo of repos) {
        console.log(chalk.white.bold(`  📦 ${repo.name}`));
        console.log(chalk.dim(`     ${repo.description || 'No description'}`));
        console.log(chalk.dim(`     URL: ${repo.url}`));
        console.log(chalk.dim(`     Source: ${repo.source || 'N/A'}`));
        console.log();
      }
      
      console.log(chalk.dim('  To pull a repository interactively, run: clsync\n'));
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
  .option("-u, --user", "Save to ~/.clsync/docs (default)")
  .option("-p, --project", "Save to .clsync (project local)")
  .option("-v, --verbose", "Verbose")
  .option("-d, --dry-run", "Preview")
  .option("-f, --force", "Overwrite")
  .action(async (options) => {
    try {
      
      const config = await loadConfig(options.config);
      
      // Default: ~/.clsync/docs, with -p option: .clsync
      if (options.project) {
        config.output.directory = ".clsync";
        console.log(chalk.dim(`  📁 Scope: .clsync (project)\n`));
      } else {
        config.output.directory = join(os.homedir(), ".clsync", "docs");
        console.log(chalk.dim(`  📁 Scope: ~/.clsync/docs\n`));
      }
      
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

// ============================================================================
// LINK: Link skills/subagents to slash commands
// ============================================================================
program
  .command("link [type] [name]")
  .description("Link skills/subagents to slash commands")
  .option("-u, --user", "User scope (default)", true)
  .option("-p, --project", "Project scope")
  .option("-a, --all", "Link all skills and agents")
  .option("--skills-only", "Only link skills (with --all)")
  .option("--agents-only", "Only link agents (with --all)")
  .option("-n, --name <custom-name>", "Custom slash command name")
  .action(async (type, name, options) => {
    try {
      const scope = options.project ? "project" : "user";
      const spinner = ora();

      // Link all
      if (options.all) {
        spinner.start("Linking all skills and agents...");
        const results = await linkAll({
          scope,
          skillsOnly: options.skillsOnly,
          agentsOnly: options.agentsOnly
        });
        spinner.succeed();

        console.log(chalk.cyan("\n  📋 Linking Results:\n"));
        if (results.skills.length > 0) {
          console.log(chalk.bold("  Skills:"));
          results.skills.forEach(r => {
            console.log(chalk.dim(`    ✓ ${r.skill} → /${r.command}`));
          });
        }
        if (results.agents.length > 0) {
          console.log(chalk.bold("\n  Subagents:"));
          results.agents.forEach(r => {
            console.log(chalk.dim(`    ✓ ${r.agent} → /${r.command}`));
          });
        }
        console.log();

        showSuccess('All links created!');
        return;
      }

      // Validate arguments
      if (!type || !name) {
        showError("Usage: clsync link <skill|agent> <name>");
        process.exit(1);
      }

      // Link single item
      let result;
      if (type === "skill") {
        spinner.start(`Linking skill "${name}"...`);
        result = await linkSkillToCommand(name, {
          scope,
          commandName: options.name
        });
        spinner.succeed();
        console.log(chalk.dim(`\n  ✓ Linked: ${result.skill} → /${result.command}\n`));
      } else if (type === "agent") {
        spinner.start(`Linking subagent "${name}"...`);
        result = await linkSubagentToCommand(name, {
          scope,
          commandName: options.name
        });
        spinner.succeed();
        console.log(chalk.dim(`\n  ✓ Linked: ${result.agent} → /${result.command}\n`));
      } else {
        showError(`Unknown type "${type}". Use "skill" or "agent"`);
        process.exit(1);
      }

      showSuccess('Link created!');
    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

// ============================================================================
// SCAN: Find all .claude directories and run claude command
// ============================================================================
program
  .command("scan")
  .description("Find all directories with .claude and run claude command on each")
  .option("-p, --path <paths...>", "Specific paths to search (can specify multiple)")
  .option("-d, --depth <n>", "Maximum search depth", "4")
  .option("-e, --exclude <patterns...>", "Patterns to exclude (e.g., node_modules)")
  .option("-c, --cmd <args>", "Claude command/prompt to run (default: /review)")
  .option("-l, --list", "Only list directories, don't run commands (dry run)")
  .option("-i, --interactive", "Run claude interactively for each directory")
  .option("-r, --refresh", "Force fresh scan (ignore cache)")
  .option("-g, --go", "Select a project and navigate to it")
  .option("-o, --open", "Open selected project in Finder/file manager")
  .option("--cache-info", "Show cache information")
  .option("--clear-cache", "Clear scan cache")
  .option("-v, --verbose", "Show detailed output")
  .action(async (options) => {
    try {
      // Handle cache info
      if (options.cacheInfo) {
        console.log(chalk.cyan('\n  📦 Scan Cache Info\n'));
        
        const info = await getScanCacheInfo();
        
        if (!info.exists) {
          console.log(chalk.yellow('  No cache found.\n'));
          console.log(chalk.dim('  Run: clsync scan --list\n'));
        } else {
          console.log(chalk.white.bold('  Cache Status:') + (info.isValid ? chalk.green(' Valid') : chalk.yellow(' Expired')));
          console.log(chalk.dim(`  Directories: ${info.dirs}`));
          console.log(chalk.dim(`  Scanned at:  ${info.scannedAt}`));
          console.log(chalk.dim(`  Age:         ${info.ageMinutes} minutes`));
          console.log(chalk.dim(`  Location:    ~/.clsync/scan-cache.json\n`));
          
          if (!info.isValid) {
            console.log(chalk.dim('  💡 Cache expired. Run: clsync scan --refresh\n'));
          }
        }
        process.exit(0);
      }

      // Handle clear cache
      if (options.clearCache) {
        console.log(chalk.cyan('\n  🗑️  Clearing scan cache...\n'));
        await clearScanCache();
        console.log(chalk.green('  ✓ Cache cleared\n'));
        process.exit(0);
      }

      // Handle --go (select project)
      if (options.go || options.open) {
        console.log(chalk.cyan('\n  📁 Select a Project\n'));
        
        const { dirs, fromCache, cacheAge } = await getClaudeDirsWithCache({
          useCache: true,
          forceRefresh: false
        });

        if (dirs.length === 0) {
          console.log(chalk.yellow('  No projects found in cache.\n'));
          console.log(chalk.dim('  Run: clsync scan --list\n'));
          process.exit(0);
        }

        if (fromCache) {
          console.log(chalk.dim(`  Using cache (${cacheAge}m old, ${dirs.length} projects)\n`));
        }

        const inquirer = await import('inquirer');
        const homeDir = os.homedir();

        const { selectedDir } = await inquirer.default.prompt([
          {
            type: 'list',
            name: 'selectedDir',
            message: 'Select a project:',
            choices: [
              ...dirs.map((dir, i) => {
                const displayPath = dir.startsWith(homeDir) 
                  ? dir.replace(homeDir, '~') 
                  : dir;
                return { name: `${String(i + 1).padStart(2)}. ${displayPath}`, value: dir };
              }),
              new inquirer.default.Separator(),
              { name: '❌ Cancel', value: null }
            ],
            pageSize: 15
          }
        ]);

        if (!selectedDir) {
          console.log(chalk.dim('\n  Cancelled.\n'));
          process.exit(0);
        }

        const displayPath = selectedDir.startsWith(homeDir) 
          ? selectedDir.replace(homeDir, '~') 
          : selectedDir;

        // If --open, open in Finder
        if (options.open) {
          console.log(chalk.cyan(`\n  📂 Opening: ${displayPath}\n`));
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execPromise = promisify(exec);
          
          // macOS: open, Linux: xdg-open, Windows: explorer
          const openCmd = process.platform === 'darwin' ? 'open' : 
                         process.platform === 'win32' ? 'explorer' : 'xdg-open';
          await execPromise(`${openCmd} "${selectedDir}"`);
          console.log(chalk.green('  ✓ Opened in file manager\n'));
          process.exit(0);
        }

        // Show action menu for --go
        const { action } = await inquirer.default.prompt([
          {
            type: 'list',
            name: 'action',
            message: `What would you like to do with ${displayPath}?`,
            choices: [
              { name: '📋 Copy path to clipboard', value: 'copy' },
              { name: '📂 Open in Finder', value: 'open' },
              { name: '🤖 Run claude here', value: 'claude' },
              { name: '💻 Print cd command', value: 'cd' },
              new inquirer.default.Separator(),
              { name: '← Back', value: null }
            ]
          }
        ]);

        if (!action) {
          process.exit(0);
        }

        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);

        switch (action) {
          case 'copy':
            // macOS: pbcopy, Linux: xclip, Windows: clip
            const copyCmd = process.platform === 'darwin' ? 'pbcopy' : 
                           process.platform === 'win32' ? 'clip' : 'xclip -selection clipboard';
            await execPromise(`echo -n "${selectedDir}" | ${copyCmd}`);
            console.log(chalk.green(`\n  ✓ Copied to clipboard: ${displayPath}\n`));
            break;

          case 'open':
            const openCmd = process.platform === 'darwin' ? 'open' : 
                           process.platform === 'win32' ? 'explorer' : 'xdg-open';
            await execPromise(`${openCmd} "${selectedDir}"`);
            console.log(chalk.green(`\n  ✓ Opened: ${displayPath}\n`));
            break;

          case 'claude':
            console.log(chalk.cyan(`\n  🤖 Starting Claude in: ${displayPath}\n`));
            const { spawn } = await import('child_process');
            spawn('claude', [], {
              cwd: selectedDir,
              stdio: 'inherit',
              shell: true
            });
            break;

          case 'cd':
            console.log(chalk.cyan(`\n  💡 Run this command:\n`));
            console.log(chalk.white.bold(`     cd "${selectedDir}"\n`));
            break;
        }

        process.exit(0);
      }

      console.log(chalk.cyan('\n  🔍 Scanning for Claude Code Projects\n'));

      const searchPaths = options.path || undefined;
      const maxDepth = parseInt(options.depth) || 4;
      const exclude = options.exclude || undefined;
      const claudeArgs = options.cmd ? options.cmd.split(' ') : undefined;
      const dryRun = options.list || false;
      const verbose = options.verbose || false;
      const forceRefresh = options.refresh || false;

      if (searchPaths) {
        console.log(chalk.dim(`  Search paths: ${searchPaths.join(', ')}\n`));
      }

      // Get directories (with cache support)
      const spinner = ora('Searching for .claude directories...').start();
      
      const { dirs, fromCache, scannedAt, cacheAge } = await getClaudeDirsWithCache({
        searchPaths,
        maxDepth,
        exclude,
        forceRefresh,
        useCache: !forceRefresh
      });

      if (fromCache) {
        spinner.succeed(`Found ${dirs.length} directories ${chalk.dim(`(from cache, ${cacheAge}m old)`)}`);
      } else {
        spinner.succeed(`Found ${dirs.length} directories with .claude ${chalk.dim('(fresh scan, cached)')}`);      }
      console.log();

      if (dirs.length === 0) {
        console.log(chalk.yellow('  No directories with .claude found.\n'));
        console.log(chalk.dim('  Tips:'));
        console.log(chalk.dim('    - Check if you have any Claude Code projects'));
        console.log(chalk.dim('    - Try specifying a path: clsync scan -p ~/Projects'));
        console.log(chalk.dim('    - Increase search depth: clsync scan -d 6\n'));
        process.exit(0);
      }

      // Display found directories
      console.log(chalk.white.bold('  📁 Found Projects:\n'));
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const homeDir = os.homedir();
        const displayPath = dir.startsWith(homeDir) 
          ? dir.replace(homeDir, '~') 
          : dir;
        console.log(chalk.dim(`     ${String(i + 1).padStart(2)}. ${displayPath}`));
      }
      console.log();

      if (dryRun) {
        if (fromCache) {
          console.log(chalk.dim(`  (Cached ${cacheAge}m ago. Use --refresh for fresh scan)\n`));
        } else {
          console.log(chalk.dim('  (Results cached to ~/.clsync/scan-cache.json)\n'));
        }
        process.exit(0);
      }

      // Ask for confirmation if running commands
      const inquirer = await import('inquirer');
      const { confirm } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Run claude ${claudeArgs ? claudeArgs.join(' ') : '/review'} on all ${dirs.length} directories?`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.dim('\n  Cancelled.\n'));
        process.exit(0);
      }

      console.log();

      // If interactive mode, run one at a time
      if (options.interactive) {
        for (let i = 0; i < dirs.length; i++) {
          const dir = dirs[i];
          const homeDir = os.homedir();
          const displayPath = dir.startsWith(homeDir) 
            ? dir.replace(homeDir, '~') 
            : dir;
          
          console.log(chalk.cyan(`\n  [${i + 1}/${dirs.length}] 📁 ${displayPath}\n`));
          
          const { runThis } = await inquirer.default.prompt([
            {
              type: 'confirm',
              name: 'runThis',
              message: 'Run claude interactively?',
              default: true
            }
          ]);

          if (runThis) {
            const { spawn } = await import('child_process');
            await new Promise((resolve) => {
              const proc = spawn('claude', claudeArgs || ['/review'], {
                cwd: dir,
                stdio: 'inherit',
                shell: true
              });
              proc.on('close', resolve);
            });
          }
        }
        
        showSuccess('Scan Complete!');
      } else {
        // Non-interactive batch mode
        const results = await scanLocalClaudeDirs({
          searchPaths,
          maxDepth,
          exclude,
          claudeArgs,
          dryRun: false,
          sequential: true,
          onProgress: (msg) => {
            if (verbose) {
              console.log(chalk.dim(`     ${msg}`));
            }
          }
        });

        console.log(chalk.cyan('\n  📊 Results:\n'));
        
        let successCount = 0;
        let failCount = 0;

        for (const result of results.results) {
          const homeDir = os.homedir();
          const displayPath = result.dir.startsWith(homeDir) 
            ? result.dir.replace(homeDir, '~') 
            : result.dir;

          if (result.success) {
            console.log(chalk.green(`     ✓ ${displayPath}`));
            successCount++;
          } else {
            console.log(chalk.red(`     ✗ ${displayPath}`));
            if (verbose && result.error) {
              console.log(chalk.dim(`       Error: ${result.error}`));
            }
            failCount++;
          }
        }

        console.log();
        console.log(chalk.dim(`  Summary: ${successCount} succeeded, ${failCount} failed\n`));
        
        showSuccess('Scan Complete!');
      }

    } catch (error) {
      showError(error.message);
      process.exit(1);
    }
  });

program.parse();

} // end of else block for interactive mode
