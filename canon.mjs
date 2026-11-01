import {catalog, progression, canonicalRules} from './canon-data.mjs';

export const CANON_VERSION=1;
export const canonicalItems=catalog;
export const canonicalItemById=new Map(catalog.map(item=>[item.id,item]));
export const weaponTypes={knife:{name:'Ніж',art:'sabre',traits:'Критичний удар · ухилення'},club:{name:'Дубина',art:'mace',traits:'Антикрит · антиухилення'},sword:{name:'Меч',art:'sabre',traits:'Ухилення · антиухилення'},axe:{name:'Сокира',art:'axe',traits:'Критичний удар · антикрит'},hammer:{name:'Молот',art:'hammer',traits:'Критичний удар · антиухилення'},spear:{name:'Спис',art:'pike',traits:'Ухилення · антикрит'}};
export {progression,canonicalRules};
export function minor(value){return Math.round(Number(value||0)*100);}
export function balanceMinor(p,currency='florin'){return currency==='sesterce'?p.sestercesMinor||0:minor(p.gold);}
export function creditMinor(p,amount,currency='florin'){
 if(!Number.isSafeInteger(amount))throw new Error('Некоректна сума.');
 const next=balanceMinor(p,currency)+amount;
 if(!Number.isSafeInteger(next)||next<0)throw new Error(currency==='sesterce'?'Бракує сестерціїв.':'Бракує флоринів.');
 if(currency==='sesterce')p.sestercesMinor=next;else p.gold=next/100;
}
export function progressionAt(xp){return progression.findLast(row=>row.xp<=xp)||progression[0];}
export function nextMilestone(xp){return progression.find(row=>row.xp>xp)||null;}
export function migrateProgression(p){
 if(p.canonVersion)return;
 // Preserve legacy level, allocated points, money and equipment. Rebase only the
 // old within-level XP counter; past rewards are marked as already settled.
 const baseLevel=Math.min(11,Math.max(0,p.level)),first=progression.find(row=>row.level===baseLevel),next=progression.find(row=>row.level===baseLevel+1);
 p.legacyProgress={level:p.level,xp:p.xp,stats:{...p.stats},points:p.points};
 p.xp=first?first.xp+Math.floor(Math.min(.999,(p.xp||0)/Math.max(100,p.level*100))*(next?next.xp-first.xp:0)):p.xp||0;
 const reached=progressionAt(p.xp);p.points=Math.max(p.points||0,reached.totalStats-['strength','agility','intuition','vitality'].reduce((n,k)=>n+(p.stats[k]||0),0));p.progressionCursor=reached.xp;p.canonVersion=CANON_VERSION;p.sestercesMinor??=0;
}
export function awardProgression(p,xp,gold=0){
 if(!Number.isSafeInteger(xp)||xp<0||!Number.isFinite(gold)||gold<0)throw new Error('Некоректна нагорода.');
 migrateProgression(p);const before=p.progressionCursor;
 p.xp+=xp;creditMinor(p,minor(gold));
 const reached=progression.filter(row=>row.xp>before&&row.xp<=p.xp);
 for(const row of reached){p.points+=row.statAward;creditMinor(p,row.florinAwardMinor);p.level=Math.max(p.level,row.level);p.progressionCursor=row.xp;}
 return reached;
}
export function gearTotals(p,allItems,{excludeSlot}={}){
 const totals={};
 for(const [slot,id] of Object.entries(p.equipment||{})){
  if(slot===excludeSlot)continue;
  const item=allItems.find(i=>i.id===id);if(!item)continue;
  if(item.canonical){for(const [key,value] of Object.entries(item.modifiers))totals[key]=(totals[key]||0)+value;}
  else {
   // Retain the value of owned Sich gear during the migration.
   const rank=p.instances?.find(i=>i.uid===p.equipmentInstances?.[slot])?.rank||0;
   if(item.damage){totals.minDamage=(totals.minDamage||0)+item.damage+rank*2;totals.maxDamage=(totals.maxDamage||0)+item.damage+rank*2;}
   if(item.armor)for(const zone of ['headArmor','bodyArmor','waistArmor','legArmor'])totals[zone]=(totals[zone]||0)+item.armor+rank*2;
  }
 }
 return totals;
}
export function effectiveStats(p,allItems,options){
 const gear=gearTotals(p,allItems,options);
 return {strength:(p.stats.strength||0)+(gear.strength||0),agility:(p.stats.agility||0)+(gear.agility||0),intuition:(p.stats.intuition??p.stats.instinct??0)+(gear.instinct||0),vitality:(p.stats.vitality||0)+(gear.vitality||0),intellect:(p.stats.intellect||0)+(gear.intellect||0)};
}
export function sourceRequirements(item){return Object.fromEntries(Object.entries(item.requirements||{}).filter(([key])=>key!=='level').map(([key,value])=>[key==='instinct'?'intuition':key,value]));}
export function canEquipCanonical(p,item,allItems){const stats=effectiveStats(p,allItems,{excludeSlot:item.slot});return p.level>=item.level&&Object.entries(sourceRequirements(item)).every(([key,value])=>(stats[key]||0)>=value);}
export function canonicalProfile(p,allItems){
 const g=gearTotals(p,allItems),s=effectiveStats(p,allItems),weapon=allItems.find(i=>i.id===p.equipment?.weapon),knuckle=weapon?.canonical&&weapon.category==='cas',classId=knuckle?'unarmed':weapon?.weaponType||({sabre:'sword',mace:'club',pike:'spear'})[weapon?.combatClass]||weapon?.combatClass||(weapon?.slot==='weapon'?'sword':'unarmed');
 const minDamage=Math.max(1,g.minDamage||1),maxDamage=Math.max(minDamage,g.maxDamage||2);
 return {ruleset:'lutecia-public',level:p.level,classId,className:knuckle?'Кастет':weaponTypes[classId]?.name||'Без зброї',maxHp:Math.max(1,s.vitality*6+(g.health||0)),maxStamina:Math.max(1,s.strength*6+(g.stamina||0)),stats:s,minDamage,maxDamage,attack:(minDamage+maxDamage)/2,crit:s.intuition*3+(g.critical||0),antiCrit:s.intuition*3+(g.antiCritical||0),dodge:s.agility*3+(g.dodge||0),antiDodge:s.agility*3+(g.antiDodge||0),zoneArmor:['headArmor','bodyArmor','waistArmor','legArmor'].map(key=>Math.max(0,g[key]||0)),armor:Math.max(0,g.bodyArmor||0),critMultiplier:1.5,ability:null,pace:1};
}
export function roundTimeout(startedAt,now=Date.now()){
 const rule=canonicalRules.combat,elapsed=Math.max(0,now-startedAt);
 return Math.max(rule.minimumReducedTimeoutMs,rule.defaultTimeoutMs-Math.floor(elapsed/rule.timeoutReductionIntervalMs)*rule.timeoutReductionMs);
}
export function repairQuote(p,instance,item){
 if(!item?.canonical||item.category==='stone')throw new Error('Цю річ неможливо відремонтувати.');
 const wear=instance.wear||0;if(!Number.isInteger(wear)||wear<0||wear>=item.durability)throw new Error('Некоректний стан речі.');
 // Reputation discount is intentionally not inferred from faction reputation.
 return wear*canonicalRules.repair.unitPriceMinor;
}
