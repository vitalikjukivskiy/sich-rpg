import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP: сесії, вхід, перевірка дій, чат, збереження після перезапуску',{timeout:30000},async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'vilni-mista-test-'));let child;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,PORT:'0',GAME_DATA_DIR:data},windowsHide:true,stdio:['ignore','pipe','pipe']});return new Promise((resolve,reject)=>{let buf='';child.stdout.on('data',b=>{buf+=b;const m=buf.match(/http:\/\/localhost:(\d+)/);if(m)resolve(`http://127.0.0.1:${m[1]}`);});child.once('error',reject);child.once('exit',code=>reject(new Error('Сервер завершився: '+code)));});}
 async function stop(){if(!child||child.exitCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}
 let base=await start(),cookie='';
 async function call(url,body,override){const r=await fetch(base+url,{...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json',Cookie:override??cookie}});if(r.headers.has('set-cookie')&&override===undefined)cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json(),headers:r.headers};}
 try{
  let r=await call('/api/state');assert.equal(r.status,200);const id=r.data.player.id;assert.ok(cookie.includes('vm_session='));
  const html=await fetch(base);assert.equal(html.status,200);assert.match(await html.text(),/lang="uk"/);
  assert.equal((await fetch(base+'/game.mjs')).status,404);assert.equal((await fetch(base+'/data/game.json')).status,404);
  r=await call('/api/register',{name:'ТестовийВоїн',password:'LocalTest-4872'});assert.equal(r.status,200);assert.equal(r.data.registered,true);
  r=await call('/api/action',{type:'buy',item:'mail',gold:999999});assert.equal(r.data.player.gold,100);
  r=await call('/api/action',{type:'equip',item:'mail'});assert.equal(r.data.derived.armor,9);
  r=await call('/api/action',{type:'sell',item:'mail'});assert.equal(r.status,400);
  r=await call('/api/chat',{message:'<script>test</script> Вітаю!'});assert.equal(r.status,200);assert.equal(r.data.chat.at(-1).text,'<script>test</script> Вітаю!');
  r=await call('/api/chat',{message:'Торгова перевірка',channel:'trade'});assert.equal(r.status,200);
  const recipient=await call('/api/state',undefined,''),recipientCookie=recipient.headers.get('set-cookie').split(';')[0];
  assert.ok(recipient.data.chat.some(m=>m.channel==='trade'&&m.text==='Торгова перевірка'));
  r=await call('/api/chat',{message:'Приватна перевірка',channel:'private',to:recipient.data.player.id});assert.equal(r.status,200);
  assert.ok((await call('/api/state',undefined,recipientCookie)).data.chat.some(m=>m.text==='Приватна перевірка'));
  const spectator=await call('/api/state',undefined,'');assert.ok(!spectator.data.chat.some(m=>m.text==='Приватна перевірка'));assert.ok(spectator.data.chat.some(m=>m.text==='Торгова перевірка'));
  r=await call('/api/state',undefined,'');assert.notEqual(r.data.player.id,id);
  const blocked=await fetch(base+'/api/action',{method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({type:'rest'})});assert.equal(blocked.status,403);
  r=await call('/api/logout',{});assert.notEqual(r.data.player.id,id);
  r=await call('/api/login',{name:'тестовийвоїн',password:'wrong-password'});assert.equal(r.status,401);
  r=await call('/api/login',{name:'ТестовийВоїн',password:'LocalTest-4872'});assert.equal(r.data.player.id,id);assert.equal(r.data.player.gold,100);
  const disk=JSON.parse(await fs.readFile(path.join(data,'game.json'),'utf8'));assert.equal(disk.players[id].gold,100);assert.ok(!JSON.stringify(disk).includes('LocalTest-4872'));
  await stop();base=await start();r=await call('/api/state');assert.equal(r.data.player.id,id);assert.equal(r.data.player.gold,100);assert.equal(r.data.derived.armor,9);assert.equal(r.data.chat.length,3);
 }finally{await stop();await fs.rm(data,{recursive:true,force:true});}
});
