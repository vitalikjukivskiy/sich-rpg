import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,derived} from '../game.mjs';
import {action,migrate,clanAction,duelAction,worldSnapshot} from '../world.mjs';
import {marketAction} from '../market.mjs';
import {onRoad} from '../roads.mjs';
import {recordClanProgress,prepareClan} from '../clanworks.mjs';
import {today} from '../content.mjs';
function hero(){const p=migrate(newPlayer());action(p,{type:'faction',faction:'cossacks'});return p;}
function start(p){action(p,{type:'roadStart',route:'river'},()=>.7);return p.journey;}
function choose(p,choice,rng=()=>.9){const j=p.journey;action(p,{type:'roadChoice',journey:j.id,stage:j.stage,choice},rng);}
test('дорога має випадкові неповторні зустрічі; мирний шлях завершується й видає одну платню',()=>{
 const p=hero(),j=start(p);assert.equal(p.gold,260);assert.equal(new Set(j.events).size,3);j.events=['well','herbalist','shrine'];p.hp=50;choose(p,'water');assert.equal(p.hp,68);choose(p,'learn');const before=p.gold;choose(p,'record');assert.equal(j.status,'complete');assert.equal(p.gold,before+65);assert.equal(p.journeysWon,1);assert.equal(p.city,'forest');assert.deepEqual(p.journeyRoutes,['river']);assert.throws(()=>choose(p,'record'));assert.equal(p.journeysWon,1);
});
test('старий вибір не може пройти наступну зустріч; припаси й характеристики перевіряються до витрат',()=>{
 const p=hero(),j=start(p);j.events=['bridge','cart','well'];const stale={type:'roadChoice',journey:j.id,stage:0,choice:'ferry'};action(p,stale);const gold=p.gold;assert.throws(()=>action(p,stale),/уже/);assert.equal(p.gold,gold);assert.throws(()=>choose(p,'lift'),/характеристика/);p.materials.ore=0;assert.throws(()=>choose(p,'wood'),/припасів/);assert.equal(j.stage,1);assert.equal(p.gold,gold);
});
test('під час дороги не можна обійти припаси через лікарню, крамницю, ринок чи дуель',()=>{
 const p=hero();start(p);const db={players:{[p.id]:p},duels:{},clans:{}};for(const a of [{type:'rest'},{type:'travel',city:'harbor'},{type:'buy',item:'potion'},{type:'contract',contract:'crossing'},{type:'gather',resource:'herb'}])assert.throws(()=>action(p,a),/дорозі/);assert.throws(()=>marketAction(db,p,{type:'claim',id:'none'}),/дороги/);assert.throws(()=>duelAction(db,p,{type:'create'}),/дороги/);assert.throws(()=>clanAction(db,p,{type:'join',id:'none'}),/дороги/);action(p,{type:'roadAbandon',journey:p.journey.id});assert.equal(onRoad(p),false);action(p,{type:'rest'});assert.equal(p.hp,derived(p).maxHp);
});
test('дорожня засідка використовує реальний бій; додаткова нагорода не дублюється',()=>{
 const p=hero(),j=start(p);j.events=['checkpoint','well','shrine'];choose(p,'fight',()=>.5);assert.equal(j.status,'combat');assert.equal(p.battle.source,'road');const before=p.gold;while(!p.battle.result)action(p,{type:'turn',attack:3,block:0,stance:'defense',power:(p.battle.stamina??100)>=20},()=>.2);assert.equal(p.battle.result,'win');assert.equal(j.stage,1);assert.equal(p.gold,before+32+30);assert.throws(()=>action(p,{type:'turn',attack:3,block:0,stance:'defense'}));assert.equal(p.gold,before+62);p.hp=40;action(p,{type:'potion'});assert.equal(p.battle,null);assert.equal(p.hp,85);
});
test('поразка повертає обоз без дорожньої нагороди; звичайний бій не підмінює дорожній',()=>{
 const p=hero(),j=start(p);j.events=['checkpoint','well','shrine'];choose(p,'fight',()=>.5);const gold=p.gold;action(p,{type:'surrender'});assert.equal(j.status,'failed');assert.equal(p.gold,gold);assert.equal(p.journeysWon,0);action(p,{type:'leave'});action(p,{type:'rest'});action(p,{type:'battle',enemy:'recruit'});assert.equal(j.status,'failed');
});
test('подорож між сюжетними сутичками призупиняє розділ і не стирає його прогрес',()=>{
 const p=hero();action(p,{type:'contract',contract:'crossing'});const chapter=p.campaign.id,j=start(p);j.events=['well','herbalist','shrine'];choose(p,'water');choose(p,'learn');choose(p,'record');assert.equal(j.status,'complete');assert.equal(p.campaign.id,chapter);assert.equal(p.campaign.status,'active');assert.equal(p.campaign.stage,0);action(p,{type:'campaignFight'});assert.equal(p.battle.enemy.id,'recruit');assert.equal(p.campaign.currentBattle,p.battle.id);assert.throws(()=>action(p,{type:'roadStart',route:'river'}),/завершіть бій/);assert.equal(p.campaign.id,chapter);
});
test('перенавчання повертає лише зароблені очки, знімає плату й не лікує',()=>{
 const p=hero();p.level=4;p.points=3;p.stats.strength=11;p.stats.vitality=8;p.hp=120;const gold=p.gold;action(p,{type:'retrain'});assert.equal(p.gold,gold-75);assert.equal(p.points,9);assert.deepEqual(p.stats,{strength:5,agility:5,intuition:5,vitality:5});assert.equal(p.hp,120);p.gold=0;assert.throws(()=>action(p,{type:'retrain'}),/талерів/);assert.equal(p.points,9);
});
test('будівлі куреня: права отамана, утримання, припас раз на добу й заборона обходу зміною куреня',()=>{
 const a=hero(),b=hero(),db={players:{[a.id]:a,[b.id]:b},clans:{}};a.level=2;a.gold=2000;clanAction(db,a,{type:'create',name:'Вільна дорога'});clanAction(db,b,{type:'join',id:a.clanId});clanAction(db,a,{type:'donate',amount:1000});const c=db.clans[a.clanId];assert.throws(()=>clanAction(db,b,{type:'build',building:'infirmary'}),/отаман/);clanAction(db,a,{type:'build',building:'infirmary'});assert.equal(c.treasury,800);const n=b.instances.length;clanAction(db,b,{type:'supply',building:'infirmary'});assert.equal(b.instances.length,n+1);assert.equal(c.treasury,795);assert.throws(()=>clanAction(db,b,{type:'supply',building:'infirmary'}),/сьогодні/);
 clanAction(db,b,{type:'leave'});b.level=2;b.gold=500;clanAction(db,b,{type:'create',name:'Інша варта'});const other=db.clans[b.clanId];other.treasury=500;clanAction(db,b,{type:'build',building:'infirmary'});assert.throws(()=>clanAction(db,b,{type:'supply',building:'infirmary'}),/сьогодні/);b.clanSupplies.day='2000-01-01';clanAction(db,b,{type:'supply',building:'infirmary'});assert.equal(b.clanSupplies.day,today());
});
test('спільні накази рахують тільки новий внесок; нагорода потрапляє лише у скарбницю',()=>{
 const a=hero(),db={players:{[a.id]:a},clans:{}};a.level=2;a.gold=500;clanAction(db,a,{type:'create',name:'Спільний дозор'});let before=structuredClone(db);a.wins=10;recordClanProgress(before,db);const c=prepareClan(db.clans[a.clanId]);assert.equal(c.progress.wins,10);const money=a.gold;clanAction(db,a,{type:'order',order:'guard'});assert.equal(c.treasury,400);assert.equal(a.gold,money);assert.throws(()=>clanAction(db,a,{type:'order',order:'guard'}),/вже/);const p=hero();p.wins=500;db.players[p.id]=p;before=structuredClone(db);clanAction(db,p,{type:'join',id:c.id});recordClanProgress(before,db);assert.equal(c.progress.wins,10);assert.equal(worldSnapshot(db,p).clanOrders[0].claimed,true);
});
test('відзнаки випробувань не можна купити за талери або отримати до фіналу',()=>{
 const p=hero();p.level=20;p.gold=10000;assert.throws(()=>action(p,{type:'trialStart',trial:'sentinel'}),/фіналу/);assert.throws(()=>action(p,{type:'buy',item:'council_seal'}),/відзнаки/);p.storyComplete=true;assert.throws(()=>action(p,{type:'trialStart',trial:'champion'}),/попереднє/);assert.throws(()=>action(p,{type:'honorBuy',item:'council_seal'}),/Бракує/);
});
test('намір суперника впливає на удар, блок і наступну фазу; настоянка теж просуває фазу',()=>{
 const p=hero();p.level=20;p.storyComplete=true;p.hp=derived(p).maxHp;action(p,{type:'trialStart',trial:'sentinel'});assert.equal(p.battle.intent.zone,0);const other=structuredClone(p),before=p.hp;
 action(p,{type:'turn',attack:3,block:0,stance:'defense'},()=>.5);action(other,{type:'turn',attack:3,block:5,stance:'defense'},()=>.5);assert.ok(before-p.hp<before-other.hp);assert.equal(p.battle.intent.kind,'guard');action(p,{type:'potion'});assert.equal(p.battle.intent.kind,'rush');assert.equal(p.battle.round,2);
});
