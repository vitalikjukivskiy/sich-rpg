import fs from 'node:fs';
import {simulate} from './simulate-balance.mjs';
import {STYLE_MATCHUP_RATIOS} from '../balance-parameters.mjs';
const desired={'sabre:hammer':44,'sabre:mace':50,'sabre:pike':50,'sabre:axe':56,'hammer:mace':44,'hammer:pike':50,'hammer:axe':50,'mace:pike':50,'mace:axe':44,'pike:axe':50};
const seed=27102026;
function rate(x,y,n=1000){let a=0,t=0;for(let i=0;i<n;i++){const v=simulate(x,y,seed+i*211+113*i%n,i%2===1);a+=v.win===x;t+=v.win===null;}return (a+t*.5)/n*100;}
for(const [k,target] of Object.entries(desired)){
 const [x,y]=k.split(':');let lo=0.08,hi=20;
 for(let j=0;j<10;j++){const mid=Math.sqrt(lo*hi);STYLE_MATCHUP_RATIOS[k]=mid;const got=rate(x,y);if(got<target)lo=mid;else hi=mid;}
 STYLE_MATCHUP_RATIOS[k]=Math.round(Math.sqrt(lo*hi)*10000)/10000;
 console.log(`${k}: ratio ${STYLE_MATCHUP_RATIOS[k]}, target ${target}%, achieved ${rate(x,y,2500).toFixed(2)}%`);
}
const code='// Calibrated style-tempo interactions; server-authoritative.\\n'.replace('\\n','\n')+'export const STYLE_MATCHUP_RATIOS='+JSON.stringify(STYLE_MATCHUP_RATIOS,null,2)+';\nexport const COMBAT_PACE=1.46;\n';
fs.writeFileSync(new URL('../balance-parameters.mjs',import.meta.url),code);
