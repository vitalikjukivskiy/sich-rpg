import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,derived,action,items,cities} from '../game.mjs';

test('новий персонаж має окремий інвентар і характеристики',()=>{
 const p=newPlayer();assert.equal(derived(p).maxHp,100);assert.equal(derived(p).damage,19);assert.equal(derived(p).armor,3);
 const second=newPlayer();p.inventory.push('mail');assert.equal(second.inventory.includes('mail'),false);assert.notEqual(p.id,second.id);
});
test('торгівля, рівневі обмеження та заборона продажу одягненого',()=>{
 const p=newPlayer(),before=derived(p).armor;action(p,{type:'buy',item:'mail'});assert.equal(p.gold,100);assert.equal(derived(p).armor,before);
 action(p,{type:'equip',item:'mail'});assert.equal(derived(p).armor,before+6);assert.throws(()=>action(p,{type:'sell',item:'mail'}),/зніміть/);
 action(p,{type:'equip',item:'mail'});action(p,{type:'sell',item:'mail'});assert.equal(p.gold,170);assert.equal(p.inventory.includes('mail'),false);
 assert.throws(()=>action(p,{type:'buy',item:'axe'}),/рівень/);p.gold=0;assert.throws(()=>action(p,{type:'buy',item:'potion'}),/талерів/);
 assert.throws(()=>action(p,{type:'buy',item:'nonexistent'}),/знайдено/);
});
test('завдання не виплачує нагороду повторно; підвищення дає очки і здоров’я',()=>{
 const p=newPlayer();assert.throws(()=>action(p,{type:'claim',quest:'first'}),/не виконано/);
 p.wins=1;p.xp=90;p.hp=15;action(p,{type:'claim',quest:'first'});assert.equal(p.level,2);assert.equal(p.xp,25);assert.equal(p.points,3);assert.equal(p.hp,derived(p).maxHp);
 const gold=p.gold;assert.throws(()=>action(p,{type:'claim',quest:'first'}),/вже/);assert.equal(p.gold,gold);
 action(p,{type:'stat',stat:'vitality'});assert.equal(p.points,2);assert.equal(p.hp,derived(p).maxHp);assert.throws(()=>action(p,{type:'stat',stat:'gold'}),/Невідома/);
});
test('повний бій: витривалість, нагорода, заборона повторного ходу',()=>{
 const p=newPlayer();action(p,{type:'battle',enemy:'recruit'});
 for(const a of [{type:'travel',city:'forest'},{type:'rest'},{type:'equip',item:'shield'}])assert.throws(()=>action(p,a),/завершіть/);
 assert.throws(()=>action(p,{type:'turn',attack:99,block:0,stance:'attack'}),/зону/);
 for(let i=0;i<20&&!p.battle.result;i++)action(p,{type:'turn',attack:3,block:0,stance:'defense',power:true},()=>.2);
 assert.equal(p.battle.result,'win');assert.equal(p.wins,1);assert.equal(p.gold,272);assert.equal(p.xp,45);assert.ok(p.energy<60);
 assert.equal(p.history.length,1);assert.throws(()=>action(p,{type:'turn',attack:3,block:0,stance:'attack'}),/Немає/);
 action(p,{type:'leave'});action(p,{type:'rest'});assert.equal(p.hp,100);assert.equal(p.energy,60);
});
test('поразка, нічия, зілля, обмеження енергії',()=>{
 const p=newPlayer();p.hp=1;action(p,{type:'battle',enemy:'knight'});action(p,{type:'turn',attack:0,block:0,stance:'attack'},()=>.5);
 assert.equal(p.battle.result,'loss');assert.equal(p.hp,0);assert.equal(p.losses,1);assert.equal(p.gold,240);
 action(p,{type:'leave'});assert.throws(()=>action(p,{type:'battle',enemy:'recruit'}),/здоров’я/);action(p,{type:'rest'});
 p.hp=30;action(p,{type:'potion'});assert.equal(p.hp,75);assert.equal(p.inventory.filter(x=>x==='potion').length,1);
 action(p,{type:'battle',enemy:'recruit'});p.energy=0;assert.throws(()=>action(p,{type:'turn',attack:0,block:0,stance:'attack',power:true}),/витривалості/);
 p.hp=1;p.battle.enemy.currentHp=1;action(p,{type:'turn',attack:0,block:0,stance:'attack'},()=>.5);assert.equal(p.battle.result,'draw');assert.equal(p.wins,0);
});
test('подорожі відмічають лише унікальні міста; нагорода мандрівника',()=>{
 const p=newPlayer();for(const c of cities)action(p,{type:'travel',city:c.id});action(p,{type:'travel',city:'castle'});assert.equal(p.visited.length,5);
 action(p,{type:'claim',quest:'traveler'});assert.equal(p.gold,340);assert.throws(()=>action(p,{type:'travel',city:'invalid'}),/немає/);
});
test('зілля в бою витрачає предмет і дає супернику хід',()=>{
 const p=newPlayer();p.hp=30;action(p,{type:'battle',enemy:'recruit'});action(p,{type:'potion'});assert.equal(p.battle.round,1);assert.equal(p.hp,70);assert.equal(p.inventory.filter(x=>x==='potion').length,1);
});
test('місткість, неіснуючі дії та недостатні очки',()=>{
 const p=newPlayer();p.inventory=Array(60).fill('potion');assert.throws(()=>action(p,{type:'buy',item:'potion'}),/місця/);
 assert.throws(()=>action(p,{type:'stat',stat:'strength'}),/очок/);assert.throws(()=>action(p,{type:'unknown'}),/Невідома/);assert.ok(items.every(i=>i.price>0));
});
