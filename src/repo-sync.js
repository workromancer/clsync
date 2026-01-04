/**
 * CLSYNC - Claude Code Settings Sync
 *
 * Architecture:
 * ~/.clsync/
 *   ├── manifest.json
 *   ├── local/           # Staged from ~/.claude or .claude
 *   └── repos/           # Pulled from GitHub
 *       └── owner/repo/
 */

import { mkdir, writeFile, readdir, stat, readFile, cp, rm } from "fs/promises";
import { join, dirname, basename } from "path";
import { existsSync } from "fs";
import os from "os";

const SETTINGS_DIRS = ["skills", "agents", "output-styles"];
const CLSYNC_DIR = join(os.homedir(), ".clsync");
const LOCAL_DIR = join(CLSYNC_DIR, "local");
const REPOS_DIR = join(CLSYNC_DIR, "repos");
const MANIFEST_FILE = join(CLSYNC_DIR, "manifest.json");

const LOCAL_CLSYNC_JSON = join(LOCAL_DIR, "clsync.json");

/**
 * Initialize ~/.clsync directory
 */
export async function initClsync() {
  await mkdir(CLSYNC_DIR, { recursive: true });
  await mkdir(LOCAL_DIR, { recursive: true });
  await mkdir(REPOS_DIR, { recursive: true });

  for (const dir of SETTINGS_DIRS) {
    await mkdir(join(LOCAL_DIR, dir), { recursive: true });
  }

  if (!existsSync(MANIFEST_FILE)) {
    await saveManifest({
      version: "1.0.0",
      repos: {},
      last_updated: new Date().toISOString(),
    });
  }

  // Create local clsync.json if not exists
  if (!existsSync(LOCAL_CLSYNC_JSON)) {
    const clsyncJson = {
      $schema: "https://clsync.dev/schema/v1.json",
      version: "1.0.0",
      name: "local",
      description: "Local staging area for Claude Code settings",
      author: os.userInfo().username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
      stats: {
        skills: 0,
        agents: 0,
        output_styles: 0,
        total: 0,
      },
    };
    await writeFile(LOCAL_CLSYNC_JSON, JSON.stringify(clsyncJson, null, 2), "utf-8");
  }
}

/**
 * Update ~/.clsync/local/clsync.json with current staged items
 */
async function updateLocalClsyncJson() {
  const staged = await scanItems(LOCAL_DIR);
  
  let existing = {};
  try {
    const content = await readFile(LOCAL_CLSYNC_JSON, "utf-8");
    existing = JSON.parse(content);
  } catch {
    existing = {
      $schema: "https://clsync.dev/schema/v1.json",
      version: "1.0.0",
      name: "local",
      description: "Local staging area for Claude Code settings",
      author: os.userInfo().username,
      created_at: new Date().toISOString(),
    };
  }

  const clsyncJson = {
    ...existing,
    updated_at: new Date().toISOString(),
    items: staged.map((item) => ({
      type: item.type,
      name: item.name,
      path: item.path,
      description: item.description || null,
    })),
    stats: {
      skills: staged.filter((i) => i.type === "skill").length,
      agents: staged.filter((i) => i.type === "agent").length,
      output_styles: staged.filter((i) => i.type === "output-style").length,
      total: staged.length,
    },
  };

  await writeFile(LOCAL_CLSYNC_JSON, JSON.stringify(clsyncJson, null, 2), "utf-8");
}

// =============================================================================
// GITHUB ACCOUNT & LOCAL REPOSITORY LINK
// =============================================================================

import { execSync } from "child_process";

/**
 * Check if gh CLI is installed
 */
function isGhInstalled() {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get GitHub account info from gh CLI
 */
export async function getGitHubAccountInfo() {
  if (!isGhInstalled()) {
    throw new Error(
      "GitHub CLI (gh) is not installed.\n\n" +
      "Install it with:\n" +
      "  brew install gh     # macOS\n" +
      "  sudo apt install gh # Ubuntu/Debian\n\n" +
      "Then authenticate:\n" +
      "  gh auth login"
    );
  }

  try {
    const statusOutput = execSync("gh auth status 2>&1", { encoding: "utf-8" });
    
    // Parse account info
    const accountMatch = statusOutput.match(/Logged in to ([\w.]+) account (\w+)/);
    const protocolMatch = statusOutput.match(/Git operations protocol: (\w+)/);
    const scopesMatch = statusOutput.match(/Token scopes: '([^']+)'/);
    
    if (!accountMatch) {
      throw new Error("Not logged in to GitHub. Run: gh auth login");
    }

    return {
      host: accountMatch[1],
      username: accountMatch[2],
      protocol: protocolMatch ? protocolMatch[1] : "https",
      scopes: scopesMatch ? scopesMatch[1].split("', '") : [],
      authenticated: true,
    };
  } catch (error) {
    if (error.message.includes("Not logged in")) {
      throw error;
    }
    throw new Error("Failed to get GitHub account info: " + error.message);
  }
}

/**
 * Link local staging to a GitHub repository
 */
export async function linkLocalRepo(repoUrl) {
  await initClsync();
  
  const { owner, repo } = parseRepoUrl(repoUrl);
  const accountInfo = await getGitHubAccountInfo();
  
  // Update clsync.json with repository info
  let clsyncJson = {};
  try {
    const content = await readFile(LOCAL_CLSYNC_JSON, "utf-8");
    clsyncJson = JSON.parse(content);
  } catch {
    clsyncJson = {
      $schema: "https://clsync.dev/schema/v1.json",
      version: "1.0.0",
      name: "local",
      description: "Local staging area for Claude Code settings",
      author: accountInfo.username,
      created_at: new Date().toISOString(),
      items: [],
      stats: { skills: 0, agents: 0, output_styles: 0, total: 0 },
    };
  }

  clsyncJson.repository = {
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    linked_at: new Date().toISOString(),
    linked_by: accountInfo.username,
  };
  clsyncJson.author = accountInfo.username;
  clsyncJson.updated_at = new Date().toISOString();

  await writeFile(LOCAL_CLSYNC_JSON, JSON.stringify(clsyncJson, null, 2), "utf-8");

  return {
    repository: `${owner}/${repo}`,
    account: accountInfo,
    clsyncJson,
  };
}

/**
 * Unlink local staging from repository
 */
export async function unlinkLocalRepo() {
  let clsyncJson = {};
  try {
    const content = await readFile(LOCAL_CLSYNC_JSON, "utf-8");
    clsyncJson = JSON.parse(content);
  } catch {
    throw new Error("No local clsync.json found. Run: clsync init");
  }

  if (!clsyncJson.repository) {
    throw new Error("No repository is linked.");
  }

  const previousRepo = clsyncJson.repository;
  delete clsyncJson.repository;
  clsyncJson.updated_at = new Date().toISOString();

  await writeFile(LOCAL_CLSYNC_JSON, JSON.stringify(clsyncJson, null, 2), "utf-8");

  return { unlinked: previousRepo };
}

/**
 * Get local staging info including linked repo
 */
export async function getLocalInfo() {
  await initClsync();
  
  let clsyncJson = {};
  try {
    const content = await readFile(LOCAL_CLSYNC_JSON, "utf-8");
    clsyncJson = JSON.parse(content);
  } catch {
    clsyncJson = null;
  }

  let accountInfo = null;
  try {
    accountInfo = await getGitHubAccountInfo();
  } catch {
    // gh not installed or not authenticated
  }

  const staged = await scanItems(LOCAL_DIR);

  return {
    clsyncJson,
    account: accountInfo,
    staged,
    repository: clsyncJson?.repository || null,
  };
}

/**
 * Generate README.md content from clsync.json
 * Template-based, no AI involved
 */
export function generateReadmeFromClsyncJson(clsyncJson, repoPath = null) {
  const { name, description, author, items = [], stats = {}, repository } = clsyncJson;
  
  const repoName = repoPath || (repository ? `${repository.owner}/${repository.repo}` : 'owner/repo');
  
  // Group items by type
  const skills = items.filter(i => i.type === 'skill');
  const agents = items.filter(i => i.type === 'agent');
  const outputStyles = items.filter(i => i.type === 'output-style');

  // Generate skills section
  const skillsSection = skills.length > 0 ? `
## 🎯 Skills

| Name | Description |
|------|-------------|
${skills.map(s => `| \`${s.name}\` | ${s.description || '-'} |`).join('\n')}
` : '';

  // Generate agents section
  const agentsSection = agents.length > 0 ? `
## 🤖 Subagents

| Name | Description |
|------|-------------|
${agents.map(a => `| \`${a.name}\` | ${a.description || '-'} |`).join('\n')}
` : '';

  // Generate output styles section
  const stylesSection = outputStyles.length > 0 ? `
## ✨ Output Styles

| Name | Description |
|------|-------------|
${outputStyles.map(s => `| \`${s.name}\` | ${s.description || '-'} |`).join('\n')}
` : '';

  const readme = `# ${name || 'Claude Code Settings'}

${description || 'Claude Code settings managed by clsync.'}

[![clsync compatible](https://img.shields.io/badge/clsync-compatible-blue)](https://github.com/workromancer/clsync)

## 📊 Stats

| Type | Count |
|------|-------|
| Skills | ${stats.skills || 0} |
| Subagents | ${stats.agents || 0} |
| Output Styles | ${stats.output_styles || 0} |
| **Total** | **${stats.total || 0}** |
${skillsSection}${agentsSection}${stylesSection}
## 🚀 Quick Start

\`\`\`bash
# Install clsync
npm install -g clsync

# Pull this repository
clsync pull ${repoName}

# Apply all settings to user scope (~/.claude)
clsync apply -a -s ${repoName} -u

# Or apply specific item
clsync apply <item-name> -s ${repoName} -u
\`\`\`

## 📁 Structure

\`\`\`
${repoName}/
├── clsync.json          # Repository metadata
├── README.md            # This file (auto-generated)
${skills.length > 0 ? `├── skills/              # ${skills.length} skill(s)\n${skills.map((s, i) => `│   ${i === skills.length - 1 ? '└──' : '├──'} ${s.name}/`).join('\n')}\n` : ''}${agents.length > 0 ? `├── agents/              # ${agents.length} agent(s)\n${agents.map((a, i) => `│   ${i === agents.length - 1 ? '└──' : '├──'} ${a.name}.md`).join('\n')}\n` : ''}${outputStyles.length > 0 ? `└── output-styles/       # ${outputStyles.length} style(s)\n${outputStyles.map((s, i) => `    ${i === outputStyles.length - 1 ? '└──' : '├──'} ${s.name}.md`).join('\n')}\n` : ''}\`\`\`

## 👤 Author

${author || 'Unknown'}

---

*Auto-generated by [clsync](https://github.com/workromancer/clsync) on ${new Date().toISOString().split('T')[0]}*
`;

  return readme;
}

/**
 * Get Claude directory based on scope
 */
function getClaudeDir(scope = "user") {
  if (typeof scope === "object" && scope.custom) {
    return scope.custom;
  }
  if (scope === "project") {
    return join(process.cwd(), ".claude");
  }
  return join(os.homedir(), ".claude");
}

/**
 * Get repo directory in ~/.clsync/repos/
 */
function getRepoDir(repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  return join(REPOS_DIR, owner, repo);
}

/**
 * Load manifest
 */
export async function loadManifest() {
  try {
    const content = await readFile(MANIFEST_FILE, "utf-8");
    const manifest = JSON.parse(content);
    // Ensure repos field exists
    if (!manifest.repos) {
      manifest.repos = {};
    }
    return manifest;
  } catch {
    return { version: "1.0.0", repos: {}, last_updated: null };
  }
}

/**
 * Save manifest
 */
export async function saveManifest(manifest) {
  await mkdir(CLSYNC_DIR, { recursive: true });
  manifest.last_updated = new Date().toISOString();
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf-8");
}

/**
 * Parse YAML frontmatter
 */
function parseMetadata(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const metadata = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) metadata[m[1]] = m[2].trim();
  }
  return metadata;
}

/**
 * Scan items in a directory
 */
async function scanItems(baseDir) {
  const items = [];

  for (const dir of SETTINGS_DIRS) {
    const dirPath = join(baseDir, dir);

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        const entryPath = join(dirPath, entry);
        const entryStat = await stat(entryPath);

        if (dir === "skills" && entryStat.isDirectory()) {
          const skillFile = join(entryPath, "SKILL.md");
          try {
            const content = await readFile(skillFile, "utf-8");
            const metadata = parseMetadata(content);
            items.push({
              type: "skill",
              name: entry,
              path: `skills/${entry}`,
              ...metadata,
              updated_at: entryStat.mtime.toISOString(),
            });
          } catch {}
        } else if (entryStat.isFile() && entry.endsWith(".md")) {
          const content = await readFile(entryPath, "utf-8");
          const metadata = parseMetadata(content);
          const type = dir === "agents" ? "agent" : "output-style";
          items.push({
            type,
            name: entry.replace(".md", ""),
            path: `${dir}/${entry}`,
            ...metadata,
            updated_at: entryStat.mtime.toISOString(),
          });
        }
      }
    } catch {}
  }

  return items;
}

// =============================================================================
// LOCAL STAGING (from ~/.claude or .claude)
// =============================================================================

/**
 * Stage: Copy item from ~/.claude or .claude to ~/.clsync/local
 */
export async function stageItem(itemName, scope = "user") {
  await initClsync();

  const sourceDir = getClaudeDir(scope);
  const items = await scanItems(sourceDir);
  const item = items.find((i) => i.name === itemName);

  if (!item) {
    throw new Error(`Item "${itemName}" not found in ${scope} scope`);
  }

  const sourcePath = join(sourceDir, item.path);
  const destPath = join(LOCAL_DIR, item.path);

  await mkdir(dirname(destPath), { recursive: true });

  if (item.type === "skill") {
    await cp(sourcePath, destPath, { recursive: true });
  } else {
    const content = await readFile(sourcePath, "utf-8");
    await writeFile(destPath, content, "utf-8");
  }

  // Update clsync.json
  await updateLocalClsyncJson();

  return { item, path: destPath };
}

/**
 * Stage all items from a scope
 */
export async function stageAll(scope = "user") {
  await initClsync();

  const sourceDir = getClaudeDir(scope);
  const items = await scanItems(sourceDir);
  const results = [];

  for (const item of items) {
    try {
      const result = await stageItem(item.name, scope);
      results.push(result);
    } catch (e) {
      results.push({ item, error: e.message });
    }
  }

  return results;
}

/**
 * List local staged items
 */
export async function listLocalStaged() {
  await initClsync();
  return await scanItems(LOCAL_DIR);
}

/**
 * Unstage: Remove item from local staging
 */
export async function unstageItem(itemName) {
  const items = await listLocalStaged();
  const item = items.find((i) => i.name === itemName);

  if (!item) {
    throw new Error(`Item "${itemName}" not found in local staging`);
  }

  const itemPath = join(LOCAL_DIR, item.path);
  await rm(itemPath, { recursive: true, force: true });

  // Update clsync.json
  await updateLocalClsyncJson();

  return { item };
}

// =============================================================================
// APPLY (from ~/.clsync to destination)
// =============================================================================

/**
 * Apply item from staging to destination
 * @param {string} itemName - Item name
 * @param {string} scope - 'user', 'project', or { custom: '/path' }
 * @param {string} source - 'local' or 'owner/repo'
 */
export async function applyItem(itemName, scope = "user", source = "local") {
  let sourceDir;
  let items;

  if (source === "local") {
    sourceDir = LOCAL_DIR;
    items = await listLocalStaged();
  } else {
    sourceDir = join(REPOS_DIR, source);
    items = await scanItems(sourceDir);
  }

  const item = items.find((i) => i.name === itemName);

  if (!item) {
    throw new Error(`Item "${itemName}" not found in ${source}`);
  }

  const sourcePath = join(sourceDir, item.path);
  const destDir = getClaudeDir(scope);
  const destPath = join(destDir, item.path);

  await mkdir(dirname(destPath), { recursive: true });

  if (item.type === "skill") {
    await cp(sourcePath, destPath, { recursive: true });
  } else {
    const content = await readFile(sourcePath, "utf-8");
    await writeFile(destPath, content, "utf-8");
  }

  return { item, path: destPath, source };
}

/**
 * Apply all items from a source
 */
export async function applyAll(scope = "user", source = "local") {
  let items;

  if (source === "local") {
    items = await listLocalStaged();
  } else {
    const sourceDir = join(REPOS_DIR, source);
    items = await scanItems(sourceDir);
  }

  const results = [];

  for (const item of items) {
    try {
      const result = await applyItem(item.name, scope, source);
      results.push(result);
    } catch (e) {
      results.push({ item, error: e.message });
    }
  }

  return results;
}

// =============================================================================
// GITHUB INTEGRATION
// =============================================================================

/**
 * Parse GitHub repo URL
 */
export function parseRepoUrl(repo) {
  if (repo.startsWith("http")) {
    const url = new URL(repo);
    const parts = url.pathname.split("/").filter(Boolean);
    return {
      owner: parts[0],
      repo: parts[1]?.replace(".git", ""),
      branch: "main",
    };
  }
  const parts = repo.split("/");
  return { owner: parts[0], repo: parts[1], branch: "main" };
}

/**
 * Fetch repo tree from GitHub
 */
async function fetchRepoTree(owner, repo, branch = "main") {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "clsync",
  };
  if (process.env.GITHUB_TOKEN)
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        `Repository "${owner}/${repo}" is empty.\n\n` +
        `To initialize it with your settings, use:\n` +
        `  clsync push ${owner}/${repo}\n\n` +
        `This will push your local settings (~/.clsync/local) to the repository.`
      );
    }
    if (response.status === 404) {
      throw new Error(
        `Repository "${owner}/${repo}" not found.\n\n` +
        `Make sure the repository exists and is accessible.`
      );
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }
  const data = await response.json();
  return data.tree || [];
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(owner, repo, branch, path) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(rawUrl, { headers: { "User-Agent": "clsync" } });
  if (!response.ok) throw new Error(`Failed to fetch: ${path}`);
  return response.text();
}

/**
 * Pull from GitHub to ~/.clsync/repos/{owner}/{repo}
 */
export async function pullFromGitHub(repoUrl, options = {}) {
  const { force = false, onProgress } = options;
  await initClsync();

  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  const repoDir = join(REPOS_DIR, owner, repo);
  const log = (msg) => onProgress && onProgress(msg);

  log(`Fetching from ${owner}/${repo}...`);

  // Create repo directory
  await mkdir(repoDir, { recursive: true });
  for (const dir of SETTINGS_DIRS) {
    await mkdir(join(repoDir, dir), { recursive: true });
  }

  const tree = await fetchRepoTree(owner, repo, branch);
  const settingsFiles = tree.filter(
    (f) =>
      f &&
      f.path &&
      f.type === "blob" &&
      SETTINGS_DIRS.some((d) => f.path.startsWith(d + "/"))
  );

  if (settingsFiles.length === 0) {
    throw new Error(
      `No clsync settings found in repository.\n\n` +
        `This repository doesn't have the clsync directory structure:\n` +
        `  - skills/\n` +
        `  - agents/\n` +
        `  - output-styles/\n\n` +
        `Would you like to add clsync settings to this repository?`
    );
  }

  const results = {
    downloaded: 0,
    skipped: 0,
    files: [],
    repoPath: `${owner}/${repo}`,
  };

  for (const file of settingsFiles) {
    const targetPath = join(repoDir, file.path);

    if (!force && existsSync(targetPath)) {
      results.skipped++;
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });
    const content = await fetchFileContent(owner, repo, branch, file.path);
    await writeFile(targetPath, content, "utf-8");
    results.downloaded++;
    results.files.push(file.path);
    log(`Downloaded: ${file.path}`);
  }

  // Update manifest
  const manifest = await loadManifest();
  manifest.repos[`${owner}/${repo}`] = {
    url: repoUrl,
    last_pulled: new Date().toISOString(),
    items_count: results.downloaded + results.skipped,
  };
  await saveManifest(manifest);

  return results;
}

/**
 * Browse items in GitHub repo
 */
export async function browseRepo(repoUrl) {
  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  const tree = await fetchRepoTree(owner, repo, branch);

  const items = [];
  const skillDirs = new Set();

  // First pass: find skill directories (those with SKILL.md)
  for (const file of tree) {
    if (!file || !file.path) continue;
    if (file.type === "blob" && file.path.match(/^skills\/[^/]+\/SKILL\.md$/)) {
      const skillName = file.path.split("/")[1];
      skillDirs.add(skillName);
    }
  }

  // Add skills
  for (const name of skillDirs) {
    items.push({ type: "skill", name, path: `skills/${name}` });
  }

  // Find agents and output-styles
  for (const file of tree) {
    if (!file || !file.path) continue;
    if (file.type !== "blob") continue;

    if (file.path.startsWith("agents/") && file.path.endsWith(".md")) {
      const name = basename(file.path, ".md");
      items.push({ type: "agent", name, path: file.path });
    } else if (
      file.path.startsWith("output-styles/") &&
      file.path.endsWith(".md")
    ) {
      const name = basename(file.path, ".md");
      items.push({ type: "output-style", name, path: file.path });
    }
  }

  return items;
}

/**
 * List pulled repos
 */
export async function listPulledRepos() {
  await initClsync();
  const manifest = await loadManifest();

  const repos = [];
  for (const [name, info] of Object.entries(manifest.repos || {})) {
    const repoDir = join(REPOS_DIR, name);
    const items = await scanItems(repoDir);
    repos.push({
      name,
      ...info,
      items,
    });
  }

  return repos;
}

/**
 * List items from a specific repo
 */
export async function listRepoItems(repoPath) {
  const repoDir = join(REPOS_DIR, repoPath);
  return await scanItems(repoDir);
}

/**
 * Get current sync status
 */
export async function getStatus() {
  await initClsync();
  const manifest = await loadManifest();
  const localStaged = await listLocalStaged();
  const repos = await listPulledRepos();

  return {
    local_count: localStaged.length,
    local_items: localStaged,
    repos_count: repos.length,
    repos,
    last_updated: manifest.last_updated,
  };
}

/**
 * Export local staging for git push with clsync.json metadata
 */
export async function exportForPush(outputDir, options = {}) {
  const { author, description } = options;
  const staged = await listLocalStaged();

  await mkdir(outputDir, { recursive: true });

  // Copy staged items
  for (const item of staged) {
    const sourcePath = join(LOCAL_DIR, item.path);
    const destPath = join(outputDir, item.path);

    await mkdir(dirname(destPath), { recursive: true });

    if (item.type === "skill") {
      await cp(sourcePath, destPath, { recursive: true });
    } else {
      const content = await readFile(sourcePath, "utf-8");
      await writeFile(destPath, content, "utf-8");
    }
  }

  // Create clsync.json - repository metadata file
  const clsyncJson = {
    $schema: "https://clsync.dev/schema/v1.json",
    version: "1.0.0",
    name: basename(outputDir),
    description: description || "Claude Code settings repository",
    author: author || os.userInfo().username,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: staged.map((item) => ({
      type: item.type,
      name: item.name,
      path: item.path,
      description: item.description || null,
    })),
    stats: {
      skills: staged.filter((i) => i.type === "skill").length,
      agents: staged.filter((i) => i.type === "agent").length,
      output_styles: staged.filter((i) => i.type === "output-style").length,
      total: staged.length,
    },
  };

  await writeFile(
    join(outputDir, "clsync.json"),
    JSON.stringify(clsyncJson, null, 2),
    "utf-8"
  );

  return { exported: staged.length, items: staged, clsyncJson };
}

/**
 * Fetch clsync.json from a GitHub repository
 */
export async function fetchRepoMetadata(repoUrl) {
  const { owner, repo, branch } = parseRepoUrl(repoUrl);

  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/clsync.json`;
    const response = await fetch(rawUrl, {
      headers: { "User-Agent": "clsync" },
    });

    if (!response.ok) return null;

    const content = await response.text();
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if a repo is a clsync repository
 */
export async function isClsyncRepo(repoUrl) {
  const metadata = await fetchRepoMetadata(repoUrl);
  return metadata !== null;
}

// =============================================================================
// PROMOTE / DEMOTE
// =============================================================================

/**
 * Get user Claude dir
 */
function getUserClaudeDir() {
  return join(os.homedir(), ".claude");
}

/**
 * Get project Claude dir
 */
function getProjectClaudeDir() {
  return join(process.cwd(), ".claude");
}

/**
 * Check if item exists in target
 */
async function itemExistsInTarget(name, type, targetDir) {
  const items = await scanItems(targetDir);
  return items.find((i) => i.name === name && i.type === type);
}

/**
 * Generate unique name if conflict
 */
async function getUniqueName(name, type, targetDir) {
  let newName = name;
  let counter = 1;

  while (await itemExistsInTarget(newName, type, targetDir)) {
    newName = `${name}-${counter}`;
    counter++;
  }

  return newName;
}

/**
 * Promote: Move from project (.claude) → user (~/.claude)
 * Makes setting available globally
 */
export async function promoteItem(itemName, options = {}) {
  const { rename, force = false } = options;

  const projectDir = getProjectClaudeDir();
  const userDir = getUserClaudeDir();

  // Find item in project
  const projectItems = await scanItems(projectDir);
  const item = projectItems.find((i) => i.name === itemName);

  if (!item) {
    throw new Error(`Item "${itemName}" not found in project (.claude)`);
  }

  // Check for conflict in user
  const existingInUser = await itemExistsInTarget(itemName, item.type, userDir);
  let targetName = rename || itemName;

  if (existingInUser && !force && !rename) {
    const suggestedName = await getUniqueName(itemName, item.type, userDir);
    throw new Error(
      `"${itemName}" already exists in ~/.claude.\n\n` +
        `Options:\n` +
        `  --force    Overwrite existing\n` +
        `  --rename   Rename to avoid conflict (suggested: "${suggestedName}")`
    );
  }

  // Determine paths
  const sourcePath = join(projectDir, item.path);
  let targetPath;

  if (item.type === "skill") {
    targetPath = join(userDir, "skills", targetName);
  } else if (item.type === "agent") {
    targetPath = join(userDir, "agents", `${targetName}.md`);
  } else {
    targetPath = join(userDir, "output-styles", `${targetName}.md`);
  }

  // Copy to user
  await mkdir(dirname(targetPath), { recursive: true });

  if (item.type === "skill") {
    await cp(sourcePath, targetPath, { recursive: true });
  } else {
    const content = await readFile(sourcePath, "utf-8");
    await writeFile(targetPath, content, "utf-8");
  }

  // Remove from project
  await rm(sourcePath, { recursive: true, force: true });

  return {
    item,
    from: ".claude",
    to: "~/.claude",
    originalName: itemName,
    newName: targetName,
    renamed: targetName !== itemName,
  };
}

/**
 * Demote: Move from user (~/.claude) → project (.claude)
 * Makes setting project-specific
 */
export async function demoteItem(itemName, options = {}) {
  const { rename, force = false } = options;

  const projectDir = getProjectClaudeDir();
  const userDir = getUserClaudeDir();

  // Find item in user
  const userItems = await scanItems(userDir);
  const item = userItems.find((i) => i.name === itemName);

  if (!item) {
    throw new Error(`Item "${itemName}" not found in user (~/.claude)`);
  }

  // Check for conflict in project
  const existingInProject = await itemExistsInTarget(
    itemName,
    item.type,
    projectDir
  );
  let targetName = rename || itemName;

  if (existingInProject && !force && !rename) {
    const suggestedName = await getUniqueName(itemName, item.type, projectDir);
    throw new Error(
      `"${itemName}" already exists in .claude.\n\n` +
        `Options:\n` +
        `  --force    Overwrite existing\n` +
        `  --rename   Rename to avoid conflict (suggested: "${suggestedName}")`
    );
  }

  // Determine paths
  const sourcePath = join(userDir, item.path);
  let targetPath;

  if (item.type === "skill") {
    targetPath = join(projectDir, "skills", targetName);
  } else if (item.type === "agent") {
    targetPath = join(projectDir, "agents", `${targetName}.md`);
  } else {
    targetPath = join(projectDir, "output-styles", `${targetName}.md`);
  }

  // Copy to project
  await mkdir(dirname(targetPath), { recursive: true });

  if (item.type === "skill") {
    await cp(sourcePath, targetPath, { recursive: true });
  } else {
    const content = await readFile(sourcePath, "utf-8");
    await writeFile(targetPath, content, "utf-8");
  }

  // Remove from user
  await rm(sourcePath, { recursive: true, force: true });

  return {
    item,
    from: "~/.claude",
    to: ".claude",
    originalName: itemName,
    newName: targetName,
    renamed: targetName !== itemName,
  };
}

/**
 * List items in both scopes for comparison
 */
export async function listBothScopes() {
  const projectDir = getProjectClaudeDir();
  const userDir = getUserClaudeDir();

  const projectItems = await scanItems(projectDir);
  const userItems = await scanItems(userDir);

  return {
    project: projectItems,
    user: userItems,
  };
}

// =============================================================================
// ONLINE REPOSITORY REGISTRY
// =============================================================================

const ONLINE_REPOS_URL = "https://raw.githubusercontent.com/workromancer/clsync-repos/refs/heads/main/repos.yaml";

/**
 * Parse simple YAML for repos.yaml format
 */
function parseReposYaml(yamlContent) {
  const repos = [];
  const lines = yamlContent.split('\n');
  let currentRepo = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;
    
    // New repo entry
    if (trimmed === '- name:' || trimmed.startsWith('- name:')) {
      if (currentRepo) repos.push(currentRepo);
      currentRepo = {};
      const value = trimmed.replace('- name:', '').trim();
      if (value) currentRepo.name = value;
    } else if (currentRepo) {
      // Parse key: value
      const match = trimmed.match(/^-?\s*(\w+):\s*(.*)$/);
      if (match) {
        const [, key, rawValue] = match;
        // Remove quotes if present
        let value = rawValue.trim();
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        currentRepo[key] = value;
      }
    }
  }
  
  if (currentRepo) repos.push(currentRepo);
  
  return repos;
}

/**
 * Fetch online repository list from clsync-repos
 */
export async function fetchOnlineRepoList() {
  const response = await fetch(ONLINE_REPOS_URL, {
    headers: { "User-Agent": "clsync" }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch online repo list: ${response.status}`);
  }
  
  const yamlContent = await response.text();
  return parseReposYaml(yamlContent);
}

/**
 * Pull an online repo to ~/.clsync/repos
 */
export async function pullOnlineRepo(repoInfo, options = {}) {
  // repoInfo has: name, url, source, description, addedAt
  // Use the url field which is the forked/clsync-ready version
  const repoUrl = repoInfo.url;
  
  // Extract owner/repo from URL
  const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!urlMatch) {
    throw new Error(`Invalid repository URL: ${repoUrl}`);
  }
  
  const repoPath = `${urlMatch[1]}/${urlMatch[2]}`;
  
  return await pullFromGitHub(repoPath, options);
}

// =============================================================================
// PUSH TO GITHUB
// =============================================================================

import { exec as execCallback } from "child_process";
import { promisify } from "util";
const exec = promisify(execCallback);

/**
 * Check if git is available
 */
async function isGitAvailable() {
  try {
    await exec("git --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if directory is a git repo
 */
async function isGitRepo(dir) {
  try {
    await exec("git rev-parse --git-dir", { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git remote URL
 */
async function getGitRemote(dir) {
  try {
    const { stdout } = await exec("git remote get-url origin", { cwd: dir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Push settings to GitHub repository
 * @param {string} scope - 'user', 'project', or 'local'
 * @param {object} options - { repo, message, force }
 */
export async function pushToGitHub(scope = "local", options = {}) {
  let { repo, message = "Update clsync settings", force = false, onProgress } = options;
  const log = (msg) => onProgress && onProgress(msg);

  // Check git availability
  if (!(await isGitAvailable())) {
    throw new Error("Git is not installed. Please install git first.");
  }

  // Determine source directory
  let sourceDir;
  let items;
  
  if (scope === "local") {
    await initClsync();
    sourceDir = LOCAL_DIR;
    items = await listLocalStaged();

    // If no repo specified, try to get from linked repository
    if (!repo) {
      try {
        const content = await readFile(LOCAL_CLSYNC_JSON, "utf-8");
        const clsyncJson = JSON.parse(content);
        if (clsyncJson.repository) {
          repo = `${clsyncJson.repository.owner}/${clsyncJson.repository.repo}`;
          log(`Using linked repository: ${repo}`);
        }
      } catch {
        // No linked repo
      }
    }
  } else if (scope === "user") {
    sourceDir = getUserClaudeDir();
    items = await scanItems(sourceDir);
  } else if (scope === "project") {
    sourceDir = getProjectClaudeDir();
    items = await scanItems(sourceDir);
  } else {
    throw new Error(`Invalid scope: ${scope}. Use 'local', 'user', or 'project'`);
  }

  if (items.length === 0) {
    throw new Error(`No settings found in ${scope} scope to push.`);
  }

  // Create temp directory for push
  const tempDir = join(os.tmpdir(), `clsync-push-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  log(`Preparing ${items.length} items for push...`);

  // Copy items to temp directory
  for (const dir of SETTINGS_DIRS) {
    await mkdir(join(tempDir, dir), { recursive: true });
  }

  for (const item of items) {
    const sourcePath = join(sourceDir, item.path);
    const destPath = join(tempDir, item.path);
    
    await mkdir(dirname(destPath), { recursive: true });
    
    if (item.type === "skill") {
      await cp(sourcePath, destPath, { recursive: true });
    } else {
      const content = await readFile(sourcePath, "utf-8");
      await writeFile(destPath, content, "utf-8");
    }
  }

  // Create clsync.json metadata
  const clsyncJson = {
    $schema: "https://clsync.dev/schema/v1.json",
    version: "1.0.0",
    description: "Claude Code settings repository",
    author: os.userInfo().username,
    updated_at: new Date().toISOString(),
    items: items.map((item) => ({
      type: item.type,
      name: item.name,
      path: item.path,
      description: item.description || null,
    })),
    stats: {
      skills: items.filter((i) => i.type === "skill").length,
      agents: items.filter((i) => i.type === "agent").length,
      output_styles: items.filter((i) => i.type === "output-style").length,
      total: items.length,
    },
  };

  await writeFile(
    join(tempDir, "clsync.json"),
    JSON.stringify(clsyncJson, null, 2),
    "utf-8"
  );

  // Create README.md from template
  const readmeContent = generateReadmeFromClsyncJson(clsyncJson, repo);
  await writeFile(join(tempDir, "README.md"), readmeContent, "utf-8");

  // Initialize git and push
  log("Initializing git repository...");
  await exec("git init", { cwd: tempDir });
  await exec("git add -A", { cwd: tempDir });
  await exec(`git commit -m "${message}"`, { cwd: tempDir });

  if (repo) {
    const repoUrl = repo.startsWith("http") 
      ? repo 
      : `https://github.com/${repo}.git`;
    
    log(`Pushing to ${repo}...`);
    
    try {
      await exec(`git remote add origin ${repoUrl}`, { cwd: tempDir });
    } catch {
      // Remote might already exist
    }
    
    const forceFlag = force ? " --force" : "";
    try {
      await exec(`git push -u origin main${forceFlag}`, { cwd: tempDir });
    } catch (error) {
      // Try master branch if main fails
      try {
        await exec(`git branch -m master main`, { cwd: tempDir });
        await exec(`git push -u origin main${forceFlag}`, { cwd: tempDir });
      } catch {
        throw new Error(
          `Failed to push to ${repo}.\n\n` +
          `Make sure:\n` +
          `  1. The repository exists on GitHub\n` +
          `  2. You have push access to it\n` +
          `  3. You're authenticated with git (gh auth login or git credentials)\n\n` +
          `Error: ${error.message}`
        );
      }
    }

    // Cleanup
    await rm(tempDir, { recursive: true, force: true });

    return {
      pushed: items.length,
      items,
      repo,
      scope,
    };
  } else {
    // No repo specified - return temp directory path for manual push
    return {
      prepared: items.length,
      items,
      tempDir,
      scope,
      instructions: `Files prepared at: ${tempDir}\n\nTo push manually:\n  cd ${tempDir}\n  git remote add origin https://github.com/YOUR/REPO.git\n  git push -u origin main`,
    };
  }
}
