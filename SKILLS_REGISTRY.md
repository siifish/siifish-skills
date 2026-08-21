# Skill Catalog — 常用 Skill 速查

> 本文件记录平时常用、值得保留的 Agent Skill。迁移 Agent 或新环境配置时，按此列表按需下载即可。
> 格式：每条 Skill 一个卡片，包含来源、安装命令、适用场景和不适用场景，方便快速扫一眼决定要不要装。

---

## grill-me

- **来源**: mattpocock/skills（GitHub）
- **一句话**: 在动手写代码之前，让 AI 对你的方案进行"灵魂拷问"——逐层追问，一次只问一个问题，遍历决策树，把逻辑盲区和边界问题逼出来。
- **安装**:
  ```bash
  npx skills@latest add mattpocock/skills --skill grill-me
  ```
- **触发方式**: `/grilling`
- **适用场景**:
  - 项目方案梳理（还没写代码，先把需求想清）
  - 技术设计审查（架构方案压力测试）
  - 产品功能规划（边界、依赖、降级方案）
- **特点**:
  - AI 主动提问，不是被动回答
  - 一次只问一个问题，节奏可控
  - 能自己查代码库的问题不烦人
  - 不替你做决定，只帮你发现漏洞
- **不适合**: 已经想清楚、只想快速执行的任务（会拖慢节奏）

---

## grill-with-docs

- **来源**: mattpocock/skills（GitHub）
- **一句话**: `grill-me` 的文档版——在拷问方案的同时，自动创建 ADR（架构决策记录）和术语表，边审边沉淀文档。
- **安装**:
  ```bash
  npx skills@latest add mattpocock/skills --skill grill-with-docs
  ```
- **触发方式**: `/grilling`
- **适用场景**:
  - 同 `grill-me`，但需要产出正式文档的场景
  - 团队需要留存决策记录（ADR）
  - 需要建立统一术语表（glossary）的项目
- **特点**:
  - 继承 `grill-me` 的全部拷问能力
  - 拷问过程中自动写入 `CONTEXT.md` 和 `docs/adr/`
  - 使用 `/domain-modeling` skill 辅助建模
- **与 grill-me 的区别**: `grill-me` 只提问不产文档，`grill-with-docs` 边问边写文档。如果只是自己梳理思路，用 `grill-me` 更轻量；如果需要团队共享决策记录，用 `grill-with-docs`。

---

## flomo-manager

- **来源**: 自研（OpenClaw Friday 打包，2026-08-21）
- **一句话**: 智能灵感记录助手——把零散思考转成结构化 flomo 笔记（自动匹配标签和风格、建立笔记关联），并支持"智能漫步"：按主题漫游复习笔记、边走边分析标签体系与关联、给出可确认执行的优化建议。
- **安装**: 从本仓库 `skills/flomo-manager/` 复制到你的 Agent skills 目录；需 Node.js ≥ 18 + npx mcporter；flomo MCP token 在用户 flomo 设置中生成（MCP/Experimental，形如 `fmcp_...`），配置到 `config/mcporter.json`，详见目录内 README.md
- **触发方式**: `/flomo`、`FM`、`发送到 flomo`、`/flomo walk`、`flomo 漫步`、`随机漫步`、`标签分析`、`更新标签缓存`
- **适用场景**:
  - 随口说的灵感 → 800-1200 字结构化笔记（检索相关旧笔记、参考既有风格、推荐标签、确认后发送）
  - 定期"漫步"复习某个主题的笔记，顺带治理标签体系（合并重复标签、补缺失标签、建双链）
  - 维护标签语义/统计/用户偏好缓存，越用越懂用户的写作风格
- **特点**:
  - 先展示后发送：关键词、成文、标签全部经用户确认才写入
  - 写操作（memo_update / tag_rename）逐条或批量确认后执行
  - 缓存边走边学：漫步中增量更新标签语义，结束时写漫步历史
- **不适合**: 只想单向快速发一条笔记的场景（用 flomo Webhook 更简单）；没有 flomo MCP token 的环境
- **依赖**: flomo 官方 MCP 服务（`https://flomoapp.com/mcp`）+ mcporter CLI


> 待补充 Skill 按相同格式追加在下方，保持最新优先排最前。
