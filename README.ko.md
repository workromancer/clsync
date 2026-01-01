# CLSYNC

<p align="center">
  <img src="https://img.shields.io/npm/v/clsync?style=flat-square&color=00A67E" alt="npm version">
  <img src="https://img.shields.io/npm/l/clsync?style=flat-square" alt="license">
  <img src="https://img.shields.io/node/v/clsync?style=flat-square" alt="node version">
  <img src="https://img.shields.io/badge/Claude_Code-MCP-blueviolet?style=flat-square" alt="MCP">
</p>

<p align="center">
  <b>🔄 GitHub을 통해 Claude Code 환경을 동기화하세요</b>
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

---

## ✨ 주요 기능

- 🔄 **GitHub 동기화** - GitHub을 통해 Claude Code 설정 공유
- 📦 **멀티 리포 지원** - 여러 리포지토리에서 풀 가능
- 📤 **Stage & Apply** - 로컬에서 스테이지, 어디든 적용
- 🎯 **Skills, Agents, Output Styles** - 모든 Claude Code 확장 관리
- 📄 **clsync.json** - 리포지토리 식별용 메타데이터

## 📐 아키텍처

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

## 📦 설치

```bash
npm install -g clsync
```

## 🚀 빠른 시작

### clsync 리포지토리 만들기

```bash
# 1. 초기화
clsync init

# 2. 설정 스테이지
clsync stage --all -u              # ~/.claude에서

# 3. 메타데이터와 함께 내보내기
clsync export ./my-settings \
  -a "Your Name" \
  -d "My Claude Code settings"

# 4. GitHub에 푸시
cd my-settings
git init && git add . && git commit -m "Claude settings"
git remote add origin git@github.com:user/my-settings.git
git push -u origin main
```

### 다른 사람 리포지토리 사용하기

```bash
# 내용 탐색
clsync browse owner/repo

# 로컬 캐시로 풀
clsync pull owner/repo

# ~/.claude에 적용
clsync apply --all -s owner/repo -u

# 또는 프로젝트에 적용
clsync apply --all -s owner/repo -d /path/to/.claude
```

## 📖 CLI 명령어

| 명령어                  | 설명                          |
| ----------------------- | ----------------------------- |
| `clsync init`           | `~/.clsync` 초기화            |
| `clsync status`         | 스테이징 상태                 |
| `clsync stage [name]`   | `~/.clsync/local`로 스테이지  |
| `clsync apply [name]`   | 스테이징에서 적용             |
| `clsync unstage <name>` | 스테이징에서 제거             |
| `clsync pull <repo>`    | GitHub → `~/.clsync/repos/`   |
| `clsync browse <repo>`  | 메타데이터와 함께 탐색        |
| `clsync list [source]`  | 항목 목록 (local 또는 repo)   |
| `clsync repos`          | 풀한 리포지토리 목록          |
| `clsync export <dir>`   | `clsync.json`과 함께 내보내기 |

### Stage 옵션

```bash
clsync stage [name] [options]
  -u, --user     ~/.claude에서 (기본)
  -p, --project  .claude에서
  -a, --all      모두 스테이지
```

### Apply 옵션

```bash
clsync apply [name] [options]
  -u, --user        ~/.claude로 (기본)
  -p, --project     .claude로
  -d, --dir <path>  커스텀 디렉터리로
  -s, --source <repo>  리포에서 (기본: local)
  -a, --all         모두 적용
```

### Export 옵션

```bash
clsync export <dir> [options]
  -a, --author <name>  작성자 이름
  -d, --desc <text>    설명
```

## 📁 디렉터리 구조

### ~/.clsync (스테이징 영역)

```
~/.clsync/
├── manifest.json
├── local/                 # 내가 스테이지한 것
│   ├── skills/
│   ├── agents/
│   └── output-styles/
└── repos/                 # 풀한 리포지토리들
    ├── owner1/repo1/
    │   ├── clsync.json    # 리포 메타데이터
    │   ├── skills/
    │   └── agents/
    └── owner2/repo2/
```

### clsync.json (리포지토리 메타데이터)

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

## 🎯 워크플로우

### 1. 내 설정 공유하기

```bash
clsync init
clsync stage --all -u
clsync export ./my-settings -a "Me" -d "My settings"
cd my-settings && git init && git push
```

### 2. 여러 리포지토리 사용

```bash
clsync pull user1/skills
clsync pull user2/agents
clsync repos                        # 모두 보기
clsync apply --all -s user1/skills -u
```

### 3. 여러 프로젝트에 적용

```bash
clsync pull team/shared-settings
clsync apply --all -s team/shared-settings -d ~/project1/.claude
clsync apply --all -s team/shared-settings -d ~/project2/.claude
```

### 4. 여러 컴퓨터 간 동기화

**컴퓨터 A:**

```bash
clsync stage --all -u && clsync export ./s && cd s && git push
```

**컴퓨터 B:**

```bash
clsync pull user/settings && clsync apply --all -s user/settings -u
```

## 🔌 MCP 서버

```bash
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### 사용 가능한 도구

| 도구                  | 설명              |
| --------------------- | ----------------- |
| `sync_docs`           | 문서 동기화       |
| `create_skill`        | 스킬 생성         |
| `create_subagent`     | 서브에이전트 생성 |
| `create_output_style` | 출력 스타일 생성  |
| `pull_settings`       | GitHub에서 풀     |
| `browse_repo`         | 리포지토리 탐색   |

## 🤝 기여

Pull Request와 Issue 환영합니다!

## 📜 라이선스

[MIT](LICENSE) © 2026 workromancer
