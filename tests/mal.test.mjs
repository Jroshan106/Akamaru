import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createMalRouter}=require('../server/dist/routes/mal.js');
const config={clientId:'test-id',clientSecret:'test-secret',redirect:'http://localhost:4000/api/mal/callback',key:'12'.repeat(32)};
test('MAL OAuth validates state, encrypts tokens, and rejects cross-origin writes',async()=>{
 const calls=[];
 const app=express();app.use(express.json());app.use('/api/mal',createMalRouter(async(url,init)=>{
  assert.equal(init.redirect, 'manual');
  calls.push({url,init});
  if(url.includes('/token'))return Response.json({access_token:'private-access',refresh_token:'private-refresh',expires_in:3600});
  if(init?.method==='PATCH')return Response.json({status:'watching',num_episodes_watched:2});
  return Response.json({my_list_status:{status:'watching',num_episodes_watched:1},num_episodes:12});
 },config));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api/mal`;
 try{
  const start=await fetch(base+'/connect?anime=9253',{redirect:'manual'});
  const auth=new URL(start.headers.get('location'));
  assert.equal(auth.hostname,'myanimelist.net');assert.equal(auth.searchParams.get('code_challenge_method'),'plain');
  const cookie=start.headers.getSetCookie()[0].split(';')[0];
  assert.match(start.headers.getSetCookie()[0],/HttpOnly/);
  const bad=await fetch(base+'/callback?code=foo&state=wrong',{headers:{Cookie:cookie},redirect:'manual'});
  assert.equal(bad.status,400);assert.equal(calls.length,0);
  const callback=await fetch(base+`/callback?code=foo&state=${auth.searchParams.get('state')}`,{headers:{Cookie:cookie},redirect:'manual'});
  assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/anime/9253?mal=connected');
  const session=callback.headers.getSetCookie().find(s=>s.startsWith('akamaru_mal=')).split(';')[0];
  assert.ok(!session.includes('private-access'));
  assert.equal((await (await fetch(base+'/status',{headers:{Cookie:session}})).json()).connected,true);
  const body=JSON.stringify({status:'watching',episodes:2,score:8});
  const rejected=await fetch(base+'/anime/9253',{method:'PATCH',headers:{Cookie:session,Origin:'https://evil.test','Content-Type':'application/json','X-Akamaru-Request':'tracking'},body});
  assert.equal(rejected.status,403);
  const headers={Cookie:session,Origin:'http://localhost:4000','Content-Type':'application/json','X-Akamaru-Request':'tracking'};
  assert.equal((await fetch(base+'/anime/9253',{method:'PATCH',headers,body})).status,200);
  assert.equal(calls.at(-1).init.body.get('num_watched_episodes'),'2');
  assert.equal((await fetch(base+'/anime/9253',{method:'PATCH',headers,body:JSON.stringify({status:'watching',episodes:-1,score:8})})).status,400);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
