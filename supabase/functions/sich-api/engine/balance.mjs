import {items} from './game.mjs';
import {equippedRank} from './inventory.mjs';
import {STYLE_MATCHUP_RATIOS,LEVEL_MATCHUP_RATIOS,COMBAT_PACE} from './balance-parameters.mjs';
// Beta 0.2: authoritative, deterministic-with-injected-rng combat rules.
export const ROUND_MS=30_000;
export const STANCES={attack:{damage:1.10,incoming:1,block:.55,dodge:0},defense:{damage:.85,incoming:1,block:.75,dodge:0}};
export const CLASS_RULES={
 sabre:{name:'Шабля',vitalityHp:6,hp:850,attack:100,crit:25,antiCrit:7,dodge:30,antiDodge:5,critMultiplier:1.65,ability:'Ковзний крок',cost:15,cooldown:4},
 hammer:{name:'Молот',vitalityHp:10,hp:1150,attack:110,crit:4,antiCrit:30,dodge:6,antiDodge:30,critMultiplier:1.25,ability:'Точний розмах',cost:15,cooldown:3},
 mace:{name:'Булава',hp:1450,attack:90,crit:22,antiCrit:12,dodge:5,antiDodge:5,critMultiplier:1.65,ability:'Оглушливий удар',cost:20,cooldown:4},
 pike:{name:'Піка',hp:950,attack:105,crit:16,antiCrit:15,dodge:18,antiDodge:18,critMultiplier:1.50,ability:'Прицільний випад',cost:15,cooldown:3},
 axe:{name:'Сокира',hp:1350,attack:110,crit:30,antiCrit:8,dodge:7,antiDodge:6,critMultiplier:1.85,ability:'Розколюючий удар',cost:20,cooldown:4}
};
export const ZONES=['голову','груди','пояс','ноги'];
export const BLOCKS=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export const clamp=(lo,hi,n)=>Math.max(lo,Math.min(hi,n));
export function classOf(p){
 const item=p?.equipment?.weapon||'sword';
 const catalog=items.find(i=>i.id===item);if(catalog?.combatClass)return catalog.combatClass;
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
 const key=classOf(p),r=CLASS_RULES[key],s=p.stats||{},perk={damage:p.faction==='cossacks'?2:0,armor:p.faction==='commonwealth'?2:0,hp:p.faction==='ottoman'?10:0,crit:p.faction==='sweden'?3:0,dodge:p.faction==='crimea'?3:0};
 const bonus=(stat)=>Math.max(0,(s[stat]||5)-5);
 const soft=(n)=>n<=20?n:20+(n-20)*0.35;
 const body=items.find(i=>i.id===p.equipment?.body),armorBonus=body?.combatClass===key?body.combatBonus||{}:{};
 const gear=Object.entries(p.equipment||{}).map(([slot,id])=>{const item=items.find(i=>i.id===id);if(!item)return {damage:0,armor:0};const rank=equippedRank(p,slot,id);return {slot,damage:(item.damage||0)+(['weapon','pistol'].includes(slot)?rank*2:0),armor:(item.armor||0)+(!['weapon','pistol'].includes(slot)?rank*2:0)};});
 const gearDamage=gear.reduce((sum,i)=>sum+i.damage,0),gearArmor=gear.reduce((sum,i)=>sum+i.armor,0);
 const hp=Math.round((r.hp+perk.hp+(r.vitalityHp||12)*soft(bonus('vitality'))+(armorBonus.hp||0))*(1+Math.max(0,(p.level||1)-10)*0.035));
 return {level:p.level||1,classId:key,className:r.name,ability:r.ability,maxHp:hp,attack:(r.attack+gearDamage+perk.damage)*(1+0.012*soft(bonus('strength'))),
 crit:clamp(3,40,r.crit+perk.crit+0.15*soft(bonus('agility'))*(key==='sabre'?1:0)+(armorBonus.crit||0)),antiCrit:r.antiCrit+(armorBonus.antiCrit||0),
 dodge:clamp(0,35,r.dodge+perk.dodge+0.6*soft(bonus('agility'))+(armorBonus.dodge||0)),antiDodge:r.antiDodge+0.6*soft(bonus('intuition'))+(armorBonus.antiDodge||0),
 critMultiplier:r.critMultiplier+(armorBonus.critMultiplier||0),controlResistance:armorBonus.controlResistance||0,armor:60+gearArmor+perk.armor,zoneArmor:['head','body','belt','boots'].map(slot=>60+gearArmor+perk.armor+2*(gear.find(i=>i.slot===slot)?.armor||0))};
}
export function validMove(m){return !!m&&Number.isInteger(m.attack)&&m.attack>=0&&m.attack<4&&Number.isInteger(m.block)&&m.block>=0&&m.block<6&&['attack','defense'].includes(m.stance)&&(m.ability===undefined||typeof m.ability==='boolean')&&(m.power===undefined||typeof m.power==='boolean');}
export function resolveHit(attacker,defender,attack,defense,rng=Math.random){
 if(!attack)return {damage:0,miss:true,pass:true};
 const a=attacker,b=defender,ability=!!attack.ability;
 const stance=STANCES[attack.stance],guard=STANCES[b.stance]||STANCES.attack;
 const dodge=clamp(3,35,b.profile.dodge+guard.dodge-(a.profile.antiDodge+(a.profile.classId==='hammer'&&ability?12:0))*0.75+(b.profile.classId==='sabre'&&b.ability?8:0));
 if(rng()*100<dodge)return {damage:0,dodged:true};
 const critChance=clamp(3,40,a.profile.crit-b.profile.antiCrit*0.65),crit=rng()*100<critChance;
 const critBonus=(a.profile.critMultiplier-1+(a.profile.classId==='axe'&&ability?.15:0))*Math.max(.7,1-b.profile.antiCrit*.007);
 const zone=[1.10,1,1.05,.95][attack.attack];
 const key=`${a.profile.classId}:${b.profile.classId}`,reverse=`${b.profile.classId}:${a.profile.classId}`;
 const level=((a.profile.level||10)+(b.profile.level||10))/2;
 const anchors=[...new Set([10,...Object.keys(LEVEL_MATCHUP_RATIOS).map(Number)])].sort((a,b)=>a-b),low=anchors.filter(n=>n<=level).at(-1)??anchors[0],high=anchors.find(n=>n>=level)??anchors.at(-1);
 const ratio=n=>{const table=n===10?STYLE_MATCHUP_RATIOS:LEVEL_MATCHUP_RATIOS[n]||STYLE_MATCHUP_RATIOS;return table[key]??(table[reverse]?1/table[reverse]:1);};
 const coefficient=low===high?ratio(low):Math.exp(Math.log(ratio(low))+(Math.log(ratio(high))-Math.log(ratio(low)))*(level-low)/(high-low));
 const tempo=Math.sqrt(coefficient);
 const damage=(a.profile.pace??COMBAT_PACE)*tempo*a.profile.attack*zone*(crit?1+critBonus:1)*
  stance.damage*guard.incoming*(attack.power?1.2:1);
 const zoneArmor=b.profile.zoneArmor?.[attack.attack]??b.profile.armor;
 const armor=clamp(0,.4,zoneArmor/(zoneArmor+250));
 let blockStrength=BLOCKS[b.block]?.includes(attack.attack)?guard.block:0;
 if(a.profile.classId==='pike'&&ability)blockStrength=Math.max(0,blockStrength-.15);
 if(b.disoriented)blockStrength=Math.max(0,blockStrength-.20);
 const final=Math.max(1,Math.round(damage*(1-armor)*(1-blockStrength)));
 return {damage:final,crit,blocked:blockStrength>0,dodged:false,zone:attack.attack,antiCritMitigated:crit&&b.profile.antiCrit>0,control:a.profile.classId==='mace'&&ability&&!b.immunity};
}
export function formatCombatLog(name,hit,other){
 if(hit.pass)return `${name}: ЧАС ВИЙШОВ, атаку пропущено.`;
 if(hit.dodged)return `${name}: удар не влучив. ${other}: УХИЛЕННЯ.`;
 return `${name}: удар у ${ZONES[hit.zone]} — ${hit.damage} шкоди${hit.crit?'! КРИТИЧНИЙ УДАР':''}${hit.blocked?' (блок)':''}${hit.control?' (дезорієнтація на наступний хід)':''}${hit.antiCritMitigated?' (антикрит зменшив силу криту)':''}.`;
}
export function priceFloor(item,rank=0){
 const rarity={common:1,fine:1.3,uncommon:1.3,rare:1.8,epic:2.8,legendary:4.5}[item?.rarity]||1;
 return Math.max(2,Math.ceil((item?.price||1)*rarity*(1+Math.max(0,rank)*.35)));
}
