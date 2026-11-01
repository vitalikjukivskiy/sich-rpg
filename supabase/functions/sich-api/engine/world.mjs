import {campaignContract,campaignQuest,campaignDaily,canonicalEncounter,sourceBaseXp,campaignRecipe} from './prototype.mjs';
import {migrateProgression,creditMinor,balanceMinor,repairQuote,roundTimeout,canonicalItemById} from './canon.mjs';
import {action as baseAction,items,award,derived,blocks,zones,quests} from './game.mjs';
const randomUUID = () => crypto.randomUUID();
import {ROUND_MS,CLASS_RULES,combatProfile,validMove,resolveHit,formatCombatLog,meetsRequirements,requirement,abilityRule} from './balance.mjs';
import {factions,contracts,rules,requiredLevel,shopPrice,forgePrice} from './factions.mjs';
import {recipes,dailyQuests,refreshDaily,progressOf} from './content.mjs';
import {migrateInventory,syncInventory,findInstance,addInstance,removeInstance,CAPACITY} from './inventory.mjs';
import {roadAction,resolveRoadBattle,roadSnapshot,onRoad} from './roads.mjs';
import {trialAction,resolveTrialBattle,trialSnapshot} from './trials.mjs';
import {clanWorksAction,clanWorksSnapshot} from './clanworks.mjs';
function markCampaignBattle(p){const c=p.campaign,b=p.battle;if(c?.id&&b?.id&&c.currentBattle===b.id&&!b.source){b.source='campaign';b.campaign={id:c.id,contract:c.contract,stage:c.stage};}}
export function migrate(p){p.materials??={herb:0,ore:0,resin:0};p.upgrades??={};p.gathered??=0;p.forged??=0;p.forestWins??=0;p.faction??=null;p.reputation??={};p.campaign??=null;p.starterClaimed??=false;p.deliveries??=[];p.completedContracts??=[];if(p.campaign?.status==='complete'&&!p.completedContracts.includes(p.campaign.contract))p.completedContracts.push(p.campaign.contract);p.redistribution??={credits:0,at:Date.now()};const weeks=Math.floor(Math.max(0,Date.now()-p.redistribution.at)/604800000);if(weeks){p.redistribution.credits=Math.min(10,p.redistribution.credits+weeks);p.redistribution.at+=weeks*604800000;}p.storyComplete??=p.completedContracts.includes('five_roads');p.journey??=null;p.journeysWon??=0;p.journeyRoutes??=[];p.honor??=0;p.trialsCompleted??=[];p.trialRecords??={};refreshDaily(p);migrateInventory(p);markCampaignBattle(p);if(p.canonVersion)p.energy=Math.min(p.energy,derived(p).maxEnergy);p.hp=Math.max(0,Math.min(p.hp??derived(p).maxHp,derived(p).maxHp));if(p.alignment==='Шлях свободи')p.alignment='Вільний козак';return p;}
function check(v,m){if(!v)throw new Error(m);}
export function idle(p){check(!p.duelId,'Спочатку завершіть дуель.');check(!p.battle||p.battle.result,'Спочатку завершіть поточний поєдинок.');}
function starter(p){
 check(!p.starterClaimed,'Стартовий набір уже отримано.');const faction=factions.find(f=>f.id===p.faction);check(faction,'Спочатку оберіть сторону.');const pack=p.canonVersion?{items:[],gold:0,materials:{herb:1,ore:1,resin:0}}:faction.starter;
 check(p.instances.length+pack.items.length<=CAPACITY,'Звільніть місце у скрині для стартового набору.');
 for(const item of pack.items)addInstance(p,item);p.gold+=pack.gold;for(const [id,n]of Object.entries(pack.materials))p.materials[id]+=n;p.starterClaimed=true;p.starterFaction=faction.id;
}
function stabilizeEquipment(p){
 if(!p.canonVersion)return;
 const removed=[];
 for(let pass=0;pass<20;pass++){let changed=false;for(const [slot,uid] of Object.entries(p.equipmentInstances)){const instance=p.instances.find(i=>i.uid===uid),item=items.find(i=>i.id===instance?.item);if(item?.canonical&&(!meetsRequirements(p,item)||(instance.wear||0)>=item.durability-1)){delete p.equipmentInstances[slot];removed.push(item.name);changed=true;syncInventory(p);}}if(!changed)break;}
 p.lastUnequipped=removed;p.hp=Math.min(p.hp,derived(p).maxHp);p.energy=Math.min(p.energy,derived(p).maxEnergy);
}
export function action(p,a,rng=Math.random){
 migrate(p);
 if(p.duelId)throw new Error('Спочатку завершіть дуель.');
 if(onRoad(p)&&!['roadChoice','roadAbandon','turn','timeout','potion','leave','surrender','stat','claim','daily'].includes(a.type))throw new Error('Ви в дорозі. Завершіть подорож або поверніть обоз. Лікуйтеся настоянками й під час зустрічей.');
 if(['roadStart','roadChoice','roadAbandon'].includes(a.type)){roadAction(p,a,rng);return p;}
 if(['trialStart','honorBuy'].includes(a.type)){idle(p);trialAction(p,a);return p;}
 if(a.type==='mentor'){idle(p);p.metMentor=1;return p;}
 if(a.type==='skin'){idle(p);check(['auto','legacy','sabre','hammer','mace','pike','axe'].includes(a.skin),'Невідомий образ.');p.skin=a.skin;return p;}
 if(a.type==='redistribute'){idle(p);const keys=['strength','agility','intuition','vitality'];check(keys.includes(a.from)&&keys.includes(a.to)&&a.from!==a.to,'Оберіть дві різні характеристики.');check(!p.injury,'Перерозподіл недоступний під час травми.');check(p.redistribution.credits>0,'Немає доступного безкоштовного перерозподілу.');check(p.stats[a.from]>3,'Базове значення характеристики — 3.');p.stats[a.from]--;p.stats[a.to]++;p.redistribution.credits--;for(const [slot,uid] of Object.entries(p.equipmentInstances)){const inst=p.instances.find(i=>i.uid===uid),item=items.find(i=>i.id===inst?.item);if(item&&!meetsRequirements(p,item))delete p.equipmentInstances[slot];}syncInventory(p);stabilizeEquipment(p);p.hp=Math.min(p.hp,derived(p).maxHp);return p;}
 if(a.type==='retrain'){check(!p.canonVersion,'Оберіть перенесення одного очка на сторінці характеристик.');
  idle(p);check(p.level>1,'Вправи відкриються з 2 рівня.');const cost=Math.max(50,(p.level-1)*25);check(p.gold>=cost,'Бракує флоринів для перенавчання.');p.gold-=cost;p.stats={strength:5,agility:5,intuition:5,vitality:5};p.points=(p.level-1)*3;for(const [slot,uid] of Object.entries(p.equipmentInstances)){const instance=p.instances.find(i=>i.uid===uid),item=items.find(i=>i.id===instance?.item);if(item&&!meetsRequirements(p,item))delete p.equipmentInstances[slot];}syncInventory(p);stabilizeEquipment(p);p.hp=Math.min(p.hp,derived(p).maxHp);return p;
 }
 if(a.type==='daily'){
  idle(p);const original=dailyQuests.find(x=>x.id===a.quest),q=original&&p.canonVersion?campaignDaily(original):original;check(q,'Доручення не знайдено.');check(!p.daily.claimed.includes(q.id),'Сьогоднішню нагороду вже отримано.');check(progressOf(p,q.metric)-(p.daily.base[q.metric]||0)>=q.target,'Доручення ще не виконано.');p.daily.claimed.push(q.id);award(p,q.xp,q.gold);return p;
 }
 if(a.type==='recipe'){
  idle(p);const original=recipes.find(x=>x.id===a.recipe),r=original&&p.canonVersion?campaignRecipe(original):original;check(r,'Рецепт не знайдено.');check(p.level>=r.level,'Замалий рівень.');check(p.gold>=r.gold,'Бракує флоринів.');check(p.instances.length+r.quantity<=CAPACITY,'У скрині немає місця.');for(const [key,n]of Object.entries(r.materials))check(p.materials[key]>=n,'Бракує припасів.');p.gold-=r.gold;for(const [key,n]of Object.entries(r.materials))p.materials[key]-=n;for(let i=0;i<r.quantity;i++)addInstance(p,r.item);p.forged++;return p;
 }
 if(a.type==='starter'){idle(p);starter(p);return p;}
 if(['buy','sell','equip'].includes(a.type)){
  idle(p);
  if(a.type==='buy'){const item=items.find(i=>i.id===a.item);check(item,'Предмет не знайдено.');if(item.canonical){check(p.canonVersion,'Числа перенесеного каталогу доступні в новому режимі.');check(item.purchasable,'Цей особливий предмет не продається у звичайній крамниці.');check(balanceMinor(p,item.currency)>=item.priceMinor,item.currency==='sesterce'?'Бракує сестерціїв.':'Бракує флоринів.');check(p.instances.length<CAPACITY,'У скрині немає місця.');const instance=addInstance(p,item.id);instance.wear=0;creditMinor(p,-item.priceMinor,item.currency);p.purchases++;return p;}check(!p.canonVersion||item.id==='potion','Оберіть спорядження з перенесеного каталогу.');check(!item.honorCost,'Ця річ доступна за відзнаки у випробуваннях ради.');check(p.level>=requiredLevel(p,item),'Недостатній рівень.');const price=shopPrice(p,item);check(p.gold>=price,'Бракує флоринів.');check(p.instances.length<CAPACITY,'У скрині немає місця.');addInstance(p,item.id);p.gold-=price;p.purchases++;return p;}
  const instance=findInstance(p,a),item=items.find(i=>i.id===instance?.item);check(instance&&item,'Предмет не знайдено.');
  if(a.type==='sell'&&item.canonical){check(!instance.bound,'Прив’язану річ неможливо продати.');check((instance.wear||0)===0,'Спочатку відремонтуйте річ.');check(item.priceMinor>0,'Цей предмет не має ціни викупу.');removeInstance(p,instance.uid);creditMinor(p,Math.floor(item.priceMinor/2),item.currency);return p;}
  if(a.type==='sell'){removeInstance(p,instance.uid);if(p.canonVersion&&item.id==='potion')creditMinor(p,50);else p.gold+=Math.floor(item.price/2);return p;}
  check(!['rune','license'].includes(item.slot),'Цей предмет не можна спорядити.');check(!item.canonical||!item.effectNeedsReview,'Особлива дія цього предмета ще недоступна.');check(!item.canonical||(instance.wear||0)<item.durability-1,'Спочатку відремонтуйте річ.');check(item.slot!=='consumable','Цей предмет потрібно використати.');check(p.level>=requiredLevel(p,item),'Недостатній рівень.');check(p.equipmentInstances[item.slot]===instance.uid||meetsRequirements(p,item),'Недостатньо характеристик для спорядження.');
  if(p.equipmentInstances[item.slot]===instance.uid)delete p.equipmentInstances[item.slot];else p.equipmentInstances[item.slot]=instance.uid;syncInventory(p);stabilizeEquipment(p);p.hp=Math.min(p.hp,derived(p).maxHp);return p;
 }
 if(a.type==='faction'){
  idle(p);const f=factions.find(f=>f.id===a.faction);check(f,'Такої сторони немає.');check(p.faction!==f.id,'Ви вже на цій службі.');const first=!p.faction,price=first?0:50;check(p.gold>=price,'Зміна служби коштує 50 флоринів.');const hp=derived(p).maxHp;p.gold-=price;p.faction=f.id;p.city=f.city;p.alignment=f.name;
  for(const [slot,uid] of Object.entries(p.equipmentInstances)){const instance=p.instances.find(i=>i.uid===uid),item=items.find(i=>i.id===instance?.item);if(item&&p.level<requiredLevel(p,item))delete p.equipmentInstances[slot];}syncInventory(p);
  p.hp=Math.max(0,Math.min(derived(p).maxHp,p.hp+derived(p).maxHp-hp));if(!p.visited.includes(f.city))p.visited.push(f.city);if(first&&!p.starterClaimed)starter(p);return p;
 }
 if(a.type==='contract'){
  idle(p);check(p.faction,'Оберіть свою сторону на мапі.');check(!p.campaign||p.campaign.status!=='active','Спочатку завершіть або скасуйте поточний похід.');const original=contracts.find(c=>c.id===a.contract),contract=original&&p.canonVersion?campaignContract(original):original;check(contract,'Доручення не знайдено.');check(p.level>=contract.level,'Замалий рівень для цього походу.');check(!contract.requires||p.completedContracts.includes(contract.requires),'Спочатку завершіть попередній розділ кампанії.');p.campaign={id:randomUUID(),contract:contract.id,faction:p.faction,stage:0,status:'active',currentBattle:null,rewardGiven:false};return p;
 }
 if(a.type==='campaignFight'){
  idle(p);const c=p.campaign,original=contracts.find(x=>x.id===c?.contract),contract=original&&p.canonVersion?campaignContract(original):original;check(c?.status==='active'&&contract,'Немає активного походу.');check(p.hp>0,'Відновіть здоров’я перед наступною сутичкою.');baseAction(p,{type:'battle',enemy:contract.enemies[c.stage],encounterLevel:contract.level},rng);c.currentBattle=p.battle.id;markCampaignBattle(p);return p;
 }
 if(a.type==='cancelContract'){idle(p);check(p.campaign?.status==='active','Немає активного походу.');p.campaign.status='cancelled';return p;}
 if(a.type==='gather'){
  idle(p);check(['herb','ore','resin'].includes(a.resource),'Невідомий ресурс.');const cost=rules(p).gatherCost;check(p.energy>=cost,'Бракує витривалості. Відновіть сили в лікарні.');
  const amount=a.resource==='resin'?rules(p).powderYield:1;p.energy-=cost;p.materials[a.resource]+=amount;if(a.resource==='herb')p.gathered+=amount;return p;
 }
 if(a.type==='repair'){idle(p);const instance=findInstance(p,a),item=items.find(i=>i.id===instance?.item);check(instance&&item,'Предмет не знайдено.');const price=repairQuote(p,instance,item);check(price>0,'Річ уже повністю відремонтована.');creditMinor(p,-price);instance.wear=0;return p;}
 if(a.type==='forge'){
  idle(p);const instance=findInstance(p,a),item=items.find(i=>i.id===instance?.item);check(instance&&item&&item.slot!=='consumable','Оберіть спорядження зі скрині.');check(!item.canonical,'Для цього спорядження потрібне зачарування, а не січовий гарт.');const rank=instance.rank;
  check(rank<5,'Досягнуто максимальне покращення +5.');const cost=forgePrice(p,rank),ore=rank+1;check(p.gold>=cost&&p.materials.ore>=ore,'Бракує флоринів або залізної руди.');
  p.gold-=cost;p.materials.ore-=ore;instance.rank++;syncInventory(p);p.forged++;return p;
 }
 if(a.type==='craft'){
  idle(p);check(p.level>=2,'Потрібен 2 рівень.');check(p.gold>=50&&p.materials.herb>=3&&p.materials.resin>=2,'Потрібно 50 флоринів, 3 пучки трав та 2 мірки пороху.');check(p.inventory.length<60,'У наплічнику немає місця.');
  p.gold-=50;p.materials.herb-=3;p.materials.resin-=2;addInstance(p,'amulet');p.forged++;return p;
 }
 if(a.type==='potion'&&onRoad(p)&&p.battle?.result)p.battle=null;
 if(a.type==='battle')a={type:'battle',enemy:a.enemy};
 const consumed=a.type==='potion'?p.instances.find(i=>i.item==='potion'):null;
 const result=baseAction(p,a,rng),campaign=p.campaign;if(a.type==='claim'){const reward=quests.find(q=>q.id===a.quest)?.rewardItem;if(reward){if(p.instances.length<CAPACITY)addInstance(p,reward);else p.deliveries.push({id:randomUUID(),kind:'item',instance:{uid:randomUUID(),item:reward,rank:0,wear:0},reason:'Нагорода новобранця',createdAt:Date.now(),claimedAt:null});}}
 if(consumed){p.instances=p.instances.filter(i=>i.uid!==consumed.uid);syncInventory(p);}
 if(campaign?.status==='active'&&p.battle?.id===campaign.currentBattle&&p.battle.result){
  if(p.battle.result==='win'){campaign.stage++;campaign.currentBattle=null;const original=contracts.find(x=>x.id===campaign.contract),contract=p.canonVersion?campaignContract(original):original;if(campaign.stage>=contract.enemies.length&&!campaign.rewardGiven){campaign.status='complete';campaign.rewardGiven=true;const first=!p.completedContracts.includes(contract.id);if(first){p.completedContracts.push(contract.id);if(contract.rewardItem)p.deliveries.push({id:randomUUID(),kind:'item',instance:{uid:randomUUID(),item:contract.rewardItem,rank:0},reason:'Відзнака за '+contract.name,createdAt:Date.now(),claimedAt:null});}if(contract.finale){p.storyComplete=true;p.title='Хранитель П’яти Доріг';}award(p,contract.xp,contract.gold);const reputation=Math.ceil(contract.reputation*(campaign.faction==='cossacks'?1.2:1));p.reputation[campaign.faction]=(p.reputation[campaign.faction]||0)+reputation;p.battle.log.push(`Похід завершено! Додатково: ${contract.gold} флоринів, ${contract.xp} досвіду та ${reputation} репутації.`);}}
  else campaign.status='failed';
 }
 resolveRoadBattle(p);resolveTrialBattle(p);return result;
}
export function clanAction(db,p,a){
 idle(p);check(!onRoad(p),'Поверніться з дороги, щоб відвідати курінь.');db.clans??={};const clan=p.clanId&&db.clans[p.clanId];
 if(['build','supply','order'].includes(a.type)){clanWorksAction(clan,p,a);return;}
 if(a.type==='create'){
  check(!clan,'Ви вже у курені.');check(p.level>=2,'Курінь можна заснувати з 2 рівня.');check(p.gold>=150,'Для заснування потрібно 150 флоринів.');
  const name=String(a.name||'').trim();check(/^[\p{L}\p{N} _’-]{3,30}$/u.test(name),'Назва: 3–30 літер, цифр або пробілів.');check(!Object.values(db.clans).some(c=>c.name.toLowerCase()===name.toLowerCase()),'Такий курінь уже існує.');
  const id=randomUUID();db.clans[id]={id,name,leader:p.id,members:[p.id],treasury:0,createdAt:Date.now()};p.clanId=id;p.gold-=150;
 }else if(a.type==='join'){
  check(!p.canonVersion||p.level>=1,'Дуелі відкриваються з 1 рівня.');
  check(!clan,'Ви вже у курені.');const target=db.clans[a.id];check(target,'Курінь не знайдено.');check(target.members.length<20,'У курені немає вільних місць.');target.members.push(p.id);p.clanId=target.id;
 }else if(a.type==='donate'){
  check(clan,'Спочатку вступіть у курінь.');check(Number.isInteger(a.amount)&&a.amount>0&&a.amount<=p.gold,'Введіть доступну цілу суму.');p.gold-=a.amount;clan.treasury+=a.amount;
 }else if(a.type==='leave'){
  check(clan,'Ви не у курені.');clan.members=clan.members.filter(id=>id!==p.id);if(clan.leader===p.id)clan.leader=clan.members[0]||null;if(!clan.members.length)delete db.clans[clan.id];delete p.clanId;
 }else throw new Error('Невідома дія куреня.');
}
function duelRound(db,duel,now=Date.now(),rng=Math.random){
 if(duel.status!=='active')return false;
 const people=duel.players.map(id=>db.players[id]);
 const [x,y]=people, m0=duel.moves[x.id],m1=duel.moves[y.id];
 if(m0===undefined||m1===undefined){if(now<(duel.deadline||0))return false;}
 duel.profiles??=Object.fromEntries(people.map(p=>[p.id,combatProfile(p)]));duel.worldMaxHp??=Object.fromEntries(people.map(p=>[p.id,derived(p).maxHp]));
 const moves=[m0||null,m1||null],profiles=people.map(p=>duel.profiles[p.id]);
 const hits=people.map((p,i)=>resolveHit(
  {profile:profiles[i]},
  {profile:profiles[1-i],block:moves[1-i]?.block??-1,stance:moves[1-i]?.stance||'attack',disoriented:duel.effects?.[people[1-i].id]?.disoriented>0,immunity:duel.effects?.[people[1-i].id]?.immunity>0,ability:!!moves[1-i]?.ability},moves[i],moves[1-i],rng));
 duel.metrics??={hits:0,dodges:0,crits:0,blocks:0,controls:0,maxHitFraction:0};for(let i=0;i<2;i++){const hit=hits[i];duel.metrics.hits+=Number(!hit.pass&&!hit.dodged);duel.metrics.dodges+=Number(!!hit.dodged);duel.metrics.crits+=Number(!!hit.crit);duel.metrics.blocks+=Number(!!hit.blocked);duel.metrics.controls+=Number(!!hit.control);duel.metrics.maxHitFraction=Math.max(duel.metrics.maxHitFraction,hit.damage/profiles[1-i].maxHp);}
 duel.round++;
 if(!moves[0]&&!moves[1]&&people.every(p=>p.canonVersion)){duel.timeoutDraw=true;duel.log.push('ЧАС ВИЙШОВ в обох гравців. Поєдинок завершено без завданої шкоди.');}else if(!moves[0]&&!moves[1]){
  for(let i=0;i<2;i++)duel.hp[people[i].id]=Math.max(duel.round<=2?1:0,duel.hp[people[i].id]-Math.max(1,Math.round(profiles[i].maxHp*.08)));
  duel.log.push(`Раунд ${duel.round}. ЧАС ВИЙШОВ в обох гравців. Кожен втратив 8% здоров’я.`);
 }else{
  for(let i=0;i<2;i++){
   const target=people[1-i];duel.damage??={};duel.damage[people[i].id]=(duel.damage[people[i].id]||0)+Math.min(duel.hp[target.id],hits[i].damage);duel.hp[target.id]=Math.max(0,duel.hp[target.id]-hits[i].damage);
   duel.log.push(`Раунд ${duel.round}. ${formatCombatLog(people[i].name,hits[i],target.name)}`);
   if(hits[i].control){const e=duel.effects[target.id];if(!e.immunity){e.disoriented=2;e.immunity=3+(profiles[1-i].controlResistance||0);}}
  }
 }
 // Mirror relative duel damage into persistent character HP for healing and PvE continuity.
 for(let i=0;i<2;i++){const player=people[i];player.hp=Math.max(0,Math.round(duel.worldMaxHp[player.id]*duel.hp[player.id]/profiles[i].maxHp));}
 for(const p of people){const e=duel.effects?.[p.id];if(e){e.immunity=Math.max(0,e.immunity-1);e.disoriented=Math.max(0,e.disoriented-1);}}
 const alive=people.filter(p=>duel.hp[p.id]>0);
 const limit=people.every(p=>p.canonVersion)?100:25;
 if(duel.timeoutDraw||alive.length<2||duel.round>=limit){
  let winner=alive.length===1?alive[0].id:null;
  if(duel.round>=limit&&alive.length===2&&!people.every(p=>p.canonVersion)){const proportions=people.map((p,i)=>duel.hp[p.id]/profiles[i].maxHp);if(Math.abs(proportions[0]-proportions[1])>.001)winner=people[proportions[0]>proportions[1]?0:1].id;}
  duel.status='finished';duel.winner=winner;
  for(const u of people){if(winner===u.id){u.wins++;if(!u.canonVersion)award(u,60,45);}else if(winner)u.losses++;if(u.canonVersion){const opponent=people.find(v=>v.id!==u.id);const xp=Math.floor(sourceBaseXp(opponent.level)*Math.min(1,(duel.damage?.[u.id]||0)/duel.profiles[opponent.id].maxHp));award(u,xp,0);}u.history.unshift({id:duel.id,enemy:people.find(z=>z.id!==u.id).name,result:winner===u.id?'win':winner?'loss':'draw',round:duel.round,at:now});u.history=u.history.slice(0,20);}
  duel.log.push(winner?`ПЕРЕМОЖЕЦЬ: ${db.players[winner].name}. ${people.every(p=>p.canonVersion)?'Досвід нараховано за завдану шкоду.':'+60 досвіду, +45 флоринів.'}`:'НІЧИЯ: обидва воїни завершили бій.');
 }else duel.deadline=now+(people.every(p=>p.canonVersion)?roundTimeout(duel.startedAt||duel.createdAt,now):ROUND_MS);
 duel.moves={};duel.log=duel.log.slice(-60);return true;
}
export function advanceBattles(db,now=Date.now()){
 let changed=false;
 for(const p of Object.values(db.players||{})){
  if(p.battle&&!p.battle.result&&!p.battle.deadline){p.battle.deadline=now+(p.canonVersion?roundTimeout(p.battle.startedAt??now,now):ROUND_MS);changed=true;}
  while(p.battle&&!p.battle.result&&now>=p.battle.deadline){action(p,{type:'timeout'});changed=true;}
 }
 return changed;
}
export function advanceDuels(db,now=Date.now()){
 let changed=false;for(const duel of Object.values(db.duels||{})){
  if(duel.status==='waiting'&&now>=duel.createdAt+3600000){for(const id of duel.players)if(db.players[id]?.duelId===duel.id)delete db.players[id].duelId;delete db.duels[duel.id];changed=true;continue;}
  if(duel.status!=='active')continue;
  if(!duel.hp||!duel.deadline){
   duel.hp=Object.fromEntries(duel.players.map(id=>{const p=db.players[id];return [id,Math.max(1,Math.round(combatProfile(p).maxHp*Math.min(1,p.hp/derived(p).maxHp)))];}));
   duel.stamina??=Object.fromEntries(duel.players.map(id=>[id,100]));duel.cooldowns??=Object.fromEntries(duel.players.map(id=>[id,0]));
   duel.effects??=Object.fromEntries(duel.players.map(id=>[id,{disoriented:0,immunity:0}]));duel.deadline=now+(duel.players.every(id=>db.players[id].canonVersion)?roundTimeout(duel.startedAt??now,now):ROUND_MS);changed=true;
  }
  while(duel.status==='active'&&now>=duel.deadline)changed=duelRound(db,duel,duel.deadline)||changed;
 }
 return changed;
}
export function duelAction(db,p,a,rng=Math.random){
 check(!onRoad(p),'Поверніться з дороги перед дуеллю.');
 db.duels??={};let duel=p.duelId&&db.duels[p.duelId];
 if(a.type==='create'){
  check(!p.canonVersion||p.level>=1,'Дуелі відкриваються з 1 рівня.');idle(p);check(p.hp>0,'Спочатку відновіть здоров’я.');p.battle=null;
  const id=randomUUID();db.duels[id]={id,players:[p.id],status:'waiting',round:0,moves:{},log:['Відкрито заявку на чесний поєдинок.'],createdAt:Date.now()};p.duelId=id;return;
 }
 if(a.type==='join'){
  check(!p.canonVersion||p.level>=1,'Дуелі відкриваються з 1 рівня.');
  idle(p);check(p.hp>0,'Спочатку відновіть здоров’я.');duel=db.duels[a.id];check(duel&&duel.status==='waiting'&&duel.players.length===1&&duel.players[0]!==p.id,'Заявка вже недоступна.');
  check(!!p.canonVersion===!!db.players[duel.players[0]].canonVersion,'Суперник грає за іншою версією правил.');check(db.players[duel.players[0]].hp>0,'Суперник не готовий.');p.battle=null;duel.players.push(p.id);p.duelId=duel.id;duel.status='active';duel.startedAt=Date.now();duel.deadline=duel.startedAt+(p.canonVersion?roundTimeout(duel.startedAt,duel.startedAt):ROUND_MS);
  duel.hp=Object.fromEntries(duel.players.map(id=>{const p=db.players[id];return [id,Math.max(1,Math.round(combatProfile(p).maxHp*Math.min(1,p.hp/derived(p).maxHp)))];}));
  duel.stamina=Object.fromEntries(duel.players.map(id=>[id,100]));
  duel.cooldowns=Object.fromEntries(duel.players.map(id=>[id,0]));
  duel.effects=Object.fromEntries(duel.players.map(id=>[id,{disoriented:0,immunity:0}]));
  duel.profiles=Object.fromEntries(duel.players.map(id=>[id,combatProfile(db.players[id])]));duel.worldMaxHp=Object.fromEntries(duel.players.map(id=>[id,derived(db.players[id]).maxHp]));
  duel.log.push(p.canonVersion?'Суперник приєднався. 10 хвилин на вибір удару та двох блоків.':'Суперник приєднався. 30 секунд на вибір удару та двох блоків.');return;
 }
 check(duel,'Дуель не знайдено.');
 if(a.type==='leave'){
  check(duel.status!=='active','Активну дуель можна завершити здачею.');delete p.duelId;if(duel.status==='waiting')delete db.duels[duel.id];return;
 }
 check(duel.status==='active','Дуель ще не почалася або вже завершена.');
 if(a.type==='surrender'){
  const enemy=duel.players.find(id=>id!==p.id),other=db.players[enemy];
  duel.status='finished';duel.winner=enemy;duel.moves={};duel.hp[p.id]=0;p.hp=0;
  other.wins++;p.losses++;if(!p.canonVersion)award(other,60,45);else for(const u of [p,other]){const target=u.id===p.id?other:p;award(u,Math.floor(sourceBaseXp(target.level)*Math.min(1,(duel.damage?.[u.id]||0)/duel.profiles[target.id].maxHp)),0);}
  for(const u of [p,other]){u.history.unshift({id:duel.id,enemy:u.id===p.id?other.name:p.name,result:u.id===p.id?'loss':'win',round:duel.round,at:Date.now()});u.history=u.history.slice(0,20);}
  duel.log.push(`${p.name} здався. ПЕРЕМОЖЕЦЬ: ${other.name}. ${p.canonVersion?'Досвід нараховано за завдану шкоду.':'+60 досвіду, +45 флоринів.'}`);return;
 }
 check(a.type==='turn','Невідома дія дуелі.');check(!duel.moves[p.id],'Ваш хід уже прийнято. Чекаємо на суперника.');
 check(Date.now()<duel.deadline,'Час для ходу минув.');
 check(validMove(a),'Оберіть удар, два блоки та стійку.');
 const rule=abilityRule(p);check(!p.canonVersion||!a.ability&&!a.power,'Цей прийом не належить до правил поточного бою.');
 check(!a.ability||duel.cooldowns[p.id]<=duel.round,'Прийом ще відновлюється.');
 const cost=(a.ability?rule.cost:0)+(a.power?20:0);
 check(duel.stamina[p.id]>=cost,'Бракує бойової витривалості.');
 duel.stamina[p.id]=Math.min(100,duel.stamina[p.id]-cost+(cost===0?8:0));
 if(a.ability)duel.cooldowns[p.id]=duel.round+rule.cooldown;
 duel.moves[p.id]={attack:a.attack,block:a.block,stance:a.stance,power:!!a.power,ability:!!a.ability};
 if(duel.players.every(id=>duel.moves[id]))duelRound(db,duel,Date.now(),rng);
}
export function worldSnapshot(db,p){
 const publicPlayer=u=>({id:u.id,name:u.name,level:u.level,hp:u.hp,maxHp:derived(u).maxHp,classId:combatProfile(u).classId,skin:u.skin||'auto',stats:combatProfile(u).stats||u.stats,combat:combatProfile(u),equipment:Object.entries(u.equipment).map(([slot,id])=>({slot,id,name:items.find(i=>i.id===id)?.name||'Спорядження'}))});
 const d=p.duelId&&db.duels?.[p.duelId];const duel=d?{id:d.id,status:d.status,round:d.round,log:d.log,winner:d.winner,players:d.players.map(id=>({...publicPlayer(db.players[id]),hp:d.hp?.[id]??db.players[id].hp,maxHp:d.hp?(d.profiles?.[id]||combatProfile(db.players[id])).maxHp:derived(db.players[id]).maxHp})),submitted:!!d.moves[p.id],deadline:d.deadline,stamina:d.stamina?.[p.id]??100,abilityCooldown:d.cooldowns?.[p.id]??0,combatProfile:d.profiles?.[p.id]||combatProfile(p)}:null;
 return {...roadSnapshot(p),...trialSnapshot(p),...clanWorksSnapshot(db,p),factions:p.canonVersion?factions.map(f=>({...f,perk:'Служба без бойових множників',traits:['Характеристики залежать від вашої збірки та спорядження.','Після присяги відкривається січова кампанія.'],starter:{title:'Припас служби',text:'Один пучок трав та одна мірка руди. Бойові характеристики й ціни спорядження однакові для всіх сторін.'}})):factions,contracts:p.canonVersion?contracts.map(campaignContract):contracts,recipes:p.canonVersion?recipes.map(campaignRecipe):recipes,dailyQuests:(p.canonVersion?dailyQuests.map(campaignDaily):dailyQuests).map(q=>({...q,progress:Math.min(q.target,Math.max(0,progressOf(p,q.metric)-(p.daily.base[q.metric]||0))),claimed:p.daily.claimed.includes(q.id)})),economy:rules(p),itemRules:items.filter(i=>!i.canonical||p.inventory.includes(i.id)).map(i=>({id:i.id,price:shopPrice(p,i),level:requiredLevel(p,i),requirements:requirement(i,i.level),canEquip:meetsRequirements(p,i)})),duel,lobby:Object.values(db.duels||{}).filter(x=>x.status==='waiting'&&x.createdAt>Date.now()-3600000).map(x=>({id:x.id,player:publicPlayer(db.players[x.players[0]])})),clans:Object.values(db.clans||{}).map(c=>({...c,members:c.members.map(id=>publicPlayer(db.players[id]))})),online:Object.values(db.players).filter(u=>(u.lastSeen||0)>Date.now()-60000).map(publicPlayer).slice(0,30)};
}
