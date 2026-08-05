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


@dataclass
class Issue:
    level: str
    path: Path
    message: str


def iter_markdown(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.md") if ".git" not in p.parts)


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


def check_phase_shape(plans_root: Path) -> list[Issue]:
    issues: list[Issue] = []
    for phase in phase_dirs(plans_root):
        for required in ["project_overview.md", "handoff.md", "changelog.md", "reference.md"]:
            path = phase / required
            if not path.exists():
                issues.append(Issue("ERROR", phase, f"missing required phase file: {required}"))
        if not (phase / "tasks").is_dir():
            issues.append(Issue("ERROR", phase, "missing tasks/ directory"))
        if not (phase / "resources").is_dir():
            issues.append(Issue("WARN", phase, "missing resources/ directory"))
    return issues


def check_task_index(phase: Path) -> list[Issue]:
    issues: list[Issue] = []
    overview = phase / "project_overview.md"
    tasks_dir = phase / "tasks"
    if not overview.exists() or not tasks_dir.is_dir():
        return issues

    overview_text = overview.read_text(encoding="utf-8", errors="ignore")
    task_files = sorted(tasks_dir.glob("*.md"))

    for task in task_files:
        if f"tasks/{task.name}" not in overview_text:
            issues.append(Issue("WARN", task, "task file is not linked from project_overview.md"))
    return issues


def check_status_conflicts(files: list[Path]) -> list[Issue]:
    issues: list[Issue] = []
    for path in files:
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
    issues: list[Issue] = []
    issues.extend(check_phase_shape(plans_root))
    issues.extend(check_links(plans_root, files))
    for phase in phase_dirs(plans_root):
        issues.extend(check_task_index(phase))
    issues.extend(check_status_conflicts(files))
    issues.extend(check_changelog_order(files))

    counts = {"ERROR": 0, "WARN": 0, "INFO": 0}
    for issue in issues:
        counts[issue.level] += 1
        rel = issue.path.relative_to(plans_root.parent)
        print(f"[{issue.level}] {rel}: {issue.message}")

    print(
        f"\nSummary: {counts['ERROR']} error(s), {counts['WARN']} warning(s), "
        f"{counts['INFO']} info item(s), {len(files)} markdown file(s) scanned."
    )
    return 1 if counts["ERROR"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
