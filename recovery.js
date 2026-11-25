'use strict';
(() => {
  const status = document.getElementById('recoveryStatus');
  const form = document.getElementById('recoveryForm');
  const cancel = document.getElementById('recoveryCancel');
  const back = document.getElementById('recoveryBack');
  const submit = form.querySelector('button[type=submit]');
  const password = document.getElementById('recoveryPassword');
  const confirm = document.getElementById('recoveryConfirm');
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const cleanURL = () => history.replaceState(null, '', location.pathname);
  const allowed = user => user?.email?.toLowerCase() === 'tuempresadigital.off@gmail.com' && user?.id === 'eb81f9f6-9220-4c89-91c4-319d27d7d608';
  const finish = text => { form.hidden = true; cancel.hidden = true; back.hidden = false; form.reset(); status.textContent = text; cleanURL(); };
  if (hash.has('error') || hash.has('error_code') || query.has('error') || query.has('error_code')) {
    finish('El enlace no es válido o ha caducado. Solicita otro desde Supabase.'); return;
  }
  if (hash.get('type') !== 'recovery' || !hash.get('access_token') || !hash.get('refresh_token')) {
    finish('Abre un enlace de recuperación nuevo enviado desde Supabase.'); return;
  }
  if (!window.supabase) { finish('No se pudo cargar el servicio de recuperación. Solicita un nuevo enlace e inténtalo de nuevo.'); return; }
  // Cliente independiente: no restaura ni guarda la sesión normal del administrador.
  const client = window.supabase.createClient(
    'https://agqaxarvoxqyltyjqseg.supabase.co',
    'sb_publishable_AttyiBpqQ30PYw0-Wtmv6g_3WMq1uRP',
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:true,flowType:'implicit',storageKey:'gato-negro-recovery'}}
  );
  let ready = false, busy = false, ended = false;
  async function exit(text, scope = 'local') {
    ended = true; ready = false;
    try {
      const {error} = await client.auth.signOut({scope});
      if (error) throw error;
      finish(text);
    } catch {
      finish(text + ' No se pudo confirmar el cierre de sesión. Cierra esta pestaña.');
    }
  }
  // Fuera del callback de Auth para evitar bloqueos al llamar a getUser.
  const timeout = setTimeout(() => {
    if (!ready && !ended) { ended = true; finish('No se pudo verificar el enlace. Solicita uno nuevo desde Supabase.'); }
  }, 15000);
  const {data:{subscription}} = client.auth.onAuthStateChange((event, session) => {
    if (event !== 'PASSWORD_RECOVERY' || !session || ended) return;
    setTimeout(async () => {
      try {
        const {data,error} = await client.auth.getUser();
        if (ended) return;
        if (error || !allowed(data.user)) { clearTimeout(timeout); await exit('El enlace no corresponde a la cuenta autorizada.'); return; }
        clearTimeout(timeout); cleanURL(); ready = true; form.hidden = false; cancel.hidden = false;
        status.textContent = 'Enlace verificado. Puedes establecer una nueva contraseña.';
        password.focus();
      } catch { clearTimeout(timeout); await exit('No se pudo verificar el enlace. Solicita uno nuevo.'); }
    }, 0);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy || ended) return;
    if (password.value !== confirm.value || password.value.length < 12 || password.value.length > 128) {
      status.textContent = 'Las contraseñas deben coincidir y tener entre 12 y 128 caracteres.'; return;
    }
    busy = true; submit.disabled = cancel.disabled = true;
    status.textContent = 'Guardando la nueva contraseña…';
    try {
      const {data,error} = await client.auth.getUser();
      if (error || !allowed(data.user)) { await exit('La sesión ya no es válida. Solicita otro enlace.'); return; }
      const result = await client.auth.updateUser({password:password.value});
      if (result.error) { status.textContent = 'No se pudo cambiar la contraseña. Comprueba los requisitos o solicita otro enlace.'; return; }
      await exit('Contraseña restablecida. Inicia sesión con la nueva contraseña.', 'global');
    } catch { status.textContent = 'Error de conexión. Inténtalo de nuevo.'; }
    finally { busy = false; submit.disabled = cancel.disabled = false; form.reset(); }
  });
  cancel.addEventListener('click', () => { if (!busy) { subscription.unsubscribe(); void exit('Recuperación cancelada. Solicita otro enlace si lo necesitas.'); } });
})();
