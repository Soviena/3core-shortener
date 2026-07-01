# URL Shortener (Cloudflare Worker + KV)

Cloudflare Worker that serves a landing page ([index.html](index.html)) and a
shortener tool UI ([src/shortener.html](src/shortener.html)), and shortens
URLs with either an auto-generated slug or a custom name. Mappings are stored
in Workers KV. Worker logic lives in [src/index.js](src/index.js), which
imports both HTML files as text at build time (see the `rules` entry in
`wrangler.toml`).

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create the KV namespace:
   ```
   npx wrangler kv namespace create URLS
   npx wrangler kv namespace create URLS --preview
   ```
3. Copy the `id` and `preview_id` values from the command output into
   `wrangler.toml`.

## Develop

```
npm run dev
```

## Deploy

```
npm run deploy
```

## Routes

- `GET /` — landing page.
- `GET /shortener` — the shorten-a-URL tool UI.
- `POST /api/shorten` — body `{ "url": "https://...", "alias": "optional-name" }`
  returns `{ slug, url, shortUrl }`.
- `GET /:slug` — redirects to the stored URL (302).

## Custom alias blacklist

[blacklist.json](blacklist.json) lists names that cannot be used as a custom
alias (checked case-insensitively). It's seeded with the app's own route
names (`api`, `shortener`, `favicon.ico`) so a custom alias can never shadow
a real page or the API. Add any other names you want to ban — no code
changes needed, just redeploy after editing the file.
