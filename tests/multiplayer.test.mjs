import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP: двоє учасників дуелі, курінь, приватність каналів і збереження',{timeout:30000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sich-multiplayer-'));let processHandle,base;
 async function start(){processHandle=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,SICH_RULESET:'legacy',PORT:'0',GAME_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let out='';processHandle.stdout.on('data',x=>{out+=x;const m=out.match(/localhost:(\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});processHandle.once('error',reject);});}
 async function stop(){const exited=new Promise(r=>processHandle.once('exit',r));processHandle.kill();await exited;}
 function client(){let cookie='';return async(endpoint='/api/state',body)=>{const r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};}
 await start();const a=client(),b=client(),c=client();
 try{
  const pa=(await a()).player,pb=(await b()).player;await c();
  let s=await a('/api/action',{type:'faction',faction:'cossacks'});assert.equal(s.factions.length,5);assert.equal(s.contracts.length,12);
  s=await a('/api/duel',{type:'create'});const id=s.duel.id;await b('/api/duel',{type:'join',id});
  const move={type:'turn',attack:3,block:0,stance:'attack'};s=await a('/api/duel',move);assert.equal(s.duel.submitted,true);
  s=await b();assert.equal(s.duel.submitted,false);assert.equal('moves' in s.duel,false);s=await b('/api/duel',move);assert.equal(s.duel.round,1);
  s=await b('/api/duel',{type:'surrender'});assert.equal(s.duel.winner,pa.id);await a('/api/duel',{type:'leave'});await b('/api/duel',{type:'leave'});
  await a('/api/action',{type:'claim',quest:'first'});await a('/api/action',{type:'buy',item:'potion'});s=await a('/api/action',{type:'claim',quest:'merchant'});assert.ok(s.player.level>=2);
  s=await a('/api/clan',{type:'create',name:'Тестовий курінь'});const clan=s.player.clanId;await b('/api/clan',{type:'join',id:clan});await a('/api/clan',{type:'donate',amount:10});
  await a('/api/chat',{message:'Лише курінь',channel:'clan'});await a('/api/chat',{message:'Особисте слово',channel:'private',to:pb.id});
  s=await b();assert.ok(s.chat.some(m=>m.text==='Лише курінь'));assert.ok(s.chat.some(m=>m.text==='Особисте слово'));assert.equal(s.clans[0].treasury,10);
  s=await c();assert.equal(s.chat.some(m=>m.text==='Лише курінь'||m.text==='Особисте слово'),false);
  await stop();await start();s=await b();assert.equal(s.player.id,pb.id);assert.equal(s.player.clanId,clan);assert.ok(s.chat.some(m=>m.text==='Особисте слово'));
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
});
