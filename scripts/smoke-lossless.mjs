import { detectWsl } from "../lib/wsl-host.js";
import {
  buildGpuAdvice,
  probeInferencePorts,
  runNvidiaQuery,
  runNvidiaSmi,
  toLosslessJson,
} from "../lib/gpu.js";

const wsl = detectWsl();
const smi = await runNvidiaSmi();
const query = smi.ok ? await runNvidiaQuery() : { ok: false, gpus: [] };
const inference = await probeInferencePorts({ hosts: ["127.0.0.1"] });
const report = toLosslessJson({
  wsl,
  smi,
  query,
  inference,
  advice: buildGpuAdvice({ wsl, smi, query, inference }),
  ok: Boolean(smi.ok),
});
JSON.parse(JSON.stringify(report));
console.log(
  "lossless_ok",
  report.ok,
  report.query?.gpus?.[0]?.name,
  (report.inference || []).map((s) => `${s.id}:${s.open}`).join(","),
);
