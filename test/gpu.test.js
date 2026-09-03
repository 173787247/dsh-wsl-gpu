import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildContentionAdvice,
  buildGpuAdvice,
  classifyVramPressure,
  formatGpuReport,
  isBlackwellLike,
  parseGpuCsv,
  probeInferencePorts,
  runNvidiaQuery,
} from "../lib/gpu.js";

describe("parseGpuCsv", () => {
  it("parses nounits CSV and flags 5080", () => {
    const csv =
      "NVIDIA GeForce RTX 5080, 591.86, 16303, 14000, 2303, 45, 12.0";
    const [g] = parseGpuCsv(csv);
    assert.equal(g.name, "NVIDIA GeForce RTX 5080");
    assert.equal(g.memoryTotalMiB, 16303);
    assert.equal(g.memoryUsedMiB, 14000);
    assert.equal(g.vramPressure, "high");
    assert.equal(g.blackwellLike, true);
    assert.equal(g.computeCap, "12.0");
  });

  it("marks older cards non-blackwell", () => {
    const [g] = parseGpuCsv("NVIDIA GeForce RTX 4090, 560.00, 24564, 1000, 23564, 5, 8.9");
    assert.equal(g.blackwellLike, false);
    assert.equal(g.vramPressure, "low");
  });
});

describe("isBlackwellLike / classifyVramPressure", () => {
  it("detects by name or compute cap", () => {
    assert.equal(isBlackwellLike("RTX 5090", "10.0"), true);
    assert.equal(isBlackwellLike("Tesla T4", "12.0"), true);
    assert.equal(isBlackwellLike("Tesla T4", "7.5"), false);
  });

  it("classifies ratios", () => {
    assert.equal(classifyVramPressure(9000, 16000), "medium");
    assert.equal(classifyVramPressure(14000, 16000), "high");
    assert.equal(classifyVramPressure(1000, 16000), "low");
  });
});

describe("buildGpuAdvice", () => {
  it("advises when smi fails", () => {
    const advice = buildGpuAdvice({ wsl: true, smi: { ok: false, error: "ENOENT" } });
    assert.ok(advice.some((t) => /nvidia-smi missing|Windows NVIDIA/i.test(t)));
  });

  it("adds blackwell and contention tips", () => {
    const advice = buildGpuAdvice({
      wsl: true,
      smi: { ok: true, listing: "GPU 0" },
      query: {
        ok: true,
        gpus: parseGpuCsv("NVIDIA GeForce RTX 5080, 591.86, 16303, 2000, 14303, 10, 12.0"),
      },
      inference: [
        { id: "ollama", port: 11434, open: true },
        { id: "llama", port: 8080, open: true },
      ],
    });
    assert.ok(advice.some((t) => /Blackwell|sm_120/i.test(t)));
    assert.ok(advice.some((t) => /Multiple inference/i.test(t)));
  });
});

describe("buildContentionAdvice", () => {
  it("handles zero / one / many open ports", () => {
    assert.match(buildContentionAdvice([])[0], /No common inference/);
    assert.match(buildContentionAdvice([{ id: "ollama", port: 11434, open: true }])[0], /Only ollama/);
    assert.match(
      buildContentionAdvice([
        { id: "ollama", port: 11434, open: true },
        { id: "vllm", port: 8000, open: true },
      ])[0],
      /Multiple inference/,
    );
  });
});

describe("probeInferencePorts", () => {
  it("marks open when probe succeeds on any host", async () => {
    const services = await probeInferencePorts({
      hosts: ["127.0.0.1", "localhost"],
      ports: { ollama: { port: 11434, label: "Ollama" } },
      probeFn: async (host, port) => ({ host, port, open: host === "localhost" }),
    });
    assert.equal(services[0].open, true);
    assert.equal(services[0].targets.length, 2);
  });
});

describe("runNvidiaQuery", () => {
  it("parses via injected execFile", async () => {
    const result = await runNvidiaQuery({
      execFileFn: async () => ({
        stdout: "NVIDIA GeForce RTX 5080, 591.86, 16303, 100, 16203, 1, 12.0\n",
      }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.gpus[0].blackwellLike, true);
  });
});

describe("formatGpuReport", () => {
  it("includes VRAM line and ports", () => {
    const text = formatGpuReport({
      wsl: true,
      smi: { ok: true, listing: "GPU 0: NVIDIA" },
      query: {
        gpus: parseGpuCsv("NVIDIA GeForce RTX 5080, 591.86, 16303, 100, 16203, 1, 12.0"),
      },
      inference: [{ id: "ollama", port: 11434, open: true }],
      advice: ["ok tip"],
    });
    assert.match(text, /nvidia-smi: ok/);
    assert.match(text, /\[blackwell\]/);
    assert.match(text, /ollama :11434 OPEN/);
    assert.match(text, /ok tip/);
  });
});

describe("toLosslessJson", () => {
  it("strips NaN/undefined so JSON round-trips", async () => {
    const { toLosslessJson } = await import("../lib/gpu.js");
    const dirty = {
      ok: true,
      n: Number.NaN,
      miss: undefined,
      nested: [{ open: true, error: undefined, util: Infinity }],
    };
    const clean = toLosslessJson(dirty);
    const again = JSON.parse(JSON.stringify(clean));
    assert.deepEqual(clean, again);
    assert.equal(clean.n, null);
    assert.equal(clean.miss, null);
    assert.equal(clean.nested[0].util, null);
  });

  it("parseGpuCsv never emits NaN", () => {
    const [g] = parseGpuCsv("GPU, 1.0, N/A, N/A, N/A, N/A, 12.0");
    assert.equal(g.memoryTotalMiB, null);
    assert.equal(g.utilizationGpu, null);
    assert.equal(g.vramPressure, "unknown");
  });
});
