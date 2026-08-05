---
name: task-progress-system
description: Maintains a Markdown-based project task progress system under plans/ for human + AI collaboration, including long-running and autonomous (cron-style) work. Use whenever asked to create a plans folder, start a project phase, add or update task documents, continue current progress, run patrol/cron pushes, check plan health, synchronize project_overview/tasks/changelog/docs, define hard constraints and Exit-Criteria decision gates, prepare handoff notes, or critically judge whether task progress and experimental conclusions are reasonable.
---

# Task Progress System

Use this skill to create and maintain a `plans/` task progress system for human + AI collaboration. It is designed for research, experiment, training, and long-running projects where a task may run for days and be pushed forward by both a human and one or more autonomous agents. The system rests on a stable information hierarchy:

- **L1 `project_overview.md`**: one-screen summary, task board, current blockers, next action, Exit Criteria.
- **L2 `tasks/*.md`**: single-task goal, hard constraints, steps, execution records, failure signs, evidence, results, Exit-Criteria gate.
- **L3 `changelog.md` / `handoff.md` / `reference.md` / `docs/*.md`**: event log, takeover guide, commands/paths, and cross-phase summaries.

The goal: a new AI or teammate reads `plans/README.md -> current phase project_overview.md -> handoff.md -> active task` and knows what to do — and what NOT to do — within minutes.

## First Move

Before editing, identify which mode the user needs:

| User intent | Action |
|---|---|
| "创建一个任务推进系统 / plans 模板" | Create or adapt the full `plans/` scaffold |
| "新建阶段 / phase" | Add a new `phaseN-topic/` shell and update root `plans/README.md` |
| "新建任务" | Add `tasks/T#-topic.md` or `R#-topic.md`, then link it from `project_overview.md` |
| "继续推进当前任务" | Read overview, handoff, changelog, active task; state inferred state; then execute or propose next action |
| "巡检 / 定时推进 / cron 推进" | Run the autonomous-patrol loop (see Operating Constitution); advance without deciding Go/No-Go |
| "检查健康 / 有没有乱" | Run the health checklist and report inconsistencies |
| "批判性分析进度是否合理" | Compare claims against evidence, Exit Criteria, dependencies, and experiment summaries |

If the target project has no `plans/` directory, start from the bundled templates. Look for them in this order:

```text
<skill-dir>/templates/          # bundled with this skill (recommended)
task-progress-system/templates/ # if the whole system was cloned into the project
templates/                      # if only the template folder was copied in
plans/templates/task-progress-system/  # legacy in-project layout
```

`<skill-dir>` is wherever this SKILL.md lives (e.g. `.cursor/skills/task-progress-system/` when installed, or the cloned repo path). If none are present, recreate the same shape manually from this skill's structure.

## Creation Workflow

1. Create `plans/README.md`, `plans/docs/`, `plans/archive/`, and one current phase directory (copy `templates/root/.` into `plans/`, and `templates/phase-template` into `plans/phase1-<topic>`).
2. In the phase directory keep `project_overview.md`, `handoff.md`, `changelog.md`, `reference.md`, `tasks/`, and `resources/`.
3. Add at least one first task document in `tasks/` using the task anatomy below.
4. Keep placeholders explicit: `{project}`, `{phase}`, `{metric}`, `{owner}`, `{next action}`.
5. Ensure root `README.md` points to the current phase and the phase overview links back to docs and tasks.

Naming conventions:

- Phase: `phase{N}-{kebab-topic}/`
- Task: `{Prefix}{N}-{kebab-topic}.md` (e.g. `T1-build-baseline.md`, `R4-eval-debug.md`, `B20-auxthink-curriculum.md`)
- Resource report: `YYYY-MM-DD-{kebab-topic}.md`
- Cross-phase docs: `plans/docs/experiments_summary_{type}.md`

## Task Document Anatomy

A good task doc (see `templates/phase-template/tasks/T1-example-task.md`) is more than a checklist. For any non-trivial or long-running task, include these battle-tested sections, top to bottom:

1. **Rich header block**: `创建日期 | 最后更新 | 状态 | 优先级 | 上游依赖 | 负责人 | 来源`. The status line carries live state (current step/progress, health, latest result vs baseline) so a reader gets the situation without scrolling.
2. **📊 置顶结果总览 (pinned result summary)**: right under the header, state the *single decision metric*, an *expectation disclaimer* (what absolute numbers to expect and NOT over-read), and a comparison table of results-so-far. Put the conclusion where it is seen first.
3. **参照标尺 (reference baselines)**: an explicit table of the comparison lines (`vs baseline`, `vs sibling run`). Enforce **same-protocol comparison** (apples-to-apples): note the exact eval setting so numbers are not mixed across protocols.
4. **🔴 硬约束 (hard constraints, read before any action)**: the highest-priority section. List fail-loud preconditions and forbidden actions, e.g.:
   - Preconditions that must be verified from logs before trusting a run (right start point, right config flags), stated so a violation is loud and unambiguous.
   - "**留痕后执行 (write-before-act)**": before any major/irreversible action (start/kill/resume/delete artifact/extend run), first append one line to the execution record (time + action + reason + evidence), then act.
   - "**禁止越权 (no overreach)**": enumerate the *only* conditions under which destructive actions (kill, delete the sole copy of an artifact) are allowed; everything else → stop, write evidence, ask the user.
5. **能回答 / 不能回答 (scope)**: what conclusion this task *can* and *cannot* support. Manage expectations up front so a partial result is not over-claimed.
6. **Exit Criteria as a tri-state decision gate** (see below).
7. **执行记录 (execution record)**: append-only; for long-running tasks compress routine monitoring into a per-day digest row (see Maintenance Workflow).

Keep the L1/L2 boundary clean: long root-cause analysis lives in the task doc or `resources/`, not in `project_overview.md`.

## Exit Criteria as a Tri-State Decision Gate

Do not write Exit Criteria as a vague "done when it works". Write a decision gate the user can act on. Prefer the tri-state form, each state carrying a concrete escalation:

- 🟢 **信号 (hypothesis holds)**: the concrete, quantified condition that would confirm the hypothesis, plus the exact next escalation (e.g. "补 unseen 评估 → 写入 docs 汇总 → 与用户讨论下一阶段").
- 🟡 **部分 / 模糊 (partial / ambiguous)**: the mixed-signal condition and what extra evidence to collect before deciding.
- 🔴 **证否 (refuted)**: the condition that kills the hypothesis and where resources should go instead.

State the decision metric once and rank checkpoints/results only by it; never rank by a proxy (e.g. train loss) when the real metric exists.

## Maintenance Workflow

When a task changes state or produces results, update documents in this order:

1. **Task doc first**: append execution record, results, failures, next action; refresh the header status line and the pinned result table.
2. **Overview second**: update L1 status, task board, blockers, Exit Criteria, next step.
3. **Docs summary third**: if the result is reusable across tasks/phases, add it to `plans/docs/`.
4. **Changelog last**: append a dated entry at the top, only for things that already happened.
5. **Handoff/reference as needed**: update if execution order, commands, paths, or takeover guidance changed.

For **long-running / autonomously-monitored tasks**, the execution record grows without bound if every patrol writes a full entry. Instead:

- Keep one **append-only row per day** in the task's execution-record table; fold routine patrols ("training healthy, step X, loss Y, 0 NaN") into that day's digest.
- Write a full standalone entry only for **events**: a new result closing the loop, a decision, a kill/resume, a disk/infra incident, a config change.
- Never rewrite historical rows except to correct an explicit mistake.

## Operating Constitution (for autonomous / long-running push)

When the user hands a task to an agent to advance over time (including cron/patrol style), the task doc should carry an explicit operating constitution. Encode three blocks:

**A. Resources & preconditions** — which machine/env for which step, what must be free/idle before starting, and any preflight that must pass (smoke test, start-point self-check) before risky work.

**B. Document maintenance order** — the fixed sync order (task doc → overview → docs → changelog) so multiple agents do not diverge.

**C. Things NOT to do** — a blunt list of forbidden actions specific to this task (wrong start point, wrong flags, ranking by proxy metric, unauthorized kill, deleting the sole copy of an artifact, grabbing shared resources).

For a recurring **patrol (cron) role**, define it as *a pusher, not a decider*:

- Each pass: re-read hard constraints + design + commands + decision gate first.
- Do the mechanical work: check health, advance ready sub-steps, back-fill result tables and the day's digest.
- On a guardrail event (metric below gate, precondition failed, NaN, infra broken): record it and, unless a hard constraint explicitly authorizes the action, stop and ask — do not self-authorize kills, deletes, or scope expansion.

## Human-in-the-Loop Authority

The **Go / No-Go / scope-change decision belongs to the user**. An agent's job is to produce closed-loop evidence and a drafted recommendation; the user makes the final call. Encode this in the task doc (e.g. "裁决权属用户；agent 出闭环数据 + 草案，最终由用户拍板"), especially for stop/extend/next-phase decisions and anything irreversible.

## Health Check

For a quick deterministic check, run the bundled script against the target `plans/`. Use whichever path exists:

```bash
# when installed as a Cursor skill
python .cursor/skills/task-progress-system/scripts/health_check.py plans
# or from the skill directory directly
python <skill-dir>/scripts/health_check.py plans
```

Then inspect issues with judgment. The script catches broken links, missing phase files, task files not linked from overview, obvious status conflicts, and changelog entries that are out of reverse-chronological order. It does not replace reading the documents.

Manual health checklist:

- Root `plans/README.md` names the current phase correctly.
- Current `project_overview.md` has a fresh one-screen summary and a task board.
- Every task board row links to a task doc, unless explicitly external or future work.
- Every `tasks/*.md` file is linked from `project_overview.md` or `handoff.md`.
- `changelog.md` is reverse chronological and only records completed events.
- Key experimental numbers are consistent across task docs, docs summaries, and overview.
- Exit Criteria are concrete enough to decide Go / No-Go.
- Hard constraints and "things not to do" are present for any risky long-running task.
- `handoff.md` tells a new AI what to read and what not to do.

## Continuing Progress

1. Read `plans/README.md`, the current phase `project_overview.md`, `handoff.md`, the latest `changelog.md` entries, and the active task.
2. State the inferred current task, blocker, and next action before making changes.
3. If execution is required, follow the task doc's hard constraints, preflight checks, and Exit Criteria.
4. If the task doc is stale, update the plan before executing risky work.
5. After execution, synchronize the task doc, overview, docs summary, and changelog per the Maintenance Workflow.

## Critical Review Mode

When judging whether progress is reasonable, be skeptical and evidence-first:

- Check whether the current "next step" follows from completed Exit Criteria.
- Look for skipped dependencies, stale assumptions, and status contradictions.
- Compare claimed results against raw logs, reports, docs summaries, or execution records.
- Verify comparisons are same-protocol; flag numbers mixed across eval settings.
- Distinguish "pipeline healthy" from "objective achieved"; a passing smoke test may not prove end-to-end success.
- Watch for over-claiming absolute performance when the task's scope only supports a relative/delta conclusion.
- Identify whether a No-Go is caused by implementation, data, evaluation, or documentation drift.
- Prefer concrete recommendations: "update R8 decision after R7 val_seen lands" beats "do more analysis".

Report findings in this order: (1) blocking inconsistencies or unsafe next steps; (2) missing evidence or stale documentation; (3) reasonable next action; (4) optional cleanup.

## Changelog Entry Template

```markdown
## YYYY-MM-DD — {event}

关联文档：tasks/{task}.md、project_overview.md

### 执行
- {what happened}

### 结果
- {numbers, paths, artifacts}

### 决策
- 结论：{Go / No-Go / Continue}
- 下一步：{specific task/action}

### 文档同步
- tasks/...：{updated}
- project_overview.md：{updated}
- ../docs/...：{updated if applicable}
```

## Guardrails

- Do not rewrite historical changelog entries unless correcting an explicit mistake.
- Do not invent experiment numbers; mark unknowns as `待补` or `TBD`.
- Do not create new task files without linking them from the overview.
- Do not bury blockers in long task notes; blockers belong in the L1 summary.
- Do not let an agent self-authorize destructive or scope-changing actions; defer to the user.
- Preserve project-specific naming once established, even if the generic template uses `T#`.
