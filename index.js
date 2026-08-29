import { detectWsl } from "./lib/wsl-host.js";
import { buildGpuAdvice, formatGpuReport, runNvidiaQuery, runNvidiaSmi } from "./lib/gpu.js";

export const name = "dsh-wsl-gpu";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const timeoutMs = positive(config.timeoutMs, 20_000);
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:gpu_doctor",
    order: 120,
    text: "Use gpu_doctor to check whether NVIDIA GPUs are visible inside WSL (nvidia-smi) before local inference or CUDA installs.",
  });

  ctx.tools.register({
    name: "gpu_doctor",
    description: "Probe nvidia-smi in WSL and advise on Windows driver / CUDA visibility for local inference.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          wsl: { type: "boolean" },
          smi: { type: "object", additionalProperties: true },
          query: { type: "object", additionalProperties: true },
          advice: { type: "array", items: { type: "string" } },
        },
      },
      render: (_args, value) => [{ type: "text", text: formatGpuReport(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute() {
      const smi = await runNvidiaSmi();
      const query = smi.ok ? await runNvidiaQuery() : { ok: false };
      const report = { wsl, smi, query };
      report.advice = buildGpuAdvice(report);
      return report;
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
