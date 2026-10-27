const areas=['голову','груди','пояс','ноги'];
export function enemyPlan(b){
 if(b.source!=='trial')return null;
 const style={sentinel:{zones:[0,2,3],power:1.5,guard:7},marshal:{zones:[1,0,2],power:1.35,guard:14},champion:{zones:[3,1,0],power:1.6,guard:10}}[b.enemy.id];if(!style)return null;
 const phase=b.round%3,index=Math.floor(b.round/3);
 if(phase===0){const zone=style.zones[index%style.zones.length];return {kind:'heavy',zone,damage:style.power,text:'Важкий замах у '+areas[zone]+'. Блок цієї зони зменшить небезпечний удар.'};}
 if(phase===1){const block=index%2?[2,3]:[0,1];return {kind:'guard',block,armor:style.guard,damage:.75,text:'Суперник прикриває '+areas[block[0]]+' й '+areas[block[1]]+'. Оберіть іншу зону або накопичте витривалість.'};}
 return {kind:'rush',damage:1.15,text:'Короткий натиск: зона прихована. Захисна стійка допоможе перечекати серію.'};
}
