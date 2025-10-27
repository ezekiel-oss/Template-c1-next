#!/usr/bin/env node

/**
 * Minimal API route test harness.
 *
 * - Scans src/app/api/**/route.(ts|js)
 * - Extracts exported HTTP methods (GET, POST, etc.) via regex
 * - Reports findings and basic validations
 *
 * Note: This does not execute handlers (safe for repos without build tooling).
 */

const fs = require("fs");
const path = require("path");

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function listFilesRecursive(dir) {
  const result = [];
  if (!fileExists(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      result.push(...listFilesRecursive(full));
    } else {
      result.push(full);
    }
  }
  return result;
}

function toRoutePath(relParts) {
  const filtered = relParts
    .filter(Boolean)
    .map((p) => (p.startsWith("(") && p.endsWith(")") ? "" : p))
    .filter(Boolean);
  return "/" + filtered.join("/").replace(/\/+/g, "/");
}

function main() {
  const apiDir = path.join("src", "app", "api");
  const files = listFilesRecursive(apiDir).filter((f) => /\/route\.(ts|js)$/.test(f));
  const report = [];

  for (const f of files) {
    const rel = path.relative(path.join("src", "app"), f).split(path.sep);
    const routePath = toRoutePath(rel.slice(0, -1));
    const content = readText(f);

    const methods = [];
    const methodMatches = content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS)\s*\(/g);
    for (const m of methodMatches) methods.push(m[1]);

    const envRefs = [...content.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);

    report.push({
      file: f,
      path: routePath,
      exportedMethods: methods,
      envReferenced: Array.from(new Set(envRefs))
    });
  }

  if (!report.length) {
    console.log("No API routes found under src/app/api.");
    process.exit(0);
  }

  console.log("API Route Report:");
  for (const r of report) {
    console.log(`- ${r.path} (${r.file})`);
    console.log(`  methods: ${r.exportedMethods.join(", ") || "none"}`);
    console.log(`  env: ${r.envReferenced.join(", ") || "none"}`);
  }

  // Simple validation
  const missingMethods = report.filter((r) => r.exportedMethods.length === 0);
  if (missingMethods.length) {
    console.warn("\nWarning: Some API routes do not export any HTTP method handlers:");
    for (const r of missingMethods) {
      console.warn(`  - ${r.path} (${r.file})`);
    }
  }

  const envSummary = new Set();
  for (const r of report) {
    for (const e of r.envReferenced) envSummary.add(e);
  }
  if (envSummary.size) {
    console.log("\nEnvironment variables referenced by API routes:");
    console.log(Array.from(envSummary).join(", "));
  }
}

if (require.main === module) {
  main();
}