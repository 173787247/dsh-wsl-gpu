import { detectWsl } from "../lib/wsl-host.js";
import {
  buildGpuAdvice,
  formatGpuReport,
  probeInferencePorts,
  runNvidiaQuery,
  runNvidiaSmi,
} from "../lib/gpu.js";

const wsl = detectWsl();
const smi = await runNvidiaSmi();
const query = smi.ok ? await runNvidiaQuery() : { ok: false, gpus: [] };
const inference = await probeInferencePorts({ hosts: ["127.0.0.1"] });
const report = { wsl, smi, query, inference };
report.advice = buildGpuAdvice(report);
console.log(formatGpuReport(report));
