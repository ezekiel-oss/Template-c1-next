# Project summary — `template-c1-next`

> Purpose: a Next.js + TypeScript template (likely a starter) configured for AI features (Thesys / Google / Gemini keys referenced) and ready to be run locally or deployed. This document explains the repository step-by-step in a way Cosine AI (or another automated system) can parse and use.

---

## 1) High-level overview

- **Framework**: Next.js (TypeScript)
- **Project name**: `template-c1` (from package.json)
- **Key integrations**: references to API keys in README (`THESYS_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_CX`, `GEMINI_API_KEY`) — signals usage of Thesys and Google (image/web search) and Gemini (Google model) or similar.
- **Build tools**: PostCSS, ESLint, Prettier. The `dev` script runs `next dev --turbopack`.

---

## 2) Top-level files and their roles

- `.github/` — GitHub workflows and CI (typical location). Useful for automation / tests / deploy pipelines.
- `src/` — All application source code (Next.js `app/` directory structure).
- `.env.example` — Example environment variables (contains keys that must be provided).
- `.gitignore` — Files to ignore in Git commits.
- `README.md` — Human-facing instructions; contains API key guidance and other usage notes.
- `eslint.config.mjs` — ESLint configuration.
- `next.config.ts` — Next.js configuration (TypeScript-based config).
- `package.json` — npm scripts and dependency list. Important scripts (from file):
  - `dev`: `next dev --turbopack`
  - `build`: `next build`
  - `start`: `next start`
  - `lint`: `next lint`
  - `format:fix`: `prettier --write .`
- `package-lock.json`, `pnpm-lock.yaml` — Lockfiles for reproducible installs.
- `postcss.config.mjs` — PostCSS tooling config.
- `tsconfig.json` — TypeScript configuration.
- `favicon.ico` — site icon.

---

## 3) `src/` structure (important files found)

A snapshot of the `src` tree (top entries):

- `src/app/` — Next.js App Router entrypoint
- `src/app/api/` — API route(s) — serverless endpoints for backend logic
- `src/app/font.ts` — font setup (likely using `next/font` or similar)
- `src/app/globals.css` — global CSS stylesheet
- `src/app/layout.tsx` — root layout for the app

> Note: `src/app/api/` is important for Cosine AI to know where server-side logic and data-access endpoints live.

---

## 4) Environment variables (from README snippet)

The README lists environment variables you must set before running the app. Example keys found in the README:

```
THESYS_API_KEY=[your_thesys_api_key]
GOOGLE_API_KEY=[your_google_api_key]
GOOGLE_CX=[your_google_custom_search_id]
GEMINI_API_KEY=[your_gemini_api_key]
```

- **THESYS_API_KEY**: Likely used for a custom AI service or wrapper (`thesys.dev`). README mentions generating an API key at `https://chat.thesys.dev/console/keys`.
- **GOOGLE_API_KEY / GOOGLE_CX**: For Google Custom Search (image & web search).
- **GEMINI_API_KEY**: For access to a Gemini model or Google-hosted model.

Action: copy `.env.example` -> `.env.local` and set these values prior to running.

---

## 5) How to run (step-by-step) — exact commands Cosine AI can execute

1. Install dependencies (choose one package manager):

```bash
# using npm
npm install

# or using pnpm if you prefer (lockfile exists)
pnpm install
```

2. Prepare environment:

```bash
cp .env.example .env.local
# then edit .env.local to include the keys: THESYS_API_KEY, GOOGLE_API_KEY, GOOGLE_CX, GEMINI_API_KEY
```

3. Run dev server:

```bash
npm run dev
# opens at http://localhost:3000
```

4. Build & start (production):

```bash
npm run build
npm run start
```

5. Lint / format:

```bash
npm run lint
npm run format:fix
```

---

## 6) What Cosine AI should pay attention to when ingesting this repo

1. **Server endpoints**: `src/app/api/` — parse all files under this folder to extract REST endpoints, expected inputs, outputs, and any AI-related calls (calls to Thesys / Gemini / Google APIs).
2. **Environment variables**: index all required keys from `.env.example` and README to surface secrets required for integrations.
3. **Package scripts**: `dev`, `build`, `start` — for lifecycle automation.
4. **Next.js routing & components**: `src/app/layout.tsx` and other files define page structure and any server components. If Cosine AI builds an index of routes, it should traverse `src/app/**` and map files ending with `page.tsx` / `route.ts` / `layout.tsx` etc.
5. **Third-party usage**: check `package.json` dependencies to identify which SDKs are used for AI or search (e.g., `openai`, `@googleapis`, `node-fetch`, axios, etc.) — this helps Cosine determine how to authenticate and call external services.

---

## 7) Recommended next automated steps for Cosine AI

1. Parse `package.json` dependencies and flag any packages that require credentials or have native build steps.
2. Scan `src/app/api/` for `fetch` / `axios` / SDK usages to identify which environment variables map to which calls.
3. Extract README usage examples (if present) to create runnable integration tests.
4. Run static analysis: TypeScript compile check (`tsc --noEmit`) and `next build` in a sandbox to catch runtime config issues.
5. Create a minimal test harness that can run API routes locally with mocked environment variables to validate endpoints.

---

## 8) Quick mapping example (how Cosine AI might map env keys to API calls)

- If `src/app/api/search` calls

```ts
fetch(
  "https://www.googleapis.com/customsearch/v1?key=" +
    process.env.GOOGLE_API_KEY +
    "&cx=" +
    process.env.GOOGLE_CX +
    "..."
);
```

then map `GOOGLE_API_KEY, GOOGLE_CX` → Google Custom Search.

- If `src/app/api/ai` posts to

```ts
"https://api.thesys.dev/"
```

with

```ts
Authorization: `Bearer ${process.env.THESYS_API_KEY}`
```

map `THESYS_API_KEY` → Thesys AI service.

- If a Gemini SDK import exists and references `process.env.GEMINI_API_KEY`, map accordingly.

---

## 9) Known assumptions & limitations

- This summary was generated from top-level files, `package.json`, `README.md`, and a partial `src/` listing. Not every file under `src/` was inspected in depth. If Cosine AI needs a deeper file-by-file function-level breakdown, run a targeted parser across `src/` to extract function signatures, API usage, and inline comments.
- This repo appears to be an AI-enabled template; exact usage of each env key must be confirmed by searching for `process.env.` usages in `src/`.

---

## 10) Follow-up (if you want this doc converted into machine-readable JSON)

I can produce a JSON manifest that lists:

- routes (path → handler file)
- env variables (name → file references)
- external APIs called (url patterns → env keys)

If you want that, tell me and I'll produce the manifest.

---

---

## 11) Deployment (Vercel)

Follow these steps to deploy to Vercel:

1. Create environment variables:
   - Add the required env vars from `.env.example` in your Vercel project settings:
     - `THESYS_API_KEY`
     - `GOOGLE_API_KEY`
     - `GOOGLE_CX`
     - `GEMINI_API_KEY`
   - Ensure names match exactly what the code expects.

2. Link the GitHub repo:
   - In Vercel, click “New Project” → Import from GitHub → select `ezekiel-oss/Template-c1-next`.
   - Choose the branch (e.g., `main`).

3. Set build & output settings:
   - Build command: `npm run build` (or `pnpm build` if using pnpm).
   - Output directory: leave default (Next.js).
   - Environment: `production` or your desired environment.

4. Deploy preview and production:
   - On each push to `main`, Vercel will build and deploy automatically.
   - Preview branches will get their own preview URLs.

5. Test the deployment:
   - Visit the live URL, e.g., `https://template-c1-next.vercel.app`.
   - Test pages, API routes (`/api/...`), and integrations (Thesys/Google/Gemini).
   - Confirm environment variables are working by making a real AI request.

6. Monitor & iterate:
   - Use Vercel’s dashboard to monitor logs, errors, and performance.
   - Configure additional serverless functions if needed.
   - Update env variables and scale plan as necessary.

### Optional: GitHub Actions CI & Deploy

If you want to build/test before deploying, use a workflow that:
- Runs on every push to `main`.
- Installs dependencies, runs lint and build, then deploys to Vercel (via Vercel Git integration or the Vercel action).

This repository includes a workflow:
- `.github/workflows/project-validation.yml` — generates a manifest, runs TypeScript/noEmit, lint, build checks, and enumerates API routes.
- `.github/workflows/deploy.yml` — CI & deploy with conditional steps. Ensure these GitHub Secrets are set:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`_