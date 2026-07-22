# siifish-skills

`siifish-skills` 是一个个人维护的 [Agent Skills](https://agentskills.io/) 集合。每个 skill 都是独立、可移植的目录，可以通过社区通用的 [`skills`](https://github.com/vercel-labs/skills) CLI 安装到 Claude Code、Codex、Cursor、OpenClaw 等 Agent。

仓库只维护 skill 源码，不实现独立的 Agent 探测、复制、软链接、更新或卸载逻辑。这些生命周期操作统一交给 `npx skills`。

## Skills

| Skill | 用途 | 平台 | 依赖 |
|---|---|---|---|
| `bear-notes` | 搜索、阅读、创建和整理 Bear 笔记 | macOS | Bear、`bearcli` |

## 安装

需要 Node.js 22.20.0 或更高版本以及 npm。先查看仓库中可用的 skills：

```bash
npx skills add siifish/siifish-skills --list
```

交互式安装 `bear-notes`：

```bash
npx skills add siifish/siifish-skills --skill bear-notes -g
```

`-g` 表示安装到用户级目录，让 skill 在所有项目中可用。不加 `-g` 时默认安装到当前项目。

也可以明确指定一个或多个 Agent：

```bash
npx skills add siifish/siifish-skills \
  --skill bear-notes \
  --global \
  --agent claude-code \
  --agent codex \
  --agent cursor \
  --agent openclaw
```

安装器默认推荐使用统一副本和软链接；如果当前环境不适合使用软链接，可以选择复制：

```bash
npx skills add siifish/siifish-skills --skill bear-notes -g --copy
```

## 管理

```bash
# 查看已安装的 skills
npx skills list -g

# 检查并更新
npx skills update bear-notes -g

# 卸载
npx skills remove bear-notes -g
```

`npx skills` 会负责记录安装来源并管理不同 Agent 的目录。完整选项和当前支持的 Agent 以 [`skills` CLI 文档](https://github.com/vercel-labs/skills#readme)为准。

> `skills` CLI 默认会发送匿名安装遥测，用于 skills.sh 排名。如果不希望发送，可在命令前设置 `DISABLE_TELEMETRY=1`。

## 依赖与兼容性

`bear-notes` 只适用于 macOS，运行时需要：

- [Bear](https://bear.app/)；
- Bear 提供的 `bearcli`，优先通过 `PATH` 查找；
- 如果 `PATH` 中不存在，则使用 Bear App 内的 `/Applications/Bear.app/Contents/MacOS/bearcli`。

`npx skills` 负责通用安装，但不会替 skill 自动安装 Bear 或 `bearcli`。安装前请自行检查 skill 内容和外部依赖。

## 本地开发

```bash
git clone https://github.com/siifish/siifish-skills.git
cd siifish-skills
npm run check
npx skills add . --list
npx skills add . --skill bear-notes -g
```

从本地目录安装时，`npx skills` 仍会把 skill 复制到规范安装目录，再让 Agent 使用该快照；它不会直接链接 Git 工作区。每次修改后需重新执行本地安装才能刷新测试快照。正式使用时应从 GitHub 安装，以便锁文件记录远程来源并支持更新。校验器会自动发现 `skills/*/SKILL.md`，检查目录命名、frontmatter、名称唯一性、`agents/openai.yaml`、本地引用、个人绝对路径和常见凭据模式。

新增 skill 时使用扁平目录结构：

```text
skills/
└── skill-name/
    ├── SKILL.md
    ├── agents/openai.yaml  # 可选的 Codex UI 元数据
    ├── scripts/            # 可选
    ├── references/         # 可选
    └── assets/             # 可选
```

## 收录原则

仓库只直接收录由 siifish 原创或明确接管维护的 skills。第三方 skills 应保留在各自上游；如需接管，先确认许可证、记录来源，并完成独立审查。

仓库根目录的 `README.md`、CI 和开发工具属于集合的维护层；每个 skill 目录只保留 Agent 执行该能力所需的文件。

## License

[MIT](LICENSE)
