// Preserve only unfinished local edits during a background world refresh.
function key(field){const data=Object.entries(field.dataset||{}).map(([name,value])=>name+'='+value).join('|'),semantic=field.id||field.name||field.getAttribute?.('href')||data||(['BUTTON','SUMMARY'].includes(field.tagName)?field.textContent.trim().slice(0,120):'');return [field.tagName,semantic,field.type||'',/^(checkbox|radio)$/.test(field.type)?field.value:''].join(':');}
export function captureViewDraft(){
 const main=document.querySelector('main'),active=document.activeElement,chat=document.querySelector('#chat-messages');
 return {fields:[...(main?.querySelectorAll('input,select,textarea')||[])].map(field=>({key:key(field),value:field.value,checked:field.checked,inTactics:!!field.closest('.tactics')})),focus:active?.closest('main')?key(active):null,selection:active?.selectionStart===undefined?null:[active.selectionStart,active.selectionEnd],scroll:main?.scrollTop||0,windowScroll:[window.scrollX,window.scrollY],chatSelection:active?.id==='chat-input'?[active.selectionStart,active.selectionEnd]:null,chatScroll:chat?.scrollTop||0,chatAtBottom:chat?chat.scrollHeight-chat.scrollTop-chat.clientHeight<30:true,details:[...(main?.querySelectorAll('details')||[])].map((el,index)=>({index,open:el.open}))};
}
export function restoreViewDraft(draft,{restoreTactics=true}={}){
 const main=document.querySelector('main');if(!main)return;
 const fields=[...main.querySelectorAll('input,select,textarea')];
 for(const saved of draft.fields){
  if(saved.inTactics&&!restoreTactics)continue;
  const field=fields.find(el=>key(el)===saved.key);if(!field)continue;
  if(field.tagName==='SELECT'&&![...field.options].some(option=>option.value===saved.value))continue;
  if(/^(checkbox|radio)$/.test(field.type))field.checked=saved.checked;else field.value=saved.value;
 }
 for(const picker of main.querySelectorAll('.block-picker')){
  const checked=[...picker.querySelectorAll('[name="guard-zone"]:checked')],input=picker.querySelector('[name="block"]');
  picker.querySelector('.block-count').textContent=`Обрано ${checked.length} з 2 зон`;
  picker.closest('.tactics').querySelectorAll('[data-action="turn"],button[type="submit"]').forEach(button=>button.disabled=checked.length!==2||Number(input.value)<0);
 }
 for(const saved of draft.details){const detail=main.querySelectorAll('details')[saved.index];if(detail)detail.open=saved.open;}
 const focus=[main,...main.querySelectorAll('input,select,textarea,button,a,summary,[tabindex]')].find(field=>key(field)===draft.focus);if(focus&&!focus.disabled){focus.focus({preventScroll:true});if(draft.selection&&draft.selection[0]!==null&&/^(text|search|url|tel|password)$/.test(focus.type)){try{focus.setSelectionRange(...draft.selection);}catch{}}}
 main.scrollTop=draft.scroll;
 const chat=document.querySelector('#chat-messages');if(chat&&!draft.chatAtBottom)chat.scrollTop=draft.chatScroll;const chatInput=document.querySelector('#chat-input');if(draft.chatSelection&&chatInput&&document.activeElement===chatInput){chatInput.setSelectionRange(...draft.chatSelection);}if(draft.windowScroll)window.scrollTo(...draft.windowScroll);
 // Recompute dependent price/quantity previews without sending any action.
 const price=main.querySelector('#market-price');if(price)price.dispatchEvent(new Event('input',{bubbles:true}));
}
