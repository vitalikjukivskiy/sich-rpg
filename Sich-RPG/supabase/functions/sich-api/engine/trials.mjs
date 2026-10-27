const randomUUID = () => crypto.randomUUID();
import {items} from './game.mjs';
import {addInstance,CAPACITY} from './inventory.mjs';
import {enemyPlan} from './combat.mjs';
import {plural} from './public/uk.js';
export const trials=[
 {id:'sentinel',name:'Вартовий Соляної Брами',text:'Перше випробування ради. Вартовий перевіряє, чи вистачить вам витримки після завершення походів.',level:12,hp:550,damage:90,armor:20,xp:300,gold:150,firstHonor:3,honor:1,portrait:'crimea',requires:null},
 {id:'marshal',name:'Майстер Залізного Строю',text:'Досвідчений дуелянт не відступає. Важкий захист і сильний натиск перевірять ваше спорядження.',level:12,hp:900,damage:115,armor:35,xp:500,gold:230,firstHonor:6,honor:2,portrait:'sweden',requires:'sentinel'},
 {id:'champion',name:'Чемпіон П’яти Доріг',text:'Останній герць ради. Підготуйте настоянки й оберіть збірку, на яку справді покладаєтеся.',level:12,hp:1250,damage:145,armor:50,xp:800,gold:350,firstHonor:9,honor:3,portrait:'commonwealth',requires:'marshal'}
];
export const honors=[{item:'council_sabre',cost:12},{item:'council_plate',cost:12},{item:'council_seal',cost:8},{item:'council_amulet',cost:8}];
const check=(v,m)=>{if(!v)throw new Error(m);};
export function trialAction(p,a){
 check(!p.battle||p.battle.result,'Спочатку завершіть бій.');check(p.storyComplete,'Випробування ради відкриваються після фіналу кампанії.');
 if(a.type==='honorBuy'){
  const offer=honors.find(o=>o.item===a.item),item=items.find(i=>i.id===offer?.item);check(offer&&item,'Відзнаку не знайдено.');check(p.level>=item.level,'Замалий рівень.');check((p.honor||0)>=offer.cost,'Бракує відзнак ради.');check(p.instances.length<CAPACITY,'У скрині немає місця.');addInstance(p,item.id);p.honor-=offer.cost;return;
 }
 check(a.type==='trialStart','Невідома дія випробування.');const trial=trials.find(t=>t.id===a.trial);check(trial,'Випробування не знайдено.');check(p.level>=trial.level,'Замалий рівень.');check(!trial.requires||p.trialsCompleted?.includes(trial.requires),'Спочатку пройдіть попереднє випробування.');check(p.hp>0,'Відновіть здоров’я.');
 const id=randomUUID();p.battle={id,source:'trial',enemy:{...trial,currentHp:trial.hp},round:0,result:null,log:['Рада засвідчує ваш виклик. Суперник: '+trial.name+'.']};p.battle.intent=enemyPlan(p.battle);p.trial={id:trial.id,battleId:id,rewarded:false};
}
export function resolveTrialBattle(p){
 const t=p.trial,b=p.battle;if(!t||t.rewarded||t.battleId!==b?.id||!b.result)return;t.rewarded=true;if(b.result!=='win')return;
 p.trialsCompleted??=[];p.trialRecords??={};const trial=trials.find(x=>x.id===t.id),first=!p.trialsCompleted.includes(t.id),honor=first?trial.firstHonor:trial.honor;p.honor=(p.honor||0)+honor;p.trialWins=(p.trialWins||0)+1;if(first)p.trialsCompleted.push(t.id);p.trialRecords[t.id]=Math.min(p.trialRecords[t.id]||Infinity,b.round);b.log.push('Рада визнає вашу перемогу. +'+honor+' '+plural(honor,'відзнака','відзнаки','відзнак')+'. '+(first?'Нове випробування пройдено.':'Повторний герць зараховано.'));
}
export function trialSnapshot(p){return {trials:trials.map(t=>({...t,completed:p.trialsCompleted?.includes(t.id)||false,best:p.trialRecords?.[t.id]||null})),honors:honors.map(h=>({...h,item:items.find(i=>i.id===h.item)}))};}
