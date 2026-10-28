export const skinNames={sabre:'Зелений дуелянт',hammer:'Залізний вартовий',mace:'Бурштиновий отаман',pike:'Степовий дозорець',axe:'Багряний рубака'};
let frameSerial=0;
const classKeys=Object.keys(skinNames),factionKeys=['cossacks','commonwealth','crimea','sweden','ottoman'];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function atlasFrame({file,width,height,box,classes,label='',fit='xMidYMid meet'}){
 const accessibility=label?`role="img" aria-label="${escape(label)}"`:'aria-hidden="true"';
 const clip='atlas-cell-'+(++frameSerial);
 return `<svg class="${escape(classes)}" viewBox="${box.join(' ')}" preserveAspectRatio="${fit}" ${accessibility} focusable="false"><defs><clipPath id="${clip}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"/></clipPath></defs><g clip-path="url(#${clip})"><image href="./assets/${file}" width="${width}" height="${height}"/></g></svg>`;
}
export function portrait(player,classId='sabre',extra=''){
 const skin=player.skin&&player.skin!=='auto'?player.skin:classId;
 if(skin==='legacy')return '<img class="legacy-skin '+escape(extra)+'" src="./assets/sich-hero.png" alt="Козак у традиційному жупані" decoding="async">';
 const key=Object.hasOwn(skinNames,skin)?skin:'sabre',index=classKeys.indexOf(key),combat=extra.split(/\s+/).includes('combat-skin'),character=extra.split(/\s+/).includes('character-skin');
 // The atlas is five equal columns. ViewBox isolates one column, so any frame size
 // preserves the warrior's proportions and can never reveal a neighbouring skin.
 const box=combat?[index*307.2,70,307.2,420]:character?[index*307.2,85,307.2,500]:[index*307.2,65,307.2,750];
 return atlasFrame({file:'class-skins.png',width:1536,height:1024,box,classes:'class-portrait skin-'+key+' '+extra,label:skinNames[key],fit:'xMidYMin slice'});
}
export function factionPortrait(id,extra='',label=''){
 const index=factionKeys.indexOf(id),key=index<0?'cossacks':id,column=Math.max(0,index),combat=/combat-face|combat-skin/.test(extra);
 return atlasFrame({file:'sich-factions.png',width:1774,height:887,box:[column*354.8,combat?90:({cossacks:110,commonwealth:100,crimea:120,sweden:95,ottoman:60})[key],354.8,combat?430:650],classes:'faction-portrait faction-'+key+' '+extra,label,fit:'xMidYMin slice'});
}
export function regionalScene(cityId,extra='',label=''){
 const coordinates={forest:[0,0],mountain:[768,0],harbor:[0,512],ottoman:[768,512]};
 if(!coordinates[cityId])return `<img class="regional-city region-castle ${escape(extra)}" src="./assets/sich-city.png" alt="${escape(label||'Запорозька Січ')}" decoding="async">`;
 return atlasFrame({file:'sich-cities.png',width:1536,height:1024,box:[...coordinates[cityId],768,512],classes:'regional-city region-'+cityId+' '+extra,label,fit:'xMidYMid slice'});
}
export function itemArt(art,extra='',label=''){
 const classMatch=/^(weapon|armor)-(sabre|hammer|mace|pike|axe)$/.exec(art);
 if(classMatch)return atlasFrame({file:'class-equipment.png',width:1983,height:793,box:[classKeys.indexOf(classMatch[2])*396.6,classMatch[1]==='armor'?364:0,396.6,classMatch[1]==='armor'?429:364],classes:'item-sprite art-'+art+' '+extra,label});
 const legacy={sword:[0,0],axe:[1,0],pistol:[2,0],mail:[3,0],plate:[3,0],helmet:[0,1],boots:[1,1],shield:[2,1],potion:[3,1],belt:[0,2],amulet:[1,2],ring:[1,2],bulava:[2,2],scroll:[3,2],ore:[0,3],herb:[1,3],resin:[2,3],clan:[3,3]},cell=legacy[art]||legacy.scroll;
 return atlasFrame({file:'sich-items.png',width:1254,height:1254,box:[cell[0]*313.5,cell[1]*313.5,313.5,313.5],classes:'item-sprite art-'+escape(art)+' '+extra,label});
}
export function skinPicker(player,disabledReason=''){return '<details class="skin-picker"><summary>Образ персонажа · без зміни характеристик</summary><div class="skin-options">'+[['auto','За класом зброї'],...Object.entries(skinNames),['legacy','Класичний козак']].map(([key,label])=>'<button class="button" data-skin="'+key+'" '+(disabledReason?'disabled title="'+escape(disabledReason)+'"':(player.skin||'auto')===key?'disabled':'')+'>'+label+'</button>').join('')+'</div></details>';}
