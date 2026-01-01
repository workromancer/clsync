#!/usr/bin/env node

/**
 * MCP Server for cc-docs-track
 * Provides tools for syncing documentation and creating Claude Code extensions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile, readdir, stat, mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import os from "os";
import { loadConfig } from "../src/config.js";
import { trackDocs } from "../src/index.js";

// Create MCP server
const server = new McpServer({
  name: "cc-syncer",
  version: "1.0.0",
});

// =============================================================================
// Directory Helpers
// =============================================================================

function getDocsDir(scope = "user") {
  if (scope === "project") {
    return resolve(process.cwd(), "claude", "cc-docs");
  }
  return join(os.homedir(), ".claude", "cc-docs");
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

server.tool(
  "sync_docs",
  "Sync documentation from configured sources. Updates local copies of Claude Code docs.",
  {
    scope: {
      type: "string",
      description: 'Where to save docs: "user" (~/.claude/cc-docs) or "project" (./claude/cc-docs)',
      enum: ["user", "project"],
    },
    force: {
      type: "boolean",
      description: "Force overwrite existing files",
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

server.tool(
  "list_docs",
  "List all synced documentation files",
  {
    scope: {
      type: "string",
      description: 'Scope: "user" or "project"',
      enum: ["user", "project"],
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

server.tool(
  "read_doc",
  "Read the contents of a synced documentation file",
  {
    source: { type: "string", description: 'Source name (e.g., "claude-code")' },
    file: { type: "string", description: 'File name (e.g., "skills.md")' },
    scope: { type: "string", description: 'Scope: "user" or "project"', enum: ["user", "project"] },
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

server.tool(
  "create_skill",
  "Create a new Claude Code skill. Skills teach Claude specific capabilities.",
  {
    name: { type: "string", description: "Skill name (e.g., code-reviewer, commit-messages)" },
    description: { type: "string", description: "Short description of what the skill does" },
    instructions: { type: "string", description: "Markdown instructions for Claude to follow" },
    scope: { type: "string", description: '"user" (~/.claude/skills) or "project" (.claude/skills)', enum: ["user", "project"] },
    allowed_tools: {
      type: "array",
      items: { type: "string" },
      description: "Optional list of allowed tools (e.g., Bash, Read, Write)",
    },
  },
  async ({ name, description, instructions, scope = "user", allowed_tools }) => {
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

server.tool(
  "list_skills",
  "List all Claude Code skills",
  {
    scope: { type: "string", description: '"user" or "project"', enum: ["user", "project"] },
  },
  async ({ scope = "user" }) => {
    const skills = await listItems(getSkillsDir(scope), "dir");

    if (skills.length === 0) {
      return { content: [{ type: "text", text: `No skills found in ${getSkillsDir(scope)}` }] };
    }

    const list = skills.map((s) => `- ${s.name}`).join("\n");
    return { content: [{ type: "text", text: `🎯 Skills (${skills.length}):\n\n${list}` }] };
  }
);

server.tool(
  "read_skill",
  "Read a skill's SKILL.md content",
  {
    name: { type: "string", description: "Skill name" },
    scope: { type: "string", description: '"user" or "project"', enum: ["user", "project"] },
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

server.tool(
  "create_subagent",
  "Create a new Claude Code subagent. Subagents are specialized agents for specific tasks.",
  {
    name: { type: "string", description: "Subagent name (e.g., test-runner, security-reviewer)" },
    description: { type: "string", description: "What this subagent specializes in" },
    instructions: { type: "string", description: "System prompt / instructions for the subagent" },
    scope: { type: "string", description: '"user" (~/.claude/agents) or "project" (.claude/agents)', enum: ["user", "project"] },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Optional list of skills this subagent can use",
    },
    allowed_tools: {
      type: "array",
      items: { type: "string" },
      description: "Optional list of allowed tools",
    },
  },
  async ({ name, description, instructions, scope = "user", skills, allowed_tools }) => {
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

server.tool(
  "list_subagents",
  "List all Claude Code subagents",
  {
    scope: { type: "string", description: '"user" or "project"', enum: ["user", "project"] },
  },
  async ({ scope = "user" }) => {
    const agents = await listItems(getAgentsDir(scope), "file");

    if (agents.length === 0) {
      return { content: [{ type: "text", text: `No subagents found in ${getAgentsDir(scope)}` }] };
    }

    const list = agents.map((a) => `- @${a.name}`).join("\n");
    return { content: [{ type: "text", text: `🤖 Subagents (${agents.length}):\n\n${list}` }] };
  }
);

server.tool(
  "read_subagent",
  "Read a subagent's configuration",
  {
    name: { type: "string", description: "Subagent name" },
    scope: { type: "string", description: '"user" or "project"', enum: ["user", "project"] },
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

server.tool(
  "create_output_style",
  "Create a new output style for Claude's responses.",
  {
    name: { type: "string", description: "Style name (e.g., concise, detailed, korean)" },
    description: { type: "string", description: "What this style does" },
    instructions: { type: "string", description: "Instructions for how Claude should format responses" },
    scope: { type: "string", description: '"user" or "project"', enum: ["user", "project"] },
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

server.tool(
  "list_output_styles",
  "List all output styles",
  {
    scope: { type: "string", description: '"user" or "project"', enum: ["user", "project"] },
  },
  async ({ scope = "user" }) => {
    const styles = await listItems(getOutputStylesDir(scope), "file");

    if (styles.length === 0) {
      return { content: [{ type: "text", text: `No output styles found` }] };
    }

    const list = styles.map((s) => `- ${s.name}`).join("\n");
    return { content: [{ type: "text", text: `✨ Output Styles (${styles.length}):\n\n${list}` }] };
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
  console.error("cc-docs-track MCP server started");
}

main().catch(console.error);
