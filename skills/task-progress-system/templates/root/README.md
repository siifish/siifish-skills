# Plans

本目录存放项目规划、阶段推进和执行记录。建议先读当前阶段的 `project_overview.md`。

---

## 阶段列表

| 阶段 | 目录 | 说明 | 状态 |
|---|---|---|---|
| **Phase 1: {阶段名称}** | `phase1-your-topic/` | {阶段目标一句话说明} | 🟢 当前阶段 |

---

## 快速导航

### 当前阶段

- **`phase1-your-topic/project_overview.md`**：项目总览，一屏摘要、任务看板、Exit Criteria
- **`phase1-your-topic/handoff.md`**：接手指南，给新人或新 AI 快速判断下一步
- **`phase1-your-topic/changelog.md`**：已发生事件流水，按时间倒序
- **`phase1-your-topic/reference.md`**：命令、路径、配置、指标速查
- **`phase1-your-topic/tasks/`**：任务详情
- **`phase1-your-topic/resources/`**：长报告、根因分析、脚本、辅助材料

### 跨阶段文档

- **[docs/experiments_summary_training.md](docs/experiments_summary_training.md)**：训练 / 构建 / 运行类实验汇总
- **[docs/experiments_summary_eval.md](docs/experiments_summary_eval.md)**：评估 / 验证 / Benchmark 结果汇总

---

## 文档组织规范

```text
plans/
├── README.md
├── docs/
│   ├── experiments_summary_training.md
│   └── experiments_summary_eval.md
├── phase1-your-topic/
│   ├── project_overview.md
│   ├── handoff.md
│   ├── changelog.md
│   ├── reference.md
│   ├── resources/
│   └── tasks/
└── archive/
```

---

## 命名规范

| 类型 | 命名格式 | 示例 |
|---|---|---|
| 阶段目录 | `phase{N}-{kebab-topic}` | `phase1-search-relevance` |
| 任务文档 | `{Prefix}{N}-{kebab-topic}.md` | `T1-build-baseline.md`、`R4-eval-debug.md` |
| 资源报告 | `YYYY-MM-DD-{kebab-topic}.md` | `2026-04-28-regression-root-cause.md` |
| 实验汇总 | `experiments_summary_{type}.md` | `experiments_summary_eval.md` |

---

## 维护原则

1. **L1 只写结论**：`project_overview.md` 保持可快速阅读，细节放 task 或 resources。
2. **追加事实，少改历史**：`changelog.md` 顶部追加已发生事件，不重写旧日志。
3. **状态同步**：任务状态变更时，同步 task、overview、changelog，必要时更新 docs summary。
4. **可接手**：任何时候新 AI 读 `README.md → project_overview.md → handoff.md → 当前 task` 都应知道下一步。
5. **证据优先**：关键判断要指向数据、命令、日志路径或分析报告。
