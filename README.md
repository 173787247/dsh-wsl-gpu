# dsh-wsl-gpu

DeepSeek Harness tool: **`gpu_doctor`** — probe `nvidia-smi` and advise on GPU / CUDA visibility inside WSL.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 ↓](#中文)

---

## English

### Why

Local inference (PyTorch, Ollama-in-WSL, etc.) needs the Windows NVIDIA driver to expose GPUs into WSL2. This tool checks `nvidia-smi` and prints actionable advice (do **not** install a conflicting Linux NVIDIA driver in the distro).

### Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-gpu
```

Ask: “Run gpu_doctor” after driver updates or when CUDA builds fail.

### Config

```yaml
- id: dsh-wsl-gpu
  name: dsh-wsl-gpu
  config:
    timeoutMs: 20000
```

### Test

```sh
npm test
```

### License

MIT

---

## 中文

### 为什么需要

在 WSL 里做本地推理前，先确认 Windows NVIDIA 驱动是否把 GPU 暴露给 WSL。本工具跑 `nvidia-smi` 并给出建议（不要在发行版里再装冲突的 Linux 驱动；必要时 `wsl --shutdown`）。

### 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-gpu
```

### 许可

MIT
