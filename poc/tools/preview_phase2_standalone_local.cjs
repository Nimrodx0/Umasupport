#!/usr/bin/env node
'use strict';
/*
 * Start a local-only, nonpersistent Phase 2 editorial browser review.
 * Do not expose to other hosts: deliberately binds 127.0.0.1 only.
 * No third-party pages are fetched, no publication data is written.
 */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {buildView}=require('../src/phase2_eight_event_review_view.cjs');
const appjs=path.resolve(__dirname,'phase2_eight_event_review_client.js');
const corejs=path.resolve(__dirname,'../src/core.js');
function html(){
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phase 2 / 4SSRの非公開イベント確認</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}
body{margin:auto;padding:clamp(12px,3vw,32px);max-width:1080px;line-height:1.55}
h1{font-size:1.5rem;margin:0 0 .5rem}
.notice{padding:12px;border:1px solid currentColor;border-radius:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}
.card{border:1px solid #777;border-radius:12px;padding:16px}
.card h2{font-size:1.15rem}
.event{padding:12px 0;border-top:1px solid #777}
.event h3{font-size:1rem;margin:0 0 3px}
.sub{font-size:.82rem;opacity:.85}
.option-list{display:grid;gap:8px}
button{font:inherit;text-align:left;padding:9px;cursor:pointer;border-radius:8px;border:1px solid #777}
button[aria-pressed=true]{outline:3px solid currentColor;outline-offset:-3px;font-weight:bold}
.route-result{display:block;margin:10px 0;min-height:2em}
a{font-size:.86rem}
</style></head><body>
<h1>イベント選択肢の非公開レビュー</h1>
<p class="notice">開発専用です。効果から編集した仮表示であり、実ゲームの選択肢文面ではありません。
<span>全結果の網羅、選択操作のゲーム実証、公開許諾は未確認です。GitHub Pagesには組み込みません。</span></p>
<p id="bootstrap" role="status">数値台帳を検証しています</p>
<main id="review-root" class="grid"></main>
<script src="/core.js"></script><script src="/review.js"></script></body></html>`;
}
function makeServer(){
 return http.createServer((req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
   'Content-Security-Policy':"default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
  const reply=(code,kind,body)=>{
   res.writeHead(code,{...headers,'Content-Type':kind});res.end(body);
  };
  if(req.method!=='GET')return reply(405,'text/plain; charset=utf-8','GET only');
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/'||pathname==='/index.html')
   return reply(200,'text/html; charset=utf-8',html());
  if(pathname==='/core.js')
   return reply(200,'text/javascript; charset=utf-8',fs.readFileSync(corejs));
  if(pathname==='/review.js')
   return reply(200,'text/javascript; charset=utf-8',fs.readFileSync(appjs));
  if(pathname==='/data.json'){
   try{
    return reply(200,'application/json; charset=utf-8',JSON.stringify(buildView()));
   }catch(error){
    // The review process must fail closed without crashing the local HTTP
    // server or leaking source input. Never fall back to stale/canned data.
    return reply(503,'text/plain; charset=utf-8',
     'Nonpublic numeric review rejected: '+String(error.message));
   }
  }
  return reply(404,'text/plain; charset=utf-8','Not found');
 });
}
function main(args){
 if(args.length>1||args.length===1&&!/^--port=\d+$/.test(args[0]))
  throw Error('usage: node poc/tools/preview_phase2_standalone_local.cjs [--port=8765]');
 const port=args.length?Number(args[0].slice('--port='.length)):8765;
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('port out of range');
 const server=makeServer();
 server.listen(port,'127.0.0.1',()=>{
  console.log('LOCAL-ONLY editorial review: http://127.0.0.1:'+port);
  console.log('UNAPPROVED. No public event JSON or approvals changed.');
 });
 return server;
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={makeServer,main,html};
