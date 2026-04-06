import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");

export function loadLocalEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    return;
  }

  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const lines = raw.split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    const normalized = value.replace(/^"(.*)"$/u, "$1").replace(/^'(.*)'$/u, "$1");

    if (!(key in process.env)) {
      process.env[key] = normalized;
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Eksik ortam degiskeni: ${name}`);
  }

  return value;
}
