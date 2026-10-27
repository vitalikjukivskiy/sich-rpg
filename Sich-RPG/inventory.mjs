import {randomUUID} from 'node:crypto';
export const CAPACITY=60;
export function migrateInventory(p){
 if(!Array.isArray(p.instances)){
  p.instances=p.inventory.map(item=>({uid:randomUUID(),item,rank:p.upgrades?.[item]||0}));p.equipmentInstances={};
  for(const [slot,item] of Object.entries(p.equipment))p.equipmentInstances[slot]=p.instances.find(i=>i.item===item)?.uid;
 }
 p.equipmentInstances??={};return p;
}
export function syncInventory(p){
 p.inventory=p.instances.map(i=>i.item);p.equipment={};p.upgrades={};
 for(const i of p.instances)if(i.rank)p.upgrades[i.item]=Math.max(p.upgrades[i.item]||0,i.rank);
 for(const [slot,uid] of Object.entries(p.equipmentInstances)){const item=p.instances.find(i=>i.uid===uid);if(item)p.equipment[slot]=item.item;else delete p.equipmentInstances[slot];}
}
export function equippedRank(p,slot,item){return p.instances?p.instances.find(i=>i.uid===p.equipmentInstances?.[slot]&&i.item===item)?.rank||0:p.upgrades?.[item]||0;}
export function equipped(p,uid){return Object.values(p.equipmentInstances||{}).includes(uid);}
export function findInstance(p,a){
 if(a.instance)return p.instances.find(i=>i.uid===a.instance);
 return p.instances.filter(i=>i.item===a.item).sort((a,b)=>Number(equipped(p,a.uid))-Number(equipped(p,b.uid))||a.rank-b.rank)[0];
}
export function addInstance(p,item,rank=0,uid=randomUUID()){
 if(p.instances.length>=CAPACITY)throw new Error('У скрині немає місця.');
 if(p.instances.some(i=>i.uid===uid))throw new Error('Цей предмет уже у скрині.');
 const instance={uid,item,rank};p.instances.push(instance);syncInventory(p);return instance;
}
export function removeInstance(p,uid){
 const index=p.instances.findIndex(i=>i.uid===uid);if(index<0)throw new Error('Предмет не знайдено.');
 if(equipped(p,uid))throw new Error('Спочатку зніміть цей предмет.');
 const [instance]=p.instances.splice(index,1);syncInventory(p);return instance;
}
