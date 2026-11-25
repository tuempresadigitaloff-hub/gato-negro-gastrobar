# Gato Negro Gastrobar — integración de Turnstile

## Archivos modificados
- `index.html`: carga la API de Cloudflare Turnstile y añade el contenedor de verificación al formulario.
- `app.js`: deja de insertar directamente en `reservas`; ahora envía los datos y el token de Turnstile a la Edge Function `crear-reserva-segura`.
- `supabase.js`: expone en `window` la URL y la publishable key pública para invocar la función.
- `style.css`: estilos del área de verificación.

La carta y el resto del panel de administración se han mantenido sin cambios funcionales.

## 1. Introducir la Site Key pública
Abre `app.js` y busca:

`const TURNSTILE_SITE_KEY = "PEGA_AQUI_TU_SITE_KEY";`

Sustituye únicamente `PEGA_AQUI_TU_SITE_KEY` por la **Site Key** de Cloudflare Turnstile.

No pegues nunca la **Secret Key** en `app.js`, HTML, CSS, `supabase.js` ni GitHub. La Secret Key debe permanecer como secreto `TURNSTILE_SECRET_KEY` en Supabase.

## 2. Comprobar la Edge Function
La función debe llamarse exactamente:

`crear-reserva-segura`

Debe tener configurados los secretos de servidor:
- `TURNSTILE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

La función que se compartió en esta conversación valida `action: "reserva"` y el hostname. El JavaScript de este ZIP envía esa acción al renderizar Turnstile.

**Importante sobre Verify JWT:** esta función recibe solicitudes de visitantes que no han iniciado sesión. En Supabase, configura `crear-reserva-segura` para que no exija un JWT de usuario (`verify_jwt = false`). La función sigue validando Turnstile en el servidor y usa la service-role key solo dentro de la Edge Function. No pongas esa service-role key en el navegador. La petición del navegador envía la publishable key pública en la cabecera `apikey`.

## 3. Hostnames de Turnstile
El widget de Cloudflare debe admitir el hostname con el que abras la web localmente, por ejemplo `localhost` o `127.0.0.1`.

La Edge Function que se creó anteriormente solo acepta actualmente estos hostnames:
- `localhost`
- `127.0.0.1`

Cuando se publique en Vercel, habrá que añadir el hostname exacto de Vercel tanto al widget de Cloudflare como a la lista `dominiosPermitidos` de la Edge Function. Si no se hace, la comprobación se rechazará.

## 4. Prueba antes de cambiar las políticas RLS
1. Guarda una copia de seguridad del proyecto actual.
2. Sustituye los archivos por los de esta carpeta.
3. Añade la Site Key pública.
4. Abre `index.html` mediante Live Server usando `localhost` o `127.0.0.1`.
5. Completa Turnstile y envía una reserva con datos ficticios.
6. Comprueba que aparece como `Pendiente` en el panel y que llega el correo de nueva solicitud.

**No elimines todavía la política RLS `Solicitar reserva`** hasta que la prueba anterior funcione. Después, elimina o restringe el permiso `INSERT` de `anon`, porque las nuevas reservas públicas deben entrar por la Edge Function. Conserva las políticas administrativas SELECT, UPDATE y DELETE que necesite el panel.

## 5. Limitación pendiente
La Edge Function actual valida Turnstile y los campos, pero todavía no incorpora un límite de frecuencia por IP/correo. Turnstile reduce el tráfico automatizado, pero no sustituye un rate limit. Antes de considerar el sistema listo para producción, hay que añadir ese límite en servidor y revisar las políticas RLS.

## Nota
Este sitio sigue mostrando textos de demostración (“no se realizan reservas reales”). No debe utilizarse para aceptar reservas reales hasta que el restaurante autorice su publicación, se actualicen los textos y se complete la revisión de seguridad.
