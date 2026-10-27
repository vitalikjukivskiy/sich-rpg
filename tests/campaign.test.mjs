import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,items,quests,questProgress,derived,cities} from '../game.mjs';
import {action,migrate} from '../world.mjs';
import {contracts,shopPrice,requiredLevel} from '../factions.mjs';
import {marketAction} from '../market.mjs';
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
for(const faction of ['cossacks','commonwealth','crimea','sweden','ottoman'])test('повна кампанія новим героєм: '+faction,{timeout:30000},()=>{
 const p=migrate(newPlayer('Шлях до фіналу')),db={players:{[p.id]:p}},rng=random(12777);let rounds=0,farm=0;
 const act=a=>action(p,a,rng);act({type:'faction',faction});
 for(const c of cities)act({type:'travel',city:c.id});
 function prepare(){
  for(const q of quests)if(!p.claimed.includes(q.id)&&questProgress(p,q)>=q.target)act({type:'claim',quest:q.id});
  for(const mail of p.deliveries.filter(d=>d.claimedAt===null))marketAction(db,p,{type:'claim',id:mail.id});
  while(p.points>0)act({type:'stat',stat:p.stats.strength<p.stats.vitality*1.4?'strength':'vitality'});
  const score=i=>(i.damage||0)*2+(i.armor||0);
  for(const instance of p.instances){const item=items.find(i=>i.id===instance.item),old=items.find(i=>i.id===p.equipment[item.slot]);if(!item.combatClass&&item.slot!=='consumable'&&p.level>=requiredLevel(p,item)&&score(item)>score(old||{}))act({type:'equip',instance:instance.uid});}
  for(let n=0;n<9;n++){
   const choices=items.filter(i=>!i.honorCost&&!i.combatClass&&i.slot!=='consumable'&&requiredLevel(p,i)<=p.level&&shopPrice(p,i)<=p.gold&&score(i)>score(items.find(x=>x.id===p.equipment[i.slot])||{})).sort((a,b)=>((score(b)-score(items.find(x=>x.id===p.equipment[b.slot])||{}))/shopPrice(p,b))-((score(a)-score(items.find(x=>x.id===p.equipment[a.slot])||{}))/shopPrice(p,a)));
   if(!choices.length)break;const item=choices[0];act({type:'buy',item:item.id});act({type:'equip',instance:p.instances.at(-1).uid});
  }
  act({type:'rest'});
 }
 function fight(campaign,trial){
  act(trial?{type:'trialStart',trial}:campaign?{type:'campaignFight'}:{type:'battle',enemy:p.level>=4?'knight':'recruit'});
  while(!p.battle.result){assert.ok(rounds++<4000,'Зависання бойового циклу');const d=derived(p),intent=p.battle.intent;
   if(p.hp+45<d.maxHp&&p.inventory.includes('potion')&&(intent?.kind==='guard'||!trial&&p.hp<45))act({type:'potion'});
   else{const blocks=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];act({type:'turn',attack:intent?.block?[0,1,2,3].find(n=>!intent.block.includes(n)):Math.floor(rng()*4),block:intent?.zone!==undefined?blocks.findIndex(b=>b.includes(intent.zone)):Math.floor(rng()*6),stance:intent?.kind==='guard'?'attack':'defense',power:p.energy>=10,shot:false});}
  }
  const result=p.battle.result;act({type:'leave'});return result;
 }
 assert.throws(()=>act({type:'contract',contract:'five_roads'}));
 for(const contract of contracts){
  prepare();while(p.level<contract.level){assert.ok(farm++<30,'Надмірний гринд рівня');fight(false);prepare();}
  let attempts=0;
  do{assert.ok(attempts++<5,'Непрохідний розділ: '+contract.id);act({type:'contract',contract:contract.id});for(let stage=0;stage<3;stage++){prepare();if(fight(true)!=='win')break;}}while(!p.completedContracts.includes(contract.id));
 }
 prepare();assert.equal(p.completedContracts.length,12);assert.equal(p.storyComplete,true);assert.equal(p.title,'Хранитель П’яти Доріг');assert.ok(p.claimed.includes('chapter12'));assert.ok(p.level>=12);assert.equal(p.inventory.includes('legend_sabre'),true);assert.ok(rounds>100);
 for(const trial of ['sentinel','marshal','champion']){let attempts=0;do{assert.ok(attempts++<5,'Непрохідне випробування: '+trial);prepare();for(let i=0;i<5&&p.instances.length<60&&p.gold>=25;i++)act({type:'buy',item:'potion'});fight(false,trial);}while(!p.trialsCompleted.includes(trial));}
 assert.equal(p.honor,18);if(p.instances.length===60)act({type:'sell',item:'potion'});act({type:'honorBuy',item:'council_seal'});assert.equal(p.honor,10);assert.equal(p.instances.at(-1).item,'council_seal');
});
