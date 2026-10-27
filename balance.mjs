import {STYLE_MATCHUP_RATIOS,COMBAT_PACE} from './balance-parameters.mjs';
// Beta 0.2: authoritative, deterministic-with-injected-rng combat rules.
export const ROUND_MS=30_000;
export const CLASS_RULES={
 sabre:{name:'Шабля',hp:850,attack:100,crit:25,antiCrit:7,dodge:30,antiDodge:5,critMultiplier:1.65,ability:'Ковзний крок',cost:15,cooldown:4},
 hammer:{name:'Молот',hp:1150,attack:110,crit:4,antiCrit:30,dodge:6,antiDodge:30,critMultiplier:1.25,ability:'Точний розмах',cost:15,cooldown:3},
 mace:{name:'Булава',hp:1450,attack:90,crit:22,antiCrit:12,dodge:5,antiDodge:5,critMultiplier:1.65,ability:'Оглушливий удар',cost:20,cooldown:4},
 pike:{name:'Піка',hp:950,attack:105,crit:16,antiCrit:15,dodge:18,antiDodge:18,critMultiplier:1.50,ability:'Прицільний випад',cost:15,cooldown:3},
 axe:{name:'Сокира',hp:1350,attack:110,crit:30,antiCrit:8,dodge:7,antiDodge:6,critMultiplier:1.85,ability:'Розколюючий удар',cost:20,cooldown:4}
};
export const ZONES=['голову','груди','пояс','ноги'];
export const BLOCKS=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export const clamp=(lo,hi,n)=>Math.max(lo,Math.min(hi,n));
export function classOf(p){
 const item=p?.equipment?.weapon||'sword';
 if(['hammer','war_hammer','starter_hammer'].includes(item))return 'hammer';
 if(['mace','club','war_mace','starter_mace'].includes(item))return 'mace';
 if(['pike','war_pike','starter_pike'].includes(item))return 'pike';
 if(['war_axe','battle_axe','starter_axe'].includes(item))return 'axe';
 return 'sabre'; // legacy and ranged items remain usable, without losing items.
}
export function requirement(item,level=5){
 if(!item?.combatClass)return {};
 const step=Math.max(0,Math.floor((level-5)/3));
 const base={sabre:{agility:12,intuition:10},hammer:{strength:12,intuition:10},mace:{strength:12,vitality:12},pike:{intuition:12,agility:10,strength:7},axe:{strength:14,vitality:10}}[item.combatClass]||{};
 return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,level<5?5+Math.round((v-5)*(level-1)/4):v+step]));
}
export function meetsRequirements(p,item){return Object.entries(requirement(item,item.level)).every(([k,v])=>(p.stats?.[k]||0)>=v);}
export function combatProfile(p){
 const key=classOf(p),r=CLASS_RULES[key],s=p.stats||{};
 const bonus=(stat)=>Math.max(0,(s[stat]||5)-5);
 const soft=(n)=>n<=20?n:20+(n-20)*0.35;
 const classArmor=p.equipment?.body==='class_armor_'+key;
 const bodyArmor=({'mail':6,'plate':13,'officer_coat':18,'officer_plate':27})[p.equipment?.body]||0;
 const hp=Math.round((r.hp+12*soft(bonus('vitality'))+(classArmor&&key==='mace'?100:0))*(1+Math.max(0,(p.level||1)-10)*0.035));
 return {classId:key,className:r.name,ability:r.ability,maxHp:hp,attack:r.attack*(1+0.012*soft(bonus('strength'))),
 crit:clamp(0,40,r.crit+0.15*soft(bonus('agility'))*(key==='sabre'?1:0)+(classArmor&&key==='axe'?5:0)),antiCrit:r.antiCrit+(classArmor&&key==='hammer'?5:0),
 dodge:clamp(0,35,r.dodge+0.6*soft(bonus('agility'))+(classArmor&&key==='sabre'?5:0)),antiDodge:r.antiDodge+0.6*soft(bonus('intuition'))+(classArmor&&key==='pike'?5:0),
 critMultiplier:r.critMultiplier,armor:60+bodyArmor+(classArmor?15:0)};
}
export function validMove(m){return !!m&&Number.isInteger(m.attack)&&m.attack>=0&&m.attack<4&&Number.isInteger(m.block)&&m.block>=0&&m.block<6&&['attack','defense'].includes(m.stance)&&(!m.ability||m.ability===true)&&(!m.power||m.power===true);}
export function resolveHit(attacker,defender,attack,defense,rng=Math.random){
 if(!attack)return {damage:0,miss:true,pass:true};
 const a=attacker,b=defender||{stance:'attack',block:-1},ability=!!attack.ability;
 const dodge=clamp(3,35,b.profile.dodge-(a.profile.antiDodge+(a.profile.classId==='hammer'&&ability?12:0))*0.75+(b.profile.classId==='sabre'&&b.ability?8:0));
 if(rng()*100<dodge)return {damage:0,dodged:true};
 const critChance=clamp(3,40,a.profile.crit-b.profile.antiCrit*0.65),crit=rng()*100<critChance;
 const critBonus=(a.profile.critMultiplier-1+(a.profile.classId==='axe'&&ability?.15:0))*Math.max(.7,1-b.profile.antiCrit*.007);
 const zone=[1.10,1,1.05,.95][attack.attack];
 const key=`${a.profile.classId}:${b.profile.classId}`,reverse=`${b.profile.classId}:${a.profile.classId}`;
 const coefficient=STYLE_MATCHUP_RATIOS[key]??(STYLE_MATCHUP_RATIOS[reverse]?1/STYLE_MATCHUP_RATIOS[reverse]:1);
 const tempo=Math.sqrt(coefficient);
 const damage=COMBAT_PACE*tempo*a.profile.attack*zone*(crit?1+critBonus:1)*
  (attack.stance==='attack'?1.10:.85)*(attack.power?1.2:1)*(a.profile.classId==='hammer'&&ability?1.04:1);
 const armor=clamp(0,.4,b.profile.armor/(b.profile.armor+250));
 let blockStrength=BLOCKS[b.block]?.includes(attack.attack)?(b.stance==='defense'?.75:.55):0;
 if(a.profile.classId==='pike'&&ability)blockStrength=Math.max(0,blockStrength-.15);
 if(b.disoriented)blockStrength=Math.max(0,blockStrength-.20);
 const final=Math.max(1,Math.round(damage*(1-armor)*(1-blockStrength)));
 return {damage:final,crit,blocked:blockStrength>0,dodged:false,zone:attack.attack,control:a.profile.classId==='mace'&&ability&&!b.immunity};
}
export function formatCombatLog(name,hit,other){
 if(hit.pass)return `${name}: час вийшов, атака пропущена.`;
 if(hit.dodged)return `${other} ухилився від удару ${name}.`;
 return `${name}: удар у ${ZONES[hit.zone]} — ${hit.damage} шкоди${hit.crit?'! КРИТИЧНИЙ УДАР':''}${hit.blocked?' (блок)':''}${hit.control?' (дезорієнтація)':''}.`;
}
export function priceFloor(item,rank=0){
 const rarity={common:1,fine:1.3,uncommon:1.3,rare:1.8,epic:2.8,legendary:4.5}[item?.rarity]||1;
 return Math.max(2,Math.ceil((item?.price||1)*rarity*(1+Math.max(0,rank)*.35)));
}
