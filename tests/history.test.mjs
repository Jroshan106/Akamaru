import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
function setup(raw = '[]', blocked = false) {
 let stored = raw;
 const context = { exports: {}, require, Event, Date, window: { dispatchEvent() {} }, localStorage: { getItem() { if (blocked) throw Error('blocked'); return stored; }, setItem(_key, value) { if (blocked) throw Error('blocked'); stored = value; } } };
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../client/src/lib/history.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
 return context.exports;
}
const item = { animeId:'1', title:'Test', cover:'/placeholder.svg', episode:'1', source:'legacy' };
test('history updates the same episode without duplicates and keeps other episodes', () => {
 const h=setup(); h.recordWatch(item, 15, 100); h.recordWatch({...item, episode:'2'}, 20,100); h.recordWatch(item,40,100);
 const rows=h.readHistory(); assert.equal(rows.length,2); assert.equal(rows.find(x=>x.episode==='1').time,40);
});
test('history tolerates invalid stored data and unavailable storage', () => {
 assert.equal(setup('[null,{}]').readHistory().length,0);
 const h=setup('invalid',true); h.recordWatch(item,10,100); assert.equal(h.readHistory().length,1);
 h.recordWatch(item,NaN,100); assert.equal(h.readHistory()[0].time,10);
});
