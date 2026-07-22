---
name: bear-notes
description: 通过 bearcli 命令行工具读写 macOS 上的 Bear 笔记。当用户想要查找、阅读、搜索、创建、编辑、整理、归档或删除 Bear 笔记，管理笔记标签、置顶、附件时使用。触发词：Bear、Bear 笔记、bearcli、我的笔记、查笔记、找笔记、写到 Bear、记到 Bear、新建笔记、整理标签、置顶笔记、归档笔记、bear note、search my notes。即使用户没有明说 "bearcli"，只要意图涉及 Bear App 里的笔记内容，都应使用本 skill。
---

# Bear 笔记（bearcli）

使用 `PATH` 中的 `bearcli` 直接读写本地 Bear 数据库，不联网、无遥测。若 `PATH` 中找不到它，检查 Bear 自带的 `/Applications/Bear.app/Contents/MacOS/bearcli`，并提示用户将其加入 `PATH`；不要假定 Homebrew 或符号链接位于固定目录。

## 核心心智模型

- **笔记标识**：几乎所有命令都用 `<note-id>` 或 `--title "标题"`（标题大小写不敏感）来定位笔记。ID 稳定可靠，标题可能重复——批处理前优先拿到 ID。
- **读用 JSON，写靠退出码**：读取类命令加 `--format json` 便于解析（默认 TSV 无表头）。写入类命令（edit/overwrite/append/create 之外的变更）成功时**静默无输出**，退出码即信号：`0` 成功、`1` 业务错误、`64` 用法错误。
- **权威文档在本机**：需要某命令的精确参数时运行 `bearcli help <子命令>`（如 `bearcli help search`），完整参考用 `bearcli help all`。不要凭记忆猜参数。

## 命令速查

| 意图 | 命令 |
|------|------|
| 读原始正文 | `bearcli cat <id>` / `bearcli cat --title "标题"` |
| 看元数据（标题/标签/时间等） | `bearcli show <id> --format json --fields all` |
| 列出笔记 | `bearcli list`（支持 `--tag`、`--sort`、`-n`、`--location`、`--count`） |
| 搜索 | `bearcli search "查询" --format json`（Bear 搜索语法） |
| 单篇内定位字符串 | `bearcli search-in <id> --string "关键词"` |
| 精确查找替换 | `bearcli edit <id> --find "旧" --replace "新"` |
| 整篇覆盖 | `bearcli overwrite <id> --content "..."` |
| 追加/前置内容 | `bearcli append <id> --content "..." [--position beginning]` |
| 新建 | `bearcli create "标题" --content "..." --tags "a,b"` |
| 标签管理 | `bearcli tags list/add/remove/rename/delete` |
| 置顶 | `bearcli pin list/add/remove` |
| 软删除/归档/恢复 | `bearcli trash` / `archive` / `restore` |
| 在 Bear 中打开 | `bearcli open <id> [--edit] [--header "标题"]` |
| 附件 | `bearcli attachments list/add/delete/save` |

## 阅读与搜索

优先用搜索缩小范围，再按 ID 读取：

```bash
# 结构化搜索，拿到 id + 命中片段
bearcli search "@today @todo 会议" --format json

# 按标签列出，控制数量与字段
bearcli list --tag work --sort modified:desc -n 20 --format json --fields id,title,modified

# 读某篇的完整正文
bearcli cat <id>

# 大笔记按字节切片，避免一次性拉全文
bearcli cat <id> --offset 0 --limit 2000
```

**Bear 搜索语法**（`search` / `list --tag` 用得上，写进 `--query` 或位置参数）：

- 文本：`关键词`、`"精确短语"`、`词1 or 词2`
- 排除：任意词或指令前加 `-`（以 `-` 开头的查询必须用 `--query` 传，避免被当成选项）
- 标签：`#tag`、`!#tag`（精确、不含子标签）、`#*/tag`（仅子标签）
- 日期：`@today`、`@yesterday`、`@last7days`、`@date(2026-01-01)`、`@date(>2026-01-01)`
- 创建时间：`@ctoday`、`@created7days`、`@cdate(YYYY-MM-DD)`
- 任务：`@todo`（有未完成）、`@done`（全部完成）、`@task`（含任意任务）
- 其它：`@tagged`/`@untagged`、`@title`（仅搜标题）、`@pinned`、`@images`/`@files`/`@attachments`/`@code`、`@locked`、`@empty`、`@untitled`、`@wikilinks`/`@backlinks`

搜索无结果时：JSON 模式返回 `[]`，否则 stderr 提示 "No notes found."，两种情况退出码都是 `0`。

## 创建笔记

```bash
# 标题 + 正文 + 标签（推荐用 --tags，会按 Bear 设置的位置插入）
bearcli create "周会纪要" --content "## 议题\n- ..." --tags "work,会议"

# 省略标题，让 Bear 从首个 # 标题或首行推断
bearcli create --content "# 快速记录\n一些想法"

# 从 stdin 读正文，只取回 id 和 hash
printf "line1\nline2" | bearcli create "我的笔记" --fields id,hash

# 标题已存在则复用（需要 title）
bearcli create "日记" --if-not-exists
```

`create` 会返回结构化行——**务必捕获 `id`** 供后续命令使用。文本参数中的 `\n \t \r \\` 会被转义解释；从 stdin 读入的内容不会。

## 编辑笔记：优先 edit，谨慎 overwrite

**首选 `edit`**——按精确字符串定位，最安全、变更最小：

```bash
bearcli edit <id> --find "TODO" --replace "DONE"
bearcli edit <id> --find "## 笔记" --insert-after "\n新的一行"
bearcli edit <id> --find "## 笔记" --insert-before "引言段落\n\n"
bearcli edit <id> --find "cat" --replace "dog" --all --word   # 全部匹配、整词
# 批量：--find/--replace 可重复配对
```

**`append`** 用于纯追加/前置，不需要定位锚点：

```bash
bearcli append <id> --content "新段落"                       # 默认追加到末尾
bearcli append <id> --content "更新" --position beginning     # 追加到开头
```

**`overwrite`** 替换整篇内容，风险最高，仅在确需重写全文时使用：

- Bear 从首个标题推断标题、从 `#hashtag` 推断标签——重写时要**保留标题和标签**，否则会丢失。
- 正文里的附件 markdown 引用**必须原样保留**，否则附件会从笔记移除。
- 并发保护（`--base`）：先 `bearcli show --fields hash` 拿到 hash，再 `overwrite --base <hash>`；若笔记在此期间被改动，写入会被拒绝，避免覆盖他人/Bear 自身的编辑。

```bash
HASH=$(bearcli show <id> --fields hash)
bearcli overwrite <id> --base "$HASH" --content "# 标题\n正文"
```

### 安全须知（重要）

- **附件保护门（`--force`）**：`edit` / `overwrite` 若会导致附件被移除，默认**拒绝**执行并在 stderr 列出将丢失的文件。确认无误后再加 `--force` 重跑。不要盲目加 `--force`——先读拒绝信息。
- **`--no-update-modified`**：编辑时保留笔记的修改时间（适合无关紧要的整理性改动）。
- **加密笔记**：内容无法通过 CLI 访问；锁定笔记可读元数据，但拒绝 `--fields content`。
- 变更前若不确定当前内容，先 `cat` / `search-in` 确认锚点字符串确实唯一存在。

## 标签、置顶、生命周期

```bash
# 标签：名称可带或不带 #；嵌套用斜杠 work/draft；空格允许
bearcli tags list --format json                    # 全局标签
bearcli tags list <id>                             # 某篇的标签
bearcli tags add <id> work "work/meetings"
bearcli tags remove <id> draft wip
bearcli tags rename work job                       # 全库重命名
bearcli tags rename old existing --force           # 目标已存在则合并（不可撤销，需 --force）
bearcli tags delete draft                          # 从所有笔记删除该标签

# 置顶：global = 全部笔记置顶；其余视为标签内置顶（标签须已存在，原子操作）
bearcli pin add <id> global
bearcli pin add <id> work projects
bearcli pin list                                   # 全库所有置顶上下文
bearcli pin remove <id> global

# 生命周期（软删除，可恢复）
bearcli trash <id>
bearcli archive <id>
bearcli restore <id>

# 在 Bear App 中打开
bearcli open <id> --edit
bearcli open --title "Mars" --header "Moons"
```

## 附件

```bash
bearcli attachments list <id> --format json
cat photo.jpg | bearcli attachments add <id> --filename photo.jpg
bearcli attachments save <id> --filename photo.jpg > photo.jpg   # 原始字节需重定向
bearcli attachments save <id> --filename photo.jpg --format json # base64 内联
bearcli attachments delete <id> --filename photo.jpg
```

## 通用约定

- **输出格式**：`--format tsv`（默认，无表头）/ `csv`（RFC 4180，带表头）/ `json`（单个合法 JSON，含错误也是 JSON）。
- **字段选择**：`--fields f1,f2` 或 `--fields all`；正文不含在 `all` 里，需 `--fields all,content`。
- **JSON 形状**：`list`/`search`/`tags list`/`pin list`/`attachments list`/`search-in` → 数组；`show`/`create` → 对象；`cat` → `{"content":"..."}`；`--count` → `{"count":N}`；错误 → `{"error":{"code":"...","message":"..."}}`。
- **时间戳**：ISO 8601 UTC（`YYYY-MM-DDTHH:MM:SSZ`）。
- **TSV 转义**：`\n \r \t \\`；文本类选项同样解释这些转义，stdin 不解释。
- **变更类命令静默**：成功无输出、不接受 `--format`。若需要写操作的结构化返回，改用 `bearcli mcp-server`（stdio 上的 MCP 接口，工具集与 CLI 一致）。

## 典型工作流

1. **找并读**：`search`/`list` 拿到 `id` → `cat <id>` 读正文（或 `show --fields all` 看元数据）。
2. **改**：能用 `edit`/`append` 就不用 `overwrite`；确需整篇重写时用 `overwrite --base <hash>` 并保留标题、标签、附件引用。
3. **整理**：批量用 `tags`/`pin`/`archive`/`trash`，配合 `search` 的日期与标签指令定位目标集合。
4. 不确定参数时随时 `bearcli help <子命令>`。
