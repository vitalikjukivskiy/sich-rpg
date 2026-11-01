import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCanonicalPlayer,newPlayer,derived,items,award} from '../game.mjs';
import {migrate,action,duelAction,advanceDuels,worldSnapshot} from '../world.mjs';
import {applyRequest} from '../requests.mjs';
import {addInstance} from '../inventory.mjs';
import {marketAction} from '../market.mjs';
import {canonicalItems,creditMinor,balanceMinor,roundTimeout,migrateProgression,canonicalProfile} from '../canon.mjs';
import {resolveHit,combatProfile} from '../balance.mjs';
const player=()=>migrate(newCanonicalPlayer());
const source=JSON.parse(readFileSync(new URL('../reference/carnage-catalog.json',import.meta.url)));
const item=id=>items.find(i=>i.id==='canon_'+id);
test('runtime catalog preserves every source number and separates unavailable special items',()=>{
 assert.equal(canonicalItems.length,1365);
 for(const raw of source.items){const actual=item(raw.key);assert.equal(actual.priceMinor,raw.priceMinor);assert.equal(actual.currency,raw.currency);assert.equal(actual.mass,raw.mass);assert.equal(actual.durability,raw.durability.maximum);for(const [key,field] of Object.entries(raw.requirements))assert.equal(actual.requirements[key],field.value);for(const [key,field] of Object.entries(raw.properties)){if(field.unit||field.observationOnly)assert.equal(actual.modifiers[key],undefined);else assert.equal(actual.modifiers[key],field.value);}assert.ok(actual.name&&!/[ыэъё]/i.test(actual.name));if(!raw.priceMinor||raw.effectNeedsReview)assert.equal(actual.purchasable,false);}
});
test('canonical character receives cumulative XP milestones exactly once, including skipped thresholds',()=>{
 const p=player();assert.equal(p.level,0);assert.equal(p.gold,6);assert.equal(p.points,3);assert.equal(derived(p).nextXp,50);
 award(p,600,0);assert.equal(p.level,2);assert.equal(p.xp,600);assert.equal(p.points,19);assert.equal(p.gold,88);assert.equal(derived(p).nextXp,900);
 const before=structuredClone(p);award(p,0,0);assert.deepEqual(p,before);
 award(p,290000-600,0);assert.equal(p.level,8);assert.equal(p.gold,2103);assert.equal(p.points+12,100);
});
test('request receipts protect milestone awards and unique quest equipment',()=>{
 const p=player(),db={players:{[p.id]:p}};const claim={type:'claim',quest:'intro_welcome',requestId:'11111111-2222-3333-4444-555555555555'};
 assert.equal(applyRequest(db,p,'/api/action',claim),true);assert.equal(p.gold,11);assert.equal(p.xp,20);assert.equal(applyRequest(db,p,'/api/action',claim),false);assert.equal(p.gold,11);
 for(const stat of ['strength','agility','intuition'])action(p,{type:'stat',stat});action(p,{type:'claim',quest:'intro_stats'});assert.equal(p.instances.filter(i=>i.item==='canon_armor-55').length,1);assert.throws(()=>action(p,{type:'claim',quest:'intro_stats'}),/вже/);
});
test('source requirements exclude self bonuses and equipping immediately updates health, stamina and ratings',()=>{
 const p=player();action(p,{type:'buy',item:'canon_cas-5'});assert.equal(p.gold,1);const knuckle=p.instances[0];action(p,{type:'equip',instance:knuckle.uid});assert.equal(derived(p).minDamage,2);assert.equal(derived(p).maxDamage,4);
 const armor=addInstance(p,'canon_armor-55');action(p,{type:'equip',instance:armor.uid});assert.equal(derived(p).maxHp,23);assert.equal(derived(p).maxStamina,23);assert.equal(derived(p).crit,9);assert.equal(derived(p).dodge,9);
 const knife=addInstance(p,'canon_kn-1');assert.throws(()=>action(p,{type:'equip',instance:knife.uid}),/рівень/);award(p,200,0);assert.throws(()=>action(p,{type:'equip',instance:knife.uid}),/характеристик/);
 p.stats.agility=5;p.stats.intuition=5;action(p,{type:'equip',instance:knife.uid});assert.equal(derived(p).classId,'knife');assert.equal(derived(p).crit,19);assert.equal(derived(p).dodge,19);assert.equal(derived(p).minDamage,6);assert.equal(derived(p).maxDamage,8);
});
test('all six weapons use item/stat modifiers without old class or faction multipliers',()=>{
 const p=player();p.stats={strength:30,agility:30,intuition:30,vitality:30};p.level=10;
 for(const [cat,key] of [['kn','knife'],['club','club'],['sw','sword'],['axe','axe'],['ham','hammer'],['sp','spear']]){
  const weapon=canonicalItems.find(i=>i.category===cat&&i.purchasable);const instance=addInstance(p,weapon.id);action(p,{type:'equip',instance:instance.uid});assert.equal(combatProfile(p).classId,key);const before=derived(p);p.faction='sweden';assert.deepEqual(derived(p),before);p.faction=null;
 }
});
test('florins and sesterces remain independent and decimal purchases use integer minor units',()=>{
 const p=player();for(let i=0;i<100;i++)creditMinor(p,1);assert.equal(balanceMinor(p),700);creditMinor(p,4250,'sesterce');assert.equal(p.gold,7);assert.equal(balanceMinor(p,'sesterce'),4250);
 const unavailable=canonicalItems.find(i=>i.priceMinor===0);const before=structuredClone(p);assert.throws(()=>action(p,{type:'buy',item:unavailable.id}),/особливий|особливе|продається/i);assert.deepEqual(p,before);
 p.level=14;const special=canonicalItems.find(i=>i.effectNeedsReview&&i.priceMinor>0);assert.throws(()=>action(p,{type:'buy',item:special.id}),/продається/);assert.equal(balanceMinor(p,'sesterce'),4250);
});
test('repair quotes charge 0.1 florin per wear; bound and worn items cannot enter the market',()=>{
 const p=player(),db={players:{[p.id]:p}};const i=addInstance(p,'canon_cas-5');i.wear=3;p.gold=.31;action(p,{type:'repair',instance:i.uid});assert.equal(p.gold,.01);assert.equal(i.wear,0);assert.throws(()=>action(p,{type:'repair',instance:i.uid}),/повністю/);
 p.gold=100;i.bound=true;assert.throws(()=>marketAction(db,p,{type:'list',kind:'item',instance:i.uid,price:5,hours:12}),/Прив’язану/);i.bound=false;i.wear=1;assert.throws(()=>marketAction(db,p,{type:'list',kind:'item',instance:i.uid,price:5,hours:12}),/відремонтовані/);
});
test('canonical combat has a ten-minute deadline and rejects obsolete power/class abilities',()=>{
 const p=player();action(p,{type:'battle',enemy:'training'});assert.equal(p.battle.deadline-p.battle.startedAt,600000);
 for(const extra of [{ability:true},{power:true},{shot:true}]){const before=structuredClone(p);assert.throws(()=>action(p,{type:'turn',attack:0,block:0,stance:'defense',...extra}),/не належить/);assert.deepEqual(p,before);}
 assert.equal(roundTimeout(0,899999),600000);assert.equal(roundTimeout(0,900000),540000);assert.equal(roundTimeout(0,1800000),480000);assert.equal(roundTimeout(0,900000*20),180000);
});
test('critical attacks bypass zone blocks in the source ruleset, without preset class counters',()=>{
 const p=player(),profile={...canonicalProfile(p,items),minDamage:10,maxDamage:10,attack:10,crit:100,dodge:0,antiCrit:0};
 const attacker={profile},defender={profile:{...profile,crit:0},block:0,stance:'defense'},move={attack:0,block:0,stance:'attack'};
 const hit=resolveHit(attacker,defender,move,move,()=>.1);assert.equal(hit.crit,true);assert.equal(hit.blocked,false);assert.ok(hit.damage>0);
});
test('PvP hides moves but exposes opponent stats and equipped items; double timeout creates no imaginary damage',()=>{
 const a=player(),b=player();award(a,200,0);award(b,200,0);const db={players:{[a.id]:a,[b.id]:b},duels:{}};const instance=addInstance(b,'canon_cas-5');action(b,{type:'equip',instance:instance.uid});duelAction(db,a,{type:'create'});duelAction(db,b,{type:'join',id:a.duelId});const duel=db.duels[a.duelId];assert.equal(duel.deadline-duel.startedAt,600000);
 const snapshot=worldSnapshot(db,a).duel,opponent=snapshot.players.find(p=>p.id===b.id);assert.equal(opponent.stats.strength,3);assert.equal(opponent.equipment[0].name,'Кастет Вуличного Бійця');assert.equal(snapshot.moves,undefined);assert.equal(opponent.inventory,undefined);
 const hp={...duel.hp};advanceDuels(db,duel.deadline);assert.equal(duel.status,'finished');assert.equal(duel.winner,null);assert.deepEqual(duel.hp,hp);const count=duel.log.length;advanceDuels(db,duel.deadline+600000);assert.equal(duel.log.length,count);
});
test('weekly redistribution accumulates to ten and consumes only one point per action',()=>{
 const p=player();p.redistribution.at=Date.now()-11*604800000;migrate(p);assert.equal(p.redistribution.credits,10);action(p,{type:'stat',stat:'strength'});const before=derived(p).maxStamina;action(p,{type:'redistribute',from:'strength',to:'vitality'});assert.equal(p.redistribution.credits,9);assert.equal(p.stats.strength,3);assert.equal(p.stats.vitality,4);assert.equal(derived(p).maxStamina,before-6);assert.equal(derived(p).maxHp,24);assert.throws(()=>action(p,{type:'redistribute',from:'strength',to:'agility'}),/Базове/);
});
test('explicit legacy migration preserves property and marks historical thresholds as settled',()=>{
 const p=migrate(newPlayer());p.level=5;p.xp=200;const owned=structuredClone(p.instances),gold=p.gold,stats={...p.stats},points=p.points;migrateProgression(p);const xp=p.xp;
 assert.equal(p.level,5);assert.equal(p.gold,gold);assert.deepEqual(p.stats,stats);assert.deepEqual(p.instances,owned);assert.ok(p.points>=points);const granted=p.points;migrateProgression(p);assert.equal(p.xp,xp);award(p,0,0);assert.equal(p.gold,gold);assert.equal(p.points,granted);
});
test('all six block combinations stop covered normal zones and never stop a critical hit',()=>{
 const profile={ruleset:'lutecia-public',level:3,classId:'sword',minDamage:10,maxDamage:10,attack:10,crit:0,antiCrit:0,dodge:0,antiDodge:0,armor:0,zoneArmor:[0,0,0,0],critMultiplier:1.5,pace:1},pairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 for(let block=0;block<6;block++)for(let zone=0;zone<4;zone++)for(const stance of ['attack','defense']){
  const defender={profile,block,stance},move={attack:zone,block:0,stance:'attack'},normal=resolveHit({profile},defender,move,null,()=>.99);
  assert.equal(normal.blocked,pairs[block].includes(zone));assert.equal(normal.damage===0,pairs[block].includes(zone));
  const critical=resolveHit({profile:{...profile,crit:100}},defender,move,null,()=>.1);assert.equal(critical.crit,true);assert.equal(critical.blocked,false);assert.ok(critical.damage>0);
 }
});
test('defensive stance increases evasion and reduces incoming critical frequency in the actual resolver',()=>{
 const profile={ruleset:'lutecia-public',classId:'knife',minDamage:10,maxDamage:10,attack:10,crit:30,antiCrit:30,dodge:30,antiDodge:30,armor:0,critMultiplier:1.5,pace:1};
 const count=(stance,kind)=>{let n=0;for(let i=0;i<1000;i++){const rolls=kind==='dodge'?[(i+.5)/1000,.99,.99]:[.99,(i+.5)/1000,.99];const hit=resolveHit({profile},{profile,block:-1,stance},{attack:0,block:0,stance:'attack'},null,()=>rolls.shift()??.99);n+=kind==='dodge'?Number(!!hit.dodged):Number(!!hit.crit);}return n;};
 assert.ok(count('defense','dodge')>count('attack','dodge'));assert.ok(count('defense','critical')<count('attack','critical'));
});
test('removing a stat-granting item safely unequips dependent source gear without deleting either instance',()=>{
 const p=player();p.level=14;p.stats={strength:100,agility:16,intuition:100,vitality:100};const helm=addInstance(p,'canon_helm-43'),knife=addInstance(p,'canon_kn-11');
 action(p,{type:'equip',instance:helm.uid});action(p,{type:'equip',instance:knife.uid});assert.equal(p.equipment.weapon,'canon_kn-11');action(p,{type:'equip',instance:helm.uid});assert.equal(p.equipment.weapon,undefined);assert.equal(p.equipment.head,undefined);assert.ok(p.instances.some(i=>i.uid===helm.uid));assert.ok(p.instances.some(i=>i.uid===knife.uid));assert.ok(p.lastUnequipped.includes(item('kn-11').name));
});
test('old characters beyond the published level table keep identity and receive the confirmed level-11 stat budget',()=>{
 const p=migrate(newPlayer());p.level=22;p.xp=55;migrateProgression(p);assert.equal(p.level,22);assert.equal(p.legacyProgress.level,22);assert.equal(p.xp,10000000);assert.equal(p.points+20,159);assert.equal(derived(p).nextXp,null);assert.equal(p.gold,240);
});
