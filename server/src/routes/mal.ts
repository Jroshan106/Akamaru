import { Router, Request, Response } from 'express';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

type Session = { access: string; refresh: string; expires: number };
type Config = { clientId: string; clientSecret: string; redirect: string; key: string };
export function createMalRouter(fetcher: typeof fetch = fetch, config?: Config) {
  const router = Router();
  const cfg = () => config || { clientId:process.env.MAL_CLIENT_ID || '', clientSecret:process.env.MAL_CLIENT_SECRET || '', redirect:process.env.MAL_REDIRECT_URI || '', key:process.env.MAL_COOKIE_KEY || '' };
  function configured() {
    try { const c=cfg(), u=new URL(c.redirect); return !!c.clientId && !!c.clientSecret && /^[a-f0-9]{64}$/i.test(c.key) && (u.protocol==='https:' || (u.protocol==='http:' && u.hostname==='localhost')) && u.pathname==='/api/mal/callback'; } catch { return false; }
  }
  function seal(value: object) {
    const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(cfg().key,'hex'),iv);
    const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');
  }
  function read<T>(req: Request, name:string): T | null {
    try {
      const raw=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1);
      if (!raw || raw.length>5000) return null;
      const data=Buffer.from(raw,'base64url');
      const decipher=createDecipheriv('aes-256-gcm',Buffer.from(cfg().key,'hex'),data.subarray(0,12));
      decipher.setAuthTag(data.subarray(12,28));
      return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'));
    } catch { return null; }
  }
  function cookie(res:Response, name:string, value:string, seconds:number) {
    res.cookie(name,value,{httpOnly:true,secure:cfg().redirect.startsWith('https:'),sameSite:'lax',path:'/api/mal',maxAge:seconds*1000});
  }
  async function tokens(params:URLSearchParams) {
    params.set('client_id',cfg().clientId); params.set('client_secret',cfg().clientSecret);
    const response=await fetcher('https://myanimelist.net/v1/oauth2/token',{method:'POST',body:params,signal:AbortSignal.timeout(10000),redirect:'manual'});
    if (!response.ok) throw new Error('MyAnimeList sign-in expired. Please reconnect.');
    const data=await response.json() as {access_token:string;refresh_token:string;expires_in:number};
    if (typeof data.access_token!=='string' || typeof data.refresh_token!=='string' || !Number.isFinite(data.expires_in)) throw new Error('Invalid sign-in response.');
    return {access:data.access_token,refresh:data.refresh_token,expires:Date.now()+data.expires_in*1000} as Session;
  }
  async function session(req:Request,res:Response) {
    let value=read<Session>(req,'akamaru_mal');
    if (!value?.access || !value.refresh) throw new Error('Connect MyAnimeList to track this anime.');
    if (value.expires<Date.now()+60000) {
      value=await tokens(new URLSearchParams({grant_type:'refresh_token',refresh_token:value.refresh}));
      cookie(res,'akamaru_mal',seal(value),30*86400);
    }
    return value;
  }
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  router.get('/status',(req,res)=>res.json({configured:configured(),connected:configured() && !!read<Session>(req,'akamaru_mal')?.access}));
  router.use((_req,res,next)=>{if (!configured()) {res.status(503).json({error:'MyAnimeList linking is not configured yet.'});return;} next();});
  router.get('/connect',(req,res)=>{
    const id=typeof req.query.anime==='string' && /^[1-9]\d*$/.test(req.query.anime) ? req.query.anime : '';
    const state=randomBytes(24).toString('base64url'), verifier=randomBytes(48).toString('base64url');
    cookie(res,'akamaru_mal_oauth',seal({state,verifier,id,expires:Date.now()+600000}),600);
    const query=new URLSearchParams({response_type:'code',client_id:cfg().clientId,redirect_uri:cfg().redirect,state,code_challenge:verifier,code_challenge_method:'plain'});
    res.redirect(`https://myanimelist.net/v1/oauth2/authorize?${query}`);
  });
  router.get('/callback',async (req,res)=>{
    const flow=read<{state:string;verifier:string;id:string;expires:number}>(req,'akamaru_mal_oauth');
    cookie(res,'akamaru_mal_oauth','',0);
    if (!flow || flow.expires<Date.now() || req.query.state!==flow.state || typeof req.query.code!=='string') {res.status(400).send('MyAnimeList sign-in was cancelled or expired. Return to Akamaru and reconnect.');return;}
    try {
      const value=await tokens(new URLSearchParams({grant_type:'authorization_code',code:req.query.code,code_verifier:flow.verifier,redirect_uri:cfg().redirect}));
      cookie(res,'akamaru_mal',seal(value),30*86400);
      res.redirect(flow.id ? `/anime/${flow.id}?mal=connected` : '/watchlist');
    } catch { res.status(502).send('MyAnimeList sign-in failed. Return to Akamaru and try again.'); }
  });
  router.use((req,res,next)=>{
    if (req.method!=='GET' && (req.get('Origin')!==new URL(cfg().redirect).origin || req.get('X-Akamaru-Request')!=='tracking')) {res.status(403).json({error:'Invalid request origin.'});return;}
    next();
  });
  router.post('/disconnect',(_req,res)=>{cookie(res,'akamaru_mal','',0);res.json({connected:false});});
  router.get('/anime/:id',async(req,res)=>{
    if (!/^[1-9]\d*$/.test(req.params.id)) {res.status(400).json({error:'Invalid anime ID.'});return;}
    try {
      const value=await session(req,res);
      const response=await fetcher(`https://api.myanimelist.net/v2/anime/${req.params.id}?fields=my_list_status,num_episodes`,{headers:{Authorization:`Bearer ${value.access}`},signal:AbortSignal.timeout(10000),redirect:'manual'});
      if (!response.ok) {res.status(response.status===401 ? 401 : 502).json({error:'Could not read your MyAnimeList entry. Reconnect or try again.'});return;}
      const data=await response.json() as {my_list_status?:unknown;num_episodes?:number}; res.json({entry:data.my_list_status || null,total:data.num_episodes || 0});
    } catch(e) {res.status(401).json({error:e instanceof Error ? e.message : 'Reconnect MyAnimeList.'});}
  });
  router.patch('/anime/:id',async(req,res)=>{
    const {status,episodes,score}=req.body || {};
    if (!/^[1-9]\d*$/.test(req.params.id) || !['watching','completed','on_hold','dropped','plan_to_watch'].includes(status) || !Number.isInteger(episodes) || episodes<0 || episodes>100000 || !Number.isInteger(score) || score<0 || score>10) {res.status(400).json({error:'Choose a valid status, episode count, and score.'});return;}
    try {
      const value=await session(req,res);
      const response=await fetcher(`https://api.myanimelist.net/v2/anime/${req.params.id}/my_list_status`,{method:'PATCH',headers:{Authorization:`Bearer ${value.access}`},body:new URLSearchParams({status,num_watched_episodes:String(episodes),score:String(score)}),signal:AbortSignal.timeout(10000),redirect:'manual'});
      if (!response.ok) {res.status(response.status===401 ? 401 : 502).json({error:'MyAnimeList did not save the update. Please retry or reconnect.'});return;}
      res.json({entry:await response.json()});
    } catch(e) {res.status(401).json({error:e instanceof Error ? e.message : 'Reconnect MyAnimeList.'});}
  });
  return router;
}
export default createMalRouter();
