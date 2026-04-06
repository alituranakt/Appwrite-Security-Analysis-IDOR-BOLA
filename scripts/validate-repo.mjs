import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  ".env.example",
  "package.json",
  "scripts/bootstrap-lab.mjs",
  "scripts/reset-lab.mjs",
  "functions/insecure-invoice-proxy/package.json",
  "functions/insecure-invoice-proxy/src/main.js",
  "functions/secure-invoice-proxy/package.json",
  "functions/secure-invoice-proxy/src/main.js",
  "web/index.html",
  "web/styles.css",
  "web/app.js",
  "web/config.js",
  "docs/06-idor-bola-vaka-calismasi.md"
];

const jsonFiles = [
  "package.json",
  "functions/insecure-invoice-proxy/package.json",
  "functions/secure-invoice-proxy/package.json"
];

let hasError = false;

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(cwd, relativePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`[check] Eksik dosya: ${relativePath}`);
    hasError = true;
  }
}

for (const relativePath of jsonFiles) {
  const absolutePath = path.join(cwd, relativePath);

  try {
    JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    console.error(`[check] Gecersiz JSON: ${relativePath}`);
    console.error(error.message);
    hasError = true;
  }
}

if (hasError) {
  process.exitCode = 1;
} else {
  console.log("[check] Repo yapisi dogrulandi.");
}
