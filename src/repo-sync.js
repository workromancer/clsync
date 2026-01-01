/**
 * GitHub Repository Settings Sync
 * Pull/push Claude Code settings from/to a GitHub repository
 */

import { mkdir, writeFile, readdir, stat, readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import os from 'os';

const SETTINGS_DIRS = ['skills', 'agents', 'output-styles'];

/**
 * Parse GitHub repository URL or shorthand
 * @param {string} repo - Repository URL or owner/repo format
 * @returns {{ owner: string, repo: string, branch: string }}
 */
export function parseRepoUrl(repo) {
  // Handle full URL
  if (repo.startsWith('http')) {
    const url = new URL(repo);
    const parts = url.pathname.split('/').filter(Boolean);
    return {
      owner: parts[0],
      repo: parts[1]?.replace('.git', ''),
      branch: 'main'
    };
  }
  
  // Handle owner/repo format
  const parts = repo.split('/');
  return {
    owner: parts[0],
    repo: parts[1],
    branch: 'main'
  };
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
    throw new Error(`Failed to fetch repository: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.tree || [];
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(owner, repo, branch, path) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  
  const response = await fetch(rawUrl, {
    headers: { 'User-Agent': 'clsync' }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${path}`);
  }

  return response.text();
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
 * Pull settings from a GitHub repository
 * @param {string} repoUrl - Repository URL or owner/repo
 * @param {Object} options
 * @param {string} options.scope - 'user' or 'project'
 * @param {boolean} options.force - Overwrite existing files
 * @param {boolean} options.dryRun - Don't actually write files
 * @param {Function} options.onProgress - Progress callback
 */
export async function pullSettings(repoUrl, options = {}) {
  const { scope = 'user', force = false, dryRun = false, onProgress } = options;
  const { owner, repo, branch } = parseRepoUrl(repoUrl);
  const claudeDir = getClaudeDir(scope);

  const log = (msg) => onProgress && onProgress(msg);
  
  log(`Fetching repository: ${owner}/${repo}`);
  
  // Fetch repository tree
  const tree = await fetchRepoTree(owner, repo, branch);
  
  // Filter for settings directories
  const settingsFiles = tree.filter(item => {
    if (item.type !== 'blob') return false;
    return SETTINGS_DIRS.some(dir => item.path.startsWith(dir + '/'));
  });

  if (settingsFiles.length === 0) {
    throw new Error('No settings found in repository. Expected: skills/, agents/, or output-styles/');
  }

  log(`Found ${settingsFiles.length} files to sync`);

  const results = {
    downloaded: 0,
    skipped: 0,
    failed: 0,
    files: []
  };

  for (const file of settingsFiles) {
    const targetPath = join(claudeDir, file.path);
    
    // Check if file exists
    if (!force) {
      try {
        await stat(targetPath);
        results.skipped++;
        results.files.push({ path: file.path, status: 'skipped' });
        continue;
      } catch {
        // File doesn't exist, proceed
      }
    }

    if (dryRun) {
      results.downloaded++;
      results.files.push({ path: file.path, status: 'would-download' });
      continue;
    }

    try {
      // Create directory if needed
      await mkdir(dirname(targetPath), { recursive: true });
      
      // Download and save
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
 * List local settings that could be pushed
 * @param {string} scope - 'user' or 'project'
 */
export async function listLocalSettings(scope = 'user') {
  const claudeDir = getClaudeDir(scope);
  const files = [];

  for (const dir of SETTINGS_DIRS) {
    const dirPath = join(claudeDir, dir);
    try {
      const items = await readdir(dirPath, { recursive: true });
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemStat = await stat(itemPath);
        if (itemStat.isFile()) {
          files.push({
            dir,
            path: join(dir, item),
            fullPath: itemPath
          });
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return files;
}

/**
 * Export settings to a directory (for manual git push)
 * @param {string} outputDir - Output directory
 * @param {string} scope - 'user' or 'project'
 */
export async function exportSettings(outputDir, scope = 'user') {
  const files = await listLocalSettings(scope);
  const results = { exported: 0, files: [] };

  for (const file of files) {
    const targetPath = join(outputDir, file.path);
    await mkdir(dirname(targetPath), { recursive: true });
    
    const content = await readFile(file.fullPath, 'utf-8');
    await writeFile(targetPath, content, 'utf-8');
    
    results.exported++;
    results.files.push(file.path);
  }

  return results;
}
