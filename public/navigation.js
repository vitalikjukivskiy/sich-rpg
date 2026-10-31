export const navigationGroups=[
 {id:'city',label:'Локація',routes:[['city','Площа'],['hospital','Лікарня'],['clans','Курінь'],['library','Інформація'],['world','Карта міст'],['factions','Сторони'],['ranking','Рейтинг']]},
 {id:'inventory',label:'Інвентар',routes:[['inventory','Спорядження'],['smith','Кузня'],['character','Персонаж']]},
 {id:'arena',label:'Поєдинки',routes:[['arena','Арена']]},
 {id:'quests',label:'Завдання',routes:[['quests','Журнал'],['forest','Кампанія'],['roads','Каравани'],['trials','Випробування']]},
 {id:'bank',label:'Банк',routes:[['bank','Гаманець'],['shop','Крамниця'],['market','Ринок гравців']]},
 {id:'skills',label:'Навички',routes:[['skills','Характеристики']]},
 {id:'settings',label:'Налаштування',routes:[['settings','Інтерфейс']]}
];
export function groupForRoute(route){return navigationGroups.find(group=>group.routes.some(([id])=>id===route))||navigationGroups[0];}
export function contextNavigation(route){const group=groupForRoute(route);if(group.routes.length<2)return '';return `<nav class="context-nav" aria-label="${group.label}: розділи">${group.routes.map(([id,label])=>`<a href="#${id}" ${id===route?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;}
