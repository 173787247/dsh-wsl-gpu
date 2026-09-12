## 0.2.2

- Advice: pair with host_reach / switch to deepseek-flash when local idle-timeout.

# Changelog

## 0.2.1

- Fix dsh `value is not lossless JSON`: strip `NaN`/`undefined` from tool output (TCP probe rows, numeric fields).

## 0.2.0

- Richer `nvidia-smi` query: VRAM used/free, util, compute capability.
- Parse GPUs; flag Blackwell / RTX 50-series (`sm_120` / CUDA 12.8+ tips).
- TCP-probe common inference ports (Ollama / LM Studio / vLLM / llama-server) for VRAM contention.
- Advice when multiple listeners share one ~16GB card.

## 0.1.0

- Initial public release of `dsh-wsl-gpu` for DeepSeek Harness on Windows + WSL.
