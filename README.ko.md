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

```
  ┌───────────────────────────────────────┐
  │  CLSYNC                              │
  │  Claude Code Environment Sync        │
  └───────────────────────────────────────┘
```

여러 컴퓨터에서 Claude Code 환경을 동기화합니다.
문서, skills, subagents, output styles를 한 곳에서 관리하세요.

---

## ✨ 주요 기능

- 🔄 **환경 동기화** - Claude Code 문서와 설정을 여러 컴퓨터에서 동기화
- 🎯 **Skills 관리** - 스킬 생성, 조회, 동기화
- 🤖 **Subagents 관리** - 서브에이전트 생성 및 관리
- ✨ **Output Styles 관리** - 커스텀 출력 스타일 생성
- 🔌 **MCP 서버** - Claude Code에서 직접 사용

## 📦 설치

```bash
# npm 글로벌 설치
npm install -g clsync

# 또는 npx로 바로 실행
npx clsync
```

## 🚀 빠른 시작

### CLI 사용

```bash
# 기본 실행 (문서를 ~/.claude/clsync에 저장)
npx clsync

# 프로젝트 폴더에 저장 (.claude/clsync)
npx clsync -p

# 미리보기 (실제 다운로드 X)
npx clsync --dry-run

# 상세 로그 + 큰 배너
npx clsync --verbose

# 기존 파일 덮어쓰기
npx clsync --force
```

### MCP 서버로 사용

```bash
# Claude Code에 MCP 서버 등록
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

## 📖 CLI 옵션

```
Usage: clsync [options]

Options:
  -V, --version        버전 출력
  -c, --config <path>  설정 파일 경로 (기본: clsync.config.json)
  -u, --user           ~/.claude/clsync에 저장 (기본값)
  -p, --project        .claude/clsync에 저장 (현재 디렉터리)
  -v, --verbose        상세 로그 출력
  -d, --dry-run        실제 다운로드 없이 미리보기
  -f, --force          기존 파일 덮어쓰기
  -h, --help           도움말 출력
```

### 스코프 옵션

| 플래그              | 저장 위치          | 용도                           |
| ------------------- | ------------------ | ------------------------------ |
| `-u, --user` (기본) | `~/.claude/clsync` | 개인용, 모든 프로젝트에서 공유 |
| `-p, --project`     | `.claude/clsync`   | 프로젝트별, 버전 관리 가능     |

## ⚙️ 설정 파일

`clsync.config.json` 파일로 동기화할 문서를 설정합니다:

### 기본 설정 (Claude Code 문서)

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

### GitHub 리포지토리 동기화

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

## 🔌 MCP 서버

CLSYNC는 **MCP (Model Context Protocol) 서버**로도 동작합니다.

### 설정

```bash
# Claude Code에 MCP 서버 등록
claude mcp add clsync --transport stdio -- npx -y clsync-mcp
```

### 사용 가능한 도구

#### 📚 문서 도구

| 도구        | 설명                        |
| ----------- | --------------------------- |
| `sync_docs` | 설정된 소스에서 문서 동기화 |
| `list_docs` | 동기화된 문서 목록 조회     |
| `read_doc`  | 특정 문서 내용 읽기         |

#### 🎯 Skill 도구

| 도구           | 설명                    |
| -------------- | ----------------------- |
| `create_skill` | 새 스킬 생성 (SKILL.md) |
| `list_skills`  | 스킬 목록 조회          |
| `read_skill`   | 스킬 내용 읽기          |

#### 🤖 Subagent 도구

| 도구              | 설명                   |
| ----------------- | ---------------------- |
| `create_subagent` | 새 서브에이전트 생성   |
| `list_subagents`  | 서브에이전트 목록 조회 |
| `read_subagent`   | 서브에이전트 내용 읽기 |

#### ✨ Output Style 도구

| 도구                  | 설명                  |
| --------------------- | --------------------- |
| `create_output_style` | 새 출력 스타일 생성   |
| `list_output_styles`  | 출력 스타일 목록 조회 |

### Claude Code에서 사용 예시

```
"Claude Code 문서를 동기화해줘"
"skills 문서 보여줘"
"커밋 메시지 생성 스킬 만들어줘"
"테스트 실행하는 서브에이전트 만들어줘"
"한국어 출력 스타일 만들어줘"
"프로젝트 레벨에 코드 리뷰 스킬 추가해줘"
```

### 스코프

모든 도구는 `scope` 파라미터를 지원합니다:

| Scope           | 위치            | 용도                       |
| --------------- | --------------- | -------------------------- |
| `"user"` (기본) | `~/.claude/...` | 개인용, 모든 프로젝트 공유 |
| `"project"`     | `./.claude/...` | 팀 공유, 버전 관리         |

## 📁 생성되는 파일 구조

### 동기화된 문서

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

## 📄 메타데이터

동기화된 각 문서 상단에 YAML frontmatter로 메타데이터가 추가됩니다:

```yaml
---
source_url: https://code.claude.com/docs/en/skills.md
downloaded_at: 2026-01-01T03:46:22.704Z
---
```

## 🎯 사용 시나리오

### 1. 여러 컴퓨터 환경 동기화

- 집/회사/노트북에서 동일한 Claude Code 설정 사용
- Skills, Subagents를 Git으로 버전 관리

### 2. 팀 환경 공유

- `-p` 옵션으로 프로젝트에 설정 저장
- 팀원들과 동일한 스킬/에이전트 공유

### 3. Claude Code 자동화

- MCP 서버로 Claude에서 직접 스킬/에이전트 생성
- 문서 기반 개발 워크플로우

## 🤝 기여

Pull Request와 Issue는 언제나 환영합니다!

## 📜 라이선스

[MIT](LICENSE) © 2026 workromancer
