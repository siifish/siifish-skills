# ASR 后端对比与配置

Kimi（Moonshot）和 GLM（智谱）**均不提供 ASR API**——Kimi 官方帮助中心明确建议搭配第三方语音服务。ASR 要用下面这些。

## 云端 API（OpenAI 兼容 `/audio/transcriptions`，脚本已内置）

| 后端 | 环境变量 | 默认模型 | 中文效果 | 价格量级 | 备注 |
| --- | --- | --- | --- | --- | --- |
| SiliconFlow | `SILICONFLOW_API_KEY` | `FunASR/sense-voice-small` | ⭐⭐⭐⭐⭐ | 极便宜，有免费额度 | 国内直连，**个人首选**；注册 platform.siliconflow.cn |
| Groq | `GROQ_API_KEY` | `whisper-large-v3-turbo` | ⭐⭐⭐⭐ | ~$0.04/小时 | 速度极快（LPU），需外网 |
| OpenAI | `OPENAI_API_KEY` | `whisper-1` | ⭐⭐⭐⭐ | $0.006/分钟 | 老牌稳定，需外网 |

配置（写进 ~/.zshrc 或项目 .env）：

```bash
export SILICONFLOW_API_KEY=sk-xxx   # 任选其一即可，脚本自动探测优先级同表序
export GROQ_API_KEY=gsk_xxx
export OPENAI_API_KEY=sk-xxx
```

注册与拿 key：
- SiliconFlow：https://cloud.siliconflow.cn → 账号 → API 密钥 → 新建。新用户送额度，FunASR/sense-voice-small 属免费/低价档。
- Groq：https://console.groq.com → API Keys。
- OpenAI：https://platform.openai.com → API keys。

## 本地模式（免费、隐私好、量大划算）

```bash
pip install faster-whisper
python3 scripts/transcribe.py <url> --backend local [--model small]
```

- 模型选择：`small`（快、准度够）/ `medium` / `large-v3-turbo`（最准，M 系 Mac 上也能跑）
- Apple Silicon 自动走 Metal 加速
- 适合：播客批量、隐私内容、不想管 API 额度

## 通用参数

- `--lang zh`：给 whisper 系后端语言提示，中文内容建议加（FunASR 不需要）
- `--model`：覆盖默认模型名（后端支持什么就填什么）
- 音频统一转 16kHz 单声道 wav 再发；>20MB（约 10 分钟）自动按 600s 切段逐段发送，输出按段拼接

## 选型建议

- 国内网络 + 中文内容 + 偶尔用 → **SiliconFlow**
- 已有 OpenAI key / 外网稳 → **Groq**（快）或 OpenAI
- 每周好几期长播客 → 本地 faster-whisper，一次配置永久免费
