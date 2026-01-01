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

## ✨ Features

- 🔄 **GitHub Sync** - Share and sync Claude Code settings via GitHub
- 📦 **Multi-Repo Support** - Pull from multiple repositories
- 📤 **Stage & Apply** - Stage locally, apply anywhere
- 🎯 **Skills, Agents, Output Styles** - Manage all Claude Code extensions
- 📄 **clsync.json** - Repository metadata for identification

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

## 📦 Installation

```bash
npm install -g clsync
```

## 🚀 Quick Start

### Create a clsync Repository

```bash
# 1. Initialize
clsync init

# 2. Stage your settings
clsync stage --all -u              # From ~/.claude

# 3. Export with metadata
clsync export ./my-settings \
  -a "Your Name" \
  -d "My Claude Code settings"

# 4. Push to GitHub
cd my-settings
git init && git add . && git commit -m "Claude settings"
git remote add origin git@github.com:user/my-settings.git
git push -u origin main
```

### Use Someone's Repository

```bash
# Browse contents
clsync browse owner/repo

# Pull to local cache
clsync pull owner/repo

# Apply to your ~/.claude
clsync apply --all -s owner/repo -u

# Or apply to a project
clsync apply --all -s owner/repo -d /path/to/.claude
```

## 📖 CLI Commands

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `clsync init`           | Initialize `~/.clsync`           |
| `clsync status`         | Show staging status              |
| `clsync stage [name]`   | Stage to `~/.clsync/local`       |
| `clsync apply [name]`   | Apply from staging               |
| `clsync unstage <name>` | Remove from staging              |
| `clsync pull <repo>`    | Pull GitHub → `~/.clsync/repos/` |
| `clsync browse <repo>`  | Browse repo with metadata        |
| `clsync list [source]`  | List items (local or repo)       |
| `clsync repos`          | List pulled repositories         |
| `clsync export <dir>`   | Export with `clsync.json`        |

### Stage Options

```bash
clsync stage [name] [options]
  -u, --user     From ~/.claude (default)
  -p, --project  From .claude
  -a, --all      Stage all
```

### Apply Options

```bash
clsync apply [name] [options]
  -u, --user        To ~/.claude (default)
  -p, --project     To .claude
  -d, --dir <path>  To custom directory
  -s, --source <repo>  From repo (default: local)
  -a, --all         Apply all
```

### Export Options

```bash
clsync export <dir> [options]
  -a, --author <name>  Author name
  -d, --desc <text>    Description
```

## 📁 Directory Structure

### ~/.clsync (Staging Area)

```
~/.clsync/
├── manifest.json
├── local/                 # Your staged items
│   ├── skills/
│   ├── agents/
│   └── output-styles/
└── repos/                 # Pulled repositories
    ├── owner1/repo1/
    │   ├── clsync.json    # Repo metadata
    │   ├── skills/
    │   └── agents/
    └── owner2/repo2/
```

### clsync.json (Repository Metadata)

```json
{
  "$schema": "https://clsync.dev/schema/v1.json",
  "version": "1.0.0",
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

## 🎯 Workflows

### 1. Share Your Settings

```bash
clsync init
clsync stage --all -u
clsync export ./my-settings -a "Me" -d "My settings"
cd my-settings && git init && git push
```

### 2. Use Multiple Repos

```bash
clsync pull user1/skills
clsync pull user2/agents
clsync repos                        # View all
clsync apply --all -s user1/skills -u
```

### 3. Apply to Multiple Projects

```bash
clsync pull team/shared-settings
clsync apply --all -s team/shared-settings -d ~/project1/.claude
clsync apply --all -s team/shared-settings -d ~/project2/.claude
```

### 4. Sync Across Machines

**Machine A:**

```bash
clsync stage --all -u && clsync export ./s && cd s && git push
```

**Machine B:**

```bash
clsync pull user/settings && clsync apply --all -s user/settings -u
```

## 🔌 MCP Server

```bash
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### Available Tools

| Tool                  | Description         |
| --------------------- | ------------------- |
| `sync_docs`           | Sync documentation  |
| `create_skill`        | Create skill        |
| `create_subagent`     | Create subagent     |
| `create_output_style` | Create output style |
| `pull_settings`       | Pull from GitHub    |
| `browse_repo`         | Browse repository   |

## 🤝 Contributing

Pull requests and issues welcome!

## 📜 License

[MIT](LICENSE) © 2026 workromancer
