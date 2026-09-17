import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import { isIP } from "node:net";

export type BrowserCheckConfig = {
  bin: string;
  url: string;
  screenshot?: string;
  outputDir: string;
  waitSeconds: number;
  timeoutSeconds: number;
};

export type ProcessResult = { exitCode: number; stdout: string; stderr: string };
export type ProcessRunner = (bin: string, args: string[], timeoutMs: number) => Promise<ProcessResult>;

const DEFAULT_URL = "http://127.0.0.1:3000";
const DEFAULT_OUTPUT_DIR = ".obscura-artifacts";
const DEFAULT_WAIT_SECONDS = 1;
const DEFAULT_TIMEOUT_SECONDS = 15;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function positiveNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number; received ${JSON.stringify(value)}`);
  }
  return parsed;
}

function isPrivateTarget(value: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (isIP(hostname) === 6) return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe8") || hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb");
  if (isIP(hostname) !== 4) return false;
  const octets = hostname.split(".").map(Number);
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] === 169 && octets[1] === 254 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168;
}

function screenshotPath(config: BrowserCheckConfig): string | undefined {
  if (!config.screenshot) return undefined;
  const outputRoot = resolve(config.outputDir);
  const candidate = resolve(outputRoot, config.screenshot);
  const escaped = relative(outputRoot, candidate);
  if (!escaped || isAbsolute(escaped) || escaped === ".." || escaped.startsWith(`..${sep}`)) {
    throw new Error(`BROWSER_SCREENSHOT must stay inside BROWSER_OUTPUT_DIR: ${config.screenshot}`);
  }
  return candidate;
}

function assertPng(path: string): Promise<void> {
  return Bun.file(path).arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < PNG_SIGNATURE.length || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
      throw new Error(`Obscura wrote an invalid PNG screenshot: ${path}`);
    }
  });
}

export function readConfig(env: Record<string, string | undefined> = process.env): BrowserCheckConfig {
  const config = {
    bin: env.OBSCURA_BIN?.trim() || "obscura",
    url: env.BROWSER_URL?.trim() || DEFAULT_URL,
    screenshot: env.BROWSER_SCREENSHOT?.trim() || undefined,
    outputDir: env.BROWSER_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR,
    waitSeconds: positiveNumber(env.BROWSER_WAIT, DEFAULT_WAIT_SECONDS, "BROWSER_WAIT"),
    timeoutSeconds: positiveNumber(env.BROWSER_TIMEOUT, DEFAULT_TIMEOUT_SECONDS, "BROWSER_TIMEOUT"),
  };
  if (env.BROWSER_ALLOW_EXTERNAL !== "1" && env.BROWSER_ALLOW_EXTERNAL !== "true" && !isPrivateTarget(config.url)) {
    throw new Error(`BROWSER_URL must target localhost or a private IP; set BROWSER_ALLOW_EXTERNAL=true to opt in: ${config.url}`);
  }
  screenshotPath(config);
  return config;
}

export function buildArgs(config: BrowserCheckConfig): string[] {
  const args = ["fetch", config.url, "--allow-private-network", "--dump", "text", "--wait", String(config.waitSeconds), "--timeout", String(config.timeoutSeconds)];
  const path = screenshotPath(config);
  if (path) args.push("--screenshot", path);
  return args;
}

export async function runProcess(bin: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
  if (!Bun.which(bin)) {
    throw new Error(`Obscura binary unavailable: ${bin}. Install Obscura or set OBSCURA_BIN.`);
  }
  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn([bin, ...args], { stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/enoent|not found/i.test(message)) {
      throw new Error(`Obscura binary unavailable: ${bin}. Install Obscura or set OBSCURA_BIN.`);
    }
    throw new Error(`Could not start Obscura: ${message}`);
  }

  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const complete = Promise.all([child.exited, stdout, stderr]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    child.kill();
    reject(new Error(`Obscura timed out after ${timeoutMs}ms while loading the target.`));
  }, timeoutMs); });
  try {
    const [exitCode, output, errors] = await Promise.race([complete, timeout]);
    if (timer) clearTimeout(timer);
    return {
      exitCode,
      stdout: output,
      stderr: errors,
    };
  } catch (error) {
    if (timer) clearTimeout(timer);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runBrowserCheck(config: BrowserCheckConfig, runner: ProcessRunner = runProcess): Promise<ProcessResult> {
  const targetScreenshot = screenshotPath(config);
  if (targetScreenshot) {
    await mkdir(dirname(targetScreenshot), { recursive: true });
    await unlink(targetScreenshot).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  const timeoutMs = config.timeoutSeconds * 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Obscura timed out after ${timeoutMs}ms while loading the target.`)), timeoutMs);
  });
  let result: ProcessResult;
  try {
    result = await Promise.race([runner(config.bin, buildArgs(config), timeoutMs), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (result.exitCode !== 0) {
    const details = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
    if (result.exitCode === 127) {
      throw new Error(`Obscura binary unavailable: ${config.bin}. Install Obscura or set OBSCURA_BIN.`);
    }
    throw new Error(`Obscura navigation failed for ${config.url}: ${details}`);
  }
  if (!result.stdout.trim()) {
    throw new Error(`Obscura returned an empty page for ${config.url}; check the dashboard and wait policy.`);
  }
  if (targetScreenshot) {
    const file = Bun.file(targetScreenshot);
    if (!(await file.exists()) || (await file.size) === 0) {
      throw new Error(`Obscura completed but the screenshot is missing or empty: ${targetScreenshot}`);
    }
    await assertPng(targetScreenshot);
  }
  return result;
}

async function main(): Promise<void> {
  try {
    const config = readConfig();
    const result = await runBrowserCheck(config);
    process.stdout.write(`Obscura check passed: ${config.url}\n${result.stdout.trim()}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) void main();
