import HOME_PAGE from "../index.html";
import SHORTENER_PAGE from "./shortener.html";
import blacklistWords from "../blacklist.json";

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CUSTOM_SLUG_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const BLACKLIST = new Set(
  (Array.isArray(blacklistWords) ? blacklistWords : [])
    .filter((word) => typeof word === "string")
    .map((word) => word.toLowerCase())
);

function isBlacklisted(name) {
  return BLACKLIST.has(name.toLowerCase());
}

function randomSlug(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let slug = "";
  for (const byte of bytes) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }
  return slug;
}

function normalizeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleShorten(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const targetUrl = normalizeUrl((body.url || "").trim());
  if (!targetUrl) {
    return json({ error: "Provide a valid http(s) URL" }, 400);
  }

  const customAlias = (body.alias || "").trim();
  let slug;

  if (customAlias) {
    if (!CUSTOM_SLUG_RE.test(customAlias)) {
      return json(
        { error: "Alias must be 3-32 characters: letters, numbers, - or _" },
        400
      );
    }
    if (isBlacklisted(customAlias)) {
      return json({ error: "That custom name is not available" }, 400);
    }
    const existing = await env.KV.get(customAlias);
    if (existing !== null) {
      return json({ error: "That custom name is already taken" }, 409);
    }
    slug = customAlias;
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomSlug();
      if ((await env.KV.get(candidate)) === null) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      return json({ error: "Could not generate a unique short URL, try again" }, 500);
    }
  }

  await env.KV.put(
    slug,
    JSON.stringify({ url: targetUrl, created: Date.now() })
  );

  const shortUrl = new URL(`/${slug}`, request.url).toString();
  return json({ slug, url: targetUrl, shortUrl });
}

async function handleRedirect(slug, request, env) {
  const entry = await env.KV.get(slug);
  if (entry === null) {
    return new Response("Short URL not found", { status: 404 });
  }
  let url;
  try {
    ({ url } = JSON.parse(entry));
  } catch {
    url = null;
  }
  if (typeof url !== "string" || !url) {
    return new Response("Short URL not found", { status: 404 });
  }
  return Response.redirect(url, 302);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      return new Response(HOME_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (pathname === "/shortener") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      return new Response(SHORTENER_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (pathname === "/api/shorten") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return handleShorten(request, env);
    }

    if (request.method === "GET" && pathname.length > 1 && !pathname.slice(1).includes("/")) {
      const slug = pathname.slice(1);
      if (!isBlacklisted(slug)) {
        return handleRedirect(slug, request, env);
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
