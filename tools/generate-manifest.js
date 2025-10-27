#!/usr/bin/env node

/**
 * Generate a machine-readable manifest of the project:
 * - routes (path → handler file)
 * - env variables (name → file references)
 * - external APIs called (url patterns → env keys)
 *
 * Safe to run even if only partial files exist; falls back to README-based info.
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

// Parse env variables from .env.example and README.md
function extractEnvVars() {
  const env = [];
  const sources = [
    { path: ".env.example", content: readText(".env.example") },
    { path: "README.md", content: readText("README.md") }
  ];

  const seen = new Set();

  for (const s of sources) {
    if (!s.content) continue;
    const lines = s.content.split(/\r?\n/);
    for (const line of lines) {
      // Match VAR_NAME= or VAR_NAME=[value]
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && m[1]) {
        const name = m[1];
        if (!seen.has(name)) {
          seen.add(name);
          env.push({
            name,
            foundIn: [s.path],
            example: m[2] || ""
          });
        } else {
          const idx = env.findIndex((e) => e.name === name);
        if (idx !== -1 && !env[idx].foundIn.includes(s.path)) {
            env[idx].foundIn.push(s.path);
          }
        }
      }
    }
    // Also capture code blocks like NAME=[value]
    const blockMatches = [...s.content.matchAll(/^([A-Z0-9_]+)\s*=\s*\[.*\]$/gm)];
    for (const bm of blockMatches) {
      const name = bm[1];
      if (!seen.has(name)) {
        seen.add(name);
        env.push({
          name,
          foundIn: [s.path],
          example: "[]"
        });
      } else {
        const idx = env.findIndex((e) => e.name === name);
        if (idx !== -1 && !env[idx].foundIn.includes(s.path)) {
          env[idx].foundIn.push(s.path);
        }
      }
    }
  }

  return env;
}

// Map known env vars to external APIs
function mapExternalApis(envVars) {
  const names = envVars.map((e) => e.name);
  const apis = [];

  if (names.includes("GOOGLE_API_KEY") || names.includes("GOOGLE_CX")) {
    apis.push({
      name: "Google Custom Search",
      endpoints: ["https://www.googleapis.com/customsearch/v1"],
      env: ["GOOGLE_API_KEY", "GOOGLE_CX"],
      detectedIn: [],
      confidence: "high"
    });
  }
  if (names.includes("THESYS_API_KEY")) {
    apis.push({
      name: "Thesys AI",
      endpoints: ["https://api.thesys.dev/"],
      env: ["THESYS_API_KEY"],
      detectedIn: [],
      confidence: "medium"
    });
  }
  if (names.includes("GEMINI_API_KEY")) {
    apis.push({
      name: "Gemini (Google Generative AI)",
      endpoints: [],
      env: ["GEMINI_API_KEY"],
      detectedIn: [],
      confidence: "medium"
    });
  }

  // Scan code for fetch/axios URLs
  const files = listFilesRecursive("src");
  const urlPattern = /https?:\/\/[^\s"'`)+]+/g;
  const codeFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));
  const detected = new Set();

  for (const f of codeFiles) {
    const content = readText(f);
    const urls = content.match(urlPattern) || [];
    for (const u of urls) {
      detected.add(JSON.stringify({ url: u, file: f }));
    }
  }

  const detectedArray = Array.from(detected).map((s) => JSON.parse(s));
  for (const d of detectedArray) {
    const known = apis.find((a) => d.url.startsWith(a.endpoints[0] || ""));
    if (known) {
      if (!known.detectedIn.includes(d.file)) known.detectedIn.push(d.file);
    } else {
      apis.push({
        name: "External API",
        endpoints: [d.url],
        env: [],
        detectedIn: [d.file],
        confidence: "low"
      });
    }
  }

  return apis;
}

// Discover Next.js routes from src/app
function extractRoutes() {
  const appDir = "src/app";
  const files = listFilesRecursive(appDir);
  const routes = [];

  function toRoutePath(relParts) {
    // Remove route groups (segments in parentheses)
    const filtered = relParts
      .filter(Boolean)
      .map((p) => (p.startsWith("(") && p.endsWith(")") ? "" : p))
      .filter(Boolean);

    return "/" + filtered.join("/").replace(/\/+/g, "/");
  }

  for (const f of files) {
    const rel = path.relative(appDir, f).split(path.sep);
    const filename = rel[rel.length - 1];

    if (filename === "page.tsx" || filename === "page.jsx") {
      const segments = rel.slice(0, -1);
      const pathStr = toRoutePath(segments);
      routes.push({
        type: "page",
        path: pathStr === "/" ? "/" : pathStr,
        file: f
      });
    }

    if (filename === "route.ts" || filename === "route.js") {
      const segments = rel.slice(0, -1);
      const pathStr = toRoutePath(segments);
      routes.push({
        type: segments[0] === "api" ? "api" : "route",
        path: pathStr,
        file: f
      });
    }

    // Support app-level layout files as metadata
    if (filename === "layout.tsx" || filename === "layout.jsx") {
      const segments = rel.slice(0, -1);
      const pathStr = toRoutePath(segments);
      routes.push({
        type: "layout",
        path: pathStr || "/",
        file: f
      });
    }
  }

  // Try to identify HTTP handlers within route files
  for (const r of routes.filter((r) => r.type === "api" || r.type === "route")) {
    const content = readText(r.file);
    const methods = [];
    const methodMatches = content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS)\s*\(/g);
    for (const m of methodMatches) {
      methods.push(m[1]);
    }
    if (methods.length) r.methods = methods;
  }

  return routes;
}

function extractPackageScripts() {
  const pkgPath = "package.json";
  if (!fileExists(pkgPath)) return [];
  try {
    const pkg = JSON.parse(readText(pkgPath));
    return Object.entries(pkg.scripts || {}).map(([name, command]) => ({ name, command, source: "package.json" }));
  } catch {
    return [];
  }
}

function generateManifest() {
  const envVars = extractEnvVars();
  const externalApis = mapExternalApis(envVars);
  const routes = extractRoutes();
  const packageScripts = extractPackageScripts();

  const manifest = {
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "Automated repository scan",
    project: {
      name: "template-c1-next",
      framework: "Next.js",
      language: "TypeScript"
    },
    buildTools: ["PostCSS", "ESLint", "Prettier"],
    packageScripts:
      packageScripts.length
        ? packageScripts
        : [
            { name: "dev", command: "next dev --turbopack", source: "heuristic" },
            { name: "build", command: "next build", source: "heuristic" },
            { name: "start", command: "next start", source: "heuristic" },
            { name: "lint", command: "next lint", source: "heuristic" },
            { name: "format:fix", command: "prettier --write .", source: "heuristic" }
          ],
    environmentVariables: envVars.map((e) => ({
      name: e.name,
      description:
        e.name === "THESYS_API_KEY"
          ? "API key for Thesys AI service"
          : e.name === "GOOGLE_API_KEY"
          ? "API key for Google Custom Search"
          : e.name === "GOOGLE_CX"
          ? "Google Custom Search Engine ID"
          : e.name === "GEMINI_API_KEY"
          ? "API key for Gemini (Google Generative AI)"
          : "",
      foundIn: e.foundIn,
      example: e.example
    })),
    routes,
    externalApis,
    filesScanned: listFilesRecursive(".")
  };

  return manifest;
}

function main() {
  const manifest = generateManifest();
  fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));
  console.log("Manifest written to manifest.json");
}

if (require.main === module) {
  main();
}