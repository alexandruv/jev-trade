import { describe, expect, test } from "bun:test";
import { buildArgs, readConfig, runBrowserCheck, runProcess, type BrowserCheckConfig } from "./obscura-check";

const base: BrowserCheckConfig = {
  bin: "/opt/obscura",
  url: "http://127.0.0.1:3000",
  outputDir: "/tmp/obscura",
  waitSeconds: 2,
  timeoutSeconds: 9,
};

describe("Obscura browser check", () => {
  test("builds an explicit private-network fetch command", () => {
    expect(buildArgs({ ...base, screenshot: "dashboard.png" })).toEqual([
      "fetch", "http://127.0.0.1:3000", "--allow-private-network", "--dump", "text",
      "--wait", "2", "--timeout", "9", "--screenshot", "/tmp/obscura/dashboard.png",
    ]);
  });

  test("reads configurable defaults and rejects invalid timing", () => {
    expect(readConfig({})).toMatchObject({ bin: "obscura", url: "http://127.0.0.1:3000", outputDir: ".obscura-artifacts", waitSeconds: 1, timeoutSeconds: 15 });
    expect(() => readConfig({ BROWSER_TIMEOUT: "0" })).toThrow("BROWSER_TIMEOUT");
    expect(() => readConfig({ BROWSER_URL: "https://example.com" })).toThrow("BROWSER_ALLOW_EXTERNAL");
    expect(readConfig({ BROWSER_URL: "https://example.com", BROWSER_ALLOW_EXTERNAL: "true" }).url).toBe("https://example.com");
    expect(() => buildArgs({ ...base, screenshot: "../outside.png" })).toThrow("inside BROWSER_OUTPUT_DIR");
  });

  test("reports a missing binary distinctly", async () => {
    const runner = async () => { throw new Error("Obscura binary unavailable: /missing"); };
    expect(runBrowserCheck(base, runner)).rejects.toThrow("binary unavailable");
  });

  test("reports failed navigation distinctly", async () => {
    const runner = async () => ({ exitCode: 7, stdout: "", stderr: "connection refused" });
    expect(runBrowserCheck(base, runner)).rejects.toThrow("navigation failed");
  });

  test("reports a timeout distinctly", async () => {
    const runner = async () => new Promise<never>(() => {});
    expect(runBrowserCheck({ ...base, timeoutSeconds: 0.01 }, runner)).rejects.toThrow("timed out");
  });

  test("rejects empty successful output", async () => {
    const runner = async () => ({ exitCode: 0, stdout: " \n", stderr: "" });
    expect(runBrowserCheck(base, runner)).rejects.toThrow("empty page");
  });

  test("accepts non-empty successful output", async () => {
    const runner = async () => ({ exitCode: 0, stdout: "Jev Trader dashboard", stderr: "" });
    await expect(runBrowserCheck(base, runner)).resolves.toMatchObject({ exitCode: 0 });
  });

  test("requires a non-empty screenshot when requested", async () => {
    const screenshot = "dashboard.png";
    const outputDir = `/tmp/obscura-check-${Date.now()}`;
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const runner = async () => {
      await Bun.write(`${outputDir}/${screenshot}`, png);
      return { exitCode: 0, stdout: "dashboard", stderr: "" };
    };
    await expect(runBrowserCheck({ ...base, outputDir, screenshot }, runner)).resolves.toMatchObject({ exitCode: 0 });
    await Bun.write(`${outputDir}/${screenshot}`, png);
    await expect(runBrowserCheck({ ...base, outputDir, screenshot }, async () => ({ exitCode: 0, stdout: "dashboard", stderr: "" }))).rejects.toThrow("missing or empty");
    const badRunner = async () => {
      await Bun.write(`${outputDir}/${screenshot}`, new Uint8Array([1, 2, 3]));
      return { exitCode: 0, stdout: "dashboard", stderr: "" };
    };
    await expect(runBrowserCheck({ ...base, outputDir, screenshot }, badRunner)).rejects.toThrow("invalid PNG");
  });

  test("consumes output from the default subprocess runner", async () => {
    const result = await runProcess(process.execPath, ["-e", "process.stdout.write('fixture')"], 1000);
    expect(result).toEqual({ exitCode: 0, stdout: "fixture", stderr: "" });
  });
});
