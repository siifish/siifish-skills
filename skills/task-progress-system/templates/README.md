# Task Progress System Template

> 用途：把当前项目中运行良好的 `plans/` 任务推进系统抽象成可复制模板，方便在新项目中快速建立“人 + AI”共同维护的任务推进文件夹。

---

## 复制方式

假设你已经 clone 了本项目：

```bash
git clone <this-repo-url> task-progress-system
```

进入你真正要管理的目标项目根目录后执行：

```bash
mkdir -p plans
cp -R /path/to/task-progress-system/templates/root/. plans/
cp -R /path/to/task-progress-system/templates/phase-template plans/phase1-your-topic
```

把 `/path/to/task-progress-system` 替换成你 clone 后的真实路径。

---

## 推荐目录结构

```text
plans/
├── README.md
├── docs/
│   ├── experiments_summary_eval.md
│   └── experiments_summary_training.md
├── phase1-your-topic/
│   ├── project_overview.md
│   ├── handoff.md
│   ├── changelog.md
│   ├── reference.md
│   ├── resources/
│   │   └── YYYY-MM-DD-analysis-report.md
│   └── tasks/
│       └── T1-example-task.md
└── archive/
```

---

## 核心思想

这个系统的关键不是“多写几个 Markdown”，而是把不同粒度的信息放到稳定位置：

| 层级 | 文档 | 放什么 | 更新时机 |
|---|---|---|---|
| L1 | `project_overview.md` | 一屏摘要、任务看板、Exit Criteria、下一步 | 状态、优先级、决策变化时 |
| L2 | `tasks/*.md` | 单任务目标、步骤、执行记录、失败征兆、结果 | 执行任务或拿到结果时 |
| L3 | `changelog.md` | 已发生的重要事件，按时间倒序 | 完成实质工作后 |
| L3 | `handoff.md` | 新人/新 AI 接手路径、决策图、任务速查 | 路线或执行顺序变化时 |
| L3 | `reference.md` | 命令、路径、配置、指标速查 | 命令或路径变更时 |
| L3 | `docs/*.md` | 跨阶段聚合表，如训练/评估总览 | 新实验结果进入公共事实表时 |

---

## 维护闭环

完成一次任务推进时，按这个顺序同步：

1. 更新对应 `tasks/*.md`：记录执行、结果、异常和下一步。
2. 更新 `project_overview.md`：只写 L1 结论、数字、状态和缺口。
3. 如果产生实验数字，更新 `docs/` 里的聚合表。
4. 在 `changelog.md` 顶部追加已发生事件。
5. 如果路线、命令或接手方式改变，同步 `handoff.md` / `reference.md`。

---

## 什么时候新建文件

| 需要记录的内容 | 放置位置 |
|---|---|
| 新阶段总控 | `phaseN-topic/project_overview.md` |
| 可执行任务 | `phaseN-topic/tasks/T#-topic.md` 或 `R#-topic.md` |
| 长篇根因分析 / 报告 / 脚本 | `phaseN-topic/resources/` |
| 跨阶段实验汇总 | `plans/docs/` |
| 已冻结历史材料 | `plans/archive/` |

---

## 健康标准

一个健康的任务推进系统应满足：

- `README.md` 能指向当前阶段。
- 当前阶段的 `project_overview.md` 能在 5 分钟内说明当前状态、阻塞和下一步。
- 每个看板任务都有对应 `tasks/*.md`，每个任务文档也能在看板或索引中找到。
- `changelog.md` 只写已发生事实，不写未执行计划。
- 关键实验数字在 task、docs summary、overview 中没有明显冲突。
- 大段分析不塞进 L1，总览只保留结论。
