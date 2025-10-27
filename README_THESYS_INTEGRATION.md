````markdown name=README_THESYS_INTEGRATION.md
```markdown
# Thesys Integration (draft)

Files added:
- pages/api/thesys.js — server-side proxy to Thesys
- components/Chat.js — minimal client chat UI
- pages/index.js — mounts the Chat

Setup (Vercel):
1. In your Vercel project settings, add:
   - THESYS_API_KEY — your Thesys secret key
   - THESYS_API_URL — full Thesys endpoint (e.g. https://api.thesys.ai/v1/generate)

2. Push the branch and open the PR. The API route keeps the key server-side.

Notes:
- Do NOT expose the API key in client code (no NEXT_PUBLIC_*).
- If Thesys supports streaming, we can convert the API route to an Edge function or stream tokens via ReadableStream.
- If Thesys expects a different request shape (messages array, model param, etc.), supply the docs or an example response and I will adapt the proxy and Chat component to parse it correctly.
```
````