import {randomUUID} from 'node:crypto';
import {items} from './game.mjs';
import {rules} from './factions.mjs';
import {migrateInventory,addInstance,removeInstance,CAPACITY} from './inventory.mjs';
import {onRoad} from './roads.mjs';
import {priceFloor} from './balance.mjs';
const HOUR=3600000;
const DAY=86400000;
const newAccount=(p,now)=>now-(p.createdAt||now)<DAY;
const listingLimit=(p,now)=>newAccount(p,now)?5:20;
const resourceFloors={herb:2,ore:5,resin:4};
const resources={herb:'Лікувальні трави',ore:'Залізна руда',resin:'Порох'};
function check(value,message){if(!value)throw new Error(message);}
function ready(p){check(!onRoad(p),'Торгівля доступна після повернення з дороги.');check(!p.duelId&&(!p.battle||p.battle.result),'Завершіть бій перед торговою операцією.');migrateInventory(p);}
function delivery(p,payload,reason,now){p.deliveries??=[];p.deliveries.push({id:randomUUID(),...payload,reason,createdAt:now,claimedAt:null});}
function returnLot(db,lot,reason,now){const seller=db.players[lot.seller];check(seller,'Власника лота не знайдено.');delivery(seller,lot.kind==='item'?{kind:'item',instance:lot.instance}:{kind:'resource',resource:lot.resource,quantity:lot.quantity},reason,now);}
export function expireMarket(db,now=Date.now()){
 db.market??={};let changed=false;
 for(const lot of Object.values(db.market))if(lot.status==='active'&&lot.expiresAt<=now){returnLot(db,lot,'Строк лота минув: '+lot.name,now);lot.status='expired';lot.closedAt=now;changed=true;}
 return changed;
}
export function marketAction(db,p,a,now=Date.now()){
 ready(p);db.market??={};expireMarket(db,now);
 if(a.type==='list'){
  check(Object.values(db.market).filter(l=>l.seller===p.id&&l.status==='active').length<listingLimit(p,now),'Ліміт оголошень: '+listingLimit(p,now)+'. У першу добу доступні 5 лотів.');
  check(Number.isSafeInteger(a.price)&&a.price>=2&&a.price<=1000000,'Ціна за весь лот: ціле число від 2 до 1 000 000.');
  check([12,24,48].includes(a.hours),'Оберіть строк 12, 24 або 48 годин.');
  let payload,name;
  if(a.kind==='item'){
   const instance=p.instances.find(i=>i.uid===a.instance),item=items.find(i=>i.id===instance?.item);check(instance&&item,'Предмет не знайдено.');
   check(!Object.values(p.equipmentInstances).includes(instance.uid),'Спочатку зніміть цей предмет.');
   check(!Object.values(db.market).some(l=>l.status==='active'&&l.instance?.uid===instance.uid),'Цей екземпляр уже виставлено.');check(a.price<=priceFloor(item,instance.rank)*20,'Ціна перевищує захисну межу: 20 мінімальних цін.');check(a.price>=priceFloor(item,instance.rank),'Мінімальна ціна цієї речі: '+priceFloor(item,instance.rank)+' талерів.');name=item.name+(instance.rank?' +'+instance.rank:'');payload={kind:'item',instance:removeInstance(p,instance.uid),item:item.id,rank:instance.rank,quantity:1,category:['weapon','pistol'].includes(item.slot)?'weapon':item.slot==='consumable'?'consumable':'armor',level:item.level};
  }else{
   check(a.kind==='resource'&&resources[a.resource],'Оберіть відомий припас.');check(Number.isSafeInteger(a.quantity)&&a.quantity>=1&&a.quantity<=100000,'Кількість припасів: від 1 до 100 000.');check(p.materials[a.resource]>=a.quantity,'Недостатньо припасів.');check(a.price>=resourceFloors[a.resource]*a.quantity,'Мінімальна ціна припасів: '+resourceFloors[a.resource]*a.quantity+' талерів.');
   p.materials[a.resource]-=a.quantity;name=resources[a.resource];payload={kind:'resource',resource:a.resource,quantity:a.quantity,category:'resource',level:1};
  }
  const feeRate=rules(p).marketFee,fee=Math.max(1,Math.ceil(a.price*feeRate)),id=randomUUID();
  db.marketAudit??=[];if(a.kind==='item'&&a.price>priceFloor(items.find(i=>i.id===payload.item),payload.rank)*10){db.marketAudit.push({kind:'overpriced',seller:p.id,item:payload.item,price:a.price,at:now});db.marketAudit=db.marketAudit.slice(-1000);}
  if(a.kind==='resource'&&a.price>resourceFloors[a.resource]*a.quantity*10){db.marketAudit.push({kind:'overpriced-resource',seller:p.id,resource:a.resource,quantity:a.quantity,price:a.price,at:now});db.marketAudit=db.marketAudit.slice(-1000);}
  db.market[id]={id,...payload,name,price:a.price,feeRate,fee,net:a.price-fee,seller:p.id,sellerName:p.name,sellerFaction:p.faction,status:'active',createdAt:now,expiresAt:now+a.hours*HOUR};return;
 }
 if(a.type==='claim'){
  const receipt=p.deliveries?.find(d=>d.id===a.id);check(receipt&&receipt.claimedAt===null,'Посилка вже отримана або не знайдена.');
  if(receipt.kind==='item'){check(p.instances.length<CAPACITY,'У скрині немає місця. Посилка зберігається у писаря.');addInstance(p,receipt.instance.item,receipt.instance.rank,receipt.instance.uid);}
  else if(receipt.kind==='gold'){check(Number.isSafeInteger(p.gold+receipt.amount),'Завеликий баланс.');p.gold+=receipt.amount;}
  else p.materials[receipt.resource]+=receipt.quantity;
  receipt.claimedAt=now;return;
 }
 const lot=db.market[a.id];check(lot&&lot.status==='active'&&lot.expiresAt>now,'Лот уже продано, знято або строк минув.');
 if(a.type==='cancel'){check(lot.seller===p.id,'Це не ваше оголошення.');returnLot(db,lot,'Оголошення знято: '+lot.name,now);lot.status='cancelled';lot.closedAt=now;return;}
 check(a.type==='buy','Невідома торгова дія.');check(lot.seller!==p.id,'Власний лот можна зняти, але не купити.');check(p.gold>=lot.price,'Бракує талерів.');
 const daily=Object.values(db.market).filter(l=>l.status==='sold'&&l.closedAt>now-DAY&&(l.buyer===p.id||l.seller===p.id)).reduce((sum,l)=>sum+l.price,0);
 check(!newAccount(p,now)||daily+lot.price<=5000,'У першу добу торговий обіг обмежений 5000 талерами.');
 const owner=db.players[lot.seller];check(owner,'Продавця не знайдено.');const sellerDaily=Object.values(db.market).filter(l=>l.status==='sold'&&l.closedAt>now-DAY&&(l.buyer===owner.id||l.seller===owner.id)).reduce((sum,l)=>sum+l.price,0);check(!newAccount(owner,now)||sellerDaily+lot.price<=5000,'Продавець досяг ліміту першої доби: 5000 талерів.');
 const related=Object.values(db.market).filter(l=>l.status==='sold'&&l.closedAt>now-DAY&&((l.buyer===p.id&&l.seller===lot.seller)||(l.seller===p.id&&l.buyer===lot.seller))).reduce((sum,l)=>sum+l.price,0);
 check(related+lot.price<=50000,'Добовий ліміт обміну між цією парою гравців: 50 000 талерів.');
 if(lot.kind==='item'){check(p.instances.length<CAPACITY,'У скрині немає місця.');addInstance(p,lot.instance.item,lot.instance.rank,lot.instance.uid);}
 else p.materials[lot.resource]+=lot.quantity;
 p.gold-=lot.price;p.marketPurchases=(p.marketPurchases||0)+1;
 const seller=db.players[lot.seller];check(seller,'Продавця не знайдено.');delivery(seller,{kind:'gold',amount:lot.net},'Продано: '+lot.name+' · комісія '+lot.fee+' тал.',now);seller.marketSales=(seller.marketSales||0)+1;
 lot.status='sold';lot.buyer=p.id;lot.buyerName=p.name;lot.closedAt=now;db.marketAudit??=[];db.marketAudit.push({kind:'trade',seller:lot.seller,buyer:p.id,lot:lot.id,price:lot.price,at:now});db.marketAudit=db.marketAudit.slice(-1000);
 db.marketFees=(db.marketFees||0)+lot.fee;
}
export function marketSnapshot(db,p,now=Date.now()){
 const publicLot=l=>({id:l.id,name:l.name,item:l.item,rank:l.rank,resource:l.resource,kind:l.kind,quantity:l.quantity,category:l.category,level:l.level,price:l.price,seller:l.seller,sellerName:l.sellerName,sellerFaction:l.sellerFaction,status:l.status,createdAt:l.createdAt,expiresAt:l.expiresAt,...(l.seller===p.id?{fee:l.fee,feeRate:l.feeRate,net:l.net,buyerName:l.buyerName}:{} )});
 return {market:{resourcePriceFloors:resourceFloors,instancePriceFloors:Object.fromEntries((p.instances||[]).map(i=>[i.uid,priceFloor(items.find(x=>x.id===i.item),i.rank)])),priceFloors:Object.fromEntries(items.map(item=>[item.id,priceFloor(item)])),lots:Object.values(db.market||{}).filter(l=>l.status==='active'&&l.expiresAt>now).sort((a,b)=>b.createdAt-a.createdAt).map(publicLot),mine:Object.values(db.market||{}).filter(l=>l.seller===p.id).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100).map(publicLot),deliveries:(p.deliveries||[]).filter(d=>d.claimedAt===null),feeRate:rules(p).marketFee,maxListings:listingLimit(p,now),newAccount:newAccount(p,now),dailyLimit:newAccount(p,now)?5000:null}};
}
