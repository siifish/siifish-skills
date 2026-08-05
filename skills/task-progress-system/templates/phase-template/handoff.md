# Phase {N} 接手指南

> 给新成员 / 新 AI / 断线后的自己。目标：5 分钟内知道现在该读什么、做什么、不要做什么。

---

## 5 分钟快速上手

### 第一步：先读这三个东西

1. [project_overview.md](project_overview.md)：一屏摘要 + 任务看板 + Exit Criteria
2. [changelog.md](changelog.md)：最近 3 条日志
3. 当前任务文档：看 `project_overview.md` 任务看板中第一个 ⏳ / 🔄 的任务

### 第二步：判断当前该做什么

```text
当前阶段是否有明确 P0 未完成任务？
├─ 是 → 读对应 tasks/T#-*.md，按 Exit Criteria 推进
└─ 否
   ├─ Exit Criteria 全部满足？ → 准备阶段收官 / 新阶段规划
   └─ 有未决假设？ → 新建验证任务或更新看板
```

### 第三步：执行后同步文档

1. 更新对应 task 的执行记录。
2. 更新 `project_overview.md` 看板和下一步。
3. 追加 `changelog.md`。
4. 如果产生实验数字，同步 `../docs/`。

---

## 任务速查表

| ID | 任务 | 详情文档 | 当前状态 |
|---|---|---|---|
| T1 | {任务名称} | [tasks/T1-example-task.md](tasks/T1-example-task.md) | ⏳ |

---

## 推荐执行顺序

```text
T1 → T2 → 决策点 D1
       ├─ Go → T3
       └─ No-Go → T4
```

并行建议：

- `{可并行任务 1}` 与 `{可并行任务 2}` 可同时推进。
- `{任务}` 依赖 `{前置产物}`，不要跳过。

---

## 关键速查命令

```bash
# 项目根目录
pwd

# 健康检查 / 状态检查命令
```

详见 [reference.md](reference.md)。

---

## 遇到问题怎么办

| 问题 | 去哪里找 |
|---|---|
| 不确定当前该做什么 | `project_overview.md` 任务看板 |
| 不懂具体任务怎么做 | 对应 `tasks/T#-*.md` |
| 需要命令 / 路径 | `reference.md` |
| 想了解历史决策 | `changelog.md` |
| 需要长分析证据 | `resources/` |

---

## 不要做的事

- 不要只更新 task，不同步 `project_overview.md` 的状态。
- 不要把计划写进 `changelog.md`；changelog 只记已发生。
- 不要在看板外私自新增任务文件。
- 不要把大段分析塞进 `project_overview.md`，应放到 task 或 resources。
