import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,derived,items} from '../game.mjs';
import {action,migrate,worldSnapshot} from '../world.mjs';
import {addInstance,syncInventory} from '../inventory.mjs';
import {marketAction,marketSnapshot,expireMarket} from '../market.mjs';
import {factions,forgePrice,shopPrice} from '../factions.mjs';
function setup(){const a=migrate(newPlayer('Продавець')),b=migrate(newPlayer('Покупець'));return {a,b,db:{players:{[a.id]:a,[b.id]:b},clans:{},duels:{}}};}
function list(db,p,payload,now=1000){marketAction(db,p,{type:'list',price:100,hours:12,...payload},now);return Object.values(db.market).at(-1);}
test('кожна сторона видає свій набір лише раз; зміна служби не дублює майно',()=>{
 for(const f of factions){const p=migrate(newPlayer()),initial=p.instances.length;action(p,{type:'faction',faction:f.id});assert.equal(p.gold,240+f.starter.gold);assert.equal(p.instances.length,initial+f.starter.items.length);assert.deepEqual(p.materials,f.starter.materials);assert.equal(p.starterFaction,f.id);const count=p.instances.length;assert.throws(()=>action(p,{type:'starter'}),/уже/);action(p,{type:'faction',faction:f.id==='cossacks'?'sweden':'cossacks'});assert.equal(p.instances.length,count);}
});
test('шведський мушкет доступний на старті; після зміни служби рівневе обмеження повертається',()=>{
 const p=migrate(newPlayer());action(p,{type:'faction',faction:'sweden'});const gun=p.instances.find(i=>i.item==='axe');action(p,{type:'equip',instance:gun.uid});assert.equal(p.equipment.weapon,'axe');action(p,{type:'faction',faction:'cossacks'});assert.equal(p.equipment.weapon,undefined);assert.throws(()=>action(p,{type:'equip',instance:gun.uid}),/рівень/);
});
test('економічні переваги змінюють реальну вартість і видобуток',()=>{
 const p=migrate(newPlayer());action(p,{type:'faction',faction:'crimea'});action(p,{type:'gather',resource:'ore'});assert.equal(p.energy,56);action(p,{type:'faction',faction:'sweden'});action(p,{type:'gather',resource:'resin'});assert.equal(p.materials.resin,2);action(p,{type:'faction',faction:'commonwealth'});p.materials.ore=1;const gold=p.gold;action(p,{type:'forge',instance:p.equipmentInstances.weapon});assert.equal(p.gold,gold-forgePrice(p,0));assert.equal(forgePrice(p,0),32);
 p.gold=100;action(p,{type:'faction',faction:'ottoman'});action(p,{type:'buy',item:'potion'});assert.equal(p.gold,50-shopPrice(p,items.find(i=>i.id==='potion')));assert.equal(p.gold,26);
});
test('міграція старих дублікатів зберігає гарт; нові копії незалежні',()=>{
 const legacy=newPlayer();legacy.inventory.push('sword');legacy.upgrades={sword:3};migrate(legacy);assert.equal(legacy.instances.filter(i=>i.item==='sword'&&i.rank===3).length,2);
 const p=migrate(newPlayer()),before=derived(p).damage,copy=addInstance(p,'sword',4);assert.equal(derived(p).damage,before);action(p,{type:'equip',instance:copy.uid});assert.equal(derived(p).damage,before+8);const original=p.instances.find(i=>i.item==='sword'&&i.uid!==copy.uid);action(p,{type:'equip',instance:original.uid});assert.equal(derived(p).damage,before);
});
test('гарт пістоля покращує шкоду саме спорядженого пістоля',()=>{
 const p=migrate(newPlayer());p.level=2;const base=derived(p),gun=addInstance(p,'pistol',2);action(p,{type:'equip',instance:gun.uid});assert.equal(derived(p).damage,base.damage+8);assert.equal(derived(p).armor,base.armor);action(p,{type:'equip',instance:gun.uid});assert.equal(derived(p).damage,base.damage);
});
test('комісійка: передача саме загартованого екземпляра між сторонами; виручка однократна',()=>{
 const {a,b,db}=setup();action(a,{type:'faction',faction:'ottoman'});action(b,{type:'faction',faction:'cossacks'});const blade=addInstance(a,'sword',5),lot=list(db,a,{kind:'item',instance:blade.uid});assert.equal(a.instances.some(i=>i.uid===blade.uid),false);assert.equal(lot.fee,3);assert.equal(lot.net,97);
 assert.equal('instance' in marketSnapshot(db,b,1001).market.lots[0],false);action(a,{type:'faction',faction:'sweden'});const sellerGold=a.gold,buyerGold=b.gold;marketAction(db,b,{type:'buy',id:lot.id},2000);assert.equal(b.gold,buyerGold-100);assert.equal(a.gold,sellerGold);assert.deepEqual(b.instances.find(i=>i.uid===blade.uid),blade);assert.equal(db.marketFees,3);assert.equal(a.marketSales,1);assert.throws(()=>marketAction(db,b,{type:'buy',id:lot.id},2001),/продано/);
 const receipt=a.deliveries[0];marketAction(db,a,{type:'claim',id:receipt.id},2002);assert.equal(a.gold,sellerGold+97);assert.throws(()=>marketAction(db,a,{type:'claim',id:receipt.id},2003),/отримана/);assert.equal(a.gold,sellerGold+97);assert.equal(marketSnapshot(db,b).market.mine.length,0);
});
test('скасування й прострочення повертають річ у необмежену пошту; повна скриня не втрачає річ',()=>{
 const {a,db}=setup(),blade=addInstance(a,'sword',2),lot=list(db,a,{kind:'item',instance:blade.uid});marketAction(db,a,{type:'cancel',id:lot.id},2000);while(a.instances.length<60)addInstance(a,'potion');const receipt=a.deliveries[0];assert.throws(()=>marketAction(db,a,{type:'claim',id:receipt.id},2001),/місця/);assert.equal(receipt.claimedAt,null);action(a,{type:'sell',item:'potion'});marketAction(db,a,{type:'claim',id:receipt.id},2002);assert.equal(a.instances.find(i=>i.uid===blade.uid).rank,2);
 a.materials.ore=4;const ore=list(db,a,{kind:'resource',resource:'ore',quantity:4});assert.equal(a.materials.ore,0);assert.equal(expireMarket(db,ore.expiresAt),true);assert.equal(expireMarket(db,ore.expiresAt+1),false);marketAction(db,a,{type:'claim',id:a.deliveries.at(-1).id},ore.expiresAt+2);assert.equal(a.materials.ore,4);assert.throws(()=>marketAction(db,a,{type:'cancel',id:ore.id},ore.expiresAt+3));
});
test('ринок відхиляє чужий лот, споряджену річ, дробові суми й нестачу коштів',()=>{
 const {a,b,db}=setup();assert.throws(()=>list(db,a,{kind:'item',instance:a.equipmentInstances.weapon}),/зніміть/);a.materials.ore=5;for(const price of [0,-1,2.5,1000001,'100'])assert.throws(()=>list(db,a,{kind:'resource',resource:'ore',quantity:2,price}));assert.equal(a.materials.ore,5);
 const lot=list(db,a,{kind:'resource',resource:'ore',quantity:2,price:1000});assert.throws(()=>marketAction(db,a,{type:'buy',id:lot.id},2000),/Власний/);assert.throws(()=>marketAction(db,b,{type:'cancel',id:lot.id},2000),/ваше/);assert.throws(()=>marketAction(db,b,{type:'buy',id:lot.id},2000),/талерів/);assert.equal(lot.status,'active');assert.equal(b.materials.ore,0);assert.equal(b.gold,240);
});
test('денні доручення не враховують минулі здобутки й не виплачуються двічі',()=>{
 const p=migrate(newPlayer());assert.throws(()=>action(p,{type:'daily',quest:'daily_herbs'}),/не виконано/);for(let i=0;i<5;i++)action(p,{type:'gather',resource:'herb'});const gold=p.gold;action(p,{type:'daily',quest:'daily_herbs'});assert.equal(p.gold,gold+35);assert.throws(()=>action(p,{type:'daily',quest:'daily_herbs'}),/отримано/);p.daily.day='2000-01-01';migrate(p);assert.equal(p.daily.claimed.length,0);assert.equal(worldSnapshot({players:{[p.id]:p}},p).dailyQuests.find(q=>q.id==='daily_herbs').progress,0);
});
test('рецепт перевіряє місце до оплати; створює точну кількість незалежних речей',()=>{
 const p=migrate(newPlayer());p.materials.herb=3;while(p.instances.length<59)addInstance(p,'potion');const gold=p.gold;assert.throws(()=>action(p,{type:'recipe',recipe:'tonic'}),/місця/);assert.equal(p.gold,gold);assert.equal(p.materials.herb,3);action(p,{type:'sell',item:'potion'});action(p,{type:'recipe',recipe:'tonic'});assert.equal(p.instances.length,60);assert.equal(new Set(p.instances.map(i=>i.uid)).size,60);assert.equal(p.materials.herb,0);
});
