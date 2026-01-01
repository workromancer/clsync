import { mkdir, writeFile, stat } from 'fs/promises';
import { dirname, join, resolve, basename } from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import {
  parseGitHubUrl,
  fetchRepoTree,
  fetchFileContent,
  matchesPatterns,
  isWithinPaths
} from './github.js';
import { fetchFromUrl } from './fetcher.js';

/**
 * Expand ~ to home directory
 * @param {string} filepath
 * @returns {string}
 */
function expandHome(filepath) {
  if (filepath.startsWith('~/')) {
    return join(os.homedir(), filepath.slice(2));
  }
  if (filepath === '~') {
    return os.homedir();
  }
  return filepath;
}

/**
 * Add YAML frontmatter to markdown content
 * @param {string} content - Original markdown content
 * @param {Object} metadata - Metadata to add
 * @param {string} metadata.sourceUrl - Source URL of the file
 * @param {string} metadata.downloadedAt - Download timestamp
 * @returns {string}
 */
function addFrontmatter(content, metadata) {
  const frontmatter = `---
source_url: ${metadata.sourceUrl}
downloaded_at: ${metadata.downloadedAt}
---

`;

  // Check if content already has frontmatter
  if (content.startsWith('---')) {
    // Replace existing frontmatter
    const endIndex = content.indexOf('---', 3);
    if (endIndex !== -1) {
      const existingFrontmatter = content.slice(0, endIndex + 3);
      const restContent = content.slice(endIndex + 3).replace(/^\n+/, '');
      
      // Parse existing frontmatter and merge
      const lines = existingFrontmatter.split('\n');
      const newLines = ['---'];
      
      // Add our metadata first
      newLines.push(`source_url: ${metadata.sourceUrl}`);
      newLines.push(`downloaded_at: ${metadata.downloadedAt}`);
      
      // Keep original frontmatter fields (except our keys)
      for (const line of lines) {
        if (line !== '---' && 
            !line.startsWith('source_url:') && 
            !line.startsWith('downloaded_at:') &&
            line.trim()) {
          newLines.push(line);
        }
      }
      
      newLines.push('---', '');
      return newLines.join('\n') + '\n' + restContent;
    }
  }

  return frontmatter + content;
}

/**
 * Main function to track and clone documentation
 * @param {import('./config.js').Config} config
 * @param {{ dryRun?: boolean }} options
 */
export async function trackDocs(config, options = {}) {
  const { dryRun = false } = options;
  const { sources, output } = config;
  const verbose = config.options.verbose;

  // Expand ~ to home directory and resolve path
  const outputDir = resolve(process.cwd(), expandHome(output.directory));

  if (verbose) {
    console.log(chalk.gray(`Output directory: ${outputDir}`));
  }

  for (const source of sources) {
    // Determine source type
    if (source.files && Array.isArray(source.files)) {
      // Direct URL list
      await processUrlSource(source, {
        outputDir,
        preserveStructure: output.preserveStructure,
        overwrite: config.options.overwrite,
        verbose,
        dryRun
      });
    } else if (source.url && source.url.includes('github.com')) {
      // GitHub repository
      await processGitHubSource(source, {
        outputDir,
        preserveStructure: output.preserveStructure,
        overwrite: config.options.overwrite,
        verbose,
        dryRun
      });
    } else {
      console.log(chalk.yellow(`\n⚠️  Skipping "${source.name}": Unknown source type`));
    }
  }
}

/**
 * Process a direct URL list source
 * @param {Object} source
 * @param {Object} options
 */
async function processUrlSource(source, options) {
  const { outputDir, preserveStructure, overwrite, verbose, dryRun } = options;

  console.log(chalk.blue(`\n📂 Processing: ${source.name}`));
  console.log(chalk.gray(`   Type: Direct URLs (${source.files.length} files)`));

  const spinner = ora('Preparing downloads...').start();

  try {
    const files = source.files;
    spinner.succeed(`Found ${files.length} files to sync`);

    // Download files
    const downloadSpinner = ora(`Downloading files...`).start();
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const fileUrl of files) {
      const filename = basename(new URL(fileUrl).pathname);
      
      // Determine target path
      let relativePath;
      if (preserveStructure && source.baseUrl) {
        const urlPath = new URL(fileUrl).pathname;
        const basePath = new URL(source.baseUrl).pathname.replace(/\/$/, '');
        relativePath = urlPath.startsWith(basePath) 
          ? urlPath.slice(basePath.length).replace(/^\//, '')
          : filename;
      } else {
        relativePath = filename;
      }

      const targetPath = join(outputDir, source.name, relativePath);

      // Check if file exists
      if (!overwrite) {
        try {
          await stat(targetPath);
          skipped++;
          if (verbose) {
            downloadSpinner.text = `Skipped (exists): ${filename}`;
          }
          continue;
        } catch {
          // File doesn't exist, proceed
        }
      }

      if (dryRun) {
        if (verbose) {
          console.log(chalk.gray(`   Would download: ${filename} -> ${targetPath}`));
        }
        downloaded++;
        continue;
      }

      // Create directory if needed
      await mkdir(dirname(targetPath), { recursive: true });

      // Download and save
      try {
        downloadSpinner.text = `Downloading: ${filename}`;
        const { content } = await fetchFromUrl(fileUrl);
        
        // Add frontmatter with metadata
        const contentWithMeta = addFrontmatter(content, {
          sourceUrl: fileUrl,
          downloadedAt: new Date().toISOString()
        });
        
        await writeFile(targetPath, contentWithMeta, 'utf-8');
        downloaded++;
      } catch (error) {
        failed++;
        if (verbose) {
          console.log(chalk.red(`   Failed: ${filename} - ${error.message}`));
        }
      }
    }

    if (dryRun) {
      downloadSpinner.succeed(`Would download ${downloaded} files (dry run)`);
    } else {
      let message = `Downloaded ${downloaded} files`;
      if (skipped > 0) message += `, skipped ${skipped} existing`;
      if (failed > 0) message += chalk.red(`, ${failed} failed`);
      downloadSpinner.succeed(message);
    }

    console.log(chalk.gray(`   Saved to: ${join(outputDir, source.name)}`));

  } catch (error) {
    spinner.fail(`Failed to process ${source.name}`);
    throw error;
  }
}

/**
 * Process a GitHub repository source
 * @param {import('./config.js').Source} source
 * @param {Object} options
 */
async function processGitHubSource(source, options) {
  const { outputDir, preserveStructure, overwrite, verbose, dryRun } = options;

  console.log(chalk.blue(`\n📂 Processing: ${source.name}`));
  console.log(chalk.gray(`   URL: ${source.url}`));

  const spinner = ora('Fetching repository structure...').start();

  try {
    const { owner, repo } = parseGitHubUrl(source.url);
    const branch = source.branch || 'main';
    const patterns = source.patterns || ['**/*.md', '**/*.mdx'];

    if (verbose) {
      spinner.text = `Fetching tree from ${owner}/${repo}@${branch}...`;
    }

    const tree = await fetchRepoTree(owner, repo, branch);

    // Filter files
    const files = tree.filter(item => {
      if (item.type !== 'blob') return false;
      if (!isWithinPaths(item.path, source.paths)) return false;
      if (!matchesPatterns(item.path, patterns)) return false;
      return true;
    });

    spinner.succeed(`Found ${files.length} markdown files`);

    if (files.length === 0) {
      console.log(chalk.yellow('   No files matched the criteria'));
      return;
    }

    // Download files
    const downloadSpinner = ora(`Downloading files...`).start();
    let downloaded = 0;
    let skipped = 0;

    for (const file of files) {
      const relativePath = preserveStructure
        ? file.path
        : file.path.split('/').pop();

      const targetPath = join(outputDir, source.name, relativePath);

      // Check if file exists
      if (!overwrite) {
        try {
          await stat(targetPath);
          skipped++;
          if (verbose) {
            downloadSpinner.text = `Skipped (exists): ${relativePath}`;
          }
          continue;
        } catch {
          // File doesn't exist, proceed
        }
      }

      if (dryRun) {
        if (verbose) {
          console.log(chalk.gray(`   Would download: ${file.path} -> ${targetPath}`));
        }
        downloaded++;
        continue;
      }

      // Create directory if needed
      await mkdir(dirname(targetPath), { recursive: true });

      // Download and save
      downloadSpinner.text = `Downloading: ${relativePath}`;
      const content = await fetchFileContent(owner, repo, branch, file.path);
      
      // Add frontmatter with metadata
      const sourceUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`;
      const contentWithMeta = addFrontmatter(content, {
        sourceUrl,
        downloadedAt: new Date().toISOString()
      });
      
      await writeFile(targetPath, contentWithMeta, 'utf-8');
      downloaded++;
    }

    if (dryRun) {
      downloadSpinner.succeed(`Would download ${downloaded} files (dry run)`);
    } else {
      downloadSpinner.succeed(
        `Downloaded ${downloaded} files` + 
        (skipped > 0 ? `, skipped ${skipped} existing` : '')
      );
    }

    console.log(chalk.gray(`   Saved to: ${join(outputDir, source.name)}`));

  } catch (error) {
    spinner.fail(`Failed to process ${source.name}`);
    throw error;
  }
}

export { loadConfig } from './config.js';
