/**
 * GitHub API utilities for fetching repository contents
 */

/**
 * Parse GitHub URL to extract owner and repo
 * @param {string} url - GitHub repository URL
 * @returns {{ owner: string, repo: string }}
 */
export function parseGitHubUrl(url) {
  // Support formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  
  let match;
  
  // HTTPS format
  match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // SSH format
  match = url.match(/git@github\.com:([^/]+)\/([^/.]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  throw new Error(`Invalid GitHub URL: ${url}`);
}

/**
 * Fetch repository tree from GitHub API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @returns {Promise<Array<{ path: string, type: string, url: string }>>}
 */
export async function fetchRepoTree(owner, repo, branch = 'main') {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'clsync'
  };
  
  // Use GitHub token if available
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository not found: ${owner}/${repo} (branch: ${branch})`);
    }
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining === '0') {
        throw new Error('GitHub API rate limit exceeded. Set GITHUB_TOKEN env var for higher limits.');
      }
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return data.tree.map(item => ({
    path: item.path,
    type: item.type,
    sha: item.sha,
    url: item.url
  }));
}

/**
 * Fetch raw file content from GitHub
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} filePath - Path to file in repository
 * @returns {Promise<string>}
 */
export async function fetchFileContent(owner, repo, branch, filePath) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  
  const response = await fetch(rawUrl, {
    headers: {
      'User-Agent': 'clsync'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${filePath} (${response.status})`);
  }
  
  return response.text();
}

/**
 * Check if a path matches any of the given glob patterns
 * @param {string} filePath - File path to check
 * @param {string[]} patterns - Glob patterns to match against
 * @returns {boolean}
 */
export function matchesPatterns(filePath, patterns) {
  // Simple glob matching for common patterns
  for (const pattern of patterns) {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a path is within any of the specified paths
 * @param {string} filePath - File path to check
 * @param {string[]} paths - Parent paths to check against
 * @returns {boolean}
 */
export function isWithinPaths(filePath, paths) {
  if (!paths || paths.length === 0) {
    return true; // No path restriction
  }
  
  return paths.some(basePath => {
    const normalizedBase = basePath.replace(/^\/|\/$/g, '');
    return filePath.startsWith(normalizedBase + '/') || filePath === normalizedBase;
  });
}
