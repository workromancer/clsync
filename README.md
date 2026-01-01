# CLSYNC

<p align="center">
  <img src="https://img.shields.io/npm/v/clsync?style=flat-square&color=00A67E" alt="npm version">
  <img src="https://img.shields.io/npm/l/clsync?style=flat-square" alt="license">
  <img src="https://img.shields.io/node/v/clsync?style=flat-square" alt="node version">
  <img src="https://img.shields.io/badge/Claude_Code-MCP-blueviolet?style=flat-square" alt="MCP">
</p>

<p align="center">
  <b>🔄 Sync your Claude Code environment across machines</b>
</p>

<p align="center">
  <a href="README.ko.md">한국어</a>
</p>

```
  ┌───────────────────────────────────────┐
  │  CLSYNC                              │
  │  Claude Code Environment Sync        │
  └───────────────────────────────────────┘
```

Sync your Claude Code environment across multiple machines.
Manage docs, skills, subagents, and output styles in one place.

---

## ✨ Features

- 🔄 **Environment Sync** - Sync Claude Code docs and settings across machines
- 🎯 **Skills Management** - Create, list, and sync skills
- 🤖 **Subagents Management** - Create and manage subagents
- ✨ **Output Styles Management** - Create custom output styles
- 🔌 **MCP Server** - Use directly within Claude Code

## 📦 Installation

```bash
# Install globally via npm
npm install -g clsync

# Or run directly with npx
npx clsync
```

## 🚀 Quick Start

### CLI Usage

```bash
# Sync docs (default command)
npx clsync                    # saves to ~/.claude/clsync
npx clsync -p                 # saves to .claude/clsync

# Pull settings from GitHub repo
npx clsync pull owner/repo    # pull skills, agents, output-styles
npx clsync pull owner/repo -p # save to project

# List local settings
npx clsync list

# Export settings for git push
npx clsync export ./my-settings
```

### Use as MCP Server

```bash
# Register MCP server with Claude Code
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

## 📖 CLI Commands

### `clsync sync` (default)

Sync documentation from configured sources.

```bash
clsync [sync] [options]
  -c, --config <path>  Config file (default: clsync.config.json)
  -u, --user           Save to ~/.claude/clsync (default)
  -p, --project        Save to .claude/clsync
  -v, --verbose        Verbose output
  -d, --dry-run        Preview without changes
  -f, --force          Overwrite existing
```

### `clsync pull <repo>`

Pull settings from a GitHub repository.

```bash
clsync pull <owner/repo> [options]
  -u, --user           Save to ~/.claude (default)
  -p, --project        Save to .claude
  -f, --force          Overwrite existing
  -d, --dry-run        Preview
```

### `clsync list`

List local Claude Code settings.

```bash
clsync list [options]
  -u, --user           List from ~/.claude (default)
  -p, --project        List from .claude
```

### `clsync export <dir>`

Export settings to a directory for git push.

```bash
clsync export <directory> [options]
  -u, --user           Export from ~/.claude (default)
  -p, --project        Export from .claude
```

## 📖 CLI Options

```
Usage: clsync [options]

Options:
  -V, --version        Output version number
  -c, --config <path>  Path to config file (default: clsync.config.json)
  -u, --user           Save to ~/.claude/clsync (default)
  -p, --project        Save to .claude/clsync (current directory)
  -v, --verbose        Enable verbose output
  -d, --dry-run        Show what would be done without making changes
  -f, --force          Force overwrite existing files
  -h, --help           Display help
```

### Scope Options

| Flag                   | Location           | Use Case                             |
| ---------------------- | ------------------ | ------------------------------------ |
| `-u, --user` (default) | `~/.claude/clsync` | Personal, shared across projects     |
| `-p, --project`        | `.claude/clsync`   | Project-specific, version controlled |

## ⚙️ Configuration

Configure sources in `clsync.config.json`:

### Default (Claude Code Docs)

```json
{
  "sources": [
    {
      "name": "claude-code",
      "files": [
        "https://code.claude.com/docs/en/skills.md",
        "https://code.claude.com/docs/en/sub-agents.md",
        "https://code.claude.com/docs/en/plugins.md",
        "https://code.claude.com/docs/en/hooks-guide.md",
        "https://code.claude.com/docs/en/mcp.md",
        "https://code.claude.com/docs/en/headless.md",
        "https://code.claude.com/docs/en/output-styles.md",
        "https://code.claude.com/docs/en/discover-plugins.md"
      ]
    }
  ],
  "output": {
    "directory": "./.claude/clsync"
  },
  "options": {
    "overwrite": true
  }
}
```

### GitHub Repository Sync

```json
{
  "sources": [
    {
      "name": "anthropic-cookbook",
      "url": "https://github.com/anthropics/anthropic-cookbook",
      "branch": "main",
      "paths": ["patterns/agents"],
      "patterns": ["**/*.md"]
    }
  ]
}
```

## 🔌 MCP Server

CLSYNC also works as an **MCP (Model Context Protocol) server**.

### Setup

```bash
# Register MCP server with Claude Code
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### Available Tools

#### 📚 Documentation Tools

| Tool        | Description                                |
| ----------- | ------------------------------------------ |
| `sync_docs` | Sync documentation from configured sources |
| `list_docs` | List all synced documentation files        |
| `read_doc`  | Read contents of a specific doc file       |

#### 🎯 Skill Tools

| Tool           | Description                   |
| -------------- | ----------------------------- |
| `create_skill` | Create a new skill (SKILL.md) |
| `list_skills`  | List all skills               |
| `read_skill`   | Read a skill's content        |

#### 🤖 Subagent Tools

| Tool              | Description               |
| ----------------- | ------------------------- |
| `create_subagent` | Create a new subagent     |
| `list_subagents`  | List all subagents        |
| `read_subagent`   | Read a subagent's content |

#### ✨ Output Style Tools

| Tool                  | Description               |
| --------------------- | ------------------------- |
| `create_output_style` | Create a new output style |
| `list_output_styles`  | List all output styles    |

#### 🔄 Repository Sync Tools

| Tool                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| `pull_settings`       | Pull settings from a GitHub repository              |
| `list_local_settings` | List local settings (skills, agents, output-styles) |

### Usage Examples in Claude Code

```
"Sync the Claude Code documentation"
"Show me the skills documentation"
"Create a skill for generating commit messages"
"Create a test-runner subagent"
"Create a Korean output style"
"Add a code review skill at project level"
```

### Scope

All tools support the `scope` parameter:

| Scope              | Location        | Use Case                 |
| ------------------ | --------------- | ------------------------ |
| `"user"` (default) | `~/.claude/...` | Personal, all projects   |
| `"project"`        | `./.claude/...` | Team, version controlled |

## 📁 Generated File Structure

### Synced Documentation

```
~/.claude/clsync/claude-code/          # User scope
.claude/clsync/claude-code/            # Project scope
```

### Skills

```
~/.claude/skills/my-skill/SKILL.md     # User scope
.claude/skills/my-skill/SKILL.md       # Project scope
```

### Subagents

```
~/.claude/agents/my-agent.md           # User scope
.claude/agents/my-agent.md             # Project scope
```

### Output Styles

```
~/.claude/output-styles/my-style.md    # User scope
.claude/output-styles/my-style.md      # Project scope
```

## 📄 Metadata

Each synced document includes YAML frontmatter with metadata:

```yaml
---
source_url: https://code.claude.com/docs/en/skills.md
downloaded_at: 2026-01-01T03:46:22.704Z
---
```

## 🎯 Use Cases

### 1. Multi-Machine Environment Sync

- Use the same Claude Code settings at home/office/laptop
- Version control Skills and Subagents with Git

### 2. Team Environment Sharing

- Save settings to project with `-p` option
- Share the same skills/agents with team members

### 3. Claude Code Automation

- Create skills/agents directly from Claude via MCP server
- Documentation-driven development workflow

## 🤝 Contributing

Pull requests and issues are always welcome!

## 📜 License

[MIT](LICENSE) © 2026 workromancer
