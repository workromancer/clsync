/**
 * Direct URL fetching utilities
 */

import { basename } from 'path';

/**
 * Fetch content from a direct URL
 * @param {string} url - URL to fetch
 * @returns {Promise<{ content: string, filename: string }>}
 */
export async function fetchFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'cc-docs-track'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  
  // Extract filename from URL
  const urlPath = new URL(url).pathname;
  const filename = basename(urlPath);

  return { content, filename, url };
}

/**
 * Extract a clean filename from URL for organizing
 * @param {string} url - Source URL
 * @returns {string}
 */
export function getFilenameFromUrl(url) {
  const urlPath = new URL(url).pathname;
  return basename(urlPath);
}

/**
 * Get relative path structure from URL
 * @param {string} url - Source URL  
 * @param {string} baseUrl - Base URL to calculate relative path from
 * @returns {string}
 */
export function getRelativePathFromUrl(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);
    
    // Get path after base
    const fullPath = urlObj.pathname;
    const basePath = baseObj.pathname.replace(/\/$/, '');
    
    if (fullPath.startsWith(basePath)) {
      return fullPath.slice(basePath.length).replace(/^\//, '');
    }
    
    return basename(fullPath);
  } catch {
    return basename(url);
  }
}
