export const navigationGroups=[
 {id:'city',label:'Місто',routes:[['city','Площа'],['hospital','Лікарня'],['clans','Курінь'],['library','Допомога']]},
 {id:'quests',label:'Завдання',routes:[['quests','Журнал'],['forest','Кампанія'],['roads','Каравани'],['trials','Випробування']]},
 {id:'arena',label:'Бої',routes:[['arena','Арена']]},
 {id:'character',label:'Герой',routes:[['character','Характеристики'],['inventory','Спорядження'],['smith','Кузня'],['ranking','Рейтинг']]},
 {id:'shop',label:'Торгівля',routes:[['shop','Крамниця'],['market','Ринок гравців']]},
 {id:'world',label:'Карта',routes:[['world','Карта міст'],['factions','Сторони']]}
];
export function groupForRoute(route){return navigationGroups.find(group=>group.routes.some(([id])=>id===route))||navigationGroups[0];}
export function contextNavigation(route){const group=groupForRoute(route);if(group.routes.length<2)return '';return `<nav class="context-nav" aria-label="${group.label}: розділи">${group.routes.map(([id,label])=>`<a href="#${id}" ${id===route?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;}
