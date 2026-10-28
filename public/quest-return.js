// Navigation hints only: progress and battle provenance always come from the server.
const STORAGE_KEY='sich_quest_return_v1';
let memoryEntry;
const origins=new Map();
const text=value=>typeof value==='string'&&value.length>0;

function saveEntry(entry){
 memoryEntry=entry;
 try{if(entry)globalThis.sessionStorage?.setItem(STORAGE_KEY,JSON.stringify(entry));else globalThis.sessionStorage?.removeItem(STORAGE_KEY);}catch{}
}
function readEntry(){
 if(memoryEntry!==undefined)return memoryEntry;
 try{
  const raw=globalThis.sessionStorage?.getItem(STORAGE_KEY),entry=raw?JSON.parse(raw):null;
  if(entry&&text(entry.player)&&text(entry.id)&&['daily','milestone'].includes(entry.kind)&&
    (entry.kind!=='daily'||text(entry.day)))return memoryEntry={player:entry.player,id:entry.id,kind:entry.kind,...(entry.kind==='daily'?{day:entry.day}:{})};
 }catch{}
 saveEntry(null);return null;
}
function metricProgress(player,metric){
 if(metric==='visited')return player.visited?.length||0;
 if(metric==='chapters')return player.completedContracts?.length||0;
 if(metric==='routes')return player.journeyRoutes?.length||0;
 if(metric==='trials')return player.trialsCompleted?.length||0;
 return player[metric]||0;
}
function resolveQuest(state,entry){
 const p=state?.player;if(!p||entry?.player!==p.id)return null;
 const daily=entry.kind==='daily';
 if(daily&&(!text(p.daily?.day)||entry.day!==p.daily.day))return null;
 const quest=(daily?state.dailyQuests:state.quests)?.find(q=>q.id===entry.id);
 if(!quest||!Number.isFinite(quest.target)||quest.target<=0)return null;
 const raw=daily?quest.progress:metricProgress(p,quest.metric),progress=Math.max(0,Math.min(quest.target,Number.isFinite(raw)?raw:0));
 const claimed=daily?!!quest.claimed||!!p.daily?.claimed?.includes(quest.id):!!p.claimed?.includes(quest.id);
 return {id:quest.id,kind:entry.kind,name:quest.name,progress,target:quest.target,claimed,ready:!claimed&&progress>=quest.target};
}

export function trackQuest(state,{id,kind}={}){
 const p=state?.player;
 if(!text(p?.id)||!text(id)||!['daily','milestone'].includes(kind)){clearQuest(state);return null;}
 const entry={player:p.id,id,kind,...(kind==='daily'?{day:p.daily?.day}:{})},quest=resolveQuest(state,entry);
 if(!quest||quest.claimed){clearQuest(state);return null;}
 saveEntry(entry);return quest;
}
export function trackedQuest(state){
 const entry=readEntry();if(!entry)return null;
 const quest=resolveQuest(state,entry);
 if(!quest||quest.claimed){saveEntry(null);return null;}
 return quest;
}
export function clearQuest(state){
 const entry=readEntry();
 if(!state||entry?.player===state.player?.id)saveEntry(null);
}
export function afterTaskAction(before,after){
 const entry=readEntry();if(!entry)return null;
 const previous=resolveQuest(before,entry),current=trackedQuest(after);
 if(before?.player?.id!==after?.player?.id||!previous||!current||previous.target!==current.target)return null;
 return previous.progress<previous.target&&current.progress>=current.target?current:null;
}

function validOrigin(state,meta){
 const battle=state?.player?.battle,contract=state?.contracts?.find(c=>c.id===meta?.contract);
 if(!text(battle?.id)||!text(meta?.id)||!contract||!Array.isArray(contract.enemies)||
   !Number.isInteger(meta.stage)||meta.stage<0||meta.stage>=contract.enemies.length)return null;
 return {id:meta.id,contract:meta.contract,stage:meta.stage,battleId:battle.id};
}
function directOrigin(state){
 const p=state?.player,b=p?.battle;
 if(!b)return null;
 if(b.source==='campaign')return validOrigin(state,b.campaign);
 // A source belonging to a road or trial must never be treated as a campaign.
 if(b.source)return null;
 return p.campaign?.currentBattle===b.id?validOrigin(state,p.campaign):null;
}
export function campaignOrigin(state){
 const direct=directOrigin(state);if(direct)return direct;
 const p=state?.player,b=p?.battle,cached=origins.get(p?.id);
 if(!b||b.source||cached?.battleId!==b.id||cached.id!==p.campaign?.id||cached.contract!==p.campaign?.contract)return null;
 return validOrigin(state,cached);
}
export function observeQuestState(state){
 const p=state?.player;if(!text(p?.id))return null;
 const origin=campaignOrigin(state);
 if(origin)origins.set(p.id,origin);else origins.delete(p.id);
 // Clears a tracked task when the account, day, catalog or claim state changed.
 trackedQuest(state);
 return origin;
}
