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
test("requests deduplicate, cache successes, and allow retry after rate limits", async () => {
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
    globalThis.fetch = async () => new Response("", { status: 429 });
    await assert.rejects(
      jikanRequest("/test-retry"),
      (error) => error.status === 429 && /wait a minute/.test(error.message),
    );
    globalThis.fetch = async () => Response.json({ data: [{ mal_id: 1 }] });
    assert.equal((await jikanRequest("/test-retry")).data[0].mal_id, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
