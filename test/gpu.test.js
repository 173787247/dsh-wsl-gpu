import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGpuAdvice, formatGpuReport } from "../lib/gpu.js";

describe("gpu_doctor", () => {
  it("advises when smi fails", () => {
    const advice = buildGpuAdvice({ wsl: true, smi: { ok: false, error: "ENOENT" } });
    assert.ok(advice.some((t) => /nvidia-smi missing|Windows NVIDIA/i.test(t)));
  });

  it("formats report", () => {
    const text = formatGpuReport({
      wsl: true,
      smi: { ok: true, listing: "GPU 0: NVIDIA" },
      advice: ["ok tip"],
    });
    assert.match(text, /nvidia-smi: ok/);
    assert.match(text, /ok tip/);
  });
});
