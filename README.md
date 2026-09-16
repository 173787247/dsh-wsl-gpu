# dsh-wsl-gpu
> **Install set:** part of [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit). Prefer `KIT_SET=daily` | `llm` | `github` | `full` (see kit README). Fault tree: [TROUBLESHOOTING.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.md).


DeepSeek Harness tool: **`gpu_doctor`** — WSL `nvidia-smi`, VRAM pressure, Blackwell/5080 hints, and whether Ollama / vLLM / Unsloth Desktop ports compete on one GPU.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## Where it sits

Reports nvidia-smi, Blackwell hints, and whether an inference port is already taken.

```mermaid
flowchart LR
  agent["dsh agent"] --> tool["gpu_doctor"] --> gpu["nvidia-smi / VRAM"]
```

Suite diagram and version snapshot: [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit#how-the-pieces-fit). This plugin is **0.2.2** (full; also in llm). Do not copy that matrix into this README.


---
## Compatibility

| Field | Value |
|-------|-------|
| **Plugin** | `dsh-wsl-gpu` **0.2.2** |
| **Minimum dsh** | ≥ **0.1.2** (web UI one-shot `?token=` on Windows relay `:3081`) |
| **Latest verified** | See [dsh-wsl-kit Compatibility](https://github.com/173787247/dsh-wsl-kit#compatibility-2026-09) (currently **`0.1.5-rc.1`**) — single source of truth for the suite |
| **Kit set** | `llm` / `full` (some also useful alone) |
| **Cloud Flash** | Use model id **`deepseek-flash`** (V4.1 Flash) in `~/.dsh/settings.yaml` / `llm-deepseek` — not configured by this plugin |
| **Agent Teams** | Upstream experimental; not required here |

Suite floor versions: kit [`check-plugin-versions.sh`](https://github.com/173787247/dsh-wsl-kit/blob/master/scripts/check-plugin-versions.sh). Fault tree: [TROUBLESHOOTING.md](https://github.com/173787247/dsh-wsl-kit/blob/master/docs/TROUBLESHOOTING.md).

## Why

Local inference needs the Windows NVIDIA driver to expose GPUs into WSL2. On a single ~16GB card (e.g. RTX 5080), opening Ollama **and** llama-server **and** vLLM at once is a common OOM path. This tool reports visibility, VRAM, and open inference ports together.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/173787247/dsh-wsl-kit/master/install.sh | KIT_SET=llm bash
# or:
dsh plugin --profile web add github:173787247/dsh-wsl-gpu
```

Ask: “Run gpu_doctor” after driver updates, CUDA build failures, or before loading another large GGUF.

## What you get

- Parsed GPU rows: name, driver, VRAM used/total, util, compute capability
- Blackwell / RTX 50 tips (`sm_120`, CUDA 12.8+/13.x)
- Inference port scan: `11434` / `1234` / `8000` / `8080`
- Pointers to `host_reach` and `docker_doctor focus=vllm`

## Config

```yaml
- id: dsh-wsl-gpu
  name: dsh-wsl-gpu
  config:
    timeoutMs: 20000
    probeTimeoutMs: 1200
    probeInference: true
```

## Test

```sh
npm test
```

## License

MIT
