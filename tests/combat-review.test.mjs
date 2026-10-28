import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,derived,items} from '../game.mjs';
import {action,migrate,duelAction,advanceDuels,advanceBattles,worldSnapshot} from '../world.mjs';
import {BLOCKS,CLASS_RULES,combatProfile,resolveHit,validMove,ROUND_MS,priceFloor} from '../balance.mjs';
import {addInstance} from '../inventory.mjs';
import {marketAction,marketSnapshot} from '../market.mjs';
const move={type:'turn',attack:0,block:0,stance:'attack'};
function pair(){const a=migrate(newPlayer('Остап')),b=migrate(newPlayer('Тарас'));const db={players:{[a.id]:a,[b.id]:b},duels:{}};duelAction(db,a,{type:'create'});duelAction(db,b,{type:'join',id:a.duelId});return {a,b,db,d:db.duels[a.duelId]};}
const profile=()=>({...combatProfile(newPlayer()),dodge:0,crit:0});
test('кожна пара блоків захищає саме дві з чотирьох зон, захисна стійка сильніша',()=>{
 for(let block=0;block<6;block++)for(let attack=0;attack<4;attack++){
  const a={profile:profile()},b={profile:profile(),block,stance:'attack'};
  const hit=resolveHit(a,b,{...move,attack},move,()=>.99);
  const guard=resolveHit(a,{...b,stance:'defense'},{...move,attack},move,()=>.99);
  const open=resolveHit(a,{...b,block:-1},{...move,attack},move,()=>.99);
  assert.equal(hit.blocked,BLOCKS[block].includes(attack));assert.ok(guard.damage<=hit.damage);if(hit.blocked)assert.ok(hit.damage<open.damage);
 }
});
test('захисна стійка знижує власну атаку, зберігає пасивне ухилення і не дає безсмертя',()=>{
 const a={profile:profile()},b={profile:{...profile(),dodge:20,antiCrit:0},block:-1,stance:'attack'};
 assert.ok(resolveHit(a,b,{...move,stance:'defense'},move,()=>.99).damage<resolveHit(a,b,move,move,()=>.99).damage);
 assert.equal(resolveHit(a,b,move,move,()=>.18).dodged,resolveHit(a,{...b,stance:'defense'},move,move,()=>.18).dodged);
 assert.ok(resolveHit(a,{...b,stance:'defense',block:0},move,move,()=>.99).damage>0);
});
test('молот має 4% базового криту та найсильніший антикрит згідно з повним ТЗ',()=>{const p=migrate(newPlayer());p.equipment.weapon='starter_hammer';assert.equal(combatProfile(p).crit,4);assert.equal(combatProfile(p).antiCrit,30);});
test('антиуворот молота долає шаблю; антикрит знижує шанс вхідного крита',()=>{
 const a={profile:{...profile(),crit:30,antiDodge:30}},b={profile:{...profile(),dodge:30,antiCrit:30},block:-1,stance:'attack'};
 assert.equal(resolveHit(a,b,move,move,()=>.15).dodged,false);
 assert.equal(resolveHit({...a,profile:{...a.profile,antiDodge:5}},b,move,move,()=>.15).dodged,true);
 assert.equal(resolveHit(a,b,move,move,()=>.2).crit,false);
 assert.equal(resolveHit(a,{...b,profile:{...b.profile,antiCrit:0}},move,move,()=>.2).crit,true);
});
test('пропущений хід залишає пасивне ухилення, але прибирає блок',()=>{
 const a={profile:profile()},b={profile:{...profile(),dodge:35},block:-1,stance:'attack'};
 assert.equal(resolveHit(a,b,move,null,()=>0).dodged,true);
 const {a:p,b:q,db,d}=pair();duelAction(db,p,move);const hp=d.hp[q.id];advanceDuels(db,d.deadline);assert.ok(d.hp[q.id]<=hp);assert.equal(d.hp[p.id],combatProfile(p).maxHp);assert.equal(d.round,1);
});
test('офлайн PvP рахує кожні 30 секунд, повторне читання не дублює шкоду',()=>{
 const {db,d}=pair(),at=d.deadline+2*ROUND_MS;advanceDuels(db,at);assert.equal(d.round,3);const hp={...d.hp};advanceDuels(db,at);assert.deepEqual(d.hp,hp);assert.equal(d.deadline,at+ROUND_MS);
});
test('офлайн PvE наздоганяє всі раунди, старий бій отримує дедлайн без втрати речей',t=>{
 t.mock.method(Date,'now',()=>1000000);t.mock.method(Math,'random',()=>.99);const p=migrate(newPlayer()),db={players:{[p.id]:p}};action(p,{type:'battle',enemy:'recruit'});p.battle.deadline=Date.now()-2*ROUND_MS;const n=p.instances.length;advanceBattles(db);assert.equal(p.battle.round,3);assert.ok(p.hp<100);assert.equal(p.battle.deadline,Date.now()+ROUND_MS);const hp=p.hp;advanceBattles(db);assert.equal(p.hp,hp);delete p.battle.deadline;advanceBattles(db);assert.equal(p.battle.deadline,Date.now()+ROUND_MS);assert.equal(p.instances.length,n);
});
test('не можна обійти прострочений хід настоянкою',t=>{
 t.mock.method(Date,'now',()=>1000000);const p=migrate(newPlayer());action(p,{type:'battle',enemy:'recruit'});p.hp=30;p.battle.deadline=Date.now();const before=structuredClone(p);assert.throws(()=>action(p,{type:'potion'}),/Час/);assert.equal(p.hp,before.hp);assert.equal(p.instances.length,before.instances.length);
});
test('PvP відхиляє некоректні булеві прапорці та недостатню сумарну витривалість атомарно',()=>{
 for(const value of [0,1,'',null,'true'])assert.equal(validMove({...move,ability:value}),false);
 const {a,db,d}=pair();d.stamina[a.id]=25;assert.throws(()=>duelAction(db,a,{...move,power:true,ability:true}),/витривалості/);assert.equal(d.stamina[a.id],25);assert.equal(d.moves[a.id],undefined);
});
test('прийом витрачає енергію один раз і має реальну перезарядку',()=>{
 const {a,b,db,d}=pair();duelAction(db,a,{...move,ability:true});assert.equal(d.stamina[a.id],85);assert.throws(()=>duelAction(db,a,{...move,ability:true}),/уже прийнято/);duelAction(db,b,move,()=>.99);assert.throws(()=>duelAction(db,a,{...move,ability:true}),/відновлюється/);
 for(let i=1;i<4;i++){duelAction(db,a,move);duelAction(db,b,move,()=>.99);}assert.equal(d.round,4);duelAction(db,a,{...move,ability:true});assert.equal(worldSnapshot(db,a).duel.submitted,true);
});
test('гарт та всі слоти спорядження справді впливають на PvP',()=>{
 const p=migrate(newPlayer()),before=combatProfile(p);const weapon=p.instances.find(i=>i.uid===p.equipmentInstances.weapon);weapon.rank=5;assert.ok(combatProfile(p).attack>before.attack);p.equipment.head='helmet';assert.ok(combatProfile(p).armor>before.armor);
});
test('класова броня дає бонус один раз, чужий комплект не додає класового бонусу',()=>{
 const p=migrate(newPlayer());p.equipment.weapon='starter_hammer';const before=derived(p);p.equipment.body='class_armor_hammer';assert.equal(derived(p).antiCrit-before.antiCrit,5);p.equipment.body='class_armor_sabre';assert.equal(derived(p).dodge,before.dodge);
});
test('перенавчання знімає недоступне спорядження, але не видаляє його',()=>{
 const p=migrate(newPlayer());p.level=5;p.gold=1000;p.stats.strength=12;p.stats.intuition=10;const i=addInstance(p,'hammer');action(p,{type:'equip',instance:i.uid});action(p,{type:'retrain'});assert.equal(p.equipment.weapon,undefined);assert.ok(p.instances.some(x=>x.uid===i.uid));
});
test('ціна в UI точно відповідає серверу для кожного рангу й рідкості',()=>{
 const p=migrate(newPlayer()),db={players:{[p.id]:p}};for(const id of ['starter_mace','war_mace','legend_sabre'])for(let rank=0;rank<=5;rank++){const i=addInstance(p,id,rank);const floor=priceFloor(items.find(x=>x.id===id),rank);assert.equal(marketSnapshot(db,p).market.instancePriceFloors[i.uid],floor);assert.throws(()=>marketAction(db,p,{type:'list',kind:'item',instance:i.uid,price:floor-1,hours:12}),/Мінімальна/);}
});

test('PvE та PvP використовують один resolveHit: зональна броня, пробиття піки й крит',async()=>{
 const {pveProfile,npcProfile}=await import('../game.mjs');const p=migrate(newPlayer());p.equipment.head='helmet';const full=combatProfile(p);assert.ok(full.zoneArmor[0]>full.zoneArmor[3]);
 const a={profile:{...profile(),classId:'pike'}},b={profile:profile(),block:0,stance:'defense'};assert.ok(resolveHit(a,b,{...move,ability:true},move,()=>.99).damage>resolveHit(a,b,move,move,()=>.99).damage);
 action(p,{type:'battle',enemy:'recruit'});const expected=resolveHit({profile:pveProfile(p)},{profile:npcProfile(p.battle.enemy),attack:3,block:5,stance:'attack'},{...move,attack:0},move,()=>.99);const hp=p.battle.enemy.currentHp;action(p,{...move,attack:0},()=>.99);assert.equal(hp-p.battle.enemy.currentHp,expected.damage);
});
test('булава дезорієнтує наступний хід; повторний контроль блокує імунітет',()=>{
 const a={profile:{...profile(),classId:'mace'}},b={profile:profile(),block:0,stance:'defense'};assert.equal(resolveHit(a,b,{...move,ability:true},move,()=>.99).control,true);assert.equal(resolveHit(a,{...b,immunity:true},{...move,ability:true},move,()=>.99).control,false);assert.ok(resolveHit(a,{...b,disoriented:true},move,move,()=>.99).damage>resolveHit(a,b,move,move,()=>.99).damage);
});
test('ідемпотентний запит не дублює витрати або шкоду, старий раунд відхиляється',async()=>{
 const {applyRequest}=await import('../requests.mjs');const p=migrate(newPlayer()),db={players:{[p.id]:p}};const req={type:'buy',item:'potion',requestId:'11111111-2222-3333-4444-555555555555'};const n=p.instances.length;assert.equal(applyRequest(db,p,'/api/action',req),true);const gold=p.gold;assert.equal(applyRequest(db,p,'/api/action',req),false);assert.equal(p.instances.length,n+1);assert.equal(p.gold,gold);assert.throws(()=>applyRequest(db,p,'/api/action',{...req,item:'mail'}),/вже використано/);
 action(p,{type:'battle',enemy:'recruit'});const stale={...move,round:0,battleId:p.battle.id};action(p,move,()=>.99);assert.throws(()=>applyRequest(db,p,'/api/action',stale),/раунд/);
});
test('усі п’ять класів мають повні лінійки рідкості та власні скіни спорядження',()=>{
 for(const key of Object.keys(CLASS_RULES)){for(const rarity of ['fine','rare','epic','legendary'])assert.ok(items.some(i=>i.combatClass===key&&i.slot==='weapon'&&i.rarity===rarity));assert.ok(items.some(i=>i.combatClass===key&&i.slot==='body'&&i.art==='armor-'+key));}
 const p=migrate(newPlayer()),before=derived(p);action(p,{type:'skin',skin:'axe'});assert.deepEqual(derived(p),before);assert.throws(()=>action(p,{type:'skin',skin:'<script>'}),/Невідомий/);
});
test('новий персонаж не може створити більше 5 лотів; завищення має серверну межу',()=>{
 const p=migrate(newPlayer()),db={players:{[p.id]:p}};for(let n=0;n<6;n++){const i=addInstance(p,'potion');const req={type:'list',kind:'item',instance:i.uid,price:30,hours:12};if(n<5)marketAction(db,p,req);else assert.throws(()=>marketAction(db,p,req),/Ліміт/);}assert.equal(Object.keys(db.market).length,5);
});

test('фракційні бонуси до криту й ухилення діють у реальному PvE-профілі',async()=>{
 const {pveProfile}=await import('../game.mjs');const p=migrate(newPlayer());p.faction='sweden';assert.equal(pveProfile(p).crit,derived(p).crit);assert.equal(pveProfile(p).crit,28);p.faction='crimea';assert.equal(pveProfile(p).dodge,derived(p).dodge);assert.equal(pveProfile(p).dodge,33);
});
test('настоянка зберігає стартові 45 HP та масштабується з розвитком персонажа',()=>{
 const p=migrate(newPlayer());assert.equal(derived(p).potionHeal,45);p.level=20;p.stats.vitality=25;assert.ok(derived(p).potionHeal>45);const heal=derived(p).potionHeal;p.hp=10;action(p,{type:'potion'});assert.equal(p.hp,10+heal);
});

test('міграція старого запасу HP не дає зайвого здоров’я в дуелі',()=>{
 const a=newPlayer('Старий козак'),b=migrate(newPlayer('Суперник'));a.level=22;a.stats.vitality=31;a.hp=10000;migrate(a);assert.equal(a.hp,derived(a).maxHp);const db={players:{[a.id]:a,[b.id]:b},duels:{}};duelAction(db,a,{type:'create'});duelAction(db,b,{type:'join',id:a.duelId});const duel=db.duels[a.duelId];assert.ok(duel.hp[a.id]<=duel.profiles[a.id].maxHp);
});

test('екран завершеної дуелі зберігає початкові максимуми після підвищення рівня',()=>{
 const {a,b,db,d}=pair();a.xp=99;const max=d.profiles[a.id].maxHp;duelAction(db,b,{type:'surrender'});assert.ok(a.level>1);assert.equal(worldSnapshot(db,a).duel.players.find(p=>p.id===a.id).maxHp,max);assert.equal(worldSnapshot(db,a).duel.combatProfile.level,1);
});
test('фракційні бойові переваги застосовуються також у PvP-профілі',()=>{
 const p=migrate(newPlayer()),base=combatProfile(p);p.faction='cossacks';assert.equal(combatProfile(p).attack,base.attack+2);p.faction='commonwealth';assert.equal(combatProfile(p).armor,base.armor+2);p.faction='sweden';assert.equal(combatProfile(p).crit,base.crit+3);p.faction='crimea';assert.equal(combatProfile(p).dodge,base.dodge+3);p.faction='ottoman';assert.equal(combatProfile(p).maxHp,base.maxHp+10);
});
