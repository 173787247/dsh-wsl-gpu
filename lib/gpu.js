import { createConnection } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Local LLM ports often fighting for the same VRAM on Windows. */
export const INFERENCE_PORTS = {
  ollama: { port: 11434, label: "Ollama" },
  lmstudio: { port: 1234, label: "LM Studio" },
  vllm: { port: 8000, label: "vLLM" },
  llama: { port: 8080, label: "llama-server / Unsloth Desktop" },
};

const QUERY_FIELDS =
  "name,driver_version,memory.total,memory.used,memory.free,utilization.gpu,compute_cap";

export async function runNvidiaSmi({ execFileFn = execFileAsync } = {}) {
  try {
    const { stdout, stderr } = await execFileFn("nvidia-smi", ["-L"], {
      timeout: 10_000,
      encoding: "utf8",
    });
    return { ok: true, listing: String(stdout || "").trim(), stderr: String(stderr || "").trim() };
  } catch (err) {
    const out = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    if (err && typeof err === "object" && "code" in err && err.code != null) {
      out.code = err.code;
    }
    return out;
  }
}

export async function runNvidiaQuery({ execFileFn = execFileAsync } = {}) {
  try {
    const { stdout } = await execFileFn(
      "nvidia-smi",
      [`--query-gpu=${QUERY_FIELDS}`, "--format=csv,noheader,nounits"],
      { timeout: 10_000, encoding: "utf8" },
    );
    const csv = String(stdout || "").trim();
    return { ok: true, csv, gpus: parseGpuCsv(csv) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), gpus: [] };
  }
}

/**
 * Parse nvidia-smi CSV (nounits): name, driver, mem total/used/free MiB, util %, compute_cap.
 */
export function parseGpuCsv(csv) {
  const gpus = [];
  for (const line of String(csv || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length < 7) continue;
    const [name, driver, total, used, free, util, computeCap] = parts;
    const memoryTotalMiB = num(total);
    const memoryUsedMiB = num(used);
    const memoryFreeMiB = num(free);
    gpus.push({
      name,
      driver,
      memoryTotalMiB,
      memoryUsedMiB,
      memoryFreeMiB,
      utilizationGpu: num(util),
      computeCap,
      blackwellLike: isBlackwellLike(name, computeCap),
      vramPressure: classifyVramPressure(memoryUsedMiB, memoryTotalMiB),
    });
  }
  return gpus;
}

export function isBlackwellLike(name, computeCap) {
  const n = String(name || "");
  if (/50[89]0|Blackwell|RTX\s*50/i.test(n)) return true;
  const cap = parseFloat(String(computeCap || ""));
  return Number.isFinite(cap) && cap >= 12.0;
}

export function classifyVramPressure(usedMiB, totalMiB) {
  if (!Number.isFinite(usedMiB) || !Number.isFinite(totalMiB) || totalMiB <= 0) return "unknown";
  const ratio = usedMiB / totalMiB;
  if (ratio >= 0.85) return "high";
  if (ratio >= 0.55) return "medium";
  return "low";
}

function probeTcp(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const done = (open, error) => {
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      // dsh requires lossless JSON — never emit undefined fields.
      const row = { host, port, open };
      if (error != null && error !== "") row.error = String(error);
      resolve(row);
    };
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => done(true));
    sock.on("timeout", () => done(false, "timeout"));
    sock.on("error", (err) => done(false, err.message));
  });
}

/**
 * Probe well-known inference ports on localhost (+ optional Windows host IP).
 */
export async function probeInferencePorts({
  hosts = ["127.0.0.1"],
  ports = INFERENCE_PORTS,
  probeFn = probeTcp,
  timeoutMs = 1200,
} = {}) {
  const services = [];
  for (const [id, meta] of Object.entries(ports)) {
    let open = false;
    const targets = [];
    for (const host of hosts) {
      const r = await probeFn(host, meta.port, timeoutMs);
      targets.push(r);
      if (r.open) open = true;
    }
    services.push({ id, label: meta.label, port: meta.port, open, targets });
  }
  return services;
}

export function buildContentionAdvice(services = []) {
  const openOnes = services.filter((s) => s.open);
  const tips = [];
  if (openOnes.length >= 2) {
    tips.push(
      `Multiple inference listeners open: ${openOnes.map((s) => `${s.id}:${s.port}`).join(", ")}. On ~16GB cards (e.g. RTX 5080) avoid running Ollama + vLLM + llama-server/Unsloth Desktop at once — stop extras before loading another large GGUF.`,
    );
  } else if (openOnes.length === 1) {
    tips.push(
      `Only ${openOnes[0].id} (:${openOnes[0].port}) looks open — fine for exclusive VRAM use. Pair with host_reach for baseURL.`,
    );
  } else {
    tips.push(
      "No common inference ports open on probed hosts (11434/1234/8000/8080). Start Ollama / Unsloth Desktop / vLLM on Windows, then re-run gpu_doctor or host_reach.",
    );
  }
  return tips;
}

export function buildGpuAdvice(report) {
  const tips = [];
  if (!report.wsl) {
    tips.push("Not running in WSL; GPU bridging advice applies to WSL2 + Windows NVIDIA driver.");
  }
  if (!report.smi?.ok) {
    tips.push(
      "nvidia-smi missing or failed inside WSL. Install/update the Windows NVIDIA driver with WSL support; do not install a conflicting Linux driver in the distro.",
    );
    tips.push("After driver update, restart WSL (`wsl --shutdown`) and re-open the distro.");
    return tips;
  }

  tips.push("nvidia-smi works — CUDA-capable devices are visible to Linux processes.");

  const gpus = report.query?.gpus || [];
  for (const g of gpus) {
    if (g.blackwellLike) {
      tips.push(
        `${g.name}: Blackwell-class (compute ${g.computeCap || "?"}). Prefer CUDA 12.8+/13.x wheels or toolkits that ship sm_120; older cu118 builds often fail to use the GPU.`,
      );
      tips.push(
        "Building llama.cpp / Unsloth Desktop backends: use the Windows CUDA Toolkit already on PATH (nvcc), not a random Linux nvidia-driver package inside WSL.",
      );
    }
    if (g.vramPressure === "high") {
      tips.push(
        `VRAM pressure high on ${g.name}: ${g.memoryUsedMiB}/${g.memoryTotalMiB} MiB used. Unload idle models or close other inference servers before starting another.`,
      );
    } else if (g.vramPressure === "medium") {
      tips.push(
        `VRAM medium on ${g.name}: ${g.memoryUsedMiB}/${g.memoryTotalMiB} MiB — a second 20B+ GGUF may OOM; check open inference ports below.`,
      );
    }
  }

  if (!gpus.length && report.query?.ok) {
    tips.push("Query returned no parseable GPU rows; raw CSV may still be useful above.");
  }

  tips.push("For PyTorch, install a CUDA build that matches the driver; CPU-only wheels will ignore the GPU.");
  tips.push(...buildContentionAdvice(report.inference || []));
  tips.push("Docker GPU for vLLM: ensure Docker Desktop GPU support, then docker_doctor focus=vllm + host_reach.");
  return tips;
}

export function formatGpuReport(report) {
  const lines = ["gpu_doctor"];
  lines.push(`wsl: ${report.wsl}`);
  if (report.smi?.ok) {
    lines.push("nvidia-smi: ok");
    if (report.smi.listing) lines.push(report.smi.listing);
    for (const g of report.query?.gpus || []) {
      lines.push(
        `${g.name} | driver ${g.driver} | VRAM ${g.memoryUsedMiB}/${g.memoryTotalMiB} MiB (${g.vramPressure}) | util ${g.utilizationGpu}% | cc ${g.computeCap}${g.blackwellLike ? " [blackwell]" : ""}`,
      );
    }
    if (!(report.query?.gpus || []).length && report.query?.csv) {
      lines.push(report.query.csv);
    }
  } else {
    lines.push(`nvidia-smi: fail (${report.smi?.error || "unknown"})`);
  }
  if (report.inference?.length) {
    lines.push("inferencePorts:");
    for (const s of report.inference) {
      lines.push(`  ${s.id} :${s.port} ${s.open ? "OPEN" : "closed"}`);
    }
  }
  for (const tip of report.advice || []) lines.push(`- ${tip}`);
  return lines.join("\n");
}

function num(v) {
  const cleaned = String(v ?? "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Deep-clean a value so dsh tool output accepts it (no NaN / Infinity / undefined).
 */
export function toLosslessJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === "number" && !Number.isFinite(v)) return null;
      if (v === undefined) return null;
      return v;
    }),
  );
}
