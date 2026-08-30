# dsh-wsl-gpu

DeepSeek Harness 工具：**`gpu_doctor`** — 探测 `nvidia-smi`，并就 WSL 内 GPU / CUDA 可见性给出建议。

属于 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**。

[English → README.md](./README.md)

---

## 为什么需要

本地推理（PyTorch、WSL 里的 Ollama 等）需要 Windows NVIDIA 驱动把 GPU 暴露给 WSL2。本工具检查 `nvidia-smi` 并给出可执行建议（**不要**在发行版里再装冲突的 Linux NVIDIA 驱动；必要时 `wsl --shutdown`）。

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-gpu
```

驱动更新后或 CUDA 编译失败时，让 Agent「跑一下 gpu_doctor」。

## 配置

```yaml
- id: dsh-wsl-gpu
  name: dsh-wsl-gpu
  config:
    timeoutMs: 20000
```

## 测试

```sh
npm test
```

## 许可

MIT
