/**
 * «Січ: доба шаблі» — повнофункціональний сервер гри для Supabase Edge.
 * Логіка всіх поєдинків, економіки, куренів, квестів і шляхів імпортована без скорочень.
 * Публічний анонімний API використовує власні стійкі токени гравців. SERVICE_ROLE_KEY
 * ніколи не передається у браузер, а постійний JSONB-стан захищений RLS.
 */
import {prepareClan,recordClanProgress} from './engine/clanworks.mjs';
import {newPlayer,derived,cities,items,opponents,quests} from './engine/game.mjs';
import {action,migrate,clanAction,duelAction,advanceDuels,worldSnapshot} from './engine/world.mjs';
import {marketAction,marketSnapshot,expireMarket} from './engine/market.mjs';

const apiOrigin=Deno.env.get('SUPABASE_URL')!;
const serviceKey=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!apiOrigin||!serviceKey)throw new Error('Немає серверного доступу до бази даних.');
const dbEndpoint=`${apiOrigin}/rest/v1/sich_game_state`;
const pagesOrigin='https://vitalikjukivskiy.github.io';
const SESSION_MS=30*24*60*60*1000;
const limits=new Map<string,{count:number,until:number}>();
const zero=()=>({version:1,revision:0,players:{},accounts:{},sessions:{},chat:[],clans:{},duels:{},market:{}});
type World=ReturnType<typeof zero>&Record<string,any>;
const hex=(buf:Uint8Array)=>Array.from(buf).map(n=>n.toString(16).padStart(2,'0')).join('');
const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
function allow(key:string,max:number){const now=Date.now();let v=limits.get(key);if(!v||v.until<now){v={count:0,until:now+60000};limits.set(key,v);}if(limits.size>15000)limits.clear();return ++v.count<=max;}
function cors(req:Request){const origin=req.headers.get('origin');if(origin!==pagesOrigin&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin||''))return null;return {'Access-Control-Allow-Origin':origin!,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Sich-Session, apikey, Authorization','Access-Control-Expose-Headers':'X-Sich-Session','Access-Control-Max-Age':'86400'};}
function response(status:number,obj:unknown,headers:Record<string,string>={}){return new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});}
function dbHeaders(extra:Record<string,string>={}){return {apikey:serviceKey,...(serviceKey.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${serviceKey}`}), 'Content-Type':'application/json',...extra};}
async function loadWorld():Promise<World>{
 const r=await fetch(`${dbEndpoint}?select=revision,world&id=eq.live`,{headers:dbHeaders(),cache:'no-store'});
 if(!r.ok)throw new Error(`Читання бази: HTTP ${r.status}`);
 const rows=await r.json();if(!rows.length)throw new Error('База гри не ініціалізована. Виконайте SQL-міграцію.');
 const db:World=rows[0].world||zero();db.revision=rows[0].revision;
 db.clans??={};db.duels??={};db.accounts??={};db.players??={};db.sessions??={};db.chat??=[];
 for(const c of Object.values(db.clans))prepareClan(c);
 for(const p of Object.values(db.players))migrate(p);
 return db;
}
async function commitWorld(before:World,next:World){
 if(next!==before)recordClanProgress(before,next);
 next.revision=before.revision+1;
 const r=await fetch(`${dbEndpoint}?id=eq.live&revision=eq.${before.revision}&select=revision`,{method:'PATCH',headers:dbHeaders({Prefer:'return=representation'}),body:JSON.stringify({revision:next.revision,world:next})});
 if(!r.ok)throw new Error(`Запис бази: HTTP ${r.status}`);
 return (await r.json()).length===1;
}
function snapshot(db:World,p:any){
 migrate(p);const clanId=p.clanId;
 const registeredIds=new Set(Object.values(db.accounts).map((a:any)=>a.player));
 return {revision:db.revision,player:{...p,journey:p.journey?{...p.journey,events:undefined,pending:undefined}:null},derived:derived(p),cities,items,opponents,quests,...worldSnapshot(db,p),...marketSnapshot(db,p),registered:registeredIds.has(p.id),rankings:Object.values(db.players).filter((x:any)=>registeredIds.has(x.id)||x.id===p.id).sort((a:any,b:any)=>b.wins-a.wins||b.level-a.level).slice(0,20).map((x:any)=>({id:x.id,name:x.name,level:x.level,wins:x.wins,losses:x.losses})),chat:db.chat.filter((m:any)=>!m.channel||m.channel==='city'||m.channel==='clan'&&clanId&&m.clanId===clanId||m.channel==='private'&&(m.from===p.id||m.to===p.id)).slice(-60)};
}
const te=new TextEncoder();
async function hashPassword(password:string,salt:string){
 const key=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:te.encode(salt),iterations:210000,hash:'SHA-256'},key,256);
 return hex(new Uint8Array(bits));
}
function sameHex(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
class ApiError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
async function perform(req:Request, route:string, body:any, incoming:string,ip:string){
 for(let attempt=0;attempt<6;attempt++){
  const db=await loadWorld(),next:World=structuredClone(db),now=Date.now();
  let dirty=false;
  if(Object.values(next.market||{}).some((l:any)=>l.status==='active'&&l.expiresAt<=now)){expireMarket(next);dirty=true;}
  if(advanceDuels(next,now))dirty=true;
  for(const hero of Object.values(next.players) as any[]){if(hero.battle&&!hero.battle.result&&hero.battle.deadline&&now>=hero.battle.deadline){action(hero,{type:'timeout'});dirty=true;}}
  let session=incoming&&next.sessions[incoming];let outgoing=incoming;
  if(!session||session.expires<=now||!next.players[session.player]){
   outgoing=randomToken();const p=newPlayer();next.players[p.id]=p;
   session={player:p.id,expires:now+SESSION_MS};next.sessions[outgoing]=session;
   for(const [k,s]of Object.entries(next.sessions) as [string,any][])if(s.expires<now)delete next.sessions[k];
   dirty=true;
  }
  let p=migrate(next.players[session.player]);p.lastSeen=now;
  if(req.method==='POST'){
   dirty=true;
   if(['/api/market','/api/action','/api/clan','/api/duel'].includes(route)){
    try{
     if(route==='/api/market')marketAction(next,p,body);
     else if(route==='/api/action')action(p,body);
     else if(route==='/api/clan')clanAction(next,p,body);
     else duelAction(next,p,body);
    }catch(error){throw new ApiError(error instanceof Error?error.message:'Невідома ігрова дія.');}
   }
   else if(route==='/api/register'){
    if(!allow(`auth:${ip}`,15))throw new ApiError('Забагато спроб входу. Зачекайте хвилину.',429);
    const name=String(body.name||'').trim(),password=String(body.password||'');
    if(!/^[\p{L}\p{N}_ -]{3,24}$/u.test(name))throw new ApiError('Ім’я: 3–24 літери, цифри, пробіли, дефіс або підкреслення.');
    if(password.length<8||password.length>128)throw new ApiError('Пароль має містити від 8 до 128 символів.');
    if(Object.values(next.accounts).some((a:any)=>a.player===p.id))throw new ApiError('Цьому персонажу вже належить обліковий запис.');
    const key=name.toLocaleLowerCase('uk-UA');if(next.accounts[key])throw new ApiError('Це ім’я вже зайняте.');
    const salt=randomToken();next.accounts[key]={player:p.id,salt,hash:await hashPassword(password,salt),algo:'pbkdf2-sha256'};p.name=name;
   }else if(route==='/api/login'){
    if(!allow(`auth:${ip}`,15))throw new ApiError('Забагато спроб входу. Зачекайте хвилину.',429);
    const a=next.accounts[String(body.name||'').trim().toLocaleLowerCase('uk-UA')],password=String(body.password||'');
    if(password.length>128)throw new ApiError('Неправильне ім’я або пароль.',401);
    const hashed=await hashPassword(password,a?.salt||'dummy-salt');
    if(!a||!sameHex(hashed,a.hash))throw new ApiError('Неправильне ім’я або пароль.',401);
    delete next.sessions[incoming];outgoing=randomToken();next.sessions[outgoing]={player:a.player,expires:now+SESSION_MS};p=next.players[a.player];
   }else if(route==='/api/logout'){
    delete next.sessions[incoming];p=newPlayer();next.players[p.id]=p;outgoing=randomToken();next.sessions[outgoing]={player:p.id,expires:now+SESSION_MS};
   }else if(route==='/api/chat'){
    if(!allow(`chat:${p.id}`,12))throw new ApiError('Повідомлення надходять надто швидко.',429);
    const message=String(body.message||'').trim();if(message.length<1||message.length>300)throw new ApiError('Повідомлення: від 1 до 300 символів.');
    const channel=body.channel||'city';if(!['city','clan','private'].includes(channel))throw new ApiError('Невідомий канал.');
    if(channel==='clan'&&!p.clanId)throw new ApiError('Ви не у курені.');
    if(channel==='private'&&(!next.players[body.to]||body.to===p.id))throw new ApiError('Оберіть іншого персонажа.');
    next.chat.push({from:p.id,to:channel==='private'?body.to:null,channel,clanId:channel==='clan'?p.clanId:null,name:p.name,text:message,at:now,city:p.city});next.chat=next.chat.slice(-500);
   }else throw new ApiError('Невідома дія.',404);
  }else if(route!=='/api/state')throw new ApiError('Сторінку не знайдено.',404);
  if(dirty){
   if(!await commitWorld(db,next))continue;
   return {state:snapshot(next,p),token:outgoing};
  }
  return {state:snapshot(db,db.players[p.id]),token:outgoing};
 }
 throw new ApiError('Світ зайнятий. Спробуйте ще раз.',409);
}
Deno.serve(async req=>{
 const headers=cors(req);if(!headers)return response(403,{error:'Доступ з іншого сайту заборонено.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(req.method))return response(405,{error:'Метод не підтримується.'},headers);
 const route=new URL(req.url).pathname.match(/\/api\/(state|action|market|clan|duel|register|login|logout|chat)$/)?.[0];
 if(!route)return response(404,{error:'Невідома адреса.'},headers);
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 if(!allow(`ip:${ip}`,600))return response(429,{error:'Забагато запитів. Спробуйте за хвилину.'},headers);
 if(req.method==='POST'&&!req.headers.get('content-type')?.startsWith('application/json'))return response(415,{error:'Потрібен JSON.'},headers);
 let body:any={};
 if(req.method==='POST'){
  const raw=await req.text();if(te.encode(raw).length>8192)return response(413,{error:'Запит завеликий.'},headers);
  try{body=JSON.parse(raw);}catch{return response(400,{error:'Некоректні дані.'},headers);}
  if(!body||typeof body!=='object'||Array.isArray(body))return response(400,{error:'Некоректні дані.'},headers);
 }
 try{
  const incoming=req.headers.get('x-sich-session')||'';
  const result=await perform(req,route,body,/^[a-f0-9]{64}$/.test(incoming)?incoming:'',ip);
  return response(200,result.state,{...headers,'X-Sich-Session':result.token});
 }catch(error){console.error('Sich API',error instanceof Error?error.message:'Unknown');return response(error instanceof ApiError?error.status:500,{error:error instanceof ApiError?error.message:'Тимчасово не вдалося звернутися до світу.'},headers);}
});
