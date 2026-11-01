import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP: одночасні покупці не дублюють товар; паралельне отримання не дублює виручку; перезапуск зберігає угоду',{timeout:30000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sich-market-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,SICH_RULESET:'legacy',PORT:'0',GAME_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let out='';child.stdout.on('data',x=>{out+=x;const m=out.match(/localhost:(\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});child.once('error',reject);child.once('exit',code=>reject(new Error('Сервер завершився: '+code)));});}
 async function stop(){if(child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
 function client(){let cookie='';return async(url='/api/state',body)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};};}
 await start();const a=client(),b=client(),c=client();
 try{
  await a();await b();await c();let result=await a('/api/action',{type:'faction',faction:'commonwealth'});const uid=result.data.player.instances.find(i=>i.item==='helmet').uid;
  result=await a('/api/action',{type:'forge',instance:uid});assert.equal(result.status,200);const gold=result.data.player.gold,sellerId=result.data.player.id;
  result=await a('/api/market',{type:'list',kind:'item',instance:uid,price:200,hours:12});assert.equal(result.status,200);const lot=result.data.market.mine[0];
  const race=await Promise.all([b('/api/market',{type:'buy',id:lot.id}),c('/api/market',{type:'buy',id:lot.id})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);
  const bs=(await b()).data.player,cs=(await c()).data.player;assert.equal([bs,cs].filter(p=>p.instances.some(i=>i.uid===uid&&i.rank===1)).length,1);assert.equal(bs.gold+cs.gold,280);
  result=await a();assert.equal(result.data.player.gold,gold);const receipt=result.data.market.deliveries[0];
  const claims=await Promise.all([a('/api/market',{type:'claim',id:receipt.id}),a('/api/market',{type:'claim',id:receipt.id})]);assert.deepEqual(claims.map(r=>r.status).sort(),[200,400]);assert.equal((await a()).data.player.gold,gold+190);
  await stop();await start();result=await a();assert.equal(result.data.player.id,sellerId);assert.equal(result.data.player.gold,gold+190);assert.equal(result.data.market.deliveries.length,0);assert.equal(result.data.market.mine[0].status,'sold');
  const disk=JSON.parse(await fs.readFile(path.join(dir,'game.json'),'utf8'));assert.equal(disk.marketFees,10);assert.equal(Object.values(disk.players).flatMap(p=>p.instances).filter(i=>i.uid===uid).length,1);
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
});
