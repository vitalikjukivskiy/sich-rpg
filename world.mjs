import {action as baseAction,items,award,derived,blocks,zones} from './game.mjs';
import {randomUUID} from 'node:crypto';
import {factions,contracts,rules,requiredLevel,shopPrice,forgePrice} from './factions.mjs';
import {recipes,dailyQuests,refreshDaily,progressOf} from './content.mjs';
import {migrateInventory,syncInventory,findInstance,addInstance,removeInstance,CAPACITY} from './inventory.mjs';
import {roadAction,resolveRoadBattle,roadSnapshot,onRoad} from './roads.mjs';
import {trialAction,resolveTrialBattle,trialSnapshot} from './trials.mjs';
import {clanWorksAction,clanWorksSnapshot} from './clanworks.mjs';
export function migrate(p){p.materials??={herb:0,ore:0,resin:0};p.upgrades??={};p.gathered??=0;p.forged??=0;p.forestWins??=0;p.faction??=null;p.reputation??={};p.campaign??=null;p.starterClaimed??=false;p.deliveries??=[];p.completedContracts??=[];if(p.campaign?.status==='complete'&&!p.completedContracts.includes(p.campaign.contract))p.completedContracts.push(p.campaign.contract);p.storyComplete??=p.completedContracts.includes('five_roads');p.journey??=null;p.journeysWon??=0;p.journeyRoutes??=[];p.honor??=0;p.trialsCompleted??=[];p.trialRecords??={};refreshDaily(p);migrateInventory(p);if(p.alignment==='Шлях свободи')p.alignment='Вільний козак';return p;}
function check(v,m){if(!v)throw new Error(m);}
export function idle(p){check(!p.duelId,'Спочатку завершіть дуель.');check(!p.battle||p.battle.result,'Спочатку завершіть поточний поєдинок.');}
function starter(p){
 check(!p.starterClaimed,'Стартовий набір уже отримано.');const faction=factions.find(f=>f.id===p.faction);check(faction,'Спочатку оберіть сторону.');const pack=faction.starter;
 check(p.instances.length+pack.items.length<=CAPACITY,'Звільніть місце у скрині для стартового набору.');
 for(const item of pack.items)addInstance(p,item);p.gold+=pack.gold;for(const [id,n]of Object.entries(pack.materials))p.materials[id]+=n;p.starterClaimed=true;p.starterFaction=faction.id;
}
export function action(p,a,rng=Math.random){
 migrate(p);
 if(p.duelId)throw new Error('Спочатку завершіть дуель.');
 if(onRoad(p)&&!['roadChoice','roadAbandon','turn','potion','leave','surrender','stat','claim','daily'].includes(a.type))throw new Error('Ви в дорозі. Завершіть подорож або поверніть обоз. Лікуйтеся настоянками й під час зустрічей.');
 if(['roadStart','roadChoice','roadAbandon'].includes(a.type)){roadAction(p,a,rng);return p;}
 if(['trialStart','honorBuy'].includes(a.type)){idle(p);trialAction(p,a);return p;}
 if(a.type==='retrain'){
  idle(p);check(p.level>1,'Вправи відкриються з 2 рівня.');const cost=Math.max(50,(p.level-1)*25);check(p.gold>=cost,'Бракує талерів для перенавчання.');p.gold-=cost;p.stats={strength:5,agility:5,intuition:5,vitality:5};p.points=(p.level-1)*3;p.hp=Math.min(p.hp,derived(p).maxHp);return p;
 }
 if(a.type==='daily'){
  idle(p);const q=dailyQuests.find(x=>x.id===a.quest);check(q,'Доручення не знайдено.');check(!p.daily.claimed.includes(q.id),'Сьогоднішню нагороду вже отримано.');check(progressOf(p,q.metric)-(p.daily.base[q.metric]||0)>=q.target,'Доручення ще не виконано.');p.daily.claimed.push(q.id);award(p,q.xp,q.gold);return p;
 }
 if(a.type==='recipe'){
  idle(p);const r=recipes.find(x=>x.id===a.recipe);check(r,'Рецепт не знайдено.');check(p.level>=r.level,'Замалий рівень.');check(p.gold>=r.gold,'Бракує талерів.');check(p.instances.length+r.quantity<=CAPACITY,'У скрині немає місця.');for(const [key,n]of Object.entries(r.materials))check(p.materials[key]>=n,'Бракує припасів.');p.gold-=r.gold;for(const [key,n]of Object.entries(r.materials))p.materials[key]-=n;for(let i=0;i<r.quantity;i++)addInstance(p,r.item);p.forged++;return p;
 }
 if(a.type==='starter'){idle(p);starter(p);return p;}
 if(['buy','sell','equip'].includes(a.type)){
  idle(p);
  if(a.type==='buy'){const item=items.find(i=>i.id===a.item);check(item,'Предмет не знайдено.');check(!item.honorCost,'Ця річ доступна за відзнаки у випробуваннях ради.');check(p.level>=requiredLevel(p,item),'Недостатній рівень.');const price=shopPrice(p,item);check(p.gold>=price,'Бракує талерів.');check(p.instances.length<CAPACITY,'У скрині немає місця.');addInstance(p,item.id);p.gold-=price;p.purchases++;return p;}
  const instance=findInstance(p,a),item=items.find(i=>i.id===instance?.item);check(instance&&item,'Предмет не знайдено.');
  if(a.type==='sell'){removeInstance(p,instance.uid);p.gold+=Math.floor(item.price/2);return p;}
  check(item.slot!=='consumable','Цей предмет потрібно використати.');check(p.level>=requiredLevel(p,item),'Недостатній рівень.');
  if(p.equipmentInstances[item.slot]===instance.uid)delete p.equipmentInstances[item.slot];else p.equipmentInstances[item.slot]=instance.uid;syncInventory(p);return p;
 }
 if(a.type==='faction'){
  idle(p);const f=factions.find(f=>f.id===a.faction);check(f,'Такої сторони немає.');check(p.faction!==f.id,'Ви вже на цій службі.');const first=!p.faction,price=first?0:50;check(p.gold>=price,'Зміна служби коштує 50 талерів.');const hp=derived(p).maxHp;p.gold-=price;p.faction=f.id;p.city=f.city;p.alignment=f.name;
  for(const [slot,uid] of Object.entries(p.equipmentInstances)){const instance=p.instances.find(i=>i.uid===uid),item=items.find(i=>i.id===instance?.item);if(item&&p.level<requiredLevel(p,item))delete p.equipmentInstances[slot];}syncInventory(p);
  p.hp=Math.max(0,Math.min(derived(p).maxHp,p.hp+derived(p).maxHp-hp));if(!p.visited.includes(f.city))p.visited.push(f.city);if(first&&!p.starterClaimed)starter(p);return p;
 }
 if(a.type==='contract'){
  idle(p);check(p.faction,'Оберіть свою сторону на мапі.');check(!p.campaign||p.campaign.status!=='active','Спочатку завершіть або скасуйте поточний похід.');const contract=contracts.find(c=>c.id===a.contract);check(contract,'Доручення не знайдено.');check(p.level>=contract.level,'Замалий рівень для цього походу.');check(!contract.requires||p.completedContracts.includes(contract.requires),'Спочатку завершіть попередній розділ кампанії.');p.campaign={id:randomUUID(),contract:contract.id,faction:p.faction,stage:0,status:'active',currentBattle:null,rewardGiven:false};return p;
 }
 if(a.type==='campaignFight'){
  idle(p);const c=p.campaign,contract=contracts.find(x=>x.id===c?.contract);check(c?.status==='active'&&contract,'Немає активного походу.');check(p.hp>0,'Відновіть здоров’я перед наступною сутичкою.');baseAction(p,{type:'battle',enemy:contract.enemies[c.stage]},rng);c.currentBattle=p.battle.id;return p;
 }
 if(a.type==='cancelContract'){idle(p);check(p.campaign?.status==='active','Немає активного походу.');p.campaign.status='cancelled';return p;}
 if(a.type==='gather'){
  idle(p);check(['herb','ore','resin'].includes(a.resource),'Невідомий ресурс.');const cost=rules(p).gatherCost;check(p.energy>=cost,'Бракує витривалості. Відновіть сили в лікарні.');
  const amount=a.resource==='resin'?rules(p).powderYield:1;p.energy-=cost;p.materials[a.resource]+=amount;if(a.resource==='herb')p.gathered+=amount;return p;
 }
 if(a.type==='forge'){
  idle(p);const instance=findInstance(p,a),item=items.find(i=>i.id===instance?.item);check(instance&&item&&item.slot!=='consumable','Оберіть спорядження зі скрині.');const rank=instance.rank;
  check(rank<5,'Досягнуто максимальне покращення +5.');const cost=forgePrice(p,rank),ore=rank+1;check(p.gold>=cost&&p.materials.ore>=ore,'Бракує талерів або залізної руди.');
  p.gold-=cost;p.materials.ore-=ore;instance.rank++;syncInventory(p);p.forged++;return p;
 }
 if(a.type==='craft'){
  idle(p);check(p.level>=2,'Потрібен 2 рівень.');check(p.gold>=50&&p.materials.herb>=3&&p.materials.resin>=2,'Потрібно 50 талерів, 3 пучки трав та 2 мірки пороху.');check(p.inventory.length<60,'У наплічнику немає місця.');
  p.gold-=50;p.materials.herb-=3;p.materials.resin-=2;addInstance(p,'amulet');p.forged++;return p;
 }
 if(a.type==='potion'&&onRoad(p)&&p.battle?.result)p.battle=null;
 const consumed=a.type==='potion'?p.instances.find(i=>i.item==='potion'):null;
 const result=baseAction(p,a,rng),campaign=p.campaign;
 if(consumed){p.instances=p.instances.filter(i=>i.uid!==consumed.uid);syncInventory(p);}
 if(campaign?.status==='active'&&p.battle?.id===campaign.currentBattle&&p.battle.result){
  if(p.battle.result==='win'){campaign.stage++;campaign.currentBattle=null;const contract=contracts.find(x=>x.id===campaign.contract);if(campaign.stage>=contract.enemies.length&&!campaign.rewardGiven){campaign.status='complete';campaign.rewardGiven=true;const first=!p.completedContracts.includes(contract.id);if(first){p.completedContracts.push(contract.id);if(contract.rewardItem)p.deliveries.push({id:randomUUID(),kind:'item',instance:{uid:randomUUID(),item:contract.rewardItem,rank:0},reason:'Відзнака за '+contract.name,createdAt:Date.now(),claimedAt:null});}if(contract.finale){p.storyComplete=true;p.title='Хранитель П’яти Доріг';}award(p,contract.xp,contract.gold);const reputation=Math.ceil(contract.reputation*(campaign.faction==='cossacks'?1.2:1));p.reputation[campaign.faction]=(p.reputation[campaign.faction]||0)+reputation;p.battle.log.push(`Похід завершено! Додатково: ${contract.gold} талерів, ${contract.xp} досвіду та ${reputation} репутації.`);}}
  else campaign.status='failed';
 }
 resolveRoadBattle(p);resolveTrialBattle(p);return result;
}
export function clanAction(db,p,a){
 idle(p);check(!onRoad(p),'Поверніться з дороги, щоб відвідати курінь.');db.clans??={};const clan=p.clanId&&db.clans[p.clanId];
 if(['build','supply','order'].includes(a.type)){clanWorksAction(clan,p,a);return;}
 if(a.type==='create'){
  check(!clan,'Ви вже у курені.');check(p.level>=2,'Курінь можна заснувати з 2 рівня.');check(p.gold>=150,'Для заснування потрібно 150 талерів.');
  const name=String(a.name||'').trim();check(/^[\p{L}\p{N} _’-]{3,30}$/u.test(name),'Назва: 3–30 літер, цифр або пробілів.');check(!Object.values(db.clans).some(c=>c.name.toLowerCase()===name.toLowerCase()),'Такий курінь уже існує.');
  const id=randomUUID();db.clans[id]={id,name,leader:p.id,members:[p.id],treasury:0,createdAt:Date.now()};p.clanId=id;p.gold-=150;
 }else if(a.type==='join'){
  check(!clan,'Ви вже у курені.');const target=db.clans[a.id];check(target,'Курінь не знайдено.');check(target.members.length<20,'У курені немає вільних місць.');target.members.push(p.id);p.clanId=target.id;
 }else if(a.type==='donate'){
  check(clan,'Спочатку вступіть у курінь.');check(Number.isInteger(a.amount)&&a.amount>0&&a.amount<=p.gold,'Введіть доступну цілу суму.');p.gold-=a.amount;clan.treasury+=a.amount;
 }else if(a.type==='leave'){
  check(clan,'Ви не у курені.');clan.members=clan.members.filter(id=>id!==p.id);if(clan.leader===p.id)clan.leader=clan.members[0]||null;if(!clan.members.length)delete db.clans[clan.id];delete p.clanId;
 }else throw new Error('Невідома дія куреня.');
}
export function duelAction(db,p,a,rng=Math.random){
 check(!onRoad(p),'Поверніться з дороги перед дуеллю.');
 db.duels??={};let duel=p.duelId&&db.duels[p.duelId];
 if(a.type==='create'){
  idle(p);check(p.hp>0,'Спочатку відновіть здоров’я.');p.battle=null;const id=randomUUID();db.duels[id]={id,players:[p.id],status:'waiting',round:0,moves:{},log:['Відкрито заявку на чесний поєдинок.'],createdAt:Date.now()};p.duelId=id;return;
 }
 if(a.type==='join'){
  idle(p);check(p.hp>0,'Спочатку відновіть здоров’я.');duel=db.duels[a.id];check(duel&&duel.status==='waiting'&&duel.players.length===1&&duel.players[0]!==p.id,'Заявка вже недоступна.');
  check(db.players[duel.players[0]].hp>0,'Суперник не готовий.');p.battle=null;duel.players.push(p.id);p.duelId=duel.id;duel.status='active';duel.log.push('Суперник приєднався. Обидва воїни обирають тактику.');return;
 }
 check(duel,'Дуель не знайдено.');
 if(a.type==='leave'){
  check(duel.status!=='active','Активну дуель можна завершити здачею.');delete p.duelId;if(duel.status==='waiting')delete db.duels[duel.id];return;
 }
 check(duel.status==='active','Дуель ще не почалася або вже завершена.');
 const players=duel.players.map(id=>db.players[id]);
 function complete(winner){duel.status='finished';duel.winner=winner;for(const u of players){if(winner===u.id){u.wins++;award(u,60,45);}else if(winner)u.losses++;u.history.unshift({id:duel.id,enemy:players.find(x=>x.id!==u.id).name,result:winner===u.id?'win':winner?'loss':'draw',round:duel.round,at:Date.now()});u.history=u.history.slice(0,20);}duel.log.push(winner?`Переможець: ${db.players[winner].name}. +60 досвіду, +45 талерів.`:'Нічия. Обидва воїни впали.');}
 if(a.type==='surrender'){complete(players.find(x=>x.id!==p.id).id);return;}
 check(a.type==='turn','Невідома дія дуелі.');check(!duel.moves[p.id],'Ваш хід уже прийнято. Чекаємо на суперника.');
 check(Number.isInteger(a.attack)&&a.attack>=0&&a.attack<4&&Number.isInteger(a.block)&&a.block>=0&&a.block<6&&['attack','defense'].includes(a.stance),'Оберіть коректну тактику.');check(a.power===undefined||typeof a.power==='boolean','Невідомий прийом.');check(!a.power||p.energy>=10,'Бракує витривалості.');
 duel.moves[p.id]={attack:a.attack,block:a.block,stance:a.stance,power:!!a.power};
 if(players.every(x=>duel.moves[x.id])){
  const damage=players.map((attacker,index)=>{const defender=players[1-index],m=duel.moves[attacker.id],def=duel.moves[defender.id],ad=derived(attacker),dd=derived(defender);attacker.energy=m.power?attacker.energy-10:Math.min(60,attacker.energy+rules(attacker).recovery);let n=Math.max(1,Math.round((ad.damage+Math.floor(rng()*6))*(m.stance==='attack'?1.16:.86)*(def.stance==='defense'?.8:1.1)*(m.power?1.5:1)-dd.armor*.6));if(rng()*100<ad.crit)n=Math.round(n*1.65);if(blocks[def.block].includes(m.attack))n=Math.max(1,Math.round(n*.3));if(rng()*100<dd.dodge*(def.stance==='defense'?1.3:.7))n=0;return n;});
  duel.round++;players.forEach((u,i)=>{u.hp=Math.max(0,u.hp-damage[1-i]);duel.log.push(`Хід ${duel.round}. ${u.name}: удар у ${zones[duel.moves[u.id].attack]}, ${damage[i]} шкоди.`);});duel.moves={};
  if(players.some(u=>u.hp===0)){const winner=players.filter(u=>u.hp>0);complete(winner.length===1?winner[0].id:null);}duel.log=duel.log.slice(-60);
 }
}
export function worldSnapshot(db,p){
 const publicPlayer=u=>({id:u.id,name:u.name,level:u.level,hp:u.hp,maxHp:derived(u).maxHp});
 const d=p.duelId&&db.duels?.[p.duelId];const duel=d?{id:d.id,status:d.status,round:d.round,log:d.log,winner:d.winner,players:d.players.map(id=>publicPlayer(db.players[id])),submitted:!!d.moves[p.id]}:null;
 return {...roadSnapshot(p),...trialSnapshot(p),...clanWorksSnapshot(db,p),factions,contracts,recipes,dailyQuests:dailyQuests.map(q=>({...q,progress:Math.min(q.target,Math.max(0,progressOf(p,q.metric)-(p.daily.base[q.metric]||0))),claimed:p.daily.claimed.includes(q.id)})),economy:rules(p),itemRules:items.map(i=>({id:i.id,price:shopPrice(p,i),level:requiredLevel(p,i)})),duel,lobby:Object.values(db.duels||{}).filter(x=>x.status==='waiting'&&x.createdAt>Date.now()-3600000).map(x=>({id:x.id,player:publicPlayer(db.players[x.players[0]])})),clans:Object.values(db.clans||{}).map(c=>({...c,members:c.members.map(id=>publicPlayer(db.players[id]))})),online:Object.values(db.players).filter(u=>(u.lastSeen||0)>Date.now()-60000).map(publicPlayer).slice(0,30)};
}
