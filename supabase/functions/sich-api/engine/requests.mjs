import {action,duelAction,clanAction} from './world.mjs';
import {marketAction} from './market.mjs';
// Stored in the same atomic world transaction as the action. Bounded, per-player receipts.
export function applyRequest(db,p,route,body){
 const key=body.requestId;
 if(key!==undefined&&(typeof key!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(key)))throw new Error('Некоректний ідентифікатор запиту.');
 const signature=JSON.stringify({route,...body});
 if(key){const receipt=p.actionReceipts?.find(x=>x.id===key);if(receipt){if(receipt.signature!==signature)throw new Error('Ідентифікатор запиту вже використано для іншої дії.');return false;}}
 if(['turn','potion'].includes(body.type)&&body.round!==undefined){const battle=route==='/api/duel'?db.duels[p.duelId]:p.battle;if(!battle||body.battleId!==battle.id||body.round!==battle.round)throw new Error('Цей раунд уже завершено. Оновіть тактику.');}
 if(route==='/api/action')action(p,body);else if(route==='/api/duel')duelAction(db,p,body);else if(route==='/api/clan')clanAction(db,p,body);else if(route==='/api/market')marketAction(db,p,body);else throw new Error('Невідома дія.');
 if(key){p.actionReceipts??=[];p.actionReceipts.push({id:key,signature});p.actionReceipts=p.actionReceipts.slice(-100);}
 return true;
}
