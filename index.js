import { detectWsl } from "./lib/wsl-host.js";
import {
  buildGpuAdvice,
  formatGpuReport,
  probeInferencePorts,
  runNvidiaQuery,
  runNvidiaSmi,
  toLosslessJson,
} from "./lib/gpu.js";

export const name = "dsh-wsl-gpu";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 20_000);
  const probeTimeoutMs = positive(config.probeTimeoutMs, 1_200);
  const probeInference = config.probeInference !== false;
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:gpu_doctor",
    order: 120,
    text: [
      "Use gpu_doctor before local inference or CUDA installs: nvidia-smi in WSL, VRAM pressure, Blackwell/sm_120 hints, and whether Ollama/vLLM/llama-server ports compete on one GPU.",
      "Pair with host_reach for baseURL and docker_doctor focus=vllm for containers.",
    ].join(" "),
  });

  ctx.tools.register({
    name: "gpu_doctor",
    description:
      "Probe nvidia-smi (VRAM/util/compute_cap), flag Blackwell/5080 needs, and check if multiple local LLM ports are open on the same machine.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        probeInference: {
          type: "boolean",
          description: "Also TCP-probe Ollama/LM Studio/vLLM/llama ports (default true).",
        },
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
      },
      render: (_args, value) => [{ type: "text", text: formatGpuReport(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args = {}) {
      const doProbe = args.probeInference !== undefined ? Boolean(args.probeInference) : probeInference;
      const smi = await runNvidiaSmi();
      const query = smi.ok ? await runNvidiaQuery() : { ok: false, gpus: [] };
      const inference = doProbe
        ? await probeInferencePorts({
            hosts: ["127.0.0.1", "localhost"],
            timeoutMs: probeTimeoutMs,
          })
        : [];
      const report = { wsl, smi, query, inference };
      report.advice = buildGpuAdvice(report);
      report.ok = Boolean(smi.ok);
      return toLosslessJson(report);
    },
    presentCall: () => ({ card: "generic", title: "GPU doctor" }),
    presentResult: (_args, result) => (
      result.isError
        ? { card: "generic", title: "GPU doctor failed", content: result.content }
        : { card: "generic", title: "GPU doctor", content: result.content }
    ),
  });
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
