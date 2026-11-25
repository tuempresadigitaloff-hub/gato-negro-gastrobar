'use strict';
(() => {
 const root=document.getElementById('admin');
 const tabs=[...root.querySelectorAll('[data-admin-tab]')];
 const panels=[...root.querySelectorAll('[data-admin-panel]')];
 function show(name){tabs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab===name)));panels.forEach(p=>p.hidden=p.dataset.adminPanel!==name);root.querySelector('.admin-main').scrollTop=0;}
 tabs.forEach(b=>b.addEventListener('click',()=>show(b.dataset.adminTab)));
 root.querySelectorAll('[data-admin-go]').forEach(b=>b.addEventListener('click',()=>{show(b.dataset.adminGo);tabs.find(t=>t.dataset.adminTab===b.dataset.adminGo)?.focus();}));
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function filter(kind){const booking=kind==='booking', list=document.getElementById(booking?'bookings':'manage'), query=norm(document.getElementById(booking?'bookingSearch':'dishSearch').value), choice=document.getElementById(booking?'bookingFilter':'dishFilter').value;let count=0;const cards=[...list.querySelectorAll(':scope > article')];for(const card of cards){const category=booking?card.querySelector('strong')?.textContent:card.querySelector('select[name=categoria]')?.value;const searchable=booking?card.textContent:card.querySelector('summary')?.textContent;card.hidden=!(norm(searchable).includes(query)&&(!choice||category===choice));if(!card.hidden)count++;}document.getElementById(booking?'bookingCount':'dishCount').textContent=`${count} de ${cards.length} resultados`;}
 for(const [kind,ids,list] of [['booking',['bookingSearch','bookingFilter'],'bookings'],['dish',['dishSearch','dishFilter'],'manage']]){ids.forEach(id=>document.getElementById(id).addEventListener('input',()=>filter(kind)));new MutationObserver(()=>filter(kind)).observe(document.getElementById(list),{childList:true});}
 root.addEventListener('close',()=>{for(const id of ['bookingSearch','bookingFilter','dishSearch','dishFilter'])document.getElementById(id).value='';document.getElementById('passwordChange').reset();document.getElementById('passwordStrength').value=0;document.getElementById('strengthText').textContent='Mínimo 12 caracteres.';document.getElementById('passwordStatus').textContent='';show('overview');filter('booking');filter('dish');});
})();
