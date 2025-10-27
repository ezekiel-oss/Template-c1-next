/**
 * Generate a machine-readable manifest for the repository.
 * - Detects framework and language heuristically
 * - Enumerates Next.js routes (App Router: src/app/**/{page.tsx,route.ts})
 * - Finds environment variables usages (process.env.* and .env* files)
 * - Collects external API URLs from fetch/axios patterns
 * - Reads package.json scripts if present
 *
 * Output: project-manifest.json at repo root
 *
 * Run: node scripts/generate_manifest.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readJSONSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function walkDir(dir, opts = {}) {
  const {
    ignore = [
      "node_modules",
      ".git",
      ".next",
      "dist",
      "build",
      ".cache",
      ".turbo",
      ".vercel",
      ".vscode",
    ],
  } = opts;
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (ignore.includes(entry.name)) continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(full, opts));
    } else {
      results.push(full);
    }
  }
  return results;
}

function detectFramework(files) {
  const hasNextConfig =
    files.some((f) => /next\.config\.(js|ts|mjs|cjs)$/.test(f)) ||
    exists(path.join(ROOT, "next.config.js")) ||
    exists(path.join(ROOT, "next.config.ts"));
  const hasAppDir = files.some((f) => f.includes(path.join("src", "app")));
  const pkg = readJSONSafe(path.join(ROOT, "package.json"));
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const hasNextDep = "next" in deps;
  if (hasNextConfig || hasAppDir || hasNextDep) {
    return "Next.js";
  }
  return null;
}

function detectLanguage(files) {
  const hasTS = files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  const hasJS = files.some((f) => f.endsWith(".js") || f.endsWith(".jsx"));
  if (hasTS) return "TypeScript";
  if (hasJS) return "JavaScript";
  return null;
}

function collectPackageScripts() {
  const pkg = readJSONSafe(path.join(ROOT, "package.json"));
  if (!pkg) return [];
  const scripts = pkg.scripts || {};
  return Object.keys(scripts).map((name) => ({
    name,
    command: scripts[name],
  }));
}

function discoverRoutes(files) {
  const routes = [];
  for (const file of files) {
    if (!file.includes(path.join("src", "app"))) continue;
    const isPage =
      file.endsWith("page.tsx") ||
      file.endsWith("page.jsx") ||
      file.endsWith("page.js") ||
      file.endsWith("page.ts");
    const isRoute =
      file.endsWith("route.ts") ||
      file.endsWith("route.js") ||
      file.endsWith("route.mjs") ||
      file.endsWith("route.cjs");
    if (!isPage && !isRoute) continue;

    const rel = path.relative(path.join(ROOT, "src", "app"), file);
    // Normalize to web path
    let webPath = "/" + rel.replace(/\\/g, "/");
    webPath = webPath
      .replace(/\/page\.(tsx|ts|jsx|js)$/i, "")
      .replace(/\/route\.(ts|js|mjs|cjs)$/i, "");
    // Remove trailing /index if present (for pages)
    webPath = webPath.replace(/\/index$/i, "");
    if (webPath === "") webPath = "/";

    const methods = [];
    if (isRoute) {
      const src = readFileSafe(file);
      const methodRegex =
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(/g;
      let m;
      while ((m = methodRegex.exec(src))) {
        methods.push(m[1]);
      }
      if (methods.length === 0) {
        // Heuristic/common methods if not explicitly exported
        methods.push("GET");
      }
    } else if (isPage) {
      methods.push("GET"); // Pages are GET-rendered
    }

    routes.push({
      path: webPath,
      file: path.relative(ROOT, file),
      type: isRoute ? "api-route" : "page",
      methods,
    });
  }
  return routes;
}

function findEnvVars(files) {
  const envMap = new Map();
  // Scan code files for process.env.VAR
  const codeFileExts = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".md",
    ".ts",
    ".json",
    ".env",
    ".env.local",
    ".env.example",
  ];
  for (const file of files) {
    const ext = path.extname(file);
    if (!codeFileExts.includes(ext) && !file.endsWith(".env")) continue;
    const src = readFileSafe(file);
    const re = /process\.env\.([A-Z0-9_]+)/g;
    let m;
    while ((m = re.exec(src))) {
      const name = m[1];
      if (!envMap.has(name)) envMap.set(name, new Set());
      envMap.get(name).add(path.relative(ROOT, file));
    }

    // Scan .env-like files for VAR= entries
    if (file.endsWith(".env") || file.includes(".env")) {
      const reEnv = /^([A-Z0-9_]+)\s*=/gm;
      let e;
      while ((e = reEnv.exec(src))) {
        const name = e[1];
        if (!envMap.has(name)) envMap.set(name, new Set());
        envMap.get(name).add(path.relative(ROOT, file));
      }
    }

    // Also parse README for uppercase env-like names
    if (path.basename(file).toLowerCase() === "readme.md") {
      const reUpper = /\b([A-Z][A-Z0-9_]+)\b/g;
      let u;
      while ((u = reUpper.exec(src))) {
        const name = u[1];
        // Heuristic: treat ALLCAPS tokens longer than 2 as potential env
        if (name.length >= 3) {
          if (!envMap.has(name)) envMap.set(name, new Set());
          envMap.get(name).add(path.relative(ROOT, file));
        }
      }
    }
  }
  // Convert to array
  return Array.from(envMap.entries()).map(([name, filesSet]) => ({
    name,
    foundIn: Array.from(filesSet),
  }));
}

function findExternalAPIs(files) {
  const apis = [];
  const apiRegexes = [
    // fetch("https://...")
    /fetch\(\s*['"`](https?:\/\/[^"'`\s)]+)['"`]/g,
    // axios.get("https://..."), axios.post("https://...")
    /axios\.\w+\(\s*['"`](https?:\/\/[^"'`\s)]+)['"`]/g,
    // direct new URL("https://...")
    /new\s+URL\(\s*['"`](https?:\/\/[^"'`\s)]+)['"`]/g,
    // generic http(s) url literals
    /['"`](https?:\/\/[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]+)['"`]/g,
  ];
  for (const file of files) {
    const src = readFileSafe(file);
    if (!src) continue;
    const matches = new Set();
    for (const re of apiRegexes) {
      let m;
      while ((m = re.exec(src))) {
        matches.add(m[1]);
      }
    }
    if (matches.size > 0) {
      apis.push({
        file: path.relative(ROOT, file),
        urls: Array.from(matches),
      });
    }
  }
  return apis;
}

function main() {
  const allFiles = walkDir(ROOT);
  const framework = detectFramework(allFiles) || "Unknown";
  const language = detectLanguage(allFiles) || "Unknown";
  const routes = discoverRoutes(allFiles);
  const env = findEnvVars(allFiles);
  const external = findExternalAPIs(allFiles);
  const pkgScripts = collectPackageScripts();

  const manifest = {
    projectName: path.basename(ROOT),
    framework,
    language,
    packageScripts: pkgScripts,
    routes,
    env,
    externalAPIs: external,
    filesCount: allFiles.length,
    generatedAt: new Date().toISOString(),
    notes: [
      "Manifest generated heuristically by scanning repository files.",
      "If this is a Next.js project, ensure 'src/app/**' contains page.tsx and route.ts files.",
      "Add .env.example and reference environment variables in code via process.env.VAR for detection.",
    ],
  };

  fs.writeFileSync(
    path.join(ROOT, "project-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );
  console.log("Wrote project-manifest.json");
}

if (require.main === module) {
  main();
}