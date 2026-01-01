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

---

## ✨ Features

- 🔄 **Staging Area** - `~/.clsync` as a local cache for GitHub sync
- 📤 **Stage** - Copy settings from `~/.claude` or `.claude` to staging
- 📥 **Apply** - Deploy settings from staging to any directory
- � **GitHub Sync** - Pull from / push to GitHub repositories
- 🎯 **Skills, Agents, Output Styles** - Manage all Claude Code extensions

## 📐 Architecture

```
~/.claude/          ─┐
  ├── skills/        │
  ├── agents/        │                      ┌─────────────┐
  └── output-styles/ ├── stage ──►  ~/.clsync  ◄──────►  │   GitHub    │
                     │              (staging)    pull/push │  Repository │
.claude/ (project)  ─┤                             └─────────────┘
  ├── skills/        │
  ├── agents/        │◄── apply ───┘
  └── output-styles/ ─┘
```

## 📦 Installation

```bash
npm install -g clsync
# or use directly
npx clsync
```

## 🚀 Quick Start

### Initialize

```bash
clsync init
```

Creates `~/.clsync/` directory with:

```
~/.clsync/
├── manifest.json
├── skills/
├── agents/
└── output-styles/
```

### Stage Your Settings

```bash
# Stage from ~/.claude (user)
clsync stage my-skill -u
clsync stage --all -u

# Stage from .claude (project)
clsync stage my-skill -p
clsync stage --all -p
```

### Apply Settings

```bash
# Apply to ~/.claude
clsync apply my-skill -u

# Apply to project .claude
clsync apply my-skill -p

# Apply to custom directory
clsync apply my-skill -d /path/to/project/.claude

# Apply all staged items
clsync apply --all -u
```

### Sync with GitHub

```bash
# Browse a repository
clsync browse owner/repo

# Pull to staging (~/.clsync)
clsync pull owner/repo

# Apply pulled settings
clsync apply --all -u

# Export for git push
clsync export ./my-settings
cd my-settings && git init && git push
```

## 📖 CLI Commands

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `clsync init`           | Initialize `~/.clsync` directory |
| `clsync status`         | Show staging area status         |
| `clsync stage [name]`   | Stage item to `~/.clsync`        |
| `clsync apply [name]`   | Apply item from `~/.clsync`      |
| `clsync unstage <name>` | Remove item from staging         |
| `clsync list`           | List staged items                |
| `clsync pull <repo>`    | Pull from GitHub → `~/.clsync`   |
| `clsync browse <repo>`  | Browse GitHub repo contents      |
| `clsync export <dir>`   | Export staging for git push      |
| `clsync remote [repo]`  | Set/show GitHub remote           |
| `clsync sync`           | Sync docs (legacy)               |

### Stage Options

```bash
clsync stage [name] [options]
  -u, --user     From ~/.claude (default)
  -p, --project  From .claude
  -a, --all      Stage all items
```

### Apply Options

```bash
clsync apply [name] [options]
  -u, --user        To ~/.claude (default)
  -p, --project     To .claude
  -d, --dir <path>  To custom directory
  -a, --all         Apply all staged items
```

### Pull Options

```bash
clsync pull <repo> [options]
  -f, --force    Overwrite existing files
  -v, --verbose  Show details
```

## 🎯 Workflows

### 1. Share Your Settings

```bash
# Stage your settings
clsync stage --all -u

# Export for git
clsync export ./my-claude-settings

# Push to GitHub
cd my-claude-settings
git init
git add .
git commit -m "My Claude Code settings"
git remote add origin git@github.com:user/my-claude-settings.git
git push -u origin main
```

### 2. Use Someone's Settings

```bash
# Browse what's available
clsync browse owner/claude-settings

# Pull to staging
clsync pull owner/claude-settings

# Check what was pulled
clsync list

# Apply to your ~/.claude
clsync apply --all -u
```

### 3. Apply to Multiple Projects

```bash
# Pull settings once
clsync pull owner/team-settings

# Apply to different projects
clsync apply --all -d ~/projects/app1/.claude
clsync apply --all -d ~/projects/app2/.claude
clsync apply --all -d ~/projects/app3/.claude
```

### 4. Sync Across Machines

**Machine A (source):**

```bash
clsync stage --all -u
clsync export ./settings && cd settings && git push
```

**Machine B (destination):**

```bash
clsync pull user/settings
clsync apply --all -u
```

## 📁 Directory Structure

### Staging (`~/.clsync`)

```
~/.clsync/
├── manifest.json       # Sync metadata
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── agents/
│   └── my-agent.md
└── output-styles/
    └── my-style.md
```

### Claude Code Settings

```
~/.claude/              # User-level (personal)
.claude/                # Project-level (shared)
├── skills/
├── agents/
└── output-styles/
```

## � MCP Server

```bash
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### Available Tools

| Tool                  | Description           |
| --------------------- | --------------------- |
| `sync_docs`           | Sync documentation    |
| `list_docs`           | List synced docs      |
| `create_skill`        | Create a new skill    |
| `create_subagent`     | Create a new subagent |
| `create_output_style` | Create output style   |
| `pull_settings`       | Pull from GitHub      |
| `browse_repo`         | Browse GitHub repo    |

## 🤝 Contributing

Pull requests and issues are welcome!

## 📜 License

[MIT](LICENSE) © 2026 workromancer
