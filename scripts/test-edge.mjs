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
async function api(route,token='',body){
 const headers={Origin:'https://vitalikjukivskiy.github.io',...(token?{'X-Sich-Session':token}:{}),...(body?{'Content-Type':'application/json'}:{})};
 const req=new Request(`https://example.supabase.co/functions/v1/sich-api${route}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
 const res=await handler(req),data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return {token:res.headers.get('X-Sich-Session'),data};
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
console.log('EDGE INTEGRATION PASS | first player, second player, faction, register/login, chat, persisted shared world | revision='+db.revision);
globalThis.fetch=oldFetch;
