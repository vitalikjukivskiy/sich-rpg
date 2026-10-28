import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,quests,derived} from '../game.mjs';
import {migrate,action,worldSnapshot} from '../world.mjs';
import {contracts} from '../factions.mjs';
import {trackQuest,trackedQuest,clearQuest,afterTaskAction,campaignOrigin,observeQuestState} from '../public/quest-return.js';

function fixture(){
 const p=migrate(newPlayer('Повернення до завдання')),db={players:{[p.id]:p},clans:{},duels:{},market:{}};
 return {p,act:a=>action(p,a,()=>.99),snapshot:()=>structuredClone({player:p,quests,derived:derived(p),...worldSnapshot(db,p)})};
}
function startCampaign(f){f.act({type:'faction',faction:'cossacks'});f.act({type:'contract',contract:'crossing'});f.act({type:'campaignFight'});}
function winCurrentBattle(f){f.p.battle.enemy.currentHp=1;f.act({type:'turn',attack:0,block:0,stance:'attack'});assert.equal(f.p.battle.result,'win');}

test('щоденна ціль повертає до прогресу лише після п’ятого збору; отримання нагороди знімає відстеження',()=>{
 clearQuest();const f=fixture();assert.equal(trackQuest(f.snapshot(),{id:'daily_herbs',kind:'daily'}).progress,0);
 for(let n=1;n<=5;n++){
  const before=f.snapshot();f.act({type:'gather',resource:'herb'});const after=f.snapshot(),finished=afterTaskAction(before,after);
  if(n<5)assert.equal(finished,null);else assert.deepEqual(finished,{id:'daily_herbs',kind:'daily',name:'Поповнити аптечку',progress:5,target:5,claimed:false,ready:true});
  assert.equal(afterTaskAction(after,after),null,'повторний знімок або polling не є новим завершенням');
 }
 f.act({type:'daily',quest:'daily_herbs'});assert.equal(trackedQuest(f.snapshot()),null);
});

test('одноразова ціль використовує реальні покупки та відхиляє вже отриману нагороду',()=>{
 clearQuest();const f=fixture();trackQuest(f.snapshot(),{id:'merchant',kind:'milestone'});
 const before=f.snapshot();f.act({type:'buy',item:'potion'});const after=f.snapshot();
 assert.equal(afterTaskAction(before,after)?.id,'merchant');assert.equal(trackedQuest(after)?.ready,true);
 f.act({type:'claim',quest:'merchant'});assert.equal(trackedQuest(f.snapshot()),null);
 assert.equal(trackQuest(f.snapshot(),{id:'merchant',kind:'milestone'}),null);
});

test('відстеження скидається при зміні доби, гравця або зникненні завдання',()=>{
 clearQuest();const f=fixture();trackQuest(f.snapshot(),{id:'daily_herbs',kind:'daily'});
 const nextDay=f.snapshot();nextDay.player.daily.day='2099-01-01';assert.equal(trackedQuest(nextDay),null);
 trackQuest(f.snapshot(),{id:'herbs',kind:'milestone'});const other=fixture();assert.equal(trackedQuest(other.snapshot()),null);assert.equal(trackedQuest(f.snapshot()),null);
 trackQuest(f.snapshot(),{id:'herbs',kind:'milestone'});const changed=f.snapshot();changed.quests=changed.quests.filter(q=>q.id!=='herbs');assert.equal(trackedQuest(changed),null);
});

test('у sessionStorage зберігається лише вибір завдання; він переживає перезавантаження модуля',async()=>{
 clearQuest();const previous=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'),values=new Map();
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});
 try{
  const model=await import('../public/quest-return.js?storage-test');const f=fixture();model.trackQuest(f.snapshot(),{id:'daily_herbs',kind:'daily'});
  const saved=JSON.parse([...values.values()][0]);assert.deepEqual(Object.keys(saved).sort(),['day','id','kind','player']);assert.equal(saved.day,f.p.daily.day);
  const reloaded=await import('../public/quest-return.js?storage-reload');assert.equal(reloaded.trackedQuest(f.snapshot())?.id,'daily_herbs');
  reloaded.clearQuest(f.snapshot());assert.equal(values.size,0);
 }finally{if(previous)Object.defineProperty(globalThis,'sessionStorage',previous);else delete globalThis.sessionStorage;}
});

test('заблоковане сховище не заважає відстеженню у поточному вікні',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('Storage denied');}});
 try{const model=await import('../public/quest-return.js?blocked-storage');const f=fixture();assert.equal(model.trackQuest(f.snapshot(),{id:'herbs',kind:'milestone'})?.id,'herbs');assert.equal(model.trackedQuest(f.snapshot())?.progress,0);model.clearQuest();assert.equal(model.trackedQuest(f.snapshot()),null);}
 finally{if(previous)Object.defineProperty(globalThis,'sessionStorage',previous);else delete globalThis.sessionStorage;}
});

test('походження сюжетного бою зберігається після перемоги та нового завантаження клієнта',async()=>{
 const f=fixture();startCampaign(f);const id=f.p.battle.id,expected={id:f.p.campaign.id,contract:'crossing',stage:0,battleId:id};
 assert.equal(f.p.battle.source,'campaign');assert.deepEqual(campaignOrigin(f.snapshot()),expected);
 winCurrentBattle(f);assert.equal(f.p.campaign.currentBattle,null);assert.equal(f.p.campaign.stage,1);
 const reloaded=await import('../public/quest-return.js?campaign-reload');assert.deepEqual(reloaded.campaignOrigin(f.snapshot()),expected);
});

test('звичайний бій зі спільним суперником не приймається за кампанію',()=>{
 const f=fixture();f.act({type:'faction',faction:'cossacks'});f.act({type:'contract',contract:'crossing'});
 const enemy=contracts.find(c=>c.id==='crossing').enemies[0];f.act({type:'battle',enemy});assert.equal(campaignOrigin(f.snapshot()),null);observeQuestState(f.snapshot());
 winCurrentBattle(f);assert.equal(f.p.campaign.stage,0);assert.equal(campaignOrigin(f.snapshot()),null);
});

test('старий активний бій розпізнається за точним ID, але кеш не переходить до наступного тренування',()=>{
 const f=fixture();startCampaign(f);delete f.p.battle.source;delete f.p.battle.campaign;
 const expected=campaignOrigin(f.snapshot());assert.equal(expected?.battleId,f.p.battle.id);observeQuestState(f.snapshot());
 winCurrentBattle(f);assert.deepEqual(campaignOrigin(f.snapshot()),expected);
 f.act({type:'leave'});f.act({type:'battle',enemy:contracts[0].enemies[0]});assert.equal(campaignOrigin(f.snapshot()),null);
});

test('пошкоджене походження та чужі види бою не створюють повернення до кампанії',()=>{
 const f=fixture();startCampaign(f);f.p.battle.campaign.contract='unknown';assert.equal(campaignOrigin(f.snapshot()),null);
 f.p.battle.campaign.contract='crossing';f.p.battle.campaign.stage=99;assert.equal(campaignOrigin(f.snapshot()),null);
 f.p.battle.source='road';assert.equal(campaignOrigin(f.snapshot()),null);
 f.p.battle.source='trial';assert.equal(campaignOrigin(f.snapshot()),null);
});
