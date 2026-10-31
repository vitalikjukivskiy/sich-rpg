// Compact collections use real pages; the remaining long sections retain accessible scrolling.
let observer,controller,lastOptions={},resizeTimer,layoutFrame;
const logPages=new Map(),collectionPages=new Map();
const desktop=()=>matchMedia('(min-width: 900px) and (min-height: 650px)').matches;
function collectionPagination(main){
 const definitions=[['.opponents','Суперники',3],['.quest-list','Завдання',3],['.contract-list','Розділи',1],['.route-grid','Маршрути',1],['.honor-grid','Арсенал',2],['.lobby-rows','Заявки',5]];
 for(const [selector,label,desktopSize] of definitions){
  const collection=main.querySelector(selector);if(!collection)continue;
  const cards=[...collection.children],size=desktop()?desktopSize:selector==='.lobby-rows'?5:1,key=(main.dataset.player||'')+main.className+selector;
  collection.nextElementSibling?.matches('.collection-pages')&&collection.nextElementSibling.remove();
  const count=Math.max(1,Math.ceil(cards.length/size));let page=Math.min(collectionPages.get(key)||0,count-1);
  const controls=document.createElement('nav');controls.className='collection-pages';controls.setAttribute('aria-label',label+': сторінки');
  const draw=()=>{cards.forEach((card,index)=>card.hidden=index<page*size||index>=(page+1)*size);collectionPages.set(key,page);controls.hidden=count===1;controls.innerHTML=`<button type="button" class="button" data-collection-prev ${page===0?'disabled':''}>Назад</button><span role="status">${label}: ${Math.min(cards.length,page*size+1)}–${Math.min(cards.length,(page+1)*size)} із ${cards.length}</span><button type="button" class="button" data-collection-next ${page===count-1?'disabled':''}>Далі</button>`;};
  controls.onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-collection-prev'))page--;else if(button.hasAttribute('data-collection-next'))page++;else return;draw();collection.dispatchEvent(new Event('collectionpage',{bubbles:true}));};
  collection.after(controls);draw();
 }
}
function battleLogPagination(main,log,options,afterDraw){
 const entries=[...log.querySelectorAll('li')],list=log.querySelector('ol');if(!list)return ()=>{};
 const key=(main.dataset.player||'')+':'+(options.logKey||main.className),saved=options.resetLog?null:logPages.get(key);
 let newest=saved?.newest!==false,anchor=0,page=0,pages=[],bodyHeight=null;
 if(!newest){
  anchor=entries.findIndex((entry,index)=>entry.textContent===saved.text&&(!saved.next||entries[index+1]?.textContent===saved.next));
  if(anchor<0)anchor=entries.findIndex(entry=>entry.textContent===saved.text);
  if(anchor<0)anchor=Math.min(saved.index||0,Math.max(0,entries.length-1));
 }
 log.querySelector('.log-pages')?.remove();
 const controls=document.createElement('nav');controls.className='log-pages';controls.setAttribute('aria-label','Сторінки бойового журналу');log.append(controls);
 const draw=()=>{
  controls.hidden=pages.length<=1;
  const visible=new Set(pages[page]||[]);entries.forEach((entry,index)=>entry.hidden=!visible.has(index));
  list.style.maxHeight=bodyHeight===null?'':bodyHeight+'px';list.style.overflowY=bodyHeight===null?'':'auto';
  const oversized=bodyHeight!==null&&list.scrollHeight>list.clientHeight+1;
  if(oversized){list.tabIndex=0;list.title='Прокрутіть довгий запис, щоб прочитати повністю';list.setAttribute('aria-label',list.title);}else{list.removeAttribute('tabindex');list.removeAttribute('title');list.removeAttribute('aria-label');}
  controls.innerHTML=`<button type="button" class="button" data-log-prev ${page===0?'disabled':''}>Новіші</button><span role="status">${page+1} / ${Math.max(1,pages.length)}</span><button type="button" class="button" data-log-next ${page>=pages.length-1?'disabled':''}>Старіші</button>`;
  logPages.set(key,{newest,index:anchor,text:entries[anchor]?.textContent,next:entries[anchor+1]?.textContent});
 };
 // The pager is part of the fixed overhead; its height must be known before measuring rows.
 controls.innerHTML='<button type="button" class="button" disabled>Новіші</button><span>1 / 1</span><button type="button" class="button">Старіші</button>';
 const reflow=()=>{
  if(!main.isConnected)return;
  const scroll=main.scrollTop;controls.hidden=false;list.style.maxHeight='none';list.style.overflowY='visible';
  entries.forEach(entry=>entry.hidden=false);
  const heights=entries.map(entry=>{const style=getComputedStyle(entry);return entry.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);});
  entries.forEach(entry=>entry.hidden=true);
  if(desktop()){
   const mainBox=main.getBoundingClientRect(),logBox=log.getBoundingClientRect(),bottomPadding=parseFloat(getComputedStyle(main).paddingBottom)||0;
   const logTop=logBox.top-mainBox.top-main.clientTop+main.scrollTop;
   const rowStyle=entries[0]&&getComputedStyle(entries[0]),minimumRow=rowStyle?Math.ceil((parseFloat(rowStyle.lineHeight)||parseFloat(rowStyle.fontSize)*1.4)+(parseFloat(rowStyle.paddingTop)||0)+(parseFloat(rowStyle.paddingBottom)||0)+(parseFloat(rowStyle.borderTopWidth)||0)+(parseFloat(rowStyle.borderBottomWidth)||0)):0;
   bodyHeight=Math.max(minimumRow,Math.floor(main.clientHeight-bottomPadding-logTop-logBox.height-2));
  }else bodyHeight=null;
  pages=[];let group=[],used=0;
  for(let index=0;index<entries.length;index++){
   const full=bodyHeight===null?group.length>=2:group.length>=12||used+heights[index]>bodyHeight;
   if(group.length&&full){pages.push(group);group=[];used=0;}
   group.push(index);used+=heights[index];
  }
  if(group.length)pages.push(group);if(!pages.length)pages=[[]];
  if(newest)anchor=0;
  page=Math.max(0,pages.findIndex(group=>group.includes(anchor)));draw();main.scrollTop=scroll;
 };
 controls.onclick=e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-log-prev'))page--;else if(button.hasAttribute('data-log-next'))page++;else return;
  anchor=pages[page]?.[0]||0;newest=page===0;draw();afterDraw();
 };
 return reflow;
}
export function fitViewport(options={}){
 lastOptions={...lastOptions,...options};observer?.disconnect();controller?.abort();cancelAnimationFrame(layoutFrame);controller=new AbortController();
 const main=document.querySelector('main');if(!main)return;
 const scroll=main.scrollTop,log=main.querySelector('.battle-log');
 collectionPagination(main);document.querySelector('.screen-pages')?.remove();
 let update=()=>{};
 const reflowLog=log?battleLogPagination(main,log,lastOptions,()=>update()):()=>{};
 if(!desktop()){reflowLog();return;}
 const controls=document.createElement('nav');controls.className='screen-pages';controls.setAttribute('aria-label','Перегляд довгого розділу');
 controls.innerHTML='<button type="button" class="button" data-page-prev>↑ Вище</button><span role="status"></span><button type="button" class="button" data-page-next>Нижче ↓</button>';controls.hidden=true;main.after(controls);
 update=()=>{const step=Math.max(100,main.clientHeight-24),max=Math.max(0,main.scrollHeight-main.clientHeight);controls.hidden=max<3||(!controls.hidden&&max<=controls.offsetHeight+5);controls.querySelector('span').textContent=`${Math.min(Math.ceil(max/step)+1,Math.ceil(main.scrollTop/step)+1)} / ${Math.ceil(max/step)+1}`;controls.querySelector('[data-page-prev]').disabled=main.scrollTop<2;controls.querySelector('[data-page-next]').disabled=main.scrollTop>=max-2;};
 const layout=()=>{if(signal.aborted||!main.isConnected)return;reflowLog();update();};
 const schedule=()=>{if(signal.aborted||!main.isConnected)return;cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layout);};
 controls.onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-page-prev'))main.scrollTop-=main.clientHeight-24;if(button.hasAttribute('data-page-next'))main.scrollTop+=main.clientHeight-24;update();};
 const {signal}=controller;main.addEventListener('scroll',update,{signal});main.addEventListener('toggle',schedule,{capture:true,signal});main.addEventListener('collectionpage',schedule,{signal});main.addEventListener('change',schedule,{signal});for(const img of main.querySelectorAll('img'))img.addEventListener('load',schedule,{once:true,signal});
 observer=new ResizeObserver(schedule);observer.observe(main);if(log)for(const element of main.children)if(element!==log)observer.observe(element);
 reflowLog();main.scrollTop=scroll;update();schedule();
}
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>fitViewport({...lastOptions,resetLog:false}),100);});
