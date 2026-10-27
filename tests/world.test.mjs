import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,derived} from '../game.mjs';
import {action,migrate,clanAction,duelAction,worldSnapshot} from '../world.mjs';
import {factions} from '../factions.mjs';
import {syncInventory} from '../inventory.mjs';
function pair(){const a=migrate(newPlayer('Остап')),b=migrate(newPlayer('Северин'));return {a,b,db:{players:{[a.id]:a,[b.id]:b},clans:{},duels:{}}};}
test('п’ять погоджених сторін; присяга, перехід, бойові переваги',()=>{
 const p=migrate(newPlayer());assert.deepEqual(factions.map(f=>f.id),['cossacks','commonwealth','crimea','sweden','ottoman']);
 const base=derived(p).damage;action(p,{type:'faction',faction:'cossacks'});assert.equal(p.gold,280);assert.equal(derived(p).damage,base+2);
 action(p,{type:'faction',faction:'sweden'});assert.equal(p.gold,230);assert.equal(p.city,'harbor');assert.equal(derived(p).crit,28);assert.throws(()=>action(p,{type:'faction',faction:'sweden'}));
});
test('припаси, кузня, максимум покращення та майстровий виріб',()=>{
 const p=migrate(newPlayer());action(p,{type:'gather',resource:'ore'});assert.equal(p.materials.ore,1);assert.equal(p.energy,54);
 action(p,{type:'forge',item:'sword'});assert.equal(p.upgrades.sword,1);assert.equal(p.gold,200);assert.equal(derived(p).damage,21);
 assert.throws(()=>action(p,{type:'forge',item:'sword'}),/Бракує/);p.level=2;p.materials.herb=3;p.materials.resin=2;action(p,{type:'craft'});assert.ok(p.inventory.includes('amulet'));assert.equal(p.materials.herb,0);
 p.instances.find(i=>i.item==='sword').rank=5;syncInventory(p);assert.throws(()=>action(p,{type:'forge',item:'sword'}),/максимальне/);
});
test('похід: три реальні бої, одна нагорода та репутація',()=>{
 const p=migrate(newPlayer());assert.throws(()=>action(p,{type:'contract',contract:'crossing'}),/сторону/);action(p,{type:'faction',faction:'cossacks'});action(p,{type:'contract',contract:'crossing'});
 assert.throws(()=>action(p,{type:'contract',contract:'crossing'}),/завершіть/);
 for(let i=0;i<3;i++){action(p,{type:'rest'});action(p,{type:'campaignFight'});p.battle.enemy.currentHp=1;action(p,{type:'turn',attack:3,block:0,stance:'defense'},()=>.2);assert.equal(p.battle.result,'win');action(p,{type:'leave'});}
 assert.equal(p.campaign.status,'complete');assert.equal(p.campaign.stage,3);assert.equal(p.reputation.cossacks,6);assert.equal(p.campaign.rewardGiven,true);const money=p.gold;action(p,{type:'rest'});assert.equal(p.gold,money);assert.throws(()=>action(p,{type:'campaignFight'}));
});
test('вогнепальна зброя: постріл потребує зброю та порох і витрачає один припас',()=>{
 const p=migrate(newPlayer());action(p,{type:'battle',enemy:'recruit'});assert.throws(()=>action(p,{type:'turn',attack:0,block:0,stance:'attack',shot:true}),/пістоль/);
 p.equipment.pistol='pistol';p.inventory.push('pistol');assert.throws(()=>action(p,{type:'turn',attack:0,block:0,stance:'attack',shot:true}),/пороху/);
 p.materials.resin=2;action(p,{type:'turn',attack:0,block:0,stance:'attack',shot:true},()=>.5);assert.equal(p.materials.resin,1);
});
test('курінь: створення, вступ, внесок, передача отаманства',()=>{
 const {a,b,db}=pair();a.level=2;clanAction(db,a,{type:'create',name:'Побратими'});assert.equal(a.gold,90);const id=a.clanId;clanAction(db,b,{type:'join',id});assert.equal(db.clans[id].members.length,2);
 clanAction(db,b,{type:'donate',amount:35});assert.equal(db.clans[id].treasury,35);assert.equal(b.gold,205);assert.throws(()=>clanAction(db,b,{type:'donate',amount:-1}));
 clanAction(db,a,{type:'leave'});assert.equal(db.clans[id].leader,b.id);assert.equal(db.clans[id].treasury,35);assert.equal(a.clanId,undefined);
});
test('PvP: прихована тактика, два живі учасники, результат і однократна нагорода',()=>{
 const {a,b,db}=pair();duelAction(db,a,{type:'create'});const id=a.duelId;duelAction(db,b,{type:'join',id});
 const move={type:'turn',attack:3,block:0,stance:'attack',power:false};duelAction(db,a,move,()=>.5);const snap=worldSnapshot(db,a);assert.equal(snap.duel.submitted,true);assert.equal(snap.duel.round,0);assert.equal(snap.duel.moves,undefined);
 assert.throws(()=>duelAction(db,a,move),/прийнято/);assert.throws(()=>action(a,{type:'rest'}),/дуель/);duelAction(db,b,move,()=>.5);assert.equal(db.duels[id].round,1);assert.ok(a.hp<100&&b.hp<100);
 const before=a.gold;duelAction(db,b,{type:'surrender'});assert.equal(db.duels[id].winner,a.id);assert.equal(a.gold,before+45);assert.equal(a.wins,1);assert.equal(b.losses,1);assert.throws(()=>duelAction(db,a,move));
 duelAction(db,a,{type:'leave'});assert.equal(a.duelId,undefined);assert.equal(b.duelId,id);duelAction(db,b,{type:'leave'});
});
test('PvP: відкликання заявки та недоступність зайнятої дуелі',()=>{
 const {a,b,db}=pair();duelAction(db,a,{type:'create'});const id=a.duelId;duelAction(db,a,{type:'leave'});assert.throws(()=>duelAction(db,b,{type:'join',id}));assert.equal(db.duels[id],undefined);
});
test('попереднє збереження мігрує без втрати грошей і спорядження',()=>{
 const p=newPlayer();delete p.materials;const id=p.id,gold=p.gold,gear=structuredClone(p.equipment);migrate(p);assert.equal(p.id,id);assert.equal(p.gold,gold);assert.deepEqual(p.equipment,gear);assert.deepEqual(p.reputation,{});assert.equal(p.faction,null);
});
