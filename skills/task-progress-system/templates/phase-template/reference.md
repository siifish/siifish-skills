# Phase {N} 参考手册

> 命令、路径、配置、指标速查。只放可复用信息；一次性分析放 `tasks/` 或 `resources/`。

---

## 关键路径

```yaml
project_root: "{项目根目录}"
data_input: "{输入数据路径}"
outputs: "{输出路径}"
logs: "{日志路径}"
reports: "plans/phaseN-your-topic/resources/"
```

---

## 常用命令

### 环境准备

```bash
cd {项目根目录}
{激活环境命令}
```

### 任务 T1

```bash
# T1 的最小可复现命令
```

---

## 关键配置

| 配置项 | 推荐值 | 说明 |
|---|---|---|
| `{config}` | `{value}` | `{说明}` |

---

## 指标目标

| 指标 | 基线 | 硬性下限 | 目标 | 说明 |
|---|---:|---:|---:|---|
| `{metric}` | `{baseline}` | `{minimum}` | `{target}` | `{说明}` |

---

## 已知陷阱

| 陷阱 | 现象 | 解决方式 |
|---|---|---|
| `{trap}` | `{symptom}` | `{fix}` |
