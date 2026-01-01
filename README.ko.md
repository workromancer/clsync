# CLSYNC

<p align="center">
  <img src="https://img.shields.io/npm/v/clsync?style=flat-square&color=00A67E" alt="npm version">
  <img src="https://img.shields.io/npm/l/clsync?style=flat-square" alt="license">
  <img src="https://img.shields.io/node/v/clsync?style=flat-square" alt="node version">
  <img src="https://img.shields.io/badge/Claude_Code-MCP-blueviolet?style=flat-square" alt="MCP">
</p>

<p align="center">
  <b>🔄 여러 컴퓨터에서 Claude Code 환경을 동기화하세요</b>
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

---

## ✨ 주요 기능

- 🔄 **스테이징 영역** - `~/.clsync`를 GitHub 동기화용 로컬 캐시로 사용
- 📤 **Stage** - `~/.claude` 또는 `.claude`에서 스테이징으로 복사
- 📥 **Apply** - 스테이징에서 원하는 디렉터리로 배포
- 🔌 **GitHub 동기화** - GitHub 리포지토리와 pull/push
- 🎯 **Skills, Agents, Output Styles** - 모든 Claude Code 확장 관리

## 📐 아키텍처

```
~/.claude/          ─┐
  ├── skills/        │
  ├── agents/        │                      ┌─────────────┐
  └── output-styles/ ├── stage ──►  ~/.clsync  ◄──────►  │   GitHub    │
                     │              (스테이징)   pull/push │  Repository │
.claude/ (project)  ─┤                             └─────────────┘
  ├── skills/        │
  ├── agents/        │◄── apply ───┘
  └── output-styles/ ─┘
```

## 📦 설치

```bash
npm install -g clsync
# 또는 바로 사용
npx clsync
```

## 🚀 빠른 시작

### 초기화

```bash
clsync init
```

`~/.clsync/` 디렉터리가 생성됩니다:

```
~/.clsync/
├── manifest.json
├── skills/
├── agents/
└── output-styles/
```

### 설정 스테이지하기

```bash
# ~/.claude에서 스테이지 (user)
clsync stage my-skill -u
clsync stage --all -u

# .claude에서 스테이지 (project)
clsync stage my-skill -p
clsync stage --all -p
```

### 설정 적용하기

```bash
# ~/.claude로 적용
clsync apply my-skill -u

# 프로젝트 .claude로 적용
clsync apply my-skill -p

# 커스텀 디렉터리로 적용
clsync apply my-skill -d /path/to/project/.claude

# 모든 스테이지된 항목 적용
clsync apply --all -u
```

### GitHub과 동기화

```bash
# 리포지토리 탐색
clsync browse owner/repo

# 스테이징으로 풀 (~/.clsync)
clsync pull owner/repo

# 풀한 설정 적용
clsync apply --all -u

# git push용으로 내보내기
clsync export ./my-settings
cd my-settings && git init && git push
```

## 📖 CLI 명령어

| 명령어                  | 설명                        |
| ----------------------- | --------------------------- |
| `clsync init`           | `~/.clsync` 디렉터리 초기화 |
| `clsync status`         | 스테이징 영역 상태          |
| `clsync stage [name]`   | `~/.clsync`로 스테이지      |
| `clsync apply [name]`   | `~/.clsync`에서 적용        |
| `clsync unstage <name>` | 스테이징에서 제거           |
| `clsync list`           | 스테이지된 항목 목록        |
| `clsync pull <repo>`    | GitHub → `~/.clsync`        |
| `clsync browse <repo>`  | GitHub 리포 탐색            |
| `clsync export <dir>`   | git push용 내보내기         |
| `clsync remote [repo]`  | GitHub 리모트 설정/조회     |
| `clsync sync`           | 문서 동기화 (기존)          |

### Stage 옵션

```bash
clsync stage [name] [options]
  -u, --user     ~/.claude에서 (기본)
  -p, --project  .claude에서
  -a, --all      모든 항목 스테이지
```

### Apply 옵션

```bash
clsync apply [name] [options]
  -u, --user        ~/.claude로 (기본)
  -p, --project     .claude로
  -d, --dir <path>  커스텀 디렉터리로
  -a, --all         모든 항목 적용
```

### Pull 옵션

```bash
clsync pull <repo> [options]
  -f, --force    기존 파일 덮어쓰기
  -v, --verbose  상세 출력
```

## 🎯 워크플로우

### 1. 내 설정 공유하기

```bash
# 설정 스테이지
clsync stage --all -u

# git용으로 내보내기
clsync export ./my-claude-settings

# GitHub에 푸시
cd my-claude-settings
git init
git add .
git commit -m "My Claude Code settings"
git remote add origin git@github.com:user/my-claude-settings.git
git push -u origin main
```

### 2. 다른 사람 설정 사용하기

```bash
# 리포지토리 탐색
clsync browse owner/claude-settings

# 스테이징으로 풀
clsync pull owner/claude-settings

# 풀한 내용 확인
clsync list

# ~/.claude에 적용
clsync apply --all -u
```

### 3. 여러 프로젝트에 적용

```bash
# 설정 한 번만 풀
clsync pull owner/team-settings

# 여러 프로젝트에 적용
clsync apply --all -d ~/projects/app1/.claude
clsync apply --all -d ~/projects/app2/.claude
clsync apply --all -d ~/projects/app3/.claude
```

### 4. 여러 컴퓨터 간 동기화

**컴퓨터 A (소스):**

```bash
clsync stage --all -u
clsync export ./settings && cd settings && git push
```

**컴퓨터 B (대상):**

```bash
clsync pull user/settings
clsync apply --all -u
```

## 📁 디렉터리 구조

### 스테이징 (`~/.clsync`)

```
~/.clsync/
├── manifest.json       # 동기화 메타데이터
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── agents/
│   └── my-agent.md
└── output-styles/
    └── my-style.md
```

### Claude Code 설정

```
~/.claude/              # User 레벨 (개인용)
.claude/                # Project 레벨 (팀 공유)
├── skills/
├── agents/
└── output-styles/
```

## 🔌 MCP 서버

```bash
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### 사용 가능한 도구

| 도구                  | 설명                 |
| --------------------- | -------------------- |
| `sync_docs`           | 문서 동기화          |
| `list_docs`           | 동기화된 문서 목록   |
| `create_skill`        | 새 스킬 생성         |
| `create_subagent`     | 새 서브에이전트 생성 |
| `create_output_style` | 출력 스타일 생성     |
| `pull_settings`       | GitHub에서 풀        |
| `browse_repo`         | GitHub 리포 탐색     |

## 🤝 기여

Pull Request와 Issue는 언제나 환영합니다!

## 📜 라이선스

[MIT](LICENSE) © 2026 workromancer
