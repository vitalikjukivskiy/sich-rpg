// Long sections stay reachable by explicit page controls; the desktop shell stays fixed.
let observer;
export function fitViewport(){
 observer?.disconnect();
 const main=document.querySelector('main');if(!main)return;
 const log=main.querySelector('.battle-log');
 if(log){const entries=[...log.querySelectorAll('li')];let page=0;const size=2;
  const controls=document.createElement('div');controls.className='log-pages';
  const draw=()=>{entries.forEach((el,i)=>el.hidden=i<page*size||i>=(page+1)*size);controls.innerHTML=`<button class="button" data-log-prev ${page===0?'disabled':''}>Новіші</button><span>${page+1} / ${Math.max(1,Math.ceil(entries.length/size))}</span><button class="button" data-log-next ${(page+1)*size>=entries.length?'disabled':''}>Старіші</button>`;};
  controls.onclick=e=>{if(e.target.closest('[data-log-prev]'))page--;else if(e.target.closest('[data-log-next]'))page++;else return;draw();};log.append(controls);draw();
 }
 document.querySelector('.screen-pages')?.remove();
 if(!matchMedia('(min-width: 900px) and (min-height: 650px)').matches)return;
 const controls=document.createElement('nav');controls.className='screen-pages';controls.setAttribute('aria-label','Сторінки розділу');
 controls.innerHTML='<button class="button" data-page-prev>↑ Назад</button><span></span><button class="button" data-page-next>Далі ↓</button>';main.after(controls);
 const update=()=>{const step=Math.max(100,main.clientHeight-24),max=Math.max(0,main.scrollHeight-main.clientHeight);controls.hidden=max<3||(!controls.hidden&&max<=controls.offsetHeight+5);controls.querySelector('span').textContent=`${Math.min(Math.ceil(max/step)+1,Math.ceil(main.scrollTop/step)+1)} / ${Math.ceil(max/step)+1}`;controls.querySelector('[data-page-prev]').disabled=main.scrollTop<2;controls.querySelector('[data-page-next]').disabled=main.scrollTop>=max-2;};
 controls.onclick=e=>{if(e.target.closest('[data-page-prev]'))main.scrollTop-=main.clientHeight-24;if(e.target.closest('[data-page-next]'))main.scrollTop+=main.clientHeight-24;update();};main.addEventListener('scroll',update);requestAnimationFrame(update);observer=new ResizeObserver(update);observer.observe(main);main.addEventListener('toggle',update,true);for(const img of main.querySelectorAll('img'))img.addEventListener('load',update,{once:true});
}
