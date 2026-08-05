#!/usr/bin/env python3
"""Lightweight health check for a Markdown-based plans/ task system.

Usage:
    python health_check.py [PLANS_ROOT]

PLANS_ROOT defaults to "plans". The script is location-independent: run it
from wherever the skill lives (e.g. .cursor/skills/task-progress-system/scripts/
or a cloned repo) and point it at the target project's plans/ directory.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote


LINK_RE = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
DATE_HEADER_RE = re.compile(r"^#{2,3}\s+(\d{4}-\d{2}-\d{2})")
# Any ISO date on a changelog line, so entries like "## 2026-08-05 - xxx" or
# "## 2026-08-05 — xxx" (em dash) are both picked up as the latest event date.
CHANGELOG_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
# "最后更新: 2026-08-05" / "最后更新**: 2026-08-05" in an overview header block.
OVERVIEW_UPDATED_RE = re.compile(r"最后更新[^\d]{0,8}(\d{4}-\d{2}-\d{2})")


@dataclass
class Issue:
    level: str
    path: Path
    message: str


def iter_markdown(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.md") if ".git" not in p.parts)


def is_template(path: Path) -> bool:
    """Template files (e.g. _TEMPLATE.md) carry placeholder links/status on
    purpose; they must not trigger broken-link or status-conflict noise."""
    return path.name.startswith("_")


def strip_anchor(target: str) -> str:
    return target.split("#", 1)[0]


def is_external(target: str) -> bool:
    return (
        "://" in target
        or target.startswith("mailto:")
        or target.startswith("#")
        or target.startswith("data:")
    )


def check_links(plans_root: Path, files: list[Path]) -> list[Issue]:
    issues: list[Issue] = []
    for path in files:
        if is_template(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for raw_target in LINK_RE.findall(text):
            target = strip_anchor(raw_target.strip())
            if not target or is_external(target):
                continue
            target_path = (path.parent / unquote(target)).resolve()
            try:
                target_path.relative_to(plans_root.resolve().parent)
            except ValueError:
                issues.append(Issue("WARN", path, f"link points outside project area: {raw_target}"))
                continue
            if not target_path.exists():
                issues.append(Issue("ERROR", path, f"broken link: {raw_target}"))
    return issues


def phase_dirs(plans_root: Path) -> list[Path]:
    return sorted(p for p in plans_root.iterdir() if p.is_dir() and p.name.startswith("phase"))


def find_units(plans_root: Path) -> tuple[list[Path], str]:
    """Return the list of "units" to validate and the detected layout mode.

    - Phased layout: every ``phaseN-*`` directory is a self-contained unit.
    - Flat layout (small projects): ``plans/`` itself is the single unit, as
      long as it carries a ``project_overview.md`` at its root.

    Without this, a flat ``plans/`` would silently skip shape/index checks.
    """
    phases = phase_dirs(plans_root)
    if phases:
        return phases, "phased"
    if (plans_root / "project_overview.md").exists():
        return [plans_root], "flat"
    return [], "unknown"


def check_unit_shape(unit: Path) -> list[Issue]:
    issues: list[Issue] = []
    for required in ["project_overview.md", "handoff.md", "changelog.md", "reference.md"]:
        if not (unit / required).exists():
            issues.append(Issue("ERROR", unit, f"missing required file: {required}"))
    if not (unit / "tasks").is_dir():
        issues.append(Issue("ERROR", unit, "missing tasks/ directory"))
    if not (unit / "resources").is_dir():
        issues.append(Issue("WARN", unit, "missing resources/ directory"))
    return issues


def check_task_index(unit: Path) -> list[Issue]:
    issues: list[Issue] = []
    overview = unit / "project_overview.md"
    tasks_dir = unit / "tasks"
    if not overview.exists() or not tasks_dir.is_dir():
        return issues

    # A flat layout may also list tasks from a root README.md index.
    index_text = overview.read_text(encoding="utf-8", errors="ignore")
    readme = unit / "README.md"
    if readme.exists():
        index_text += "\n" + readme.read_text(encoding="utf-8", errors="ignore")

    for task in sorted(tasks_dir.glob("*.md")):
        if task.name.startswith("_"):  # templates like _TEMPLATE.md are not tasks
            continue
        if f"tasks/{task.name}" not in index_text:
            issues.append(
                Issue("WARN", task, "task file is not linked from project_overview.md / README.md")
            )
    return issues


def _latest_changelog_date(changelog: Path) -> str | None:
    if not changelog.exists():
        return None
    dates: list[str] = []
    for line in changelog.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = DATE_HEADER_RE.match(line) or (
            CHANGELOG_DATE_RE.search(line) if line.lstrip().startswith("#") else None
        )
        if m:
            dates.append(m.group(1))
    return max(dates) if dates else None


def check_overview_freshness(unit: Path) -> list[Issue]:
    """Flag document drift: L1 overview stale while the changelog moved on.

    This is the single most common failure mode of a long-running human+AI
    plan system — the one-screen summary rots while work continues elsewhere.
    """
    issues: list[Issue] = []
    overview = unit / "project_overview.md"
    changelog = unit / "changelog.md"
    if not overview.exists():
        return issues

    header = "\n".join(overview.read_text(encoding="utf-8", errors="ignore").splitlines()[:20])
    om = OVERVIEW_UPDATED_RE.search(header)
    if not om:
        issues.append(
            Issue("WARN", overview, "no '最后更新: YYYY-MM-DD' found in the header block (cannot check drift)")
        )
        return issues

    overview_date = om.group(1)
    latest = _latest_changelog_date(changelog)
    if latest and latest > overview_date:
        issues.append(
            Issue(
                "WARN",
                overview,
                f"document drift: overview 最后更新 {overview_date} is older than the latest "
                f"changelog date {latest}; refresh the L1 status/board before trusting it",
            )
        )
    return issues


def check_status_conflicts(files: list[Path]) -> list[Issue]:
    issues: list[Issue] = []
    for path in files:
        if is_template(path):
            continue
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        status_lines = [line for line in lines[:40] if "状态" in line]
        for line in status_lines:
            has_done = "✅" in line or "已完成" in line
            has_pending = "⏳" in line or "未开始" in line
            has_running = "🔄" in line or "执行中" in line or "进行中" in line
            if not (has_done and (has_pending or has_running)):
                continue
            issues.append(
                Issue(
                    "INFO",
                    path,
                    "status line mixes completed and pending/running markers; verify this is intentional",
                )
            )
            break
    return issues


def check_changelog_order(files: list[Path]) -> list[Issue]:
    """Changelog entries should be reverse-chronological (newest first)."""
    issues: list[Issue] = []
    for path in files:
        if path.name != "changelog.md":
            continue
        dates: list[str] = []
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            match = DATE_HEADER_RE.match(line)
            if match:
                dates.append(match.group(1))
        for earlier, later in zip(dates, dates[1:]):
            if later > earlier:
                issues.append(
                    Issue(
                        "WARN",
                        path,
                        f"changelog not reverse-chronological: {earlier} appears above newer {later}",
                    )
                )
                break
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Check plans/ task progress system health.")
    parser.add_argument("plans_root", nargs="?", default="plans", help="Path to plans directory")
    args = parser.parse_args()

    plans_root = Path(args.plans_root).resolve()
    if not plans_root.exists():
        print(f"ERROR: plans root does not exist: {plans_root}", file=sys.stderr)
        return 2

    files = iter_markdown(plans_root)
    units, mode = find_units(plans_root)
    issues: list[Issue] = []
    if mode == "unknown":
        issues.append(
            Issue(
                "ERROR",
                plans_root,
                "no phaseN-* directory and no root project_overview.md found; "
                "cannot detect a flat or phased plans layout",
            )
        )
    for unit in units:
        issues.extend(check_unit_shape(unit))
        issues.extend(check_task_index(unit))
        issues.extend(check_overview_freshness(unit))
    issues.extend(check_links(plans_root, files))
    issues.extend(check_status_conflicts(files))
    issues.extend(check_changelog_order(files))

    counts = {"ERROR": 0, "WARN": 0, "INFO": 0}
    for issue in issues:
        counts[issue.level] += 1
        rel = issue.path.relative_to(plans_root.parent)
        print(f"[{issue.level}] {rel}: {issue.message}")

    unit_desc = f"{len(units)} {mode} unit(s)" if mode != "unknown" else "no recognizable layout"
    print(
        f"\nSummary: {counts['ERROR']} error(s), {counts['WARN']} warning(s), "
        f"{counts['INFO']} info item(s), {len(files)} markdown file(s) scanned "
        f"({unit_desc})."
    )
    return 1 if counts["ERROR"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
