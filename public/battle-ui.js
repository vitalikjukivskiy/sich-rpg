export function countdown(deadline,now=Date.now()){const left=Math.max(0,Math.ceil((deadline-now)/1000));return left>=60?Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):left+' с';}
const pairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
const labels=['Голова','Груди','Пояс','Ноги'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function blockPicker(index=0){return `<div class="block-picker"><input type="hidden" name="block" value="${index}">${labels.map((label,i)=>`<label class="choice"><input type="checkbox" name="guard-zone" value="${i}" ${(pairs[index]||[]).includes(i)?'checked':''}>${label}</label>`).join('')}<small class="block-count" aria-live="polite">Обрано ${(pairs[index]||[]).length} з 2 зон</small></div>`;}
export function battleLog(lines,names=[]){
 const actors=new Set(names.filter(Boolean).map(name=>String(name).toLocaleLowerCase('uk-UA')));
 const quoted=names.filter(Boolean).map(name=>String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const words=['КРИТИЧНИЙ УДАР','ЧАС ВИЙШОВ','ПЕРЕМОЖЕЦЬ','дезорієнтація(?: на наступний хід)?','Перемога','Поразка','НІЧИЯ','УХИЛЕННЯ','антикрит','блок','пропущено','\\+\\d+ здоров[’\u0027]я','\\d+ шкоди'];
 const pattern=new RegExp([...quoted,...words].join('|'),'gi');
 const legend='<div class="battle-legend" aria-label="Кольори бойових подій">'+[['damage','Шкода'],['critical','Крит'],['heal','Лікування'],['block','Блок'],['dodge','Ухилення'],['effect','Ефект'],['timeout','Час вийшов']].map(([kind,label])=>`<span class="event-${kind}">${label}</span>`).join('')+'</div>';
 const format=line=>{
  let html='',offset=0;line=String(line);
  for(const match of line.matchAll(pattern)){
   const part=match[0],lower=part.toLocaleLowerCase('uk-UA');let kind='';
   if(!actors.has(lower)){
    if(/критичний удар/i.test(part))kind='critical';
    else if(/час вийшов|пропущено/i.test(part))kind='timeout';
    else if(/^\+\d+/.test(part))kind='heal';
    else if(/шкоди/i.test(part))kind=/^[^.]*КРИТИЧНИЙ УДАР/i.test(line.slice(match.index+part.length))?'critical':'damage';
    else if(/^блок$/i.test(part))kind='block';
    else if(/ухилення/i.test(part))kind='dodge';
    else if(/дезорієнтація/i.test(part))kind='effect';
   }
   html+=escape(line.slice(offset,match.index))+`<strong${kind?` class="event-${kind}"`:''}>${escape(part)}</strong>`;offset=match.index+part.length;
  }
  return html+escape(line.slice(offset));
 };
 return legend+'<ol>'+[...lines].reverse().map(line=>'<li class="battle-log-entry">'+format(line)+'</li>').join('')+'</ol>';
}

document.addEventListener('change',e=>{
 if(e.target.name!=='guard-zone')return;
 const picker=e.target.closest('.block-picker');
 let checked=[...picker.querySelectorAll('[name="guard-zone"]:checked')];
 if(checked.length>2){e.target.checked=false;checked=checked.filter(x=>x!==e.target);}
 const zones=checked.map(x=>Number(x.value)).sort();
 const input=picker.querySelector('[name="block"]');
 input.value=pairs.findIndex(pair=>pair.join()===zones.join());
 picker.querySelector('.block-count').textContent=`Обрано ${zones.length} з 2 зон`;
 picker.closest('.tactics').querySelectorAll('[data-action="turn"],button[type="submit"]').forEach(b=>b.disabled=zones.length!==2);
 input.dispatchEvent(new Event('change',{bubbles:true}));
});
document.addEventListener('change',e=>{
 if(!['power','ability'].includes(e.target.name||e.target.id))return;
 const tactics=e.target.closest('.tactics');if(!tactics)return;
 const power=tactics.querySelector('[name="power"],#power'),ability=tactics.querySelector('[name="ability"],#ability');
 const stamina=Number(tactics.dataset.stamina),cost=(power?.checked?20:0)+(ability?.checked?Number(tactics.dataset.abilityCost):0);
 if(cost>stamina){e.target.checked=false;let hint=tactics.querySelector('.cost-hint');if(!hint){hint=document.createElement('p');hint.className='cost-hint';hint.setAttribute('role','status');tactics.append(hint);}hint.textContent=`Для цієї комбінації потрібно ${cost} витривалості, доступно ${stamina}.`;}
 else tactics.querySelector('.cost-hint')?.remove();
});
