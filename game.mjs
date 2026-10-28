import { randomUUID } from 'node:crypto';
import {combatProfile,classOf,CLASS_RULES,clamp,STANCES,resolveHit,formatCombatLog} from './balance.mjs';
import {equippedRank} from './inventory.mjs';
import {rules} from './factions.mjs';
import {extraItems,extraOpponents,extraQuests,progressOf} from './content.mjs';
import {enemyPlan} from './combat.mjs';

export const cities = [
  { id: 'castle', name: 'Запорозька Січ', description: 'Дніпро, дерев’яні укріплення й козацька рада. Тут починається ваша дорога.', tag: 'Військо Запорозьке' },
  { id: 'forest', name: 'Кам’янець', description: 'Торгівля й прикордонні дороги під старими мурами.', tag: 'Річ Посполита' },
  { id: 'mountain', name: 'Бахчисарай', description: 'Дороги степу ведуть до ханських палаців і жвавого базару.', tag: 'Кримське ханство' },
  { id: 'harbor', name: 'Рига', description: 'Балтійський порт, купці й далекі військові контракти.', tag: 'Шведське королівство' },
];
cities.push({id:'ottoman',name:'Очаків',description:'Лиман, мурована фортеця й торгові каравани.',tag:'Османська імперія'});
export const items = [
  { id:'sword', name:'Шабля новобранця', slot:'weapon', icon:'sword', price:60, level:1, damage:4, description:'Вигнутий сталевий клинок із мідним ефесом.' },
  { id:'shield', name:'Ладівниця козака', slot:'shield', icon:'shield', price:45, level:1, armor:3, description:'Шкіряна сумка для набоїв і рушничного начиння.' },
  { id:'mail', name:'Жупан побратима', slot:'body', icon:'armor', price:140, level:1, armor:6, description:'Щільне сукно й міцні застібки для довгої служби.' },
  { id:'helmet', name:'Шапка запорожця', slot:'head', icon:'helmet', price:90, level:1, armor:3, description:'Сукняний верх і тепла хутряна опушка.' },
  { id:'axe', name:'Мушкет піхотинця', ranged:true, slot:'weapon', icon:'axe', price:230, level:2, damage:11, description:'Довгий ствол і кремінний замок. Для пострілу потрібен порох.' },
  { id:'ring', name:'Печатка сотника', slot:'ring', icon:'ring', price:160, level:2, damage:3, armor:2, description:'Особиста печатка — знак довіри й доброго імені.' },
  { id:'plate', name:'Панцир гусара', slot:'body', icon:'armor', price:420, level:3, armor:13, description:'Сталевий захист для небезпечних прикордонних сутичок.' },
  { id:'potion', name:'Лікувальна настоянка', slot:'consumable', icon:'potion', price:25, level:1, heal:45, description:'Відновлює 45 здоров’я або 18% максимального запасу, якщо це більше. У бою витрачає хід.' },
  { id:'boots', name:'Козацькі чоботи', slot:'boots', icon:'armor', price:75, level:1, armor:2, description:'Міцна шкіра для далеких доріг.' },
  { id:'belt', name:'Козацький кушак', slot:'belt', icon:'ring', price:95, level:1, armor:2, description:'Широкий тканий пояс. Усе потрібне завжди під рукою.' },
  { id:'pistol', name:'Пістоль старшини', slot:'pistol', icon:'sword', price:190, level:2, damage:4, ranged:true, description:'Колісний замок і різьблене руків’я. Дозволяє зробити постріл у бою.' },
  { id:'amulet', name:'Срібний хрестик', slot:'amulet', icon:'spark', price:185, level:2, damage:3, armor:3, description:'Робота січового майстра. Створюється з трав і майстрового припасу.' },
];
export const opponents = [
  {id:'recruit',name:'Побратим-новак',level:1,hp:65,damage:8,armor:1,xp:45,gold:32,tag:'Тренувальний герць',difficulty:'Легко'},
  {id:'guard',name:'Курінний боєць',level:2,hp:115,damage:13,armor:4,xp:80,gold:55,tag:'Випробування майстерності',difficulty:'Середньо'},
  {id:'knight',name:'Досвідчений сотник',level:3,hp:165,damage:19,armor:7,xp:125,gold:90,tag:'Виклик досвідченим',difficulty:'Складно'},
  {id:'lisovyk',name:'Отаман розбійників',level:3,hp:185,damage:18,armor:6,xp:150,gold:105,tag:'Небезпечна переправа',difficulty:'Небезпечно',forest:true},
];
export const quests = [
  {id:'first',name:'Перший крок до слави',text:'Переможіть у першому поєдинку на арені.',target:1,metric:'wins',gold:65,xp:35,icon:'swords'},
  {id:'merchant',name:'Підготовка до пригод',text:'Придбайте будь-який предмет у крамниці.',target:1,metric:'purchases',gold:35,xp:20,icon:'bag'},
  {id:'veteran',name:'Слава козацького герцю',text:'Здобудьте три перемоги на арені.',target:3,metric:'wins',gold:120,xp:90,icon:'shield'},
  {id:'traveler',name:'Дорогами п’яти земель',text:'Відвідайте всі п’ять міст світу.',target:5,metric:'visited',gold:100,xp:60,icon:'compass'},
  {id:'herbs',name:'Похідна аптечка',text:'Зберіть 5 пучків лікувальних трав біля переправи.',target:5,metric:'gathered',gold:75,xp:45,icon:'leaf'},
  {id:'forest',name:'Небезпечна переправа',text:'Розбийте ватагу отамана на переправі.',target:1,metric:'forestWins',gold:180,xp:100,icon:'shield'},
  {id:'smith',name:'Шабля доброго майстра',text:'Покращте будь-який предмет у кузні.',target:1,metric:'forged',gold:70,xp:35,icon:'sword'},
];
items.push(...extraItems);opponents.push(...extraOpponents);quests.push(...extraQuests);
export const blocks = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export const zones = ['голову','груди','пояс','ноги'];
export function newPlayer(name='Мандрівник') {
  return {id:randomUUID(),name,city:'castle',level:1,xp:0,gold:240,hp:100,energy:60,stats:{strength:5,agility:5,intuition:5,vitality:5},points:0,inventory:['sword','shield','potion','potion'],equipment:{weapon:'sword',shield:'shield'},wins:0,losses:0,purchases:0,visited:['castle'],claimed:[],battle:null,history:[],alignment:'Вільний козак',createdAt:Date.now()};
}
export function derived(p) {
  const gear=Object.entries(p.equipment).map(([slot,id])=>{const item=items.find(i=>i.id===id);if(!item)return null;const rank=equippedRank(p,slot,id);return {...item,damage:(item.damage||0)+(['weapon','pistol'].includes(item.slot)?rank*2:0),armor:(item.armor||0)+(!['weapon','pistol'].includes(item.slot)?rank*2:0)};}).filter(Boolean);
  const perk={damage:p.faction==='cossacks'?2:0,armor:p.faction==='commonwealth'?2:0,hp:p.faction==='ottoman'?10:0,crit:p.faction==='sweden'?3:0,dodge:p.faction==='crimea'?3:0};
  const soft=n=>n<=20?n:20+(n-20)*.35;
  const combat=combatProfile(p),rule=CLASS_RULES[combat.classId],classArmor=gear.find(i=>i.combatClass===combat.classId&&i.slot==='body')?.combatBonus||{};
  const maxHp=Math.round((100+(rule.vitalityHp||12)*soft(Math.max(0,p.stats.vitality-5))+(p.level-1)*10+perk.hp)*rule.hp/850)+(classArmor.hp||0);
  return {maxHp,potionHeal:Math.max(45,Math.round(maxHp*.18)),maxEnergy:60,
   damage:Math.round((perk.damage+15+gear.reduce((n,i)=>n+(i.damage||0),0))*rule.attack/100*(1+.012*soft(Math.max(0,p.stats.strength-5)))),
   armor:perk.armor+gear.reduce((n,i)=>n+(i.armor||0),0),
   crit:clamp(3,40,combat.crit),dodge:clamp(3,35,combat.dodge),
   antiCrit:combat.antiCrit,antiDodge:combat.antiDodge,
   classId:combat.classId,className:combat.className,ability:rule.ability,abilityCost:rule.cost,abilityCooldown:rule.cooldown,critMultiplier:combat.critMultiplier,nextXp:p.level*100};
}
export function questProgress(p,q) {return q.metric==='visited'?p.visited.length:progressOf(p,q.metric);}
function requireThat(condition,message) {if(!condition) throw new Error(message);}
function idle(p) {requireThat(!p.battle||p.battle.result,'Спочатку завершіть поточний поєдинок.');}
export function award(p,xp,gold) {
  p.xp+=xp;p.gold+=gold;
  while(p.xp>=p.level*100){p.xp-=p.level*100;p.level++;p.points+=3;p.hp=derived(p).maxHp;p.energy=60;}
}
function finish(p,result) {
  const b=p.battle;b.result=result;
  if(result==='win'){p.wins++;if(b.enemy.forest){p.forestWins=(p.forestWins||0)+1;p.materials??={herb:0,ore:0,resin:0};p.materials.resin+=2;}award(p,b.enemy.xp,b.enemy.gold);b.log.push(`Перемога! +${b.enemy.xp} досвіду, +${b.enemy.gold} талерів.${b.enemy.forest?' Здобуто 2 мірки пороху.':''}`);}
  else if(result==='draw'){b.log.push('Нічия. Поєдинок завершено без переможця. Відновіть сили перед наступним герцем.');}
  else {p.losses++;b.log.push('Поразка. Відновіть сили у лікарні та спробуйте іншу тактику.');}
  p.history.unshift({id:b.id,enemy:b.enemy.name,result,round:b.round,at:Date.now()});p.history=p.history.slice(0,20);
}
export function action(p,a,rng=Math.random) {
  requireThat(a && typeof a.type==='string','Невідома дія.');
  switch(a.type){
    case 'travel': idle(p);requireThat(cities.some(c=>c.id===a.city),'Такого міста немає.');p.city=a.city;if(!p.visited.includes(a.city))p.visited.push(a.city);break;
    case 'rest': idle(p);p.hp=derived(p).maxHp;p.energy=60;break;
    case 'buy': {idle(p);const i=items.find(i=>i.id===a.item);requireThat(i,'Предмет не знайдено.');requireThat(p.level>=i.level,'Недостатній рівень.');requireThat(p.gold>=i.price,'Бракує талерів.');requireThat(p.inventory.length<60,'У наплічнику немає місця.');p.gold-=i.price;p.inventory.push(i.id);p.purchases++;break;}
    case 'sell': {idle(p);const i=items.find(i=>i.id===a.item);requireThat(i&&p.inventory.includes(i.id),'Предмет не знайдено.');const amount=p.inventory.filter(id=>id===i.id).length;requireThat(!Object.values(p.equipment).includes(i.id)||amount>1,'Спочатку зніміть цей предмет.');p.inventory.splice(p.inventory.indexOf(i.id),1);p.gold+=Math.floor(i.price/2);break;}
    case 'equip': {idle(p);const i=items.find(i=>i.id===a.item);requireThat(i&&p.inventory.includes(i.id),'Предмет не знайдено.');requireThat(i.slot!=='consumable','Цей предмет потрібно використати.');requireThat(p.level>=i.level,'Недостатній рівень.');if(p.equipment[i.slot]===i.id)delete p.equipment[i.slot];else p.equipment[i.slot]=i.id;break;}
    case 'stat': {idle(p);requireThat(['strength','agility','intuition','vitality'].includes(a.stat),'Невідома характеристика.');requireThat(p.points>0,'Немає вільних очок.');const previous=derived(p).maxHp;p.stats[a.stat]++;p.points--;if(a.stat==='vitality')p.hp+=derived(p).maxHp-previous;break;}
    case 'claim': {idle(p);const q=quests.find(q=>q.id===a.quest);requireThat(q,'Завдання не знайдено.');requireThat(!p.claimed.includes(q.id),'Нагороду вже отримано.');requireThat(questProgress(p,q)>=q.target,'Завдання ще не виконано.');p.claimed.push(q.id);award(p,q.xp,q.gold);break;}
    case 'battle': {idle(p);requireThat(p.hp>0,'Відновіть здоров’я у лікарні.');const e=opponents.find(e=>e.id===a.enemy);requireThat(e,'Суперника не знайдено.');p.battle={id:randomUUID(),enemy:{...e,currentHp:e.hp},round:0,result:null,log:[`Ви викликали на поєдинок: ${e.name}. Оберіть удар, блок і стійку.`],deadline:Date.now()+30000,stamina:100};break;}
    case 'leave': requireThat(p.battle?.result,'Поєдинок ще триває.');p.battle=null;break;
    case 'surrender': requireThat(p.battle&&!p.battle.result,'Немає активного поєдинку.');finish(p,'loss');break;
    case 'potion': {requireThat(!p.battle||Date.now()<(p.battle.deadline||Infinity),'Час раунду минув.');requireThat(p.inventory.includes('potion'),'У вас немає зілля.');requireThat(!p.battle?.result,'Спочатку закрийте завершений бій.');requireThat(p.hp>0&&p.hp<derived(p).maxHp,'Зцілення зараз не потрібне.');const heal=derived(p).potionHeal;p.inventory.splice(p.inventory.indexOf('potion'),1);p.hp=Math.min(derived(p).maxHp,p.hp+heal);if(p.battle){const intent=p.battle.intent;p.battle.round++;const hit=resolveHit({profile:npcProfile(p.battle.enemy,intent)},{profile:pveProfile(p),block:-1,stance:'attack'},{attack:intent?.zone??Math.floor(rng()*4),block:-1,stance:'attack'},null,rng),damage=hit.damage;p.battle.intent=enemyPlan(p.battle);if(p.battle.enemyEffect){p.battle.enemyEffect.disoriented=Math.max(0,p.battle.enemyEffect.disoriented-1);p.battle.enemyEffect.immunity=Math.max(0,p.battle.enemyEffect.immunity-1);}p.hp=Math.max(0,p.hp-damage);p.battle.log.push(`Ви випили настоянку (+${heal} здоров’я). Суперник завдав ${damage} шкоди.`);if(p.hp===0)finish(p,'loss');else if(p.battle.round>=100)finish(p,'draw');else p.battle.deadline=Date.now()+30000;}break;}
    case 'timeout': {
      const b=p.battle;requireThat(b&&!b.result,'Немає активного поєдинку.');
      requireThat(Date.now()>=(b.deadline||Infinity),'Час раунду ще не завершився.');
      const intent=b.intent,attack={attack:intent?.zone??Math.floor(rng()*4),block:-1,stance:'attack'};
      const hit=resolveHit({profile:npcProfile(b.enemy,intent)},{profile:pveProfile(p),block:-1,stance:'attack'},attack,null,rng);
      b.round++;p.hp=Math.max(0,p.hp-hit.damage);b.intent=enemyPlan(b);
      if(b.enemyEffect){b.enemyEffect.disoriented=Math.max(0,b.enemyEffect.disoriented-1);b.enemyEffect.immunity=Math.max(0,b.enemyEffect.immunity-1);}
      b.log.push(`ЧАС ВИЙШОВ! ${p.name}: атаку пропущено, захист зон не спрацював. ${formatCombatLog(b.enemy.name,hit,p.name)}`);
      if(!p.hp)finish(p,'loss');else if(b.round>=100)finish(p,'draw');else b.deadline+=30000;b.log=b.log.slice(-60);break;
    }
    case 'turn': {
      const b=p.battle;requireThat(b&&!b.result,'Немає активного поєдинку.');
      requireThat(Date.now()<(b.deadline||Infinity),'Час раунду минув.');
      requireThat(Number.isInteger(a.attack)&&a.attack>=0&&a.attack<4,'Оберіть зону удару.');
      requireThat(Number.isInteger(a.block)&&a.block>=0&&a.block<6,'Оберіть блок.');
      requireThat(['attack','defense'].includes(a.stance),'Оберіть стійку.');
      requireThat(a.power===undefined||typeof a.power==='boolean','Невідомий прийом.');
      requireThat(a.shot===undefined||typeof a.shot==='boolean','Невідомий постріл.');
      requireThat(a.ability===undefined||typeof a.ability==='boolean','Невідомий прийом.');
      b.stamina??=100;const style=CLASS_RULES[classOf(p)],useAbility=!!a.ability;
      requireThat(!useAbility||b.round>=(b.abilityReady||0),'Прийом ще відновлюється.');
      requireThat(!useAbility||(b.stamina??100)>=style.cost+(a.power?20:0),'Бракує витривалості для прийому.');
      requireThat(!a.power||(b.stamina??100)>=20,'Для сильної атаки потрібно 20 бойової витривалості.');
      const shot=!!a.shot;if(shot){requireThat(items.some(i=>i.ranged&&(i.id===p.equipment.pistol||i.id===p.equipment.weapon)),'Спорядіть пістоль або мушкет.');requireThat((p.materials?.resin||0)>0,'Немає пороху. Знайдіть його в припасах.');p.materials.resin--;}
      const d=derived(p),intent=b.intent,enemyAttack=intent?.zone??Math.floor(rng()*4),enemyBlock=blocks.findIndex(pair=>pair.join()===(intent?.block||blocks[Math.floor(rng()*6)]).join());
      const cost=(a.power?20:0)+(useAbility?style.cost:0);b.stamina=Math.min(100,b.stamina-cost+(cost===0?8:0));
      if(useAbility)b.abilityReady=b.round+style.cooldown;
      const playerProfile=pveProfile(p),enemyProfile=npcProfile(b.enemy,intent);
      if(shot)playerProfile.attack*=1.6;
      const enemyMove={attack:enemyAttack,block:enemyBlock,stance:intent?.kind==='guard'?'defense':'attack'};
      const outgoing=resolveHit({profile:playerProfile},{profile:enemyProfile,...enemyMove,disoriented:b.enemyEffect?.disoriented>0,immunity:b.enemyEffect?.immunity>0},a,enemyMove,rng);
      const incoming=resolveHit({profile:enemyProfile},{profile:playerProfile,...a},enemyMove,a,rng);
      if(b.enemyEffect){b.enemyEffect.disoriented=Math.max(0,b.enemyEffect.disoriented-1);b.enemyEffect.immunity=Math.max(0,b.enemyEffect.immunity-1);}
      if(outgoing.control)b.enemyEffect={disoriented:1,immunity:2};
      b.round++;b.intent=enemyPlan(b);b.enemy.currentHp=Math.max(0,b.enemy.currentHp-outgoing.damage);p.hp=Math.max(0,p.hp-incoming.damage);
      b.log.push(`Хід ${b.round}. ${formatCombatLog(p.name,outgoing,b.enemy.name)} ${formatCombatLog(b.enemy.name,incoming,p.name)}`);
      if(p.hp===0&&b.enemy.currentHp===0)finish(p,'draw');else if(p.hp===0)finish(p,'loss');else if(b.enemy.currentHp===0)finish(p,'win');
      if(!b.result&&b.round>=100)finish(p,'draw');if(!b.result)b.deadline=Date.now()+30000; b.log=b.log.slice(-60);break;
    }
    default: throw new Error('Невідома дія.');
  }
  return p;
}

export function pveProfile(p){const d=derived(p),full=combatProfile(p);return {...full,crit:d.crit,dodge:d.dodge,antiCrit:d.antiCrit,antiDodge:d.antiDodge,pace:1,attack:d.damage,armor:d.armor*6.25,zoneArmor:full.zoneArmor?.map(n=>Math.max(0,n-60+d.armor-(full.armor-60))*6.25)};}
export function npcProfile(enemy,intent){return {classId:'npc',pace:1,attack:enemy.damage*(intent?.damage||1),armor:(enemy.armor+(intent?.armor||0))*6.25,crit:enemy.crit??12,antiCrit:enemy.antiCrit??6,dodge:enemy.dodge??8,antiDodge:enemy.antiDodge??6,critMultiplier:1.5};}
