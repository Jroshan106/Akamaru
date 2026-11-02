import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../client/src/lib/jikan.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { normalizeAnime, searchPath, resolveId, jikanRequest } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("Jikan mapping preserves episode totals and keeps trailers separate", () => {
  const anime = normalizeAnime({
    mal_id: 1,
    title: "Cowboy Bebop",
    status: "Finished Airing",
    episodes: 26,
    score: 8.75,
    aired: { prop: { from: { year: 1998 } } },
    trailer: { youtube_id: "qig4KOK2R2g" },
  });
  assert.equal(anime.id, "1");
  assert.equal(anime.status, "Completed");
  assert.equal(anime.year, 1998);
  assert.equal(anime.episodeCount, 26);
  assert.equal(anime.episodes.length, 1);
  assert.equal(anime.episodes[0].id, "trailer");
  assert.equal(
    anime.episodes[0].videoUrl,
    "https://www.youtube.com/embed/qig4KOK2R2g",
  );
});
test("missing metadata does not manufacture a playable episode", () => {
  const anime = normalizeAnime({
    mal_id: 2,
    title: "Upcoming title",
    score: null,
    episodes: null,
    trailer: { youtube_id: "https://bad.example" },
  });
  assert.deepEqual(anime.episodes, []);
  assert.equal(anime.episodeCount, null);
  assert.equal(anime.coverImage, "/placeholder.svg");
  assert.equal(resolveId("attack-on-titan"), "16498");
});
test("search, genre, status, sort, and page become upstream query parameters", () => {
  const path = searchPath(
    new URLSearchParams(
      "search=one+piece&genre=Action&status=Completed&sort=year&page=3",
    ),
    [{ mal_id: 1, name: "Action" }],
  );
  const params = new URL(`https://example.test${path}`).searchParams;
  assert.equal(params.get("q"), "one piece");
  assert.equal(params.get("genres"), "1");
  assert.equal(params.get("status"), "complete");
  assert.equal(params.get("order_by"), "start_date");
  assert.equal(params.get("page"), "3");
  assert.equal(params.get("limit"), "24");
  assert.equal(
    new URL(
      `https://example.test${searchPath(new URLSearchParams("page=-2"), [])}`,
    ).searchParams.get("page"),
    "1",
  );
});
test("requests deduplicate and cache successes", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/jikan/test-cache');
    calls++;
    return Response.json({ data: [] });
  };
  try {
    await Promise.all([
      jikanRequest("/test-cache"),
      jikanRequest("/test-cache"),
    ]);
    await jikanRequest("/test-cache");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

let instance = 0;
async function isolatedCatalog() {
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#instance-${++instance}`);
}
test('Cloudflare rate limits and outages recover through the public CORS catalog', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [429, 502, 503, 504, 0]) {
      const { jikanRequest: request } = await isolatedCatalog();
      const calls = [];
      globalThis.fetch = async (url, options) => {
        calls.push(url);
        if (url.startsWith('/api/')) {
          if (!status) throw new TypeError('Network failure');
          return new Response('', { status, headers: { 'Retry-After': '60' } });
        }
        const target = new URL(url);
        assert.equal(target.origin, 'https://api.tenrai.org');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.referrerPolicy, 'no-referrer');
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers, undefined, 'No session headers or server keys go to the public API');
        assert.equal(target.searchParams.get('sfw'), 'true');
        return Response.json({ data: [{ mal_id: 21 }] });
      };
      const path = '/top/anime?limit=10&sfw=false';
      const results = await Promise.all([request(path), request(path)]);
      assert.equal(results[0].data[0].mal_id, 21);assert.equal(calls.length, 2);
      await request(path);assert.equal(calls.length, 2, 'Fallback successes share the existing cache');
      await request('/seasons/2026/fall?limit=10');
      assert.equal(calls.length, 3);assert.match(calls[2], /^https:\/\/api.tenrai.org\/v1\/seasons\/2026\/fall/);
    }
  } finally { globalThis.fetch = original; }
});
test('authentication failures and invalid requests never trigger a public fallback', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [400, 401, 403, 404]) {
      const { jikanRequest: request } = await isolatedCatalog();let calls = 0;
      globalThis.fetch = async url => { calls++;assert.match(url, /^\/api\/jikan\//);return new Response('', { status }); };
      await assert.rejects(request('/anime/21'), error => error.status === status);assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = original; }
});
test('a visitor rate limit respects Retry-After across all catalog sections', async () => {
  const original = globalThis.fetch, originalNow = Date.now;let clock = originalNow();
  try {
    Date.now = () => clock;
    const { jikanRequest: request } = await isolatedCatalog();let calls = 0;
    globalThis.fetch = async () => { calls++;return new Response('', { status: 429, headers: { 'Retry-After': '60' } }); };
    await assert.rejects(request('/top/anime'), error => error.status === 429);assert.equal(calls, 2);
    await assert.rejects(request('/seasons/2026/fall'), error => error.status === 429);assert.equal(calls, 2, 'Other sections must not retry inside the same provider limit window');
    clock += 61000;
    globalThis.fetch = async () => { calls++;return Response.json({ data: [{ mal_id: 21 }] }); };
    assert.equal((await request('/seasons/2026/fall')).data[0].mal_id, 21);assert.equal(calls, 3);
  } finally { globalThis.fetch = original;Date.now = originalNow; }
});
