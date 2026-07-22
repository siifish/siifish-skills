# siifish-skills

`siifish-skills` 是一个个人维护、可供多个 AI Agent 复用的 skills 仓库。仓库是 skill 源码的唯一来源；安装器负责发现本机 Agent，并将同一份 skill 安装到它们的 skills 目录。

## Skills

| Skill | 用途 | 平台 | 依赖 |
|---|---|---|---|
| `bear-notes` | 搜索、阅读、创建和整理 Bear 笔记 | macOS | Bear、`bearcli` |

## 快速使用

需要 Node.js 20 或更高版本。直接从 GitHub 运行，无需安装 npm 包：

```bash
npx --yes github:siifish/siifish-skills detect
npx --yes github:siifish/siifish-skills install --dry-run
npx --yes github:siifish/siifish-skills install
```

普通安装会把 skills 持久保存到 `~/.siifish-skills/skills/`，再为所有已探测到的 Agent 创建链接。重复执行 `install` 可更新中央副本。

固定版本时使用 Git tag：

```bash
npx --yes github:siifish/siifish-skills#v0.1.0 install
```

## 命令

```text
siifish-skills detect
siifish-skills list
siifish-skills status [--agent <id>]
siifish-skills install [--agent <id>] [--dry-run] [--dev]
siifish-skills uninstall [--agent <id>]
```

- 未传 `--agent` 时处理所有已探测到的 Agent；该选项可以重复使用。
- `install --dry-run` 只显示计划，不写入文件。
- `install --dev` 直接链接当前 Git 工作区，适合维护 skill 时使用。
- 安装器不会覆盖实体目录、外部链接或断裂链接；冲突需由用户明确处理。
- `uninstall` 只删除仍指向本仓库受管理来源的链接，不删除中央 skill 副本。

支持的 Agent 目录包括 Claude Code、Codex、Cursor、Gemini CLI、Qwen Code、OpenCode、OpenClaw、Hermes Agent、Qoder 和共享 `.agents`。只有已经存在的 Agent 配置目录才会被处理。

## 本地开发

```bash
git clone https://github.com/siifish/siifish-skills.git
cd siifish-skills
npm run check
node ./bin/siifish-skills.js install --dev --dry-run
node ./bin/siifish-skills.js install --dev
```

校验器会检查 skill frontmatter、目录命名、`catalog.json` 库存同步、`agents/openai.yaml`、本地引用、个人绝对路径和常见凭据模式。

## 收录原则

仓库只直接收录由 siifish 原创或明确接管维护的 skills。第三方 skills 应保留在各自上游；如需接管，先确认许可证、记录来源，并完成独立审查。

## License

[MIT](LICENSE)
