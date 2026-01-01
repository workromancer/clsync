import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import os from 'os';

const CONFIG_FILENAMES = [
  'clsync.config.json',
  '.clsyncrc.json',
  '.clsyncrc'
];

/**
 * @typedef {Object} Source
 * @property {string} name - Name identifier for the source
 * @property {string} url - GitHub repository URL
 * @property {string} [branch='main'] - Branch to track
 * @property {string[]} [paths=[]] - Specific paths to include
 * @property {string[]} [patterns=['**\/*.md']] - Glob patterns for files
 */

/**
 * @typedef {Object} OutputConfig
 * @property {string} directory - Output directory path
 * @property {boolean} [preserveStructure=true] - Preserve original directory structure
 */

/**
 * @typedef {Object} Options
 * @property {boolean} [overwrite=false] - Overwrite existing files
 * @property {boolean} [verbose=false] - Enable verbose logging
 */

/**
 * @typedef {Object} Config
 * @property {Source[]} sources - List of sources to track
 * @property {OutputConfig} output - Output configuration
 * @property {Options} options - Runtime options
 */

// Default output directory: ~/.clsync/docs
const CLSYNC_DOCS_DIR = join(os.homedir(), '.clsync', 'docs');

const defaultConfig = {
  sources: [],
  output: {
    directory: CLSYNC_DOCS_DIR,
    preserveStructure: true
  },
  options: {
    overwrite: false,
    verbose: false
  }
};

/**
 * Find config file in current directory
 * @param {string} [customPath] - Custom config file path
 * @returns {string|null} - Path to config file or null
 */
function findConfigFile(customPath) {
  if (customPath) {
    const resolvedPath = resolve(process.cwd(), customPath);
    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }
    return null;
  }

  for (const filename of CONFIG_FILENAMES) {
    const filePath = resolve(process.cwd(), filename);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * Load and validate configuration
 * @param {string} [configPath] - Optional custom config path
 * @returns {Promise<Config>}
 */
export async function loadConfig(configPath) {
  const filePath = findConfigFile(configPath);

  if (!filePath) {
    throw new Error(
      `Config file not found. Create one of: ${CONFIG_FILENAMES.join(', ')}`
    );
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const userConfig = JSON.parse(content);

    // Merge with defaults
    const config = {
      ...defaultConfig,
      ...userConfig,
      output: {
        ...defaultConfig.output,
        ...userConfig.output
      },
      options: {
        ...defaultConfig.options,
        ...userConfig.options
      }
    };

    // Validate
    validateConfig(config);

    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate configuration
 * @param {Config} config
 */
function validateConfig(config) {
  if (!config.sources || !Array.isArray(config.sources)) {
    throw new Error('Config must have "sources" array');
  }

  if (config.sources.length === 0) {
    throw new Error('At least one source is required');
  }

  for (const source of config.sources) {
    if (!source.name) {
      throw new Error('Each source must have a "name"');
    }
    // Must have either url (GitHub) or files array (direct URLs)
    if (!source.url && (!source.files || !Array.isArray(source.files))) {
      throw new Error(`Source "${source.name}" must have either a "url" or "files" array`);
    }
    if (source.files && source.files.length === 0) {
      throw new Error(`Source "${source.name}" has empty "files" array`);
    }
  }

  if (!config.output?.directory) {
    throw new Error('Config must have "output.directory"');
  }
}
