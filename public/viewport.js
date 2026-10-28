// Compact collections use real pages; the remaining long sections retain accessible scrolling.
let observer,controller,lastOptions={},resizeTimer;
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
export function fitViewport(options={}){
 lastOptions={...lastOptions,...options};observer?.disconnect();controller?.abort();controller=new AbortController();
 const main=document.querySelector('main');if(!main)return;
 const scroll=main.scrollTop,log=main.querySelector('.battle-log');
 if(log){
  const entries=[...log.querySelectorAll('li')],key=lastOptions.logKey||main.className,size=2;
  let page=lastOptions.resetLog?0:Math.min(logPages.get(key)||0,Math.max(0,Math.ceil(entries.length/size)-1));
  log.querySelector('.log-pages')?.remove();const controls=document.createElement('nav');controls.className='log-pages';controls.setAttribute('aria-label','Сторінки бойового журналу');
  const draw=()=>{entries.forEach((el,i)=>el.hidden=i<page*size||i>=(page+1)*size);logPages.set(key,page);controls.innerHTML=`<button type="button" class="button" data-log-prev ${page===0?'disabled':''}>Новіші</button><span role="status">${page+1} / ${Math.max(1,Math.ceil(entries.length/size))}</span><button type="button" class="button" data-log-next ${(page+1)*size>=entries.length?'disabled':''}>Старіші</button>`;};
  controls.onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-log-prev'))page--;else if(button.hasAttribute('data-log-next'))page++;else return;draw();};log.append(controls);draw();
 }
 collectionPagination(main);document.querySelector('.screen-pages')?.remove();
 if(!desktop())return;
 const controls=document.createElement('nav');controls.className='screen-pages';controls.setAttribute('aria-label','Перегляд довгого розділу');
 controls.innerHTML='<button type="button" class="button" data-page-prev>↑ Вище</button><span role="status"></span><button type="button" class="button" data-page-next>Нижче ↓</button>';main.after(controls);
 const update=()=>{const step=Math.max(100,main.clientHeight-24),max=Math.max(0,main.scrollHeight-main.clientHeight);controls.hidden=max<3||(!controls.hidden&&max<=controls.offsetHeight+5);controls.querySelector('span').textContent=`${Math.min(Math.ceil(max/step)+1,Math.ceil(main.scrollTop/step)+1)} / ${Math.ceil(max/step)+1}`;controls.querySelector('[data-page-prev]').disabled=main.scrollTop<2;controls.querySelector('[data-page-next]').disabled=main.scrollTop>=max-2;};
 const schedule=()=>requestAnimationFrame(update);
 controls.onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-page-prev'))main.scrollTop-=main.clientHeight-24;if(button.hasAttribute('data-page-next'))main.scrollTop+=main.clientHeight-24;update();};
 const {signal}=controller;main.addEventListener('scroll',update,{signal});main.addEventListener('toggle',schedule,{capture:true,signal});main.addEventListener('collectionpage',schedule,{signal});for(const img of main.querySelectorAll('img'))img.addEventListener('load',schedule,{once:true,signal});
 observer=new ResizeObserver(schedule);observer.observe(main);requestAnimationFrame(()=>{main.scrollTop=scroll;update();});
}
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>fitViewport({...lastOptions,resetLog:false}),100);});
