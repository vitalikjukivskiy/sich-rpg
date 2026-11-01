import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newCanonicalPlayer,award} from '../game.mjs';
test('canonical HTTP: real prices, cents, item escrow, racing buyers, duel gates, no surrender farming and restart',{timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sich-canon-http-')),a=newCanonicalPlayer('Остап'),b=newCanonicalPlayer('Тарас'),tokenA='a'.repeat(64),tokenB='b'.repeat(64);award(a,200,0);award(b,200,0);
 await writeFile(join(dir,'game.json'),JSON.stringify({revision:0,players:{[a.id]:a,[b.id]:b},sessions:{[tokenA]:{player:a.id,expires:Date.now()+1000000},[tokenB]:{player:b.id,expires:Date.now()+1000000}},accounts:{},chat:[],duels:{},clans:{}}));
 let child,base;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,SICH_RULESET:'canon',PORT:'0',GAME_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let text='';child.stdout.on('data',data=>{text+=data;const match=text.match(/localhost:(\d+)/);if(match)resolve('http://127.0.0.1:'+match[1]);});child.once('error',reject);child.once('exit',code=>reject(new Error('Server exit '+code)));});}
 async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}
 async function api(path,token,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Cookie:'vm_session='+token}:{})},body:body?JSON.stringify({...body,requestId:body.requestId||crypto.randomUUID()}):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0].split('=')[1]};}
 try{
  await start();let fresh=await api('/api/state');assert.equal(fresh.data.player.level,0);assert.equal(fresh.data.player.gold,6);assert.equal(fresh.data.player.points,3);assert.equal(fresh.data.derived.nextXp,50);const freshToken=fresh.cookie;
  const catalog=await fetch(base+'/canon-data.js');assert.equal(catalog.status,200);assert.match(await catalog.text(),/export const catalog=rows.map/);assert.equal((await fetch(base+'/canon.mjs')).status,404);
  assert.equal((await api('/api/duel',freshToken,{type:'create'})).status,400);
  let r=await api('/api/action',tokenA,{type:'buy',item:'canon_kn-1',gold:999999});assert.equal(r.status,200);assert.equal(r.data.player.gold,24);const knife=r.data.player.instances[0];
  assert.equal((await api('/api/action',tokenA,{type:'equip',instance:knife.uid})).status,400);
  for(const stat of ['agility','agility','intuition','intuition'])assert.equal((await api('/api/action',tokenA,{type:'stat',stat})).status,200);
  r=await api('/api/action',tokenA,{type:'equip',instance:knife.uid});assert.equal(r.data.derived.minDamage,6);assert.equal(r.data.derived.maxDamage,8);assert.equal(r.data.derived.crit,19);
  r=await api('/api/action',tokenB,{type:'buy',item:'canon_cas-5'});const caster=r.data.player.instances[0];assert.equal(r.data.player.gold,35);
  const listing=await api('/api/market',tokenB,{type:'list',kind:'item',instance:caster.uid,price:5.25,hours:12});assert.equal(listing.status,200);const lot=listing.data.market.mine[0];assert.equal(lot.fee,.27);assert.equal(lot.net,4.98);
  const race=await Promise.all([api('/api/market',tokenA,{type:'buy',id:lot.id}),api('/api/market',freshToken,{type:'buy',id:lot.id})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);const winner=race.find(r=>r.status===200);assert.equal(winner.data.player.instances.filter(i=>i.uid===caster.uid).length,1);
  const sale=await api('/api/state',tokenB),receipt=sale.data.market.deliveries[0];assert.equal(receipt.amount,4.98);const claim={type:'claim',id:receipt.id,requestId:'11111111-2222-3333-4444-555555555555'};
  const claims=await Promise.all([api('/api/market',tokenB,claim),api('/api/market',tokenB,claim)]);assert.ok(claims.every(r=>r.status===200));assert.equal(claims[1].data.player.gold,39.98);
  const states=await Promise.all([tokenA,tokenB,freshToken].map(token=>api('/api/state',token)));assert.equal(Math.round(states.reduce((n,r)=>n+r.data.player.gold,0)*100),6473);
  let duel=await api('/api/duel',tokenA,{type:'create'});assert.equal(duel.status,200);duel=await api('/api/duel',tokenB,{type:'join',id:duel.data.duel.id});assert.equal(duel.status,200);assert.ok(duel.data.duel.deadline-duel.data.serverTime>=599000&&duel.data.duel.deadline-duel.data.serverTime<=600000);assert.equal(duel.data.duel.moves,undefined);
  const before=await api('/api/state',tokenA);await api('/api/duel',tokenB,{type:'surrender'});const after=await api('/api/state',tokenA);assert.equal(after.data.player.gold,before.data.player.gold);assert.equal(after.data.player.xp,before.data.player.xp);assert.equal(after.data.duel.winner,a.id);
  await api('/api/duel',tokenA,{type:'leave'});await api('/api/duel',tokenB,{type:'leave'});const gold=after.data.player.gold;await stop();await start();r=await api('/api/state',tokenA);assert.equal(r.data.player.id,a.id);assert.equal(r.data.player.gold,gold);assert.equal(r.data.player.canonVersion,1);assert.equal(r.data.player.xp,200);assert.equal(r.data.player.equipment.weapon,'canon_kn-1');assert.equal((await api('/api/market',tokenB,claim)).data.player.gold,39.98);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
