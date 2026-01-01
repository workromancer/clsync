/**
 * CLSYNC - Claude Code Settings Sync
 * 
 * Architecture:
 * - ~/.clsync: Local cache/staging that syncs with GitHub
 * - ~/.claude: User-level Claude settings (source)
 * - .claude: Project-level Claude settings (source)
 * 
 * Flow:
 * 1. stage: Copy from ~/.claude or .claude → ~/.clsync
 * 2. push: Upload ~/.clsync → GitHub
 * 3. pull: Download GitHub → ~/.clsync
 * 4. apply: Copy ~/.clsync → ~/.claude or .claude
 */

import { mkdir, writeFile, readdir, stat, readFile, cp, rm } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { existsSync } from 'fs';
import os from 'os';

const SETTINGS_DIRS = ['skills', 'agents', 'output-styles'];
const CLSYNC_DIR = join(os.homedir(), '.clsync');
const MANIFEST_FILE = join(CLSYNC_DIR, 'manifest.json');

/**
 * Initialize ~/.clsync directory
 */
export async function initClsync() {
  await mkdir(CLSYNC_DIR, { recursive: true });
  for (const dir of SETTINGS_DIRS) {
    await mkdir(join(CLSYNC_DIR, dir), { recursive: true });
  }
  
  // Initialize manifest if not exists
  if (!existsSync(MANIFEST_FILE)) {
    await saveManifest({
      version: '1.0.0',
      remote: null,
      items: [],
      last_push: null,
      last_pull: null
    });
  }
}

/**
 * Get Claude directory based on scope
 */
function getClaudeDir(scope = 'user') {
  if (scope === 'project') {
    return join(process.cwd(), '.claude');
  }
  return join(os.homedir(), '.claude');
}

/**
 * Load manifest from ~/.clsync/manifest.json
 */
export async function loadManifest() {
  try {
    const content = await readFile(MANIFEST_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { 
      version: '1.0.0', 
      remote: null,
      items: [],
      last_push: null,
      last_pull: null
    };
  }
}

/**
 * Save manifest to ~/.clsync/manifest.json
 */
export async function saveManifest(manifest) {
  await mkdir(CLSYNC_DIR, { recursive: true });
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Set remote repository
 */
export async function setRemote(repoUrl) {
  const manifest = await loadManifest();
  manifest.remote = repoUrl;
  await saveManifest(manifest);
}

/**
 * Parse YAML frontmatter
 */
function parseMetadata(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const metadata = {};
  for (const line of match[1].split('\n')) {
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
        
        if (dir === 'skills' && entryStat.isDirectory()) {
          const skillFile = join(entryPath, 'SKILL.md');
          try {
            const content = await readFile(skillFile, 'utf-8');
            const metadata = parseMetadata(content);
            items.push({
              type: 'skill',
              name: entry,
              path: `skills/${entry}`,
              ...metadata,
              updated_at: entryStat.mtime.toISOString()
            });
          } catch {}
        } else if (entryStat.isFile() && entry.endsWith('.md')) {
          const content = await readFile(entryPath, 'utf-8');
          const metadata = parseMetadata(content);
          const type = dir === 'agents' ? 'agent' : 'output-style';
          items.push({
            type,
            name: entry.replace('.md', ''),
            path: `${dir}/${entry}`,
            ...metadata,
            updated_at: entryStat.mtime.toISOString()
          });
        }
      }
    } catch {}
  }
  
  return items;
}

/**
 * Stage: Copy item from ~/.claude or .claude to ~/.clsync
 */
export async function stageItem(itemName, scope = 'user') {
  await initClsync();
  
  const sourceDir = getClaudeDir(scope);
  const items = await scanItems(sourceDir);
  const item = items.find(i => i.name === itemName);
  
  if (!item) {
    throw new Error(`Item "${itemName}" not found in ${scope} scope`);
  }
  
  const sourcePath = join(sourceDir, item.path);
  const destPath = join(CLSYNC_DIR, item.path);
  
  // Copy to staging
  await mkdir(dirname(destPath), { recursive: true });
  
  if (item.type === 'skill') {
    await cp(sourcePath, destPath, { recursive: true });
  } else {
    const content = await readFile(sourcePath, 'utf-8');
    await writeFile(destPath, content, 'utf-8');
  }
  
  // Update manifest
  const manifest = await loadManifest();
  const existingIdx = manifest.items.findIndex(i => i.name === item.name && i.type === item.type);
  
  const entry = {
    ...item,
    source_scope: scope,
    staged_at: new Date().toISOString()
  };
  
  if (existingIdx >= 0) {
    manifest.items[existingIdx] = entry;
  } else {
    manifest.items.push(entry);
  }
  
  await saveManifest(manifest);
  
  return { item: entry, path: destPath };
}

/**
 * Stage all items from a scope
 */
export async function stageAll(scope = 'user') {
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
 * List staged items in ~/.clsync
 */
export async function listStaged() {
  await initClsync();
  return await scanItems(CLSYNC_DIR);
}

/**
 * Apply: Copy item from ~/.clsync to ~/.claude or .claude
 */
export async function applyItem(itemName, scope = 'user') {
  const stagedItems = await listStaged();
  const item = stagedItems.find(i => i.name === itemName);
  
  if (!item) {
    throw new Error(`Item "${itemName}" not found in staging (~/.clsync)`);
  }
  
  const sourcePath = join(CLSYNC_DIR, item.path);
  const destDir = getClaudeDir(scope);
  const destPath = join(destDir, item.path);
  
  await mkdir(dirname(destPath), { recursive: true });
  
  if (item.type === 'skill') {
    await cp(sourcePath, destPath, { recursive: true });
  } else {
    const content = await readFile(sourcePath, 'utf-8');
    await writeFile(destPath, content, 'utf-8');
  }
  
  return { item, path: destPath };
}

/**
 * Apply all staged items
 */
export async function applyAll(scope = 'user') {
  const stagedItems = await listStaged();
  const results = [];
  
  for (const item of stagedItems) {
    try {
      const result = await applyItem(item.name, scope);
      results.push(result);
    } catch (e) {
      results.push({ item, error: e.message });
    }
  }
  
  return results;
}

/**
 * Unstage: Remove item from ~/.clsync
 */
export async function unstageItem(itemName) {
  const stagedItems = await listStaged();
  const item = stagedItems.find(i => i.name === itemName);
  
  if (!item) {
    throw new Error(`Item "${itemName}" not found in staging`);
  }
  
  const itemPath = join(CLSYNC_DIR, item.path);
  await rm(itemPath, { recursive: true, force: true });
  
  // Update manifest
  const manifest = await loadManifest();
  manifest.items = manifest.items.filter(i => i.name !== itemName);
  await saveManifest(manifest);
  
  return { item };
}

// =============================================================================
// GitHub Integration
// =============================================================================

/**
 * Parse GitHub repo URL
 */
export function parseRepoUrl(repo) {
  if (repo.startsWith('http')) {
    const url = new URL(repo);
    const parts = url.pathname.split('/').filter(Boolean);
    return { owner: parts[0], repo: parts[1]?.replace('.git', ''), branch: 'main' };
  }
  const parts = repo.split('/');
  return { owner: parts[0], repo: parts[1], branch: 'main' };
}

/**
 * Fetch repo tree from GitHub
 */
async function fetchRepoTree(owner, repo, branch = 'main') {
  const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'clsync' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );
  
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  const data = await response.json();
  return data.tree || [];
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(owner, repo, branch, path) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(rawUrl, { headers: { 'User-Agent': 'clsync' } });
  if (!response.ok) throw new Error(`Failed to fetch: ${path}`);
  return response.text();
}

/**
 * Pull from GitHub to ~/.clsync
 */
export async function pullFromGitHub(repoUrl, options = {}) {
  const { force = false, onProgress } = options;
  await initClsync();
  
  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  const log = msg => onProgress && onProgress(msg);
  
  log(`Fetching from ${owner}/${repo}...`);
  
  const tree = await fetchRepoTree(owner, repo, branch);
  const settingsFiles = tree.filter(f => 
    f.type === 'blob' && SETTINGS_DIRS.some(d => f.path.startsWith(d + '/'))
  );
  
  if (settingsFiles.length === 0) {
    throw new Error('No settings found in repository');
  }
  
  const results = { downloaded: 0, skipped: 0, files: [] };
  
  for (const file of settingsFiles) {
    const targetPath = join(CLSYNC_DIR, file.path);
    
    if (!force && existsSync(targetPath)) {
      results.skipped++;
      continue;
    }
    
    await mkdir(dirname(targetPath), { recursive: true });
    const content = await fetchFileContent(owner, repo, branch, file.path);
    await writeFile(targetPath, content, 'utf-8');
    results.downloaded++;
    results.files.push(file.path);
    log(`Downloaded: ${file.path}`);
  }
  
  // Update manifest
  const manifest = await loadManifest();
  manifest.remote = repoUrl;
  manifest.last_pull = new Date().toISOString();
  manifest.items = await listStaged();
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
  const seen = new Set();
  
  for (const file of tree) {
    if (file.type !== 'blob') continue;
    
    if (file.path.startsWith('skills/')) {
      const name = file.path.split('/')[1];
      if (!seen.has(name)) {
        seen.add(name);
        items.push({ type: 'skill', name, path: `skills/${name}` });
      }
    } else if (file.path.startsWith('agents/') && file.path.endsWith('.md')) {
      items.push({ type: 'agent', name: basename(file.path, '.md'), path: file.path });
    } else if (file.path.startsWith('output-styles/') && file.path.endsWith('.md')) {
      items.push({ type: 'output-style', name: basename(file.path, '.md'), path: file.path });
    }
  }
  
  return items;
}

/**
 * Get current sync status
 */
export async function getStatus() {
  await initClsync();
  const manifest = await loadManifest();
  const staged = await listStaged();
  
  return {
    remote: manifest.remote,
    last_push: manifest.last_push,
    last_pull: manifest.last_pull,
    staged_count: staged.length,
    staged: staged
  };
}

/**
 * Export ~/.clsync for manual git push
 */
export async function exportForPush(outputDir) {
  const staged = await listStaged();
  
  for (const item of staged) {
    const sourcePath = join(CLSYNC_DIR, item.path);
    const destPath = join(outputDir, item.path);
    
    await mkdir(dirname(destPath), { recursive: true });
    
    if (item.type === 'skill') {
      await cp(sourcePath, destPath, { recursive: true });
    } else {
      const content = await readFile(sourcePath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
    }
  }
  
  // Write manifest
  const manifest = await loadManifest();
  await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  
  return { exported: staged.length, items: staged };
}
