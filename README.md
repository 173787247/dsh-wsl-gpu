# dsh-wsl-gpu

DeepSeek Harness tool: **`gpu_doctor`** — probe `nvidia-smi` and advise on GPU / CUDA visibility inside WSL.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

---

## Why

Local inference (PyTorch, Ollama-in-WSL, etc.) needs the Windows NVIDIA driver to expose GPUs into WSL2. This tool checks `nvidia-smi` and prints actionable advice (do **not** install a conflicting Linux NVIDIA driver in the distro).

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-gpu
```

Ask: “Run gpu_doctor” after driver updates or when CUDA builds fail.

## Config

```yaml
- id: dsh-wsl-gpu
  name: dsh-wsl-gpu
  config:
    timeoutMs: 20000
```

## Test

```sh
npm test
```

## License

MIT
