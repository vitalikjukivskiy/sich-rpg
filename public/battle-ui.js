const pairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
const labels=['Голова','Груди','Пояс','Ноги'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function blockPicker(index=0){return `<div class="block-picker"><input type="hidden" name="block" value="${index}">${labels.map((label,i)=>`<label class="choice"><input type="checkbox" name="guard-zone" value="${i}" ${(pairs[index]||[]).includes(i)?'checked':''}>${label}</label>`).join('')}<small class="block-count" aria-live="polite">Обрано ${(pairs[index]||[]).length} з 2 зон</small></div>`;}
export function battleLog(lines,names=[]){
 const quoted=names.filter(Boolean).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const words=['КРИТИЧНИЙ УДАР','ЧАС ВИЙШОВ','ПЕРЕМОЖЕЦЬ','ДЕЗОРІЄНТАЦІЯ','Перемога','Поразка','НІЧИЯ','УХИЛЕННЯ','антикрит','блок','пропущено','\\d+ шкоди'];
 const pattern=new RegExp('('+[...quoted,...words].join('|')+')','gi');
 return '<ol>'+[...lines].reverse().map(line=>'<li class="battle-log-entry">'+String(line).split(pattern).map((part,i)=>i%2?'<strong>'+escape(part)+'</strong>':escape(part)).join('')+'</li>').join('')+'</ol>';
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
