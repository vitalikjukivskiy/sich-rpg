export const skinNames={sabre:'Зелений дуелянт',hammer:'Залізний вартовий',mace:'Бурштиновий отаман',pike:'Степовий дозорець',axe:'Багряний рубака'};
export function portrait(player,classId='sabre',extra=''){
 const skin=player.skin&&player.skin!=='auto'?player.skin:classId;
 if(skin==='legacy')return '<img class="legacy-skin '+extra+'" src="./assets/sich-hero.png" alt="Козак у традиційному жупані">';
 const key=Object.hasOwn(skinNames,skin)?skin:'sabre';
 return '<div class="class-portrait skin-'+key+' '+extra+'" role="img" aria-label="'+skinNames[key]+'"></div>';
}
export function skinPicker(player){return '<details class="skin-picker"><summary>Образ персонажа · без зміни характеристик</summary><div class="skin-options">'+[['auto','За класом зброї'],...Object.entries(skinNames),['legacy','Класичний козак']].map(([key,label])=>'<button class="button" data-skin="'+key+'" '+((player.skin||'auto')===key?'disabled':'')+'>'+label+'</button>').join('')+'</div></details>';}
