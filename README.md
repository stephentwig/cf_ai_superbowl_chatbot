# cf_ai_superbowl_chatbot

Minimal Super Bowl chat bot built on Cloudflare Workers + Workers AI. Includes a tiny browser chat UI, a Worker for coordination, and a Durable Object for session memory.

## What’s included
- **LLM**: Workers AI (Llama 3.3) for responses
- **Workflow/coordination**: Cloudflare Worker orchestrates requests
- **User input**: Simple web chat UI served at `/`
- **Memory/state**: Durable Object stores last ~12 messages per browser session

## Project structure
- `src/index.js` Worker + Durable Object + embedded HTML UI
- `wrangler.toml` Cloudflare config
- `PROMPTS.md` AI prompts used

## Prerequisites
- Node.js 18+
- Cloudflare account with Workers AI enabled
- Wrangler CLI

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Login to Cloudflare (if needed):
   ```bash
   npx wrangler login
   ```
3. Run locally:
   ```bash
   npm run dev
   ```
4. Open the local URL shown by Wrangler and chat.

## Deploy
```bash
npm run deploy
```

## Notes
- The model is set to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` in `src/index.js`. If your account exposes a different Llama 3.3 model name, update it there.
- Memory is stored per browser session via a cookie; clearing cookies resets memory.
