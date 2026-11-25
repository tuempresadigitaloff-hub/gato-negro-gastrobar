"use strict";
(() => {
 const el = id => document.getElementById(id);
 const status = (id, text) => { el(id).textContent = text; };
 const valid = (a,b) => a.length >= 12 && a.length <= 128 && a === b;
 const form = el('passwordChange');
 el('newPassword').addEventListener('input', () => {
   const p = el('newPassword').value;
   const n = Number(p.length >= 12) + Number(p.length >= 16) + Number(/[a-z]/.test(p) && /[A-Z]/.test(p)) + Number(/\d/.test(p) && /[^\w]/.test(p));
   el('passwordStrength').value = n;
   status('strengthText', ['Muy débil','Débil','Moderada','Buena','Alta'][n] + ' · estimación orientativa');
 });
 async function busy(f, action) { const b=f.querySelector('button[type=submit]'); if(b.disabled)return; b.disabled=true; try{await action();}finally{b.disabled=false;} }
 form.addEventListener('submit', e => { e.preventDefault(); busy(form, async () => {
   const a=el('newPassword').value,b=el('confirmPassword').value;
   if(!valid(a,b)){status('passwordStatus','Las contraseñas deben coincidir y tener entre 12 y 128 caracteres.');return;}
   try {
     const {data:u,error:ue}=await cliente.auth.getUser();
     if(ue || !autorizado(u.user)) throw Error('Sesión no autorizada.');
     const {data,error}=await cliente.auth.signInWithPassword({email:u.user.email,password:el('currentPassword').value});
     if(error || data.user?.id !== u.user.id){status('passwordStatus','No se pudo verificar la contraseña actual.');return;}
     const {error:change}=await cliente.auth.updateUser({password:a});
     if(change)throw change;
     form.reset(); el('passwordStrength').value=0; status('strengthText','Mínimo 12 caracteres.');
     status('passwordStatus','Contraseña cambiada correctamente.');
   }catch{status('passwordStatus','No se pudo cambiar la contraseña. Comprueba la sesión y los requisitos de Supabase.');}
   finally{el('currentPassword').value='';}
 }); });
 admin.addEventListener('close',()=>{form.reset();el('passwordStrength').value=0;status('passwordStatus','');status('strengthText','Mínimo 12 caracteres.');});
})();
