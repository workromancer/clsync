# CLSYNC

<p align="center">
  <img src="https://img.shields.io/npm/v/clsync?style=flat-square&color=00A67E" alt="npm version">
  <img src="https://img.shields.io/npm/l/clsync?style=flat-square" alt="license">
  <img src="https://img.shields.io/node/v/clsync?style=flat-square" alt="node version">
  <img src="https://img.shields.io/badge/Claude_Code-MCP-blueviolet?style=flat-square" alt="MCP">
</p>

<p align="center">
  <b>🔄 Sync your Claude Code environment across machines via GitHub</b>
</p>

<p align="center">
  <a href="README.ko.md">한국어</a>
</p>

---

```
   ██████╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗
  ██╔════╝██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
  ██║     ██║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║
  ██║     ██║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║
  ╚██████╗███████╗███████║   ██║   ██║ ╚████║╚██████╗
   ╚═════╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
```

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [CLI Reference](#-cli-reference)
- [Interactive Mode](#-interactive-mode)
- [MCP Server](#-mcp-server)
- [Architecture](#-architecture)
- [Workflows](#-workflows)
- [License](#-license)

---

## ✨ Features

### Core Features

| Feature                       | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| 🔄 **GitHub Sync**            | Share and sync Claude Code settings via GitHub repositories   |
| 📦 **Multi-Repo Support**     | Pull from multiple repositories and manage them independently |
| 📤 **Stage & Apply**          | Stage settings locally, apply them anywhere                   |
| 🎯 **Full Extension Support** | Manage Skills, Agents, and Output Styles                      |
| 🔀 **Promote / Demote**       | Move settings between project and user scope                  |
| 🔌 **MCP Integration**        | Native Claude Code integration via MCP Server                 |

### CLI Features

| Feature                   | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| 🖥️ **Interactive Mode**   | User-friendly menu when running `clsync` without arguments |
| 📊 **Status Dashboard**   | View staging area status and pulled repositories           |
| 🔍 **Repository Browser** | Browse GitHub repositories before pulling                  |
| 📋 **Scope Comparison**   | Compare user and project settings side-by-side             |
| 💡 **Smart Hints**        | Helpful error messages with suggestions                    |
| 📐 **Responsive UI**      | Adapts to terminal window size                             |

### MCP Server Features

| Feature                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| 📝 **Create Settings**    | Create skills, subagents, output styles via AI |
| 📖 **Read Settings**      | Read and list existing settings                |
| 🔄 **Sync Operations**    | Pull, apply, promote, demote via MCP tools     |
| 📚 **Documentation Sync** | Sync external documentation to Claude context  |

---

## 📦 Installation

```bash
npm install -g clsync
```

---

## 🚀 Quick Start

### 1. Initialize

```bash
clsync init
```

### 2. Pull Community Settings

```bash
# Browse a repository
clsync browse owner/repo

# Pull to local cache
clsync pull owner/repo

# Apply all to your ~/.claude
clsync apply --all -s owner/repo -u
```

### 3. Share Your Settings

```bash
# Stage your settings
clsync stage --all -u

# Export with metadata
clsync export ./my-settings -a "Your Name" -d "My Claude settings"

# Push to GitHub
cd my-settings && git init && git add . && git push
```

---

## 📖 CLI Reference

### Basic Commands

| Command            | Description                      |
| ------------------ | -------------------------------- |
| `clsync`           | Start interactive mode           |
| `clsync init`      | Initialize `~/.clsync` directory |
| `clsync status`    | Show staging area status         |
| `clsync --help`    | Show help with ASCII banner      |
| `clsync --version` | Show version                     |

### Staging Commands

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `clsync stage [name]`   | Stage item to `~/.clsync/local` |
| `clsync stage --all -u` | Stage all from `~/.claude`      |
| `clsync stage --all -p` | Stage all from `.claude`        |
| `clsync unstage <name>` | Remove from staging             |
| `clsync list`           | List staged items               |

### Apply Commands

| Command                               | Description               |
| ------------------------------------- | ------------------------- |
| `clsync apply [name]`                 | Apply from local staging  |
| `clsync apply [name] -s owner/repo`   | Apply from pulled repo    |
| `clsync apply --all -s owner/repo -u` | Apply all to `~/.claude`  |
| `clsync apply --all -s owner/repo -p` | Apply all to `.claude`    |
| `clsync apply [name] -d /path`        | Apply to custom directory |

### Repository Commands

| Command                       | Description              |
| ----------------------------- | ------------------------ |
| `clsync pull <owner/repo>`    | Pull from GitHub         |
| `clsync pull <owner/repo> -f` | Force overwrite          |
| `clsync browse <owner/repo>`  | Browse repo contents     |
| `clsync repos`                | List pulled repositories |
| `clsync list <owner/repo>`    | List items in a repo     |

### Scope Commands

| Command                          | Description                       |
| -------------------------------- | --------------------------------- |
| `clsync scopes`                  | Compare user and project settings |
| `clsync promote <name>`          | Move: `.claude` → `~/.claude`     |
| `clsync promote <name> -f`       | Force overwrite                   |
| `clsync promote <name> -r <new>` | Rename to avoid conflict          |
| `clsync demote <name>`           | Move: `~/.claude` → `.claude`     |

### Export Commands

| Command                           | Description                 |
| --------------------------------- | --------------------------- |
| `clsync export <dir>`             | Export staging to directory |
| `clsync export <dir> -a "Author"` | With author name            |
| `clsync export <dir> -d "Desc"`   | With description            |

### Sync Commands

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `clsync sync`    | Sync documentation from config |
| `clsync sync -u` | Sync to user level             |
| `clsync sync -f` | Force overwrite                |
| `clsync sync -d` | Dry run (preview)              |

---

## 🎮 Interactive Mode

Run `clsync` without arguments to enter interactive mode:

```
   ██████╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗
  ██╔════╝██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
  ...
  📦 Local: 0 items  |  🔗 Repos: 2

? What would you like to do?
  1) 📊 View status
  2) 📦 Browse pulled repositories
  3) 📥 Apply items from repo
  4) 🔍 Pull new repository
  5) 🔀 Compare scopes (user vs project)
  6) ❓ Help
  7) 👋 Exit
```

**Features:**

- Browse and apply items with number selection
- Multi-select items to apply
- Pull new repositories interactively
- Compare scopes visually

---

## 🔌 MCP Server

### Setup

```bash
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### Available Tools

#### Documentation Tools

| Tool        | Description                                |
| ----------- | ------------------------------------------ |
| `sync_docs` | Sync documentation from configured sources |
| `list_docs` | List synced documentation files            |
| `read_doc`  | Read a documentation file                  |

#### Creation Tools

| Tool                  | Description                      |
| --------------------- | -------------------------------- |
| `create_skill`        | Create a new skill with SKILL.md |
| `create_subagent`     | Create a new subagent            |
| `create_output_style` | Create a new output style        |

#### List & Read Tools

| Tool                 | Description                     |
| -------------------- | ------------------------------- |
| `list_skills`        | List skills (user/project/both) |
| `read_skill`         | Read skill content              |
| `list_subagents`     | List subagents                  |
| `read_subagent`      | Read subagent content           |
| `list_output_styles` | List output styles              |

#### Repository Tools

| Tool            | Description                 |
| --------------- | --------------------------- |
| `pull_settings` | Pull from GitHub repository |
| `browse_repo`   | Browse repository contents  |
| `apply_setting` | Apply setting from staging  |
| `list_staged`   | List staged items           |
| `list_repos`    | List pulled repositories    |

#### Scope Tools

| Tool              | Description                       |
| ----------------- | --------------------------------- |
| `promote_setting` | Move project → user               |
| `demote_setting`  | Move user → project               |
| `compare_scopes`  | Compare user and project settings |

---

## 📐 Architecture

```
~/.claude/          ─┐
  ├── skills/        │
  ├── agents/        │     stage      ┌─────────────┐
  └── output-styles/ ├──────────►  ~/.clsync  ◄────►  GitHub
                     │              ├── local/        Repos
.claude/ (project)  ─┤              └── repos/
  ├── skills/        │                  └── owner/repo/
  └── ...           ─┘◄── apply ────┘
```

### Directory Structure

```
~/.clsync/
├── manifest.json           # Metadata and repo tracking
├── local/                  # Your staged items
│   ├── skills/
│   ├── agents/
│   └── output-styles/
└── repos/                  # Pulled repositories
    ├── owner1/repo1/
    │   ├── clsync.json     # Repo metadata
    │   ├── skills/
    │   └── agents/
    └── owner2/repo2/
```

### clsync.json Schema

```json
{
  "$schema": "https://clsync.dev/schema/v1.json",
  "version": "0.1.0-beta",
  "name": "my-settings",
  "description": "My Claude Code settings",
  "author": "username",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z",
  "items": [
    { "type": "skill", "name": "commit-msg", "path": "skills/commit-msg" }
  ],
  "stats": {
    "skills": 1,
    "agents": 0,
    "output_styles": 0,
    "total": 1
  }
}
```

---

## 🎯 Workflows

### Personal: Sync Across Machines

**Machine A (export):**

```bash
clsync stage --all -u
clsync export ./my-settings -a "Me"
cd my-settings && git push
```

**Machine B (import):**

```bash
clsync pull user/my-settings
clsync apply --all -s user/my-settings -u
```

### Team: Share Settings

```bash
# Team lead exports
clsync stage --all -u
clsync export ./team-settings -a "Team" -d "Shared team settings"

# Team members import
clsync pull team/settings
clsync apply --all -s team/settings -u
```

### Community: Use Multiple Repos

```bash
clsync pull user1/awesome-skills
clsync pull user2/productivity-agents
clsync repos                              # View all
clsync apply code-reviewer -s user2/productivity-agents -u
```

### Project: Manage Scopes

```bash
# View both scopes
clsync scopes

# Promote project setting to user (make global)
clsync promote my-skill

# Demote user setting to project (make local)
clsync demote my-agent
```

---

## 🤝 Contributing

Pull requests and issues welcome!

## 📜 License

[MIT](LICENSE) © 2026 workromancer
