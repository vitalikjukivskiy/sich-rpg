import {chapters} from './content.mjs';
import {stories} from './story.mjs';
export const factions=[
 {id:'cossacks',name:'Військо Запорозьке',short:'Запорожці',city:'castle',role:'Герць · Воля · Маневр',perk:'+2 до шкоди',description:'Січова рада, побратимство й дорога понад Дніпром. Від новака до козацької старшини.'},
 {id:'commonwealth',name:'Річ Посполита',short:'Річ Посполита',city:'forest',role:'Кіннота · Натиск · Честь',perk:'+2 до захисту',description:'Прикордонні замки, шляхетські двори й військова служба. Слава здобувається клинком і добрим іменем.'},
 {id:'crimea',name:'Кримське ханство',short:'Ханство',city:'mountain',role:'Маневр · Лук · Розвідка',perk:'+3% до ухилення',description:'Степові дороги, швидка кіннота й ханські доручення. Пильне око цінніше за важкий обладунок.'},
 {id:'sweden',name:'Шведське королівство',short:'Швеція',city:'harbor',role:'Стрій · Мушкет · Дисципліна',perk:'+3% до критичного удару',description:'Балтійські порти, військовий стрій і майстри вогнепальної зброї. Влучний залп вирішує долю сутички.'},
 {id:'ottoman',name:'Османська імперія',short:'Османи',city:'ottoman',role:'Піхота · Торг · Постачання',perk:'+10 до максимального здоров’я',description:'Прибережні твердині, караванні шляхи й султанська служба. Сила війська починається з доброго постачання.'}
];
export const factionRules={
 cossacks:{recovery:4,reputation:1.2,gatherCost:6,powderYield:1,forgeDiscount:0,shopDiscount:0,marketFee:0.05},
 commonwealth:{recovery:3,reputation:1,gatherCost:6,powderYield:1,forgeDiscount:0.2,shopDiscount:0,marketFee:0.05},
 crimea:{recovery:3,reputation:1,gatherCost:4,powderYield:1,forgeDiscount:0,shopDiscount:0,marketFee:0.05},
 sweden:{recovery:3,reputation:1,gatherCost:6,powderYield:2,forgeDiscount:0,shopDiscount:0,marketFee:0.05},
 ottoman:{recovery:3,reputation:1,gatherCost:6,powderYield:1,forgeDiscount:0,shopDiscount:0.05,marketFee:0.03}
};
export function rules(p){return factionRules[p.faction]||{...factionRules.commonwealth,forgeDiscount:0};}
export function requiredLevel(p,item){return p.faction==='sweden'&&item.id==='axe'?1:item.level;}
export function shopPrice(p,item){return Math.max(1,Math.ceil(item.price*(1-rules(p).shopDiscount)));}
export function forgePrice(p,rank){return Math.ceil(40*(rank+1)*(1-rules(p).forgeDiscount));}
const starterData={
 cossacks:{title:'Кошовий припас',text:'Чоботи, 2 настоянки, 3 трави, 2 руди, 2 порохи та 40 талерів.',items:['boots','potion','potion'],gold:40,materials:{herb:3,ore:2,resin:2}},
 commonwealth:{title:'Патент прикордонної служби',text:'Шапка, кушак, 4 руди й 20 талерів.',items:['helmet','belt'],gold:20,materials:{herb:0,ore:4,resin:0}},
 crimea:{title:'Сагайдак мандрівника',text:'Чоботи, кушак, 3 настоянки та 30 талерів.',items:['boots','belt','potion','potion','potion'],gold:30,materials:{herb:2,ore:0,resin:0}},
 sweden:{title:'Арсенальний квиток',text:'Мушкет, настоянка та 6 мірок пороху. Мушкет доступний з 1 рівня.',items:['axe','potion'],gold:0,materials:{herb:0,ore:0,resin:6}},
 ottoman:{title:'Караванна частка',text:'Кушак, 3 настоянки, 3 трави та 90 талерів.',items:['belt','potion','potion','potion'],gold:90,materials:{herb:3,ore:0,resin:0}}
};
const traits={
 cossacks:['Побратимство: звичайний хід відновлює 4 витривалості.','Січова слава: +20% репутації за похід.'],
 commonwealth:['Майстровий патент: −20% ціни гарту в талерах.'],
 crimea:['Степова звичка: збір припасу коштує 4 витривалості замість 6.'],
 sweden:['Арсенал: під час заготівлі пороху ви отримуєте 2 мірки.','Мушкет доступний з 1 рівня.'],
 ottoman:['Караванні зв’язки: −5% ціни NPC-крамниці.','Комісія спільного ринку — 3% замість 5%.']
};
for(const f of factions){f.traits=traits[f.id];f.starter=starterData[f.id];}
export const contracts=[
 {id:'crossing',name:'Варта на переправі',text:'Проведіть обоз через небезпечну переправу. Три сутички й платня від січового писаря.',enemies:['recruit','guard','lisovyk'],gold:130,xp:100,reputation:5,level:1},
 {id:'caravan',name:'Караванний шлях',text:'Супроводіть купців до наступної застави. На дорозі діють озброєні ватаги.',enemies:['guard','guard','knight'],gold:185,xp:145,reputation:8,level:2},
 {id:'border',name:'Прикордонний дозор',text:'З’ясуйте, хто перекрив торгову дорогу, й поверніть захоплені припаси.',enemies:['knight','lisovyk','lisovyk'],gold:260,xp:210,reputation:12,level:3}
];

contracts.push(...chapters);
contracts.forEach((contract,i)=>{contract.chapter=i+1;contract.requires=i?contracts[i-1].id:null;contract.story=stories[i];});
