import {today} from './content.mjs';
import {addInstance,CAPACITY} from './inventory.mjs';
export const buildings=[
 {id:'infirmary',name:'Курінний лазарет',art:'potion',text:'Раз на добу: 1–3 настоянки за рівнем будівлі.',costs:[200,450,800]},
 {id:'workshop',name:'Майстерня',art:'ore',text:'Раз на добу: 2–6 руди для власного гарту.',costs:[200,450,800]},
 {id:'watch',name:'Дозорна вежа',art:'clan',text:'Раз на добу: 2–6 пороху та 1–3 трави.',costs:[200,450,800]}
];
export const orders=[{id:'guard',name:'Варта спільної дороги',text:'Здобудьте разом 10 перемог після вступу в курінь.',metric:'wins',target:10,gold:400},{id:'craft',name:'Припас для братства',text:'Виконайте разом 5 майстрових робіт.',metric:'forged',target:5,gold:250},{id:'trade',name:'Курінний торговий шлях',text:'Продайте разом 3 лоти на комісійці.',metric:'marketSales',target:3,gold:300}];
const check=(v,m)=>{if(!v)throw new Error(m);};
export function prepareClan(c){c.buildings??={};c.progress??={wins:0,forged:0,marketSales:0};c.orderClaims??=[];c.contributions??={};return c;}
export function recordClanProgress(before,after){
 for(const c of Object.values(after.clans||{}))prepareClan(c);
 for(const [id,p]of Object.entries(after.players)){const old=before.players[id],clan=after.clans?.[p.clanId];if(!old||!clan||old.clanId!==p.clanId)continue;for(const metric of ['wins','forged','marketSales']){const delta=Math.max(0,(p[metric]||0)-(old[metric]||0));if(!delta)continue;clan.progress[metric]+=delta;clan.contributions[id]??={wins:0,forged:0,marketSales:0};clan.contributions[id][metric]+=delta;}}
}
export function clanWorksAction(c,p,a){
 check(c,'Спочатку вступіть у курінь.');prepareClan(c);
 if(a.type==='order'){
  check(c.leader===p.id,'Нагороду для скарбниці забирає отаман.');const q=orders.find(q=>q.id===a.order);check(q,'Наказ не знайдено.');check(!c.orderClaims.includes(q.id),'Нагороду вже зараховано.');check(c.progress[q.metric]>=q.target,'Спільний наказ ще не виконано.');c.orderClaims.push(q.id);c.treasury+=q.gold;return;
 }
 const building=buildings.find(b=>b.id===a.building);check(building,'Будівлю не знайдено.');const rank=c.buildings[building.id]||0;
 if(a.type==='build'){
  check(c.leader===p.id,'Розбудову замовляє лише отаман.');check(rank<3,'Будівля вже має 3 рівень.');const cost=building.costs[rank];check(c.treasury>=cost,'Бракує грошей у скарбниці.');c.treasury-=cost;c.buildings[building.id]=rank+1;return;
 }
 check(a.type==='supply','Невідома курінна справа.');check(rank>0,'Спочатку побудуйте цю споруду.');const day=today(),ledger=p.clanSupplies?.day===day?p.clanSupplies:{day,claimed:[]};check(!ledger.claimed.includes(building.id),'Цей припас сьогодні вже отримано, навіть якщо ви змінили курінь.');const upkeep=rank*5;check(c.treasury>=upkeep,'У скарбниці бракує грошей на утримання: '+upkeep+' флоринів.');check(building.id!=='infirmary'||p.instances.length+rank<=CAPACITY,'Звільніть місце для настоянок.');
 if(building.id==='infirmary')for(let i=0;i<rank;i++)addInstance(p,'potion');else if(building.id==='workshop')p.materials.ore+=rank*2;else{p.materials.resin+=rank*2;p.materials.herb+=rank;}c.treasury-=upkeep;ledger.claimed.push(building.id);p.clanSupplies=ledger;
}
export function clanWorksSnapshot(db,p){const clan=db.clans?.[p.clanId];if(clan)prepareClan(clan);const claims=p.clanSupplies?.day===today()?p.clanSupplies.claimed:[];return {buildings:buildings.map(b=>({...b,rank:clan?.buildings[b.id]||0,claimed:claims.includes(b.id)})),clanOrders:orders.map(q=>({...q,progress:clan?.progress[q.metric]||0,claimed:clan?.orderClaims.includes(q.id)||false}))};}
