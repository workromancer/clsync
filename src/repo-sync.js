/**
 * GitHub Repository Settings Sync with Metadata
 * Upload/download Claude Code settings with manifest management
 */

import { mkdir, writeFile, readdir, stat, readFile } from 'fs/promises';
import { join, dirname, basename, relative } from 'path';
import os from 'os';

const SETTINGS_DIRS = ['skills', 'agents', 'output-styles'];
const MANIFEST_FILE = 'clsync.manifest.json';
const CLSYNC_DIR = join(os.homedir(), '.clsync');
const LOCAL_MANIFEST = join(CLSYNC_DIR, 'manifest.json');

/**
 * Parse GitHub repository URL or shorthand
 */
export function parseRepoUrl(repo) {
  if (repo.startsWith('http')) {
    const url = new URL(repo);
    const parts = url.pathname.split('/').filter(Boolean);
    return {
      owner: parts[0],
      repo: parts[1]?.replace('.git', ''),
      branch: 'main'
    };
  }
  const parts = repo.split('/');
  return { owner: parts[0], repo: parts[1], branch: 'main' };
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
 * Load local manifest from ~/.clsync/manifest.json
 */
async function loadLocalManifest() {
  try {
    const content = await readFile(LOCAL_MANIFEST, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { 
      version: '1.0.0', 
      installed: [],
      repos: {}
    };
  }
}

/**
 * Save local manifest to ~/.clsync/manifest.json
 */
async function saveLocalManifest(manifest) {
  await mkdir(CLSYNC_DIR, { recursive: true });
  await writeFile(LOCAL_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Add installed item to local manifest
 */
async function trackInstallation(item, repoUrl, scope) {
  const manifest = await loadLocalManifest();
  
  const entry = {
    ...item,
    installed_at: new Date().toISOString(),
    source_repo: repoUrl,
    scope
  };

  // Remove existing entry with same name and type
  manifest.installed = manifest.installed.filter(
    i => !(i.name === item.name && i.type === item.type && i.scope === scope)
  );
  
  manifest.installed.push(entry);
  
  // Track repo
  if (!manifest.repos[repoUrl]) {
    manifest.repos[repoUrl] = { last_synced: new Date().toISOString() };
  }
  
  await saveLocalManifest(manifest);
  return entry;
}

/**
 * Fetch repository tree from GitHub API
 */
async function fetchRepoTree(owner, repo, branch = 'main') {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'clsync'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch repository: ${response.status}`);
  }

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
 * Fetch manifest from GitHub repo
 */
export async function fetchManifest(repoUrl) {
  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  
  try {
    const content = await fetchFileContent(owner, repo, branch, MANIFEST_FILE);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Generate manifest from local settings
 * @param {string} scope - 'user' or 'project'
 */
export async function generateManifest(scope = 'user') {
  const claudeDir = getClaudeDir(scope);
  const manifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    scope,
    items: []
  };

  for (const dir of SETTINGS_DIRS) {
    const dirPath = join(claudeDir, dir);
    
    try {
      const items = await readdir(dirPath);
      
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemStat = await stat(itemPath);
        
        if (dir === 'skills' && itemStat.isDirectory()) {
          // Skills are directories with SKILL.md
          const skillFile = join(itemPath, 'SKILL.md');
          try {
            const content = await readFile(skillFile, 'utf-8');
            const metadata = parseSkillMetadata(content);
            manifest.items.push({
              type: 'skill',
              name: item,
              path: `skills/${item}`,
              ...metadata,
              updated_at: itemStat.mtime.toISOString()
            });
          } catch {
            // SKILL.md doesn't exist
          }
        } else if (itemStat.isFile() && item.endsWith('.md')) {
          // Agents and output-styles are .md files
          const content = await readFile(itemPath, 'utf-8');
          const metadata = parseFileMetadata(content);
          const type = dir === 'agents' ? 'agent' : 'output-style';
          manifest.items.push({
            type,
            name: item.replace('.md', ''),
            path: `${dir}/${item}`,
            ...metadata,
            updated_at: itemStat.mtime.toISOString()
          });
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return manifest;
}

/**
 * Parse YAML frontmatter from skill file
 */
function parseSkillMetadata(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};
  
  const lines = frontmatterMatch[1].split('\n');
  const metadata = {};
  
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      metadata[match[1]] = match[2].trim();
    }
  }
  
  return metadata;
}

/**
 * Parse metadata from agent/output-style file
 */
function parseFileMetadata(content) {
  return parseSkillMetadata(content); // Same format
}

/**
 * List local settings with metadata
 */
export async function listLocalSettings(scope = 'user') {
  const manifest = await generateManifest(scope);
  return manifest.items;
}

/**
 * Export settings to a directory with manifest
 */
export async function exportSettings(outputDir, scope = 'user') {
  const claudeDir = getClaudeDir(scope);
  const manifest = await generateManifest(scope);
  const results = { exported: 0, files: [] };

  // Export each item
  for (const item of manifest.items) {
    const sourcePath = join(claudeDir, item.path);
    const targetPath = join(outputDir, item.path);
    
    await mkdir(dirname(targetPath), { recursive: true });
    
    if (item.type === 'skill') {
      // Copy entire skill directory
      const skillDir = join(claudeDir, 'skills', item.name);
      const files = await readdir(skillDir);
      
      for (const file of files) {
        const src = join(skillDir, file);
        const dest = join(outputDir, 'skills', item.name, file);
        await mkdir(dirname(dest), { recursive: true });
        const content = await readFile(src, 'utf-8');
        await writeFile(dest, content, 'utf-8');
        results.exported++;
        results.files.push(`skills/${item.name}/${file}`);
      }
    } else {
      // Copy single file
      const content = await readFile(sourcePath, 'utf-8');
      await writeFile(targetPath, content, 'utf-8');
      results.exported++;
      results.files.push(item.path);
    }
  }

  // Write manifest
  await writeFile(
    join(outputDir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
  results.files.push(MANIFEST_FILE);

  return results;
}

/**
 * Pull all settings from GitHub repo
 */
export async function pullSettings(repoUrl, options = {}) {
  const { scope = 'user', force = false, dryRun = false, onProgress } = options;
  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  const claudeDir = getClaudeDir(scope);
  const log = (msg) => onProgress && onProgress(msg);

  log(`Fetching from: ${owner}/${repo}`);

  // Try to get manifest first
  let manifest = await fetchManifest(repoUrl);
  
  // Fetch repo tree
  const tree = await fetchRepoTree(owner, repo, branch);
  
  // Filter settings files
  const settingsFiles = tree.filter(item => {
    if (item.type !== 'blob') return false;
    return SETTINGS_DIRS.some(dir => item.path.startsWith(dir + '/'));
  });

  if (settingsFiles.length === 0) {
    throw new Error('No settings found in repository');
  }

  const results = { downloaded: 0, skipped: 0, failed: 0, files: [], manifest };

  for (const file of settingsFiles) {
    const targetPath = join(claudeDir, file.path);
    
    if (!force) {
      try {
        await stat(targetPath);
        results.skipped++;
        results.files.push({ path: file.path, status: 'skipped' });
        continue;
      } catch {}
    }

    if (dryRun) {
      results.downloaded++;
      results.files.push({ path: file.path, status: 'would-download' });
      continue;
    }

    try {
      await mkdir(dirname(targetPath), { recursive: true });
      const content = await fetchFileContent(owner, repo, branch, file.path);
      await writeFile(targetPath, content, 'utf-8');
      results.downloaded++;
      results.files.push({ path: file.path, status: 'downloaded' });
      log(`Downloaded: ${file.path}`);
    } catch (error) {
      results.failed++;
      results.files.push({ path: file.path, status: 'failed', error: error.message });
    }
  }

  return results;
}

/**
 * Install specific item from GitHub repo
 * @param {string} repoUrl - Repository URL
 * @param {string} itemName - Name of item to install
 * @param {Object} options
 */
export async function installItem(repoUrl, itemName, options = {}) {
  const { scope = 'user', force = false } = options;
  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  const claudeDir = getClaudeDir(scope);

  // Fetch manifest to get item info
  const manifest = await fetchManifest(repoUrl);
  if (!manifest) {
    throw new Error('Repository has no manifest. Run "clsync pull" instead.');
  }

  const item = manifest.items.find(i => i.name === itemName);
  if (!item) {
    throw new Error(`Item "${itemName}" not found in manifest`);
  }

  // Fetch repo tree
  const tree = await fetchRepoTree(owner, repo, branch);
  
  // Find files for this item
  const itemFiles = tree.filter(f => {
    if (f.type !== 'blob') return false;
    if (item.type === 'skill') {
      return f.path.startsWith(`skills/${item.name}/`);
    }
    return f.path === item.path;
  });

  const results = { installed: 0, files: [] };

  for (const file of itemFiles) {
    const targetPath = join(claudeDir, file.path);
    
    if (!force) {
      try {
        await stat(targetPath);
        throw new Error(`File already exists: ${file.path}. Use --force to overwrite.`);
      } catch (e) {
        if (e.message.includes('already exists')) throw e;
      }
    }

    await mkdir(dirname(targetPath), { recursive: true });
    const content = await fetchFileContent(owner, repo, branch, file.path);
    await writeFile(targetPath, content, 'utf-8');
    results.installed++;
    results.files.push(file.path);
  }

  // Track in local manifest
  await trackInstallation(item, repoUrl, scope);

  results.item = item;
  return results;
}

/**
 * Browse available items from a GitHub repo
 */
export async function browseRepo(repoUrl) {
  const manifest = await fetchManifest(repoUrl);
  
  if (!manifest) {
    // No manifest, fall back to tree scanning
    const { owner, repo, branch } = parseRepoUrl(repoUrl);
    const tree = await fetchRepoTree(owner, repo, branch);
    
    const items = [];
    const seen = new Set();
    
    for (const file of tree) {
      if (file.type !== 'blob') continue;
      
      if (file.path.startsWith('skills/')) {
        const parts = file.path.split('/');
        if (parts.length >= 2 && !seen.has(parts[1])) {
          seen.add(parts[1]);
          items.push({ type: 'skill', name: parts[1], path: `skills/${parts[1]}` });
        }
      } else if (file.path.startsWith('agents/') && file.path.endsWith('.md')) {
        const name = basename(file.path, '.md');
        items.push({ type: 'agent', name, path: file.path });
      } else if (file.path.startsWith('output-styles/') && file.path.endsWith('.md')) {
        const name = basename(file.path, '.md');
        items.push({ type: 'output-style', name, path: file.path });
      }
    }
    
    return { items, hasManifest: false };
  }

  return { items: manifest.items, hasManifest: true, manifest };
}

/**
 * Copy item from user scope to project scope (or vice versa)
 */
export async function copyItem(itemName, fromScope, toScope) {
  const fromDir = getClaudeDir(fromScope);
  const toDir = getClaudeDir(toScope);
  
  // Find item in source
  const items = await listLocalSettings(fromScope);
  const item = items.find(i => i.name === itemName);
  
  if (!item) {
    throw new Error(`Item "${itemName}" not found in ${fromScope} scope`);
  }

  const results = { copied: 0, files: [] };

  if (item.type === 'skill') {
    const srcDir = join(fromDir, 'skills', item.name);
    const destDir = join(toDir, 'skills', item.name);
    
    const files = await readdir(srcDir);
    for (const file of files) {
      const src = join(srcDir, file);
      const dest = join(destDir, file);
      await mkdir(dirname(dest), { recursive: true });
      const content = await readFile(src, 'utf-8');
      await writeFile(dest, content, 'utf-8');
      results.copied++;
      results.files.push(`skills/${item.name}/${file}`);
    }
  } else {
    const srcPath = join(fromDir, item.path);
    const destPath = join(toDir, item.path);
    await mkdir(dirname(destPath), { recursive: true });
    const content = await readFile(srcPath, 'utf-8');
    await writeFile(destPath, content, 'utf-8');
    results.copied++;
    results.files.push(item.path);
  }

  results.item = item;
  return results;
}

/**
 * Get installed settings from ~/.clsync/manifest.json
 */
export async function getInstalledSettings() {
  const manifest = await loadLocalManifest();
  return manifest.installed;
}

/**
 * Get tracked repos from ~/.clsync/manifest.json
 */
export async function getTrackedRepos() {
  const manifest = await loadLocalManifest();
  return manifest.repos;
}
