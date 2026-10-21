import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
const { createLanguageCatalogRouter } = createRequire(import.meta.url)('../server/dist/routes/languageCatalog.js');

async function withRouter(fetcher, run) {
  const app = express(); app.use('/language', createLanguageCatalogRouter(fetcher, 0));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  try { await run(`http://127.0.0.1:${server.address().port}/language`); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
const html = `<input name="language[]" value="dub"><label><input name="genre[]" value="999">Action</label>
  <div class="ani items"><div class="item"><a class="name" data-jp="Sousou no Frieren" href="/watch/frieren/ep-1">Frieren</a></div></div>
  <ul class="pagination"><a rel="next" href="/filter?page=3">Next</a></ul>`;

test('language catalog uses real provider audio filters with genre, search, sort and pages', async () => {
  const calls = [];
  await withRouter(async (value, options) => {
    const url = new URL(value); calls.push(url); assert.equal(options.redirect, 'manual');
    if (url.hostname === 'anikototv.to') {
      assert.equal(url.searchParams.get('language[]'), 'dub');
      assert.equal(url.searchParams.get('keyword'), 'Frieren');
      assert.equal(url.searchParams.get('sort'), 'name-az');
      assert.equal(url.searchParams.get('page'), '2');
      if (calls.length === 2) assert.equal(url.searchParams.get('genre[]'), '999');
      return new Response(html);
    }
    assert.equal(url.hostname, 'api.tenrai.org'); assert.equal(url.searchParams.get('sfw'), 'true');
    return Response.json({ data: [{ mal_id: 52991, title: 'Sousou no Frieren', title_english: 'Frieren' }] });
  }, async base => {
    const url = `${base}?language=dub&genre=Action&search=Frieren&sort=title&page=2`;
    const response = await fetch(url), body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.data[0].mal_id, 52991);
    assert.equal(body.pagination.has_next_page, true);
    await fetch(url); assert.equal(calls.length, 3);
  });
});

test('language catalog rejects invalid queries, ambiguous seasons and upstream redirects', async () => {
  let calls = 0;
  await withRouter(async value => {
    calls++;
    return value.includes('anikototv') ? new Response(html) : Response.json({ data: [
      { mal_id: 1, title: 'Sousou no Frieren' }, { mal_id: 2, title: 'Sousou no Frieren' },
    ] });
  }, async base => {
    for (const query of ['language=invalid', 'language=sub&page=0', 'language=sub&sort=invalid', 'language=sub&language=dub']) {
      assert.equal((await fetch(`${base}?${query}`)).status, 400);
    }
    assert.equal(calls, 0);
    const body = await (await fetch(`${base}?language=sub`)).json();
    assert.deepEqual(body.data, []);
  });
  await withRouter(async () => new Response('private data', { status: 302, headers: { Location: 'https://evil.test' } }), async base => {
    const response = await fetch(`${base}?language=dub`);
    assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /private data|evil\.test/);
  });
});
