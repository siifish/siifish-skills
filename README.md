# siifish-skills

`siifish-skills` 是一个个人维护的 [Agent Skills](https://agentskills.io/) 集合。每个 skill 都是独立、可移植的目录，可以通过社区通用的 [`skills`](https://github.com/vercel-labs/skills) CLI 安装到 Claude Code、Codex、Cursor、OpenClaw 等 Agent。

仓库只维护 skill 源码，不实现独立的 Agent 探测、复制、软链接、更新或卸载逻辑。这些生命周期操作统一交给 `npx skills`。

## Skills

| Skill | 用途 | 平台 | 依赖 |
|---|---|---|---|
| `bear-notes` | 搜索、阅读、创建和整理 Bear 笔记 | macOS | Bear、`bearcli` |
| `task-progress-system` | 创建并维护 `plans/` 任务推进系统（含长跑 / 自主巡检、硬约束、Exit 决策门、批判性复核） | 任意 | 无（`health_check.py` 需 Python 3） |

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

### 不依赖 npx / GitHub 的安装（推荐用于国内服务器）

本仓库本质上只是「git 仓库 + Markdown + 一个本地校验器」，对托管平台和 `npx skills` 都**没有运行时依赖**。在 Node < 22 或 GitHub 访问不稳定的机器上，权威副本托管在 **Gitee**，先 clone 下来：

```bash
git clone git@gitee.com:siifish/siifish-skills.git   # 权威副本，国内连接更稳
```

然后用下面**两种方式之一**装进目标项目。无论哪种，都建议在目标项目里 gitignore 掉 `.cursor/skills/<skill>`，让源真相留在本仓库。

**方式 A · 复制快照**（跨机器、不依赖 clone 常驻）：

```bash
mkdir -p /path/to/project/.cursor/skills
cp -R siifish-skills/skills/task-progress-system /path/to/project/.cursor/skills/
# 更新：git pull 后重新执行上面的 cp 覆盖
```

**方式 B · 软链接（指针，推荐给已常驻权威 clone 的机器）**：把 `.cursor/skills/<skill>` 做成指向本 clone 的符号链接，零复制、`git pull` 后自动同步。

```bash
ln -s /abs/path/to/siifish-skills/skills/task-progress-system \
      /path/to/project/.cursor/skills/task-progress-system
# 更新：在 clone 里 git pull 即可，active skill 自动跟随
```

- 优点：单一本地真相、无重复副本、模板/脚本随库更新即时生效。
- 注意：① 依赖该 clone 保持在原路径（移动/删除会断链）；② 需 Agent 的 skill 发现能跟随符号链接（Linux/Cursor 下通常可行）；③ 目标项目里 gitignore 该软链接时用**不带结尾斜杠**的规则（`/.cursor/skills/<skill>`），否则只匹配目录、不匹配软链接。若 Agent 不认软链，回退到方式 A 即可，完全可逆。

GitHub 仅作可选镜像。

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
git clone git@gitee.com:siifish/siifish-skills.git   # 权威副本；GitHub 为可选镜像
cd siifish-skills
npm run check           # 需要 Node.js >= 22.20.0
npx skills add . --list
npx skills add . --skill bear-notes -g
```

从本地目录安装时，`npx skills` 仍会把 skill 复制到规范安装目录，再让 Agent 使用该快照；它不会直接链接 Git 工作区。每次修改后需重新执行本地安装（或直接 `cp` 覆盖，见上文「不依赖 npx / GitHub 的安装」）才能刷新快照。正式使用时应从权威仓库（Gitee）安装，以便记录远程来源并支持更新。校验器会自动发现 `skills/*/SKILL.md`，检查目录命名、frontmatter、名称唯一性、`agents/openai.yaml`、本地引用、个人绝对路径和常见凭据模式。

> 校验器 `src/validate.js` 需要 Node.js >= 22.20.0。在旧 Node 环境无法运行时，可用等价的轻量检查手动核对（frontmatter 单行、SKILL.md ≤ 500 行、所有 Markdown 链接可解析、`agents/openai.yaml` 各字段带引号且 `short_description` 25–64 字）。

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
