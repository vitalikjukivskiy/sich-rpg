import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,items} from '../game.mjs';
import {migrate,action,duelAction,advanceDuels,worldSnapshot} from '../world.mjs';
import {addInstance} from '../inventory.mjs';
import {marketAction} from '../market.mjs';
import {ROUND_MS,CLASS_RULES,classOf,combatProfile,priceFloor,resolveHit,validMove,meetsRequirements} from '../balance.mjs';
function pair(){const a=migrate(newPlayer('Козак')),b=migrate(newPlayer('Шляхтич'));return {a,b,db:{players:{[a.id]:a,[b.id]:b},duels:{},clans:{},market:{}}};}
test('П’ять класів, у кожного різні життєздатність, крити та антиуворот',()=>{
 assert.equal(Object.keys(CLASS_RULES).length,5);
 assert.ok(CLASS_RULES.mace.hp>CLASS_RULES.sabre.hp);
 assert.ok(CLASS_RULES.hammer.antiDodge>CLASS_RULES.axe.antiDodge);
 assert.ok(CLASS_RULES.axe.critMultiplier>CLASS_RULES.pike.critMultiplier);
 for(const k of Object.keys(CLASS_RULES)){const p=newPlayer();p.equipment.weapon={sabre:'duelist_sabre',hammer:'hammer',mace:'mace',pike:'pike',axe:'war_axe'}[k];assert.equal(classOf(p),k);}
});
test('Вимоги до класової зброї перевіряються сервером і старі предмети лишаються доступними',()=>{
 const p=migrate(newPlayer()),weapon=items.find(i=>i.id==='hammer');p.level=5;const inst=addInstance(p,weapon.id);assert.equal(meetsRequirements(p,weapon),false);
 assert.throws(()=>action(p,{type:'equip',instance:inst.uid}),/характеристик/);
 p.stats.strength=12;p.stats.intuition=10;action(p,{type:'equip',instance:inst.uid});assert.equal(p.equipment.weapon,'hammer');
 const legacy=items.find(i=>i.id==='sword');assert.equal(meetsRequirements(p,legacy),true);
});
test('Мінімальні ціни враховують рідкість і покращення, не дозволяють продавати надто дешево',()=>{
 const {a,db}=pair();const inst=addInstance(a,'sword',4),item=items.find(i=>i.id==='sword');const floor=priceFloor(item,inst.rank);
 assert.ok(floor>item.price);
 assert.throws(()=>marketAction(db,a,{type:'list',kind:'item',instance:inst.uid,price:floor-1,hours:12}),/Мінімальна ціна/);
 marketAction(db,a,{type:'list',kind:'item',instance:inst.uid,price:floor,hours:12});assert.equal(Object.values(db.market)[0].price,floor);
});
test('Таймер PvP має 30 секунд і сервер сам завершує пропущений раунд',()=>{
 const {a,b,db}=pair();duelAction(db,a,{type:'create'});duelAction(db,b,{type:'join',id:a.duelId});const d=db.duels[a.duelId];
 assert.ok(Math.abs(d.deadline-Date.now()-ROUND_MS)<1000);
 const start=d.hp[a.id];assert.equal(advanceDuels(db,d.deadline-1),false);
 assert.equal(advanceDuels(db,d.deadline),true);assert.equal(d.round,1);assert.ok(d.hp[a.id]<start);
 assert.equal(d.status,'active');assert.equal(d.log.at(-1).includes('ЧАС ВИЙШОВ'),true);
 assert.equal(advanceDuels(db,d.deadline-1),false);
});
test('Прихований вибір двох блоків, крит і антикрит застосовуються на сервері',()=>{
 const {a,b,db}=pair();duelAction(db,a,{type:'create'});duelAction(db,b,{type:'join',id:a.duelId});
 assert.equal(validMove({attack:0,block:4,stance:'defense'}),true);
 assert.equal(validMove({attack:4,block:4,stance:'defense'}),false);
 const move={type:'turn',attack:0,block:4,stance:'defense'};duelAction(db,a,move);assert.equal(worldSnapshot(db,b).duel.submitted,false);
 assert.equal(worldSnapshot(db,a).duel.submitted,true);duelAction(db,b,move,()=>.95);assert.equal(db.duels[a.duelId].round,1);
 const sabre=combatProfile(a),heavy={...sabre,antiCrit:30,dodge:6,antiDodge:30};
 const strong=resolveHit({profile:sabre},{profile:{...heavy,armor:60},block:-1,stance:'attack'},{attack:0,block:0,stance:'attack'},null,()=>.99);
 assert.ok(strong.damage>=1);assert.equal(strong.dodged,false);
});
