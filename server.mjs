import {migrateProgression} from './canon.mjs';
import {canonicalEncounter,campaignQuest} from './prototype.mjs';
import {applyRequest} from './requests.mjs';
import {prepareClan,recordClanProgress} from './clanworks.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { newPlayer as newLegacyPlayer,newCanonicalPlayer, derived, cities, items, opponents, quests } from './game.mjs';
const newPlayer=process.env.SICH_RULESET==='legacy'?newLegacyPlayer:newCanonicalPlayer;
import { action, migrate, clanAction, duelAction, advanceDuels, advanceBattles, worldSnapshot } from './world.mjs';
import {marketAction,marketSnapshot,expireMarket} from './market.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.GAME_DATA_DIR||path.join(root,'data');
fs.mkdirSync(dataDir,{recursive:true});
const dbFile=path.join(dataDir,'game.json');
let db=fs.existsSync(dbFile)?JSON.parse(fs.readFileSync(dbFile,'utf8')):{version:1,players:{},accounts:{},sessions:{},chat:[]};
db.clans??={};db.duels??={};for(const c of Object.values(db.clans))prepareClan(c);for(const p of Object.values(db.players))migrate(p);
function save(next=db){if(next!==db)recordClanProgress(db,next);next.revision=(db.revision||0)+1;const tmp=dbFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2),'utf8');fs.renameSync(tmp,dbFile);db=next;}
const SESSION_MS=30*24*60*60*1000;
function session(req,res){
  const token=/\bvm_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
  let s=token&&db.sessions[token];
  if(s&&s.expires>Date.now()&&db.players[s.player])return s;
  const id=randomBytes(32).toString('hex'),p=newPlayer();
  db.players[p.id]=p;s={player:p.id,expires:Date.now()+SESSION_MS};db.sessions[id]=s;
  for(const [key,v] of Object.entries(db.sessions))if(v.expires<Date.now())delete db.sessions[key];
  res.setHeader('Set-Cookie',`vm_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);save();return s;
}
function newSession(res,id){const token=randomBytes(32).toString('hex');db.sessions[token]={player:id,expires:Date.now()+SESSION_MS};res.setHeader('Set-Cookie',`vm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);save();}
function snapshot(p){migrate(p);const clanId=p.clanId;return {build:'prototype-0.3.0-20261101',serverTime:Date.now(),revision:db.revision||0,player:{...p,actionReceipts:undefined,journey:p.journey?{...p.journey,events:undefined,pending:undefined}:null},derived:derived(p),cities,items:items.filter(i=>!i.canonical||p.inventory.includes(i.id)),opponents:opponents.filter(e=>p.canonVersion?p.level>0||e.training:!e.training).map(e=>p.canonVersion?canonicalEncounter(e):e),quests:quests.filter(q=>p.canonVersion||!q.id.startsWith('intro_')).map(q=>p.canonVersion?campaignQuest(q):q),...worldSnapshot(db,p),...marketSnapshot(db,p),registered:Object.values(db.accounts).some(a=>a.player===p.id),rankings:Object.values(db.players).filter(x=>Object.values(db.accounts).some(a=>a.player===x.id)||x.id===p.id).sort((a,b)=>b.wins-a.wins||b.level-a.level).slice(0,20).map(x=>({id:x.id,name:x.name,level:x.level,wins:x.wins,losses:x.losses})),chat:db.chat.filter(m=>!m.channel||m.channel==='city'||m.channel==='trade'||m.channel==='clan'&&clanId&&m.clanId===clanId||m.channel==='private'&&(m.from===p.id||m.to===p.id)).slice(-60)};}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const limits=new Map();
function allow(key,max){const now=Date.now();let v=limits.get(key);if(!v||v.until<now){v={count:0,until:now+60000};limits.set(key,v);}return ++v.count<=max;}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Метод не підтримується.'});
      if(!allow(req.socket.remoteAddress,600))return json(res,429,{error:'Забагато запитів. Спробуйте за хвилину.'});
      if(req.method==='POST'){
        const origin=req.headers.origin;
        if(origin&&origin!==`http://${req.headers.host}`)return json(res,403,{error:'Запит з іншого сайту відхилено.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Потрібен JSON.'});
      }
      if(Object.values(db.market||{}).some(l=>l.status==='active'&&l.expiresAt<=Date.now())||Object.values(db.duels||{}).some(d=>d.status==='active'&&(!d.deadline||Date.now()>=d.deadline))||Object.values(db.players||{}).some(p=>p.battle&&!p.battle.result&&(!p.battle.deadline||Date.now()>=p.battle.deadline))){const expired=structuredClone(db);expireMarket(expired);advanceDuels(expired);advanceBattles(expired);save(expired);}
      const s=session(req,res);let p=migrate(db.players[s.player]);if(process.env.SICH_RULESET!=='legacy'&&!p.canonVersion&&!p.duelId&&(!p.battle||p.battle.result)){migrateProgression(p);migrate(p);save();}p.lastSeen=Date.now();
      if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,snapshot(p));
      if(req.method!=='POST')return json(res,404,{error:'Сторінку не знайдено.'});
      let raw='';for await(const chunk of req){raw+=chunk; if(Buffer.byteLength(raw)>8192)return json(res,413,{error:'Запит завеликий.'});}
      let body;try{body=JSON.parse(raw);}catch{return json(res,400,{error:'Некоректні дані.'});}
      if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Некоректні дані.'});
      p=migrate(db.players[s.player]);
      if(['/api/market','/api/action','/api/clan','/api/duel'].includes(url.pathname)){
        const transaction=structuredClone(db);applyRequest(transaction,transaction.players[p.id],url.pathname,body);save(transaction);p=db.players[p.id];
      }else if(url.pathname==='/api/register'){
        if(!allow('auth:'+req.socket.remoteAddress,15))return json(res,429,{error:'Забагато спроб входу. Зачекайте хвилину.'});
        const name=String(body.name||'').trim(),password=String(body.password||'');
        if(!/^[\p{L}\p{N}_ -]{3,24}$/u.test(name))throw new Error('Ім’я: 3–24 літери, цифри, пробіли, дефіс або підкреслення.');
        if(password.length<8||password.length>128)throw new Error('Пароль має містити від 8 до 128 символів.');
        if(Object.values(db.accounts).some(a=>a.player===p.id))throw new Error('Цьому персонажу вже належить обліковий запис.');
        const key=name.toLocaleLowerCase('uk-UA');if(db.accounts[key])throw new Error('Це ім’я вже зайняте.');
        const salt=randomBytes(16).toString('hex');db.accounts[key]={player:p.id,salt,hash:scryptSync(password,salt,64).toString('hex')};p.name=name;save();
      }else if(url.pathname==='/api/login'){
        if(!allow('auth:'+req.socket.remoteAddress,15))return json(res,429,{error:'Забагато спроб входу. Зачекайте хвилину.'});
        const a=db.accounts[String(body.name||'').trim().toLocaleLowerCase('uk-UA')],password=String(body.password||'');
        if(password.length>128)throw new Error('Неправильне ім’я або пароль.');
        const hash=scryptSync(password,a?.salt||'invalid-salt',64);
        if(!a||!timingSafeEqual(hash,Buffer.from(a.hash,'hex')))return json(res,401,{error:'Неправильне ім’я або пароль.'});
        p=db.players[a.player];newSession(res,p.id);
      }else if(url.pathname==='/api/logout'){
        const token=/\bvm_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];if(token)delete db.sessions[token];
        p=newPlayer();db.players[p.id]=p;newSession(res,p.id);
      }else if(url.pathname==='/api/chat'){
        if(!allow('chat:'+p.id,12))return json(res,429,{error:'Повідомлення надходять надто швидко.'});
        const message=String(body.message||'').trim();if(message.length<1||message.length>300)throw new Error('Повідомлення: від 1 до 300 символів.');
        const channel=body.channel||'city';if(!['city','trade','clan','private'].includes(channel))throw new Error('Невідомий канал.');if(channel==='clan'&&!p.clanId)throw new Error('Ви не у курені.');if(channel==='private'&&(!db.players[body.to]||body.to===p.id))throw new Error('Оберіть іншого персонажа.');
        db.chat.push({from:p.id,to:channel==='private'?body.to:null,channel,clanId:channel==='clan'?p.clanId:null,name:p.name,text:message,at:Date.now(),city:p.city});db.chat=db.chat.slice(-500);save();
      }else return json(res,404,{error:'Невідома дія.'});
      return json(res,200,snapshot(p));
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
    let rel=decodeURIComponent(url.pathname);if(rel==='/')rel='/index.html';
    const file=path.resolve(root,'public','.'+rel),pub=path.join(root,'public')+path.sep;
    if(!file.startsWith(pub)){res.writeHead(403);return res.end();}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Не знайдено');}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch(error){if(!res.headersSent)json(res,400,{error:error.message||'Помилка запиту.'});else res.end();}
});
server.listen(process.env.PORT===undefined?3000:Number(process.env.PORT),'127.0.0.1',()=>console.log(`Січ: доба шаблі — http://localhost:${server.address().port}\nЗбереження: ${dbFile}\nЗупинити: Ctrl+C`));
