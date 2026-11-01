import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP: будівлі й реальний торговий внесок куреня; прихована майбутня дорога, подвійний вибір і збереження',{timeout:30000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sich-frontier-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,SICH_RULESET:'legacy',PORT:'0',GAME_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let out='';child.stdout.on('data',b=>{out+=b;const m=out.match(/localhost:(\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});child.once('error',reject);child.once('exit',c=>reject(new Error('Сервер завершився: '+c)));});}
 async function stop(){if(child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
 function client(){let cookie='';return async(url='/api/state',body,expected=200)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(expected!==null)assert.equal(r.status,expected,JSON.stringify(data));return {status:r.status,data};};}
 await start();const a=client(),b=client();
 try{
  await a();await b();await a('/api/action',{type:'faction',faction:'commonwealth'});await a('/api/action',{type:'forge',item:'sword'});await a('/api/action',{type:'claim',quest:'smith'});await a('/api/action',{type:'buy',item:'potion'});await a('/api/action',{type:'claim',quest:'merchant'});for(let i=0;i<5;i++)await a('/api/action',{type:'gather',resource:'herb'});await a('/api/action',{type:'claim',quest:'herbs'});
  let s=(await a('/api/clan',{type:'create',name:'Трактова варта'})).data;const clan=s.player.clanId;await b('/api/clan',{type:'join',id:clan});await a('/api/clan',{type:'donate',amount:210});await a('/api/clan',{type:'build',building:'infirmary'});await b('/api/clan',{type:'build',building:'watch'},400);s=(await b('/api/clan',{type:'supply',building:'infirmary'})).data;assert.equal(s.player.inventory.filter(i=>i==='potion').length,3);await b('/api/clan',{type:'supply',building:'infirmary'},400);
  s=(await a('/api/market',{type:'list',kind:'resource',resource:'ore',quantity:2,price:20,hours:12})).data;const lot=s.market.mine[0];await b('/api/market',{type:'buy',id:lot.id});s=(await a()).data;assert.equal(s.clanOrders.find(q=>q.id==='trade').progress,1);await a('/api/market',{type:'claim',id:s.market.deliveries[0].id});
  s=(await a('/api/action',{type:'roadStart',route:'river'})).data;const j=s.journey;assert.equal(s.player.journey.events,undefined);assert.equal(s.player.journey.pending,undefined);assert.ok(j.event.choices.length===3);const p=s.player,choice=j.event.choices.find(c=>!c.risk&&(!c.stat||p.stats[c.stat]>=c.minimum)&&p.gold>=Math.max(0,-(c.gold||0))&&p.energy>=Math.max(0,-(c.energy||0))&&Object.entries(c.cost||{}).every(([id,n])=>p.materials[id]>=n)&&(!c.consumePotion||p.inventory.includes('potion')));assert.ok(choice);
  const body={type:'roadChoice',journey:j.id,stage:j.stage,choice:choice.id},race=await Promise.all([a('/api/action',body,null),a('/api/action',body,null)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);const stage=(await a()).data.journey.stage;assert.equal(stage,1);
  await stop();await start();s=(await a()).data;assert.equal(s.journey.id,j.id);assert.equal(s.journey.stage,1);assert.equal(s.clanOrders.find(q=>q.id==='trade').progress,1);assert.equal(s.player.journey.events,undefined);s=(await b()).data;assert.equal(s.buildings.find(b=>b.id==='infirmary').claimed,true);
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
});
