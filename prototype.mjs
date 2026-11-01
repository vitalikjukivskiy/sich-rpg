// Sich campaign tuning on top of published Lutecia item/progression data.
// These encounter/reward values are prototype design, not recovered server math.
import {canonicalItems,canonicalProfile,canonicalRules,progression} from './canon.mjs';
const levelStart=level=>progression.find(r=>r.level===level)?.xp;
export function sourceBaseXp(level){return progression.find(r=>r.level===Math.min(11,Math.max(0,level)))?.baseXp||10;}
export function campaignContract(contract){
 const level=Math.min(11,contract.chapter||contract.level),base=sourceBaseXp(level);
 const delta=level<11?levelStart(level+1)-levelStart(level):base*5;
 return {...contract,level,gold:Math.max(5,level*3),xp:Math.max(base,delta-base*contract.enemies.length),rewardItem:undefined};
}
export function campaignQuest(quest){
 if(quest.id.startsWith('intro_'))return quest;
 return {...quest,...(quest.id==='smith'?{name:'Перша майстрова робота',text:'Виготовте предмет за рецептом або покращте січову річ у кузні.'}:{}),gold:Math.max(2,Math.round(quest.gold/20)),xp:Math.max(5,Math.round(quest.xp/3))};
}
export function campaignDaily(quest){return {...quest,gold:Math.max(2,Math.round(quest.gold/20)),xp:Math.max(5,Math.round(quest.xp/3))};}
export function campaignRoad(route){return {...route,level:Math.min(11,route.level),cost:Math.max(2,Math.round(route.cost/10)),gold:Math.max(5,Math.round(route.gold/10)),xp:sourceBaseXp(Math.min(11,route.level))*2};}
export function campaignTrial(trial){return canonicalEncounter({...trial,level:11},11);}
export function campaignRecipe(recipe){
 if(recipe.item==='potion')return {...recipe,gold:1};
 const slots={veteran_sabre:['weapon','sword'],carbine:['weapon','hammer'],guild_seal:['ring'],officer_coat:['body']},target=slots[recipe.item];
 if(!target)return recipe;
 const item=canonicalItems.filter(i=>i.purchasable&&i.currency==='florin'&&i.slot===target[0]&&(!target[1]||i.weaponType===target[1])&&i.level<=recipe.level).sort((a,b)=>b.level-a.level||a.price-b.price)[0];
 return {...recipe,item:item.id,name:item.name,gold:Math.max(1,Math.ceil(item.price*.6)),text:'Майстровий рецепт Січі. Вимоги та бонуси готової речі відповідають каталогу.'};
}
export function canonicalEncounter(enemy,level=enemy.level){
 if(enemy.training)return {...enemy,profile:{ruleset:'lutecia-public',classId:'unarmed',className:'Навчальне опудало',level:0,maxHp:enemy.hp,minDamage:1,maxDamage:2,attack:1.5,armor:0,zoneArmor:[0,0,0,0],crit:0,antiCrit:3,dodge:0,antiDodge:3,critMultiplier:1.5,pace:1}};
 level=Math.min(11,Math.max(1,level));
 const style=['club','knife','spear','axe','hammer','sword'][[...enemy.id].reduce((a,c)=>a+c.charCodeAt(0),0)%6];
 const recommended=canonicalRules.buildRecommendations.entries.find(r=>r.level===Math.min(level,5)&&r.weapon===style);
 const stats={strength:recommended.stats.strength,agility:recommended.stats.agility,intuition:recommended.stats.instinct,vitality:recommended.stats.vitality};
 if(level>5){const total=progression.find(r=>r.level===level).totalStats,current=Object.values(stats).reduce((a,b)=>a+b,0),keys=['vitality','strength','agility','intuition'];for(let i=0;i<total-current;i++)stats[keys[i%keys.length]]++;}
 const npc={stats,level,equipment:{},instances:[],equipmentInstances:{},canonVersion:1};
 const allowed=i=>i.purchasable&&i.currency==='florin'&&i.level<=level&&Object.entries(i.requirements).every(([k,v])=>k==='level'||(stats[k==='instinct'?'intuition':k]||0)>=v);
 const weapon=canonicalItems.filter(i=>i.weaponType===style&&allowed(i)).sort((a,b)=>b.level-a.level||a.price-b.price)[0];
 if(weapon)npc.equipment.weapon=weapon.id;
 // Limited armor keeps NPCs fair for characters who do not own a full set yet.
 for(const slot of ['body','head','boots']){const gear=canonicalItems.filter(i=>i.slot===slot&&allowed(i)).sort((a,b)=>b.level-a.level||a.price-b.price)[0];if(gear)npc.equipment[slot]=gear.id;}
 const full=canonicalProfile(npc,canonicalItems),profile={...full,maxHp:Math.max(24,Math.round(full.maxHp*.75)),minDamage:Math.max(1,Math.round(full.minDamage*.65)),maxDamage:Math.max(2,Math.round(full.maxDamage*.65))};
 profile.attack=(profile.minDamage+profile.maxDamage)/2;
 return {...enemy,level,hp:profile.maxHp,damage:profile.attack,armor:profile.armor,xp:sourceBaseXp(level),gold:0,profile,stats:profile.stats,equipment:Object.values(npc.equipment).map(id=>({id,name:canonicalItems.find(i=>i.id===id).name}))};
}
