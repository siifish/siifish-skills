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

> 待补充 Skill 按相同格式追加在下方，保持最新优先排最前。
