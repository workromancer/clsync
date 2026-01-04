#!/usr/bin/env node

/**
 * MCP Server for clsync
 * Provides tools for syncing documentation and creating Claude Code extensions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile, readdir, stat, mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import os from "os";
import { z } from "zod";
import { loadConfig } from "../src/config.js";
import { trackDocs } from "../src/index.js";

// Create MCP server
const server = new McpServer({
  name: "clsync",
  version: "0.2.3",
});

// =============================================================================
// Directory Helpers
// =============================================================================

function getDocsDir(scope = "user") {
  if (scope === "project") {
    return resolve(process.cwd(), ".clsync");
  }
  return join(os.homedir(), ".clsync", "docs");
}

function getClaudeDir(scope = "user") {
  if (scope === "project") {
    return resolve(process.cwd(), ".claude");
  }
  return join(os.homedir(), ".claude");
}

function getSkillsDir(scope = "user") {
  return join(getClaudeDir(scope), "skills");
}

function getAgentsDir(scope = "user") {
  return join(getClaudeDir(scope), "agents");
}

function getHooksPath(scope = "user") {
  return join(getClaudeDir(scope), "hooks.json");
}

function getOutputStylesDir(scope = "user") {
  return join(getClaudeDir(scope), "output-styles");
}

// =============================================================================
// List Helpers
// =============================================================================

async function listSyncedDocs(scope = "user") {
  const docsDir = getDocsDir(scope);
  const result = [];

  try {
    const sources = await readdir(docsDir);

    for (const source of sources) {
      const sourcePath = join(docsDir, source);
      const sourceStat = await stat(sourcePath);

      if (sourceStat.isDirectory()) {
        const files = await readdir(sourcePath);
        for (const file of files) {
          if (file.endsWith(".md") || file.endsWith(".mdx")) {
            result.push({
              source,
              file,
              path: join(sourcePath, file),
            });
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist or is empty
  }

  return result;
}

async function listItems(dir, type = "file") {
  const result = [];
  try {
    const items = await readdir(dir);
    for (const item of items) {
      const itemPath = join(dir, item);
      const itemStat = await stat(itemPath);
      if (type === "dir" && itemStat.isDirectory()) {
        result.push({ name: item, path: itemPath });
      } else if (type === "file" && itemStat.isFile() && item.endsWith(".md")) {
        result.push({ name: item.replace(".md", ""), path: itemPath });
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return result;
}

// =============================================================================
// Documentation Tools
// =============================================================================

server.registerTool(
  "sync_docs",
  {
    description: "Sync documentation from configured sources. Downloads Claude Code docs to ~/.clsync/docs for reference when creating skills, subagents, and output styles.",
    inputSchema: {
      scope: z.enum(["user", "project"]).optional().describe('Where to save docs: "user" (~/.clsync/docs) or "project" (.clsync)'),
      force: z.boolean().optional().describe("Force overwrite existing files"),
    },
  },
  async ({ scope = "user", force = false }) => {
    try {
      let config;
      try {
        config = await loadConfig();
      } catch {
        config = {
          sources: [
            {
              name: "claude-code",
              files: [
                "https://code.claude.com/docs/en/skills.md",
                "https://code.claude.com/docs/en/sub-agents.md",
                "https://code.claude.com/docs/en/plugins.md",
                "https://code.claude.com/docs/en/hooks-guide.md",
                "https://code.claude.com/docs/en/mcp.md",
                "https://code.claude.com/docs/en/headless.md",
                "https://code.claude.com/docs/en/output-styles.md",
                "https://code.claude.com/docs/en/discover-plugins.md",
              ],
            },
          ],
          output: {
            directory: getDocsDir(scope),
            preserveStructure: false,
          },
          options: {
            overwrite: force,
            verbose: false,
          },
        };
      }

      config.output.directory = getDocsDir(scope);
      if (force) config.options.overwrite = true;

      await trackDocs(config, { dryRun: false });

      const docs = await listSyncedDocs(scope);
      return {
        content: [{ type: "text", text: `✅ Synced ${docs.length} documentation files to ${getDocsDir(scope)}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error syncing docs: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_docs",
  {
    description: "List all synced documentation files",
    inputSchema: {
      scope: z.enum(["user", "project"]).optional().describe('Scope: "user" or "project"'),
    },
  },
  async ({ scope = "user" }) => {
    const docs = await listSyncedDocs(scope);

    if (docs.length === 0) {
      return {
        content: [{ type: "text", text: `No documentation found in ${getDocsDir(scope)}. Run sync_docs first.` }],
      };
    }

    const docList = docs.map((d) => `- ${d.source}/${d.file}`).join("\n");
    return {
      content: [{ type: "text", text: `📚 Synced documentation (${docs.length} files):\n\n${docList}` }],
    };
  }
);

server.registerTool(
  "read_doc",
  {
    description: "Read the contents of a synced documentation file",
    inputSchema: {
      source: z.string().describe('Source name (e.g., "claude-code")'),
      file: z.string().describe('File name (e.g., "skills.md")'),
      scope: z.enum(["user", "project"]).optional().describe('Scope: "user" or "project"'),
    },
  },
  async ({ source, file, scope = "user" }) => {
    const filePath = join(getDocsDir(scope), source, file);

    try {
      const content = await readFile(filePath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Could not read ${source}/${file}: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Skill Tools
// =============================================================================

server.registerTool(
  "create_skill",
  {
    description: `Create a new Claude Code skill. Skills teach Claude specific capabilities.

📚 IMPORTANT: Before creating a skill, refer to the documentation at ~/.clsync/docs/claude-code/skills.md for the correct format and best practices. Use the read_doc tool to read it first.`,
    inputSchema: {
      name: z.string().describe("Skill name (e.g., code-reviewer, commit-messages)"),
      description: z.string().describe("Short description of what the skill does"),
      instructions: z.string().describe("Markdown instructions for Claude to follow"),
      scope: z.enum(["user", "project"]).optional().describe('"project" (.claude/skills) or "user" (~/.claude/skills). Default: project'),
      allowed_tools: z.array(z.string()).optional().describe("Optional list of allowed tools (e.g., Bash, Read, Write)"),
    },
  },
  async ({ name, description, instructions, scope = "project", allowed_tools }) => {
    // Validate required parameters
    if (!name) {
      return {
        content: [{ type: "text", text: "❌ Error: 'name' parameter is required" }],
        isError: true,
      };
    }
    if (!description) {
      return {
        content: [{ type: "text", text: "❌ Error: 'description' parameter is required" }],
        isError: true,
      };
    }
    if (!instructions) {
      return {
        content: [{ type: "text", text: "❌ Error: 'instructions' parameter is required" }],
        isError: true,
      };
    }
    
    const skillDir = join(getSkillsDir(scope), name);
    const skillFile = join(skillDir, "SKILL.md");

    try {
      await mkdir(skillDir, { recursive: true });

      let content = `---
name: ${name}
description: ${description}
`;

      if (allowed_tools && allowed_tools.length > 0) {
        content += `allowed-tools:\n${allowed_tools.map((t) => `  - ${t}`).join("\n")}\n`;
      }

      content += `---

${instructions}
`;

      await writeFile(skillFile, content, "utf-8");

      const scopeLabel = scope === "user" ? "~/.claude" : ".claude";
      return {
        content: [
          {
            type: "text",
            text: `✅ Created skill "${name}" at ${scopeLabel}/skills/${name}/SKILL.md\n\nRestart Claude Code to activate the skill.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error creating skill: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_skills",
  {
    description: "List all Claude Code skills in user and/or project scope",
    inputSchema: {
      scope: z.enum(["user", "project", "both"]).optional().describe('"user", "project", or "both" (default)'),
    },
  },
  async ({ scope = "both" }) => {
    let text = "🎯 Skills\n\n";
    
    if (scope === "both" || scope === "user") {
      const userSkills = await listItems(getSkillsDir("user"), "dir");
      text += `📁 User (~/.claude/skills): ${userSkills.length} items\n`;
      if (userSkills.length > 0) {
        for (const s of userSkills) {
          text += `   - ${s.name}\n`;
        }
      } else {
        text += `   (empty)\n`;
      }
      text += `\n`;
    }
    
    if (scope === "both" || scope === "project") {
      const projectSkills = await listItems(getSkillsDir("project"), "dir");
      text += `📁 Project (.claude/skills): ${projectSkills.length} items\n`;
      if (projectSkills.length > 0) {
        for (const s of projectSkills) {
          text += `   - ${s.name}\n`;
        }
      } else {
        text += `   (empty)\n`;
      }
      text += `\n`;
    }
    
    text += `💡 Move between scopes:\n`;
    text += `   promote_setting <name>  # project → user (global)\n`;
    text += `   demote_setting <name>   # user → project (local)`;
    
    return { content: [{ type: "text", text }] };
  }
);

server.registerTool(
  "read_skill",
  {
    description: "Read a skill's SKILL.md content",
    inputSchema: {
      name: z.string().describe("Skill name"),
      scope: z.enum(["user", "project"]).optional().describe('"user" or "project"'),
    },
  },
  async ({ name, scope = "user" }) => {
    const skillFile = join(getSkillsDir(scope), name, "SKILL.md");

    try {
      const content = await readFile(skillFile, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Could not read skill "${name}": ${error.message}` }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Subagent Tools
// =============================================================================

server.registerTool(
  "create_subagent",
  {
    description: `Create a new Claude Code subagent. Subagents are specialized agents for specific tasks.

📚 IMPORTANT: Before creating a subagent, refer to the documentation at ~/.clsync/docs/claude-code/sub-agents.md for the correct format and best practices. Use the read_doc tool to read it first.`,
    inputSchema: {
      name: z.string().describe("Subagent name (e.g., test-runner, security-reviewer)"),
      description: z.string().describe("What this subagent specializes in"),
      instructions: z.string().describe("System prompt / instructions for the subagent"),
      scope: z.enum(["user", "project"]).optional().describe('"project" (.claude/agents) or "user" (~/.claude/agents). Default: project'),
      skills: z.array(z.string()).optional().describe("Optional list of skills this subagent can use"),
      allowed_tools: z.array(z.string()).optional().describe("Optional list of allowed tools"),
    },
  },
  async ({ name, description, instructions, scope = "project", skills, allowed_tools }) => {
    const agentsDir = getAgentsDir(scope);
    const agentFile = join(agentsDir, `${name}.md`);

    try {
      await mkdir(agentsDir, { recursive: true });

      let content = `---
description: ${description}
`;

      if (skills && skills.length > 0) {
        content += `skills:\n${skills.map((s) => `  - ${s}`).join("\n")}\n`;
      }

      if (allowed_tools && allowed_tools.length > 0) {
        content += `allowed-tools:\n${allowed_tools.map((t) => `  - ${t}`).join("\n")}\n`;
      }

      content += `---

${instructions}
`;

      await writeFile(agentFile, content, "utf-8");

      const scopeLabel = scope === "user" ? "~/.claude" : ".claude";
      return {
        content: [
          {
            type: "text",
            text: `✅ Created subagent "${name}" at ${scopeLabel}/agents/${name}.md\n\nUse with: @${name} <task>`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error creating subagent: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_subagents",
  {
    description: "List all Claude Code subagents in user and/or project scope",
    inputSchema: {
      scope: z.enum(["user", "project", "both"]).optional().describe('"user", "project", or "both" (default)'),
    },
  },
  async ({ scope = "both" }) => {
    let text = "🤖 Subagents\n\n";
    
    if (scope === "both" || scope === "user") {
      const userAgents = await listItems(getAgentsDir("user"), "file");
      text += `📁 User (~/.claude/agents): ${userAgents.length} items\n`;
      if (userAgents.length > 0) {
        for (const a of userAgents) {
          text += `   - @${a.name}\n`;
        }
      } else {
        text += `   (empty)\n`;
      }
      text += `\n`;
    }
    
    if (scope === "both" || scope === "project") {
      const projectAgents = await listItems(getAgentsDir("project"), "file");
      text += `📁 Project (.claude/agents): ${projectAgents.length} items\n`;
      if (projectAgents.length > 0) {
        for (const a of projectAgents) {
          text += `   - @${a.name}\n`;
        }
      } else {
        text += `   (empty)\n`;
      }
      text += `\n`;
    }
    
    text += `💡 Move between scopes:\n`;
    text += `   promote_setting <name>  # project → user (global)\n`;
    text += `   demote_setting <name>   # user → project (local)`;
    
    return { content: [{ type: "text", text }] };
  }
);

server.registerTool(
  "read_subagent",
  {
    description: "Read a subagent's configuration",
    inputSchema: {
      name: z.string().describe("Subagent name"),
      scope: z.enum(["user", "project"]).optional().describe('"user" or "project"'),
    },
  },
  async ({ name, scope = "user" }) => {
    const agentFile = join(getAgentsDir(scope), `${name}.md`);

    try {
      const content = await readFile(agentFile, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Could not read subagent "${name}": ${error.message}` }],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Output Style Tools
// =============================================================================

server.registerTool(
  "create_output_style",
  {
    description: `Create a new output style for Claude's responses.

📚 IMPORTANT: Before creating an output style, refer to the documentation at ~/.clsync/docs/claude-code/output-styles.md for the correct format and best practices. Use the read_doc tool to read it first.`,
    inputSchema: {
      name: z.string().describe("Style name (e.g., concise, detailed, korean)"),
      description: z.string().describe("What this style does"),
      instructions: z.string().describe("Instructions for how Claude should format responses"),
      scope: z.enum(["user", "project"]).optional().describe('"user" or "project"'),
    },
  },
  async ({ name, description, instructions, scope = "user" }) => {
    const stylesDir = getOutputStylesDir(scope);
    const styleFile = join(stylesDir, `${name}.md`);

    try {
      await mkdir(stylesDir, { recursive: true });

      const content = `---
description: ${description}
---

${instructions}
`;

      await writeFile(styleFile, content, "utf-8");

      const scopeLabel = scope === "user" ? "~/.claude" : ".claude";
      return {
        content: [
          {
            type: "text",
            text: `✅ Created output style "${name}" at ${scopeLabel}/output-styles/${name}.md\n\nActivate with: /output-style ${name}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error creating output style: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_output_styles",
  {
    description: "List all output styles in user and/or project scope",
    inputSchema: {
      scope: z.enum(["user", "project", "both"]).optional().describe('"user", "project", or "both" (default)'),
    },
  },
  async ({ scope = "both" }) => {
    let text = "✨ Output Styles\n\n";
    
    if (scope === "both" || scope === "user") {
      const userStyles = await listItems(getOutputStylesDir("user"), "file");
      text += `📁 User (~/.claude/output-styles): ${userStyles.length} items\n`;
      if (userStyles.length > 0) {
        for (const s of userStyles) {
          text += `   - ${s.name}\n`;
        }
      } else {
        text += `   (empty)\n`;
      }
      text += `\n`;
    }
    
    if (scope === "both" || scope === "project") {
      const projectStyles = await listItems(getOutputStylesDir("project"), "file");
      text += `📁 Project (.claude/output-styles): ${projectStyles.length} items\n`;
      if (projectStyles.length > 0) {
        for (const s of projectStyles) {
          text += `   - ${s.name}\n`;
        }
      } else {
        text += `   (empty)\n`;
      }
      text += `\n`;
    }
    
    text += `💡 Move between scopes:\n`;
    text += `   promote_setting <name>  # project → user (global)\n`;
    text += `   demote_setting <name>   # user → project (local)`;
    
    return { content: [{ type: "text", text }] };
  }
);

// =============================================================================
// Repository Sync Tools
// =============================================================================

import {
  pullFromGitHub,
  pushToGitHub,
  listLocalStaged,
  browseRepo,
  applyItem,
  applyAll,
  listRepoItems,
  listPulledRepos,
  promoteItem,
  demoteItem,
  listBothScopes,
  linkSkillToCommand,
  linkSubagentToCommand,
  linkAll
} from "../src/repo-sync.js";

server.registerTool(
  "pull_settings",
  {
    description: "Pull settings from GitHub to ~/.clsync/repos/{owner}/{repo}",
    inputSchema: {
      repo: z.string().describe('GitHub repository (e.g., "owner/repo")'),
      force: z.boolean().optional().describe("Overwrite existing files"),
    },
  },
  async ({ repo, force = false }) => {
    try {
      const results = await pullFromGitHub(repo, { force });
      const summary = `Downloaded ${results.downloaded} files to ~/.clsync/repos/${results.repoPath}` +
        (results.skipped > 0 ? ` (skipped ${results.skipped})` : "");
      return { content: [{ type: "text", text: `✅ Pull Complete!\n\n${summary}\n\nUse apply_setting to apply items.` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "push_settings",
  {
    description: "Push settings to a GitHub repository. Requires git to be installed and authenticated.",
    inputSchema: {
      repo: z.string().describe('GitHub repository (e.g., "owner/repo")'),
      scope: z.enum(["local", "user", "project"]).optional().describe('Source scope: "local" (~/.clsync/local), "user" (~/.claude), or "project" (.claude). Default: local'),
      message: z.string().optional().describe("Commit message"),
      force: z.boolean().optional().describe("Force push (overwrites remote)"),
    },
  },
  async ({ repo, scope = "local", message = "Update clsync settings", force = false }) => {
    try {
      const results = await pushToGitHub(scope, { repo, message, force });
      
      if (results.pushed) {
        let text = `✅ Push Complete!\n\n`;
        text += `Pushed ${results.pushed} items to ${results.repo}\n\n`;
        text += `Items:\n`;
        for (const item of results.items) {
          text += `  - ${item.type}: ${item.name}\n`;
        }
        text += `\nOthers can now use:\n  clsync pull ${results.repo}`;
        return { content: [{ type: "text", text }] };
      } else if (results.prepared) {
        return { content: [{ type: "text", text: results.instructions }] };
      }
      
      return { content: [{ type: "text", text: "Push completed" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "browse_repo",
  {
    description: "Browse available settings in a GitHub repository",
    inputSchema: {
      repo: z.string().describe('GitHub repository (e.g., "owner/repo")'),
    },
  },
  async ({ repo }) => {
    try {
      const items = await browseRepo(repo);
      
      if (items.length === 0) {
        return { 
          content: [{ 
            type: "text", 
            text: `⚠️ No clsync settings found in repository.\n\n` +
              `This repository doesn't have the clsync directory structure:\n` +
              `  - skills/\n` +
              `  - agents/\n` +
              `  - output-styles/\n\n` +
              `Would you like to add clsync settings to this repository?`
          }] 
        };
      }

      let text = "";
      const skills = items.filter(i => i.type === 'skill');
      const agents = items.filter(i => i.type === 'agent');
      const styles = items.filter(i => i.type === 'output-style');

      if (skills.length > 0) {
        text += "🎯 Skills:\n" + skills.map(s => `  - ${s.name}`).join("\n") + "\n\n";
      }
      if (agents.length > 0) {
        text += "🤖 Subagents:\n" + agents.map(a => `  - ${a.name}`).join("\n") + "\n\n";
      }
      if (styles.length > 0) {
        text += "✨ Output Styles:\n" + styles.map(s => `  - ${s.name}`).join("\n") + "\n\n";
      }

      text += `Use pull_settings to download.`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "apply_setting",
  {
    description: "Apply a setting from ~/.clsync to ~/.claude or .claude",
    inputSchema: {
      name: z.string().describe("Name of the setting to apply"),
      source: z.string().optional().describe('Source: "local" or "owner/repo"'),
      scope: z.enum(["user", "project"]).optional().describe('"user" (~/.claude) or "project" (.claude)'),
    },
  },
  async ({ name, source = "local", scope = "user" }) => {
    try {
      const result = await applyItem(name, scope, source);
      return { 
        content: [{ 
          type: "text", 
          text: `✅ Applied ${result.item.type}: ${result.item.name}\n\nTo: ${scope === 'user' ? '~/.claude' : '.claude'}/${result.item.path}` 
        }] 
      };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "list_staged",
  {
    description: "List items in ~/.clsync staging area",
    inputSchema: {
      source: z.string().optional().describe('"local" for local staging, or "owner/repo" for a pulled repo'),
    },
  },
  async ({ source = "local" }) => {
    try {
      let items;
      let label;
      
      if (source === "local") {
        items = await listLocalStaged();
        label = "Local Staging (~/.clsync/local)";
      } else {
        items = await listRepoItems(source);
        label = `Repository: ${source}`;
      }

      if (items.length === 0) {
        return { content: [{ type: "text", text: `No items in ${label}.` }] };
      }

      let text = `📋 ${label}:\n\n`;
      const skills = items.filter(i => i.type === 'skill');
      const agents = items.filter(i => i.type === 'agent');
      const styles = items.filter(i => i.type === 'output-style');

      if (skills.length > 0) {
        text += "🎯 Skills:\n" + skills.map(s => `  - ${s.name}`).join("\n") + "\n\n";
      }
      if (agents.length > 0) {
        text += "🤖 Subagents:\n" + agents.map(a => `  - ${a.name}`).join("\n") + "\n\n";
      }
      if (styles.length > 0) {
        text += "✨ Output Styles:\n" + styles.map(s => `  - ${s.name}`).join("\n") + "\n";
      }

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "list_repos",
  {
    description: "List pulled repositories in ~/.clsync/repos",
    inputSchema: {},
  },
  async () => {
    try {
      const repos = await listPulledRepos();

      if (repos.length === 0) {
        return { content: [{ type: "text", text: "No repositories pulled yet.\n\nUse pull_settings to pull from GitHub." }] };
      }

      let text = "📦 Pulled Repositories:\n\n";
      for (const repo of repos) {
        text += `📁 ${repo.name} (${repo.items.length} items)\n`;
        text += `   Last pulled: ${repo.last_pulled}\n`;
      }

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "promote_setting",
  {
    description: "Move a skill/agent/output-style from project .claude → user ~/.claude for global access. Example: promote_setting name='my-skill'",
    inputSchema: {
      name: z.string().describe("Name of the skill, agent, or output-style to promote (e.g., 'update-project-docs')"),
      force: z.boolean().optional().describe("Overwrite if exists in target"),
      rename: z.string().optional().describe("New name to avoid conflict"),
    },
  },
  async ({ name, force = false, rename }) => {
    try {
      const result = await promoteItem(name, { force, rename });
      let text = `✅ Promoted ${result.item.type}: ${result.newName}\n\n`;
      text += `From: .claude (project)\n`;
      text += `To: ~/.claude (user)\n\n`;
      if (result.renamed) {
        text += `⚠ Renamed: ${result.originalName} → ${result.newName}\n`;
      }
      text += `Now available globally!`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "demote_setting",
  {
    description: "Move a skill/agent/output-style from user ~/.claude → project .claude for project-specific use. Example: demote_setting name='my-skill'",
    inputSchema: {
      name: z.string().describe("Name of the skill, agent, or output-style to demote (e.g., 'update-project-docs')"),
      force: z.boolean().optional().describe("Overwrite if exists in target"),
      rename: z.string().optional().describe("New name to avoid conflict"),
    },
  },
  async ({ name, force = false, rename }) => {
    try {
      const result = await demoteItem(name, { force, rename });
      let text = `✅ Demoted ${result.item.type}: ${result.newName}\n\n`;
      text += `From: ~/.claude (user)\n`;
      text += `To: .claude (project)\n\n`;
      if (result.renamed) {
        text += `⚠ Renamed: ${result.originalName} → ${result.newName}\n`;
      }
      text += `Now project-specific!`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "compare_scopes",
  {
    description: "Compare settings in user (~/.claude) and project (.claude) scopes",
    inputSchema: {},
  },
  async () => {
    try {
      const { project, user } = await listBothScopes();

      let text = "👁 Comparing Scopes\n\n";

      text += "📁 User (~/.claude):\n";
      if (user.length === 0) {
        text += "   (empty)\n";
      } else {
        for (const item of user) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          text += `   ${icon} ${item.name}\n`;
        }
      }

      text += "\n📁 Project (.claude):\n";
      if (project.length === 0) {
        text += "   (empty)\n";
      } else {
        for (const item of project) {
          const icon = item.type === 'skill' ? '🎯' : item.type === 'agent' ? '🤖' : '✨';
          text += `   ${icon} ${item.name}\n`;
        }
      }

      text += "\nUse promote_setting or demote_setting to move items between scopes.";
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `❌ ${error.message}` }], isError: true };
    }
  }
);

// =============================================================================
// Link Tools - Connect skills/subagents to slash commands
// =============================================================================

server.registerTool(
  "link_skill_to_command",
  {
    description: "Link a skill to a slash command for explicit invocation",
    inputSchema: {
      skillName: z.string().describe("Name of the skill to link"),
      commandName: z.string().optional().describe("Custom command name (defaults to skill name)"),
      scope: z.enum(["user", "project"]).optional().describe("Scope: user (~/.claude) or project (.claude). Default: user"),
    },
  },
  async ({ skillName, commandName, scope = "user" }) => {
    try {
      const result = await linkSkillToCommand(skillName, { scope, commandName });
      return {
        content: [{
          type: "text",
          text: `✅ Linked skill "${result.skill}" to command "/${result.command}"\n\nPath: ${result.path}\n\nYou can now use /${result.command} to explicitly invoke this skill.`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "link_subagent_to_command",
  {
    description: "Link a subagent to a slash command for explicit invocation",
    inputSchema: {
      agentName: z.string().describe("Name of the subagent to link"),
      commandName: z.string().optional().describe("Custom command name (defaults to agent name)"),
      scope: z.enum(["user", "project"]).optional().describe("Scope: user (~/.claude) or project (.claude). Default: user"),
    },
  },
  async ({ agentName, commandName, scope = "user" }) => {
    try {
      const result = await linkSubagentToCommand(agentName, { scope, commandName });
      return {
        content: [{
          type: "text",
          text: `✅ Linked subagent "${result.agent}" to command "/${result.command}"\n\nPath: ${result.path}\n\nYou can now use /${result.command} to explicitly invoke this subagent.`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "link_all_to_commands",
  {
    description: "Link all skills and subagents to slash commands",
    inputSchema: {
      scope: z.enum(["user", "project"]).optional().describe("Scope: user (~/.claude) or project (.claude). Default: user"),
      skillsOnly: z.boolean().optional().describe("Only link skills"),
      agentsOnly: z.boolean().optional().describe("Only link subagents"),
    },
  },
  async ({ scope = "user", skillsOnly, agentsOnly }) => {
    try {
      const results = await linkAll({ scope, skillsOnly, agentsOnly });

      let message = "✅ Linked all items to slash commands\n\n";

      if (results.skills.length > 0) {
        message += "**Skills:**\n";
        results.skills.forEach(r => {
          message += `- ${r.skill} → /${r.command}\n`;
        });
        message += "\n";
      }

      if (results.agents.length > 0) {
        message += "**Subagents:**\n";
        results.agents.forEach(r => {
          message += `- ${r.agent} → /${r.command}\n`;
        });
      }

      if (results.skills.length === 0 && results.agents.length === 0) {
        message += "No skills or subagents found to link.";
      }

      return {
        content: [{ type: "text", text: message }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// =============================================================================
// Resource Registration
// =============================================================================

server.resource("docs", "claude-code://{source}/{file}", async (uri) => {
  const match = uri.href.match(/claude-code:\/\/([^/]+)\/(.+)/);
  if (!match) throw new Error(`Invalid URI format: ${uri.href}`);

  const [, source, file] = match;
  const content = await readFile(join(getDocsDir("user"), source, file), "utf-8");
  return {
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }],
  };
});

// =============================================================================
// Start Server
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("clsync MCP server started");
}

main().catch(console.error);



