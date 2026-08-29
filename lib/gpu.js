import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runNvidiaSmi({ execFileFn = execFileAsync } = {}) {
  try {
    const { stdout, stderr } = await execFileFn("nvidia-smi", ["-L"], {
      timeout: 10_000,
      encoding: "utf8",
    });
    return { ok: true, listing: String(stdout || "").trim(), stderr: String(stderr || "").trim() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: err && typeof err === "object" && "code" in err ? err.code : undefined,
    };
  }
}

export async function runNvidiaQuery({ execFileFn = execFileAsync } = {}) {
  try {
    const { stdout } = await execFileFn(
      "nvidia-smi",
      ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
      { timeout: 10_000, encoding: "utf8" },
    );
    return { ok: true, csv: String(stdout || "").trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function buildGpuAdvice(report) {
  const tips = [];
  if (!report.wsl) {
    tips.push("Not running in WSL; GPU bridging advice applies to WSL2 + Windows NVIDIA driver.");
  }
  if (!report.smi?.ok) {
    tips.push("nvidia-smi missing or failed inside WSL. Install/update the Windows NVIDIA driver with WSL support; do not install a conflicting Linux driver in the distro.");
    tips.push("After driver update, restart WSL (`wsl --shutdown`) and re-open the distro.");
  } else {
    tips.push("nvidia-smi works — CUDA-capable devices are visible to Linux processes.");
    tips.push("For PyTorch, install a CUDA build that matches the driver; CPU-only wheels will ignore the GPU.");
  }
  return tips;
}

export function formatGpuReport(report) {
  const lines = ["gpu_doctor"];
  lines.push(`wsl: ${report.wsl}`);
  if (report.smi?.ok) {
    lines.push("nvidia-smi: ok");
    if (report.smi.listing) lines.push(report.smi.listing);
    if (report.query?.ok && report.query.csv) lines.push(report.query.csv);
  } else {
    lines.push(`nvidia-smi: fail (${report.smi?.error || "unknown"})`);
  }
  for (const tip of report.advice || []) lines.push(`- ${tip}`);
  return lines.join("\n");
}
