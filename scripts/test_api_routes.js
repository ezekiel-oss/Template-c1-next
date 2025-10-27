/**
 * Minimal test harness for Next.js API routes (App Router).
 * - Enumerates src/app/api/**/route.(ts|js|mjs|cjs)
 * - Parses exported HTTP methods (GET/POST/PUT/DELETE/PATCH/OPTIONS/HEAD)
 * - Detects environment variables used within each route file
 * - Writes a report to api-routes-report.json
 *
 * NOTE:
 *  - This harness does not execute TypeScript route handlers.
 *  - Execution support can be added if compiled handlers exist (.next/server/app/**)
 *
 * Run: node scripts/test_api_routes.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

function walkDir(dir, ignore = ["node_modules", ".git", ".next", "dist", "build", ".turbo"]) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (ignore.includes(entry.name)) continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(full, ignore));
    } else {
      results.push(full);
    }
  }
  return results;
}

// Provide mocked environment variables if not present
const mockEnv = {
  THESYS_API_KEY: process.env.THESYS_API_KEY || "DUMMY_THESYS",
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "DUMMY_GOOGLE",
  GOOGLE_CX: process.env.GOOGLE_CX || "DUMMY_CX",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "DUMMY_GEMINI",
};
Object.assign(process.env, mockEnv);

function findRouteFiles(files) {
  return files.filter((f) => {
    const rel = path.relative(path.join(ROOT, "src", "app"), f);
    return (
      !rel.startsWith("..") &&
      /\/api\/.*\/route\.(ts|js|mjs|cjs)$/.test(f.replace(/\\/g, "/"))
    );
  });
}

function routePathFromFile(file) {
  // src/app/api/foo/bar/route.ts => /api/foo/bar
  const rel = path.relative(path.join(ROOT, "src", "app"), file).replace(/\\/g, "/");
  return (
    "/" +
    rel
      .replace(/\/route\.(ts|js|mjs|cjs)$/i, "")
      .replace(/^\/?/, "")
  );
}

function parseMethods(src) {
  const methods = new Set();
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    methods.add(m[1]);
  }
  return Array.from(methods);
}

function parseEnvVars(src) {
  const vars = new Set();
  const re = /process\.env\.([A-Z0-9_]+)/g;
  let m;
  while ((m = re.exec(src))) {
    vars.add(m[1]);
  }
  return Array.from(vars);
}

function main() {
  const allFiles = walkDir(ROOT);
  const routeFiles = findRouteFiles(allFiles);
  const report = {
    discoveredAt: new Date().toISOString(),
    routes: [],
    summary: {
      totalRoutes: routeFiles.length,
    },
    envUsed: Object.keys(mockEnv).filter((k) => !!mockEnv[k]),
    notes: [
      "This harness enumerates API route files and extracts exported HTTP methods and env usages.",
      "To actually execute handlers, run after building Next.js so compiled handlers exist under .next/server/app/**.",
    ],
  };

  for (const file of routeFiles) {
    const src = readFileSafe(file);
    const methods = parseMethods(src);
    const envVars = parseEnvVars(src);
    report.routes.push({
      path: routePathFromFile(file),
      file: path.relative(ROOT, file),
      methods: methods.length ? methods : ["GET"],
      envVars,
    });
  }

  const outPath = path.join(ROOT, "api-routes-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`Wrote ${path.relative(ROOT, outPath)} with ${routeFiles.length} route(s).`);
}

if (require.main === module) {
  main();
}