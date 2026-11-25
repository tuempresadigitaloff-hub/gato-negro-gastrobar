(() => {
 const toggle=document.querySelector('.nav-toggle'), nav=document.getElementById('mainNav'), mq=matchMedia('(max-width:900px)');
 function close(){toggle.setAttribute('aria-expanded','false');nav.hidden=mq.matches;toggle.textContent='Menú ☰';}
 if(toggle&&nav){function sync(){toggle.hidden=!mq.matches;close();}sync();mq.addEventListener('change',sync);toggle.addEventListener('click',()=>{if(toggle.getAttribute('aria-expanded')==='true')close();else{nav.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.textContent='Cerrar ×';}});nav.addEventListener('click',e=>{if(e.target.closest('a'))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mq.matches&&!nav.hidden){close();toggle.focus();}});}
 const dialog=document.getElementById('photoDialog'), large=document.getElementById('photoLarge');
 document.querySelectorAll('.photo-open').forEach(b=>{const img=b.querySelector('img');function fail(){b.classList.add('unavailable');b.disabled=true;}img.addEventListener('error',fail);if(img.complete&&!img.naturalWidth)fail();b.addEventListener('click',()=>{large.src=b.dataset.photo;large.alt=img.alt;dialog.showModal();});});
 document.getElementById('photoClose')?.addEventListener('click',()=>dialog.close());dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});large?.addEventListener('error',()=>{large.alt='No se pudo cargar la fotografía ampliada';});
})();
