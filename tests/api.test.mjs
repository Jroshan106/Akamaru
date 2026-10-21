import { testEnv, authenticatedFetch } from './helpers/session.mjs';
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const base = "http://127.0.0.1:4107";
let server;
let request;
before(async () => {
  server = spawn(process.execPath, ["server/dist/server.js"], {
    env: { ...process.env, ...testEnv, PORT: "4107" },
    stdio: "pipe",
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) { request = await authenticatedFetch(base); return; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not start");
});
after(() => server?.kill());
test("catalog, combined filters, and malformed query values", async () => {
  const all = await (await request(`${base}/api/anime`)).json();
  assert.equal(all.length, 6);
  const filtered = await (
    await request(`${base}/api/anime?search=titan&genre=Action&status=Completed`)
  ).json();
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "attack-on-titan");
  assert.equal(
    (await request(`${base}/api/anime?search[x]=test&genre=Action&genre=Comedy`))
      .status,
    200,
  );
  assert.deepEqual(
    await (await request(`${base}/api/anime?search=nonexistenttitle`)).json(),
    [],
  );
});
test("episode retrieval and missing resource responses", async () => {
  const response = await (
    await request(`${base}/api/anime/attack-on-titan/episodes/aot-1`)
  ).json();
  assert.equal(response.episode.number, 1);
  for (const route of [
    "/api/anime/missing",
    "/api/anime/attack-on-titan/episodes/missing",
    "/api/missing",
  ])
    assert.equal((await request(base + route)).status, 404);
});
test("production serves the app for deep links", async () => {
  for (const route of [
    "/",
    "/browse",
    "/anime/attack-on-titan",
    "/watch/attack-on-titan/aot-1",
  ]) {
    const response = await request(base + route);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<div id="root">/);
  }
});
