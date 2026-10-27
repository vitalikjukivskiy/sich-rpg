import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {CLASS_RULES,resolveHit,clamp} from '../balance.mjs';
export const styles=['attack','defense','mixed','ability','adaptive'];
export const names=Object.keys(CLASS_RULES),result={runs:10000,seed:27102026,method:'Randomized strategies, paired seeds and swapped order',matrix:{}};
function rng(seed){let s=seed>>>0;return ()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);}
function move(style,profile,round,energy,r){const stance=style==='defense'?'defense':style==='attack'?'attack':r()<.5?'defense':'attack';const ab=style==='ability'&&round%4===0&&energy>=20;return {attack:Math.floor(r()*4),block:Math.floor(r()*6),stance,ability:ab,power:energy>=20&&(style==='attack'||style==='ability'||r()<.3)};}
export function simulate(x,y,seed,swap=false){const r=rng(seed),keys=swap?[y,x]:[x,y],ps=keys.map(k=>({...CLASS_RULES[k],classId:k,armor:60}));let hp=ps.map(p=>p.hp),energy=[100,100],round=0;const style=keys.map(()=>styles[Math.floor(r()*styles.length)]);let misses=0,crits=0,blocks=0,controls=0;
 for(;round<25&&hp.every(h=>h>0);round++){
  const moves=ps.map((p,i)=>move(style[i],p,round,energy[i],r));
  const attacks=ps.map((p,i)=>resolveHit({profile:ps[i]},{profile:ps[1-i],block:moves[1-i].block,stance:moves[1-i].stance,ability:moves[1-i].ability,immunity:false},moves[i],moves[1-i],r));
  for(let i=0;i<2;i++){hp[1-i]-=attacks[i].damage;energy[i]=clamp(0,100,energy[i]-(moves[i].power?20:0)-(moves[i].ability?ps[i].cost:0)+(!moves[i].power&&!moves[i].ability?8:0));misses+=Number(!!attacks[i].dodged);crits+=Number(!!attacks[i].crit);blocks+=Number(!!attacks[i].blocked);controls+=Number(!!attacks[i].control);}
 }
 const rel=hp.map((h,i)=>h/ps[i].hp),win=rel[0]===rel[1]?null:rel[0]>rel[1]?keys[0]:keys[1];return {win,round,misses,crits,blocks,controls};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
for(let a=0;a<names.length;a++)for(let b=a+1;b<names.length;b++){
 const x=names[a],y=names[b],key=x+' vs '+y;let won=0,draw=0,rounds=0,misses=0,crits=0,blocks=0,controls=0;
 for(let i=0;i<10000;i++){const v=simulate(x,y,27102026+i*211+(a*5+b)*101,i%2===1);won+=v.win===x?1:0;draw+=v.win===null?1:0;rounds+=v.round;misses+=v.misses;crits+=v.crits;blocks+=v.blocks;controls+=v.controls;}
 result.matrix[key]={winRate:Math.round(10000*(won+draw/2)/10000)/100,avgRounds:Math.round(rounds/10000*10)/10,dodgePerCombat:Math.round(misses/10000*10)/10,critPerCombat:Math.round(crits/10000*10)/10,blocksPerCombat:Math.round(blocks/10000*10)/10,controlsPerCombat:Math.round(controls/10000*10)/10};
}
const output=new URL('../BALANCE-SIMULATION.json',import.meta.url);fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result.matrix,null,2));

}
