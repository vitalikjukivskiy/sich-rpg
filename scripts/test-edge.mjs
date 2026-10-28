// End-to-end verification of the Supabase HTTP adapter without cloud credentials.
import assert from 'node:assert/strict';
const db={revision:0,world:{version:1,revision:0,players:{},accounts:{},sessions:{},chat:[],clans:{},duels:{},market:{}}};
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,init={})=>{
 if(!String(url).includes('/rest/v1/sich_game_state'))throw new Error('Unexpected URL '+url);
 if(!init.method||init.method==='GET')return Response.json([{...db}]);
 if(init.method==='PATCH'){
  const expect=Number(new URL(url).searchParams.get('revision')?.slice(3));
  if(expect!==db.revision)return Response.json([]);
  Object.assign(db,JSON.parse(init.body));return Response.json([{revision:db.revision}]);
 }
 throw new Error('Unexpected method');
};
globalThis.Deno={env:{get:(key)=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'dev-secret-key'})[key]},serve:(handler)=>{globalThis.handler=handler}};
await import('../supabase/functions/sich-api/index.ts');
async function api(route,token='',body,expectedStatus=200){
 const headers={Origin:'https://vitalikjukivskiy.github.io',...(token?{'X-Sich-Session':token}:{}),...(body?{'Content-Type':'application/json'}:{})};
 const req=new Request(`https://example.supabase.co/functions/v1/sich-api${route}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
 const res=await handler(req),data=await res.json();assert.equal(res.status,expectedStatus,JSON.stringify(data));return {token:res.headers.get('X-Sich-Session'),data};
}
const one=await api('/api/state');
assert.ok(one.token&&one.token.length===64);
assert.equal(one.data.player.level,1);
assert.ok(one.data.items.length>5);
assert.ok(one.data.cities.length>=5);
const two=await api('/api/state');assert.notEqual(two.token,one.token);
const a=await api('/api/action',one.token,{type:'faction',faction:'cossacks'});assert.equal(a.data.player.faction,'cossacks');
const b=await api('/api/register',one.token,{name:'Тестовий козак',password:'super-secret-pass'});assert.equal(b.data.registered,true);
const logged=await api('/api/login',two.token,{name:'Тестовий козак',password:'super-secret-pass'});assert.equal(logged.data.player.name,'Тестовий козак');
await api('/api/chat',logged.token,{message:'Слава Січі!'});
const chat=await api('/api/state',one.token);assert.ok(chat.data.chat.some(m=>m.text==='Слава Січі!'));
const repeat={type:'buy',item:'potion',requestId:'01234567-89ab-cdef-0123-456789abcdef'};
const bought=await api('/api/action',one.token,repeat),again=await api('/api/action',one.token,repeat);
assert.equal(again.data.player.gold,bought.data.player.gold);assert.equal(again.data.player.instances.length,bought.data.player.instances.length);
assert.equal(again.data.player.actionReceipts,undefined);
const three=await api('/api/state'),four=await api('/api/state');
const parallel=await Promise.all([api('/api/action',three.token,{type:'buy',item:'potion'}),api('/api/action',four.token,{type:'buy',item:'potion'})]);
assert.ok(parallel.every(x=>x.data.player.gold===215));
const duel=await api('/api/duel',three.token,{type:'create'});await api('/api/duel',four.token,{type:'join',id:duel.data.duel.id});
const move={type:'turn',attack:2,block:4,stance:'defense',round:0,battleId:duel.data.duel.id};
await Promise.all([api('/api/duel',three.token,move),api('/api/duel',four.token,move)]);
const resolved=await api('/api/state',three.token);assert.equal(resolved.data.duel.round,1);assert.equal('moves' in resolved.data.duel,false);
const clock=Date.now,baseTime=clock();
try{Date.now=()=>baseTime+70000;await api('/api/state',three.token);const presence=await api('/api/state',four.token);assert.ok(presence.data.online.some(p=>p.id===three.data.player.id));}finally{Date.now=clock;}
const timed=await api('/api/state');db.world.players[timed.data.player.id].hp=1;
await api('/api/action',timed.token,{type:'battle',enemy:'recruit'});
const oldRandom=Math.random;const lethalDeadline=db.world.players[timed.data.player.id].battle.deadline;
try{Date.now=()=>lethalDeadline;Math.random=()=>.99;await api('/api/action',timed.token,{type:'potion'},400);assert.equal(db.world.players[timed.data.player.id].hp,0);assert.equal(db.world.players[timed.data.player.id].battle.result,'loss');}finally{Date.now=clock;Math.random=oldRandom;}
console.log('EDGE INTEGRATION PASS | first player, second player, faction, register/login, chat, idempotency, concurrent CAS, simultaneous duel, hidden moves, presence heartbeat, timeout persistence on rejected action, persisted world | revision='+db.revision);
globalThis.fetch=oldFetch;
