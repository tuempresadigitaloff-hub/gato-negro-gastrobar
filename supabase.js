const SUPABASE_URL = "https://agqaxarvoxqyltyjqseg.supabase.co";
const SUPABASE_KEY = "sb_publishable_AttyiBpqQ30PYw0-Wtmv6g_3WMq1uRP";

// Configuración pública necesaria para llamar a la Edge Function.
// La publishable key puede estar en el navegador; nunca pongas aquí
// la service_role key ni la clave secreta de Turnstile.
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
