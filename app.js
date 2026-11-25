"use strict";

/* =========================================
   GASTROBAR GATO NEGRO
   SUPABASE · RESERVAS MANUALES
   PANEL DE ADMINISTRACIÓN
========================================= */

const $ = id => document.getElementById(id);

const cliente = window.supabaseClient;
const correoAdmin = "tuempresadigital.off@gmail.com";

const admin = $("admin");
const login = $("adminLogin");

let verificando = false;
let sesionAutorizada = false;
let reservas = [];
let cargandoReservas = false;
let modificandoReserva = false;
let versionPanel = 0;

/* =========================================
   FUNCIONES GENERALES
========================================= */

function elemento(tipo, texto) {
    const nodo = document.createElement(tipo);
    nodo.textContent = texto;
    return nodo;
}

function mensaje(id, texto) {
    if ($(id)) $(id).textContent = texto;
}

function generarId() {
    return globalThis.crypto?.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) +
          Math.random().toString(36).slice(2);
}

function normalizar(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function formatoPrecio(precio) {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR"
    }).format(precio);
}

function fechaLocal() {
    const partes = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const obtener = tipo =>
        partes.find(p => p.type === tipo).value;

    return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
}

/* =========================================
   ALMACENAMIENTO LOCAL DE PLATOS
========================================= */

let platos = [];
async function cargarPlatos() {
    const version = versionPanel;
    const {data,error} = await cliente.from('platos').select('*').order('orden').order('nombre');
    if (version !== versionPanel || !sesionAutorizada) return;
    if(error) { mensaje('dishStatus','No se pudo cargar la carta: '+error.message); return; }
    platos = data; mostrarGestion(); actualizarEstadisticas();
    mensaje('dishStatus','Carta sincronizada.');
}
/* =========================================
   AUTENTICACIÓN SUPABASE
========================================= */

function autorizado(usuario) {
    return usuario?.email?.toLowerCase() === correoAdmin;
}

function limpiarPanel() {

    versionPanel++;
    sesionAutorizada = false;
    reservas = [];

    if (admin?.open) admin.close();

    for (const id of ["adminStats", "bookings", "manage"]) {
        $(id)?.replaceChildren();
    }

    mensaje("sessionStatus", "");
}

async function mostrarPanel() {

    if (!admin) return;

    sesionAutorizada = true;
    versionPanel++;

    if (login?.open) login.close();

    platos = [];

    if (!admin.open) admin.showModal();

    mensaje(
        "sessionStatus",
        "Sesión iniciada · Conectando con Supabase..."
    );

    mostrarGestion();

    await Promise.all([cargarReservas(), cargarPlatos()]);
}

async function abrirAdmin() {

    if (verificando || admin?.open || login?.open) return;

    verificando = true;

    try {

        if (!cliente) {
            throw new Error("Supabase no disponible");
        }

        const { data, error } =
            await cliente.auth.getUser();

        if (!error && autorizado(data.user)) {

            await mostrarPanel();
            return;

        }

        mensaje("loginResult", "");

        $("loginForm")?.reset();

        login.showModal();

    } catch (error) {

        console.error(error);

        alert("No se pudo abrir el administrador.");

    } finally {

        verificando = false;

    }
}

/* =========================================
   INICIAR SESIÓN
========================================= */

$("loginForm")?.addEventListener("submit", async event => {

    event.preventDefault();

    if (verificando) return;

    verificando = true;

    const boton = $("loginButton");

    if (boton) boton.disabled = true;

    mensaje(
        "loginResult",
        "Comprobando contraseña..."
    );

    try {

        const { data, error } =
            await cliente.auth.signInWithPassword({

                email: correoAdmin,
                password: $("adminPassword").value

            });

        if (error || !autorizado(data.user)) {

            mensaje(
                "loginResult",
                "Contraseña incorrecta o acceso no autorizado."
            );

            return;

        }

        await mostrarPanel();

    } catch (error) {

        console.error(error);

        mensaje(
            "loginResult",
            "Error de conexión. Inténtalo de nuevo."
        );

    } finally {

        $("adminPassword").value = "";

        if (boton) boton.disabled = false;

        verificando = false;

    }

});

/* =========================================
   CERRAR SESIÓN
========================================= */

$("logout")?.addEventListener("click", async () => {

    try {

        const { error } = await cliente.auth.signOut({
            scope: "local"
        });

        if (error) throw error;

        limpiarPanel();

    } catch {

        alert("No se pudo cerrar la sesión.");

    }

});

cliente?.auth.onAuthStateChange((evento, sesion) => {

    if (!autorizado(sesion?.user)) {
        limpiarPanel();
    }

});

$("closeLogin")?.addEventListener("click", () => {

    if (!verificando && login?.open) {
        login.close();
    }

});

login?.addEventListener("cancel", event => {

    if (verificando) event.preventDefault();

});

$("close")?.addEventListener("click", () => {

    if (admin?.open) admin.close();

});

admin?.addEventListener("close", () => {

    versionPanel++;
    reservas = [];

    $("bookings")?.replaceChildren();
    $("adminStats")?.replaceChildren();

});

$("adminOpen")?.addEventListener("click", abrirAdmin);

/* =========================================
   ACCESO OCULTO
   CINCO PULSACIONES EN EL LOGOTIPO
========================================= */

let pulsaciones = 0;
let temporizador;

document.querySelector(".brand")?.addEventListener(
    "click", event => {

        pulsaciones++;

        clearTimeout(temporizador);

        temporizador = setTimeout(() => {

            pulsaciones = 0;

        }, 3000);

        if (pulsaciones >= 5) {

            event.preventDefault();

            pulsaciones = 0;

            clearTimeout(temporizador);

            abrirAdmin();

        }

    }
);

/* =========================================
   SOLICITAR RESERVAS
   CLOUDFLARE TURNSTILE + EDGE FUNCTION
   CONFIRMACIÓN MANUAL
========================================= */

const formulario = $("booking");

let procesandoReserva = false;
let tokenTurnstile = "";
let widgetTurnstile = null;

// Es una clave PÚBLICA. Sustituye el texto de ejemplo por la
// Site Key de Cloudflare Turnstile (nunca pongas aquí la Secret Key).
const TURNSTILE_SITE_KEY = "0x4AAAAAAGQjC7TIpX9bLo0e";

function actualizarEstadoTurnstile(texto) {
    mensaje("turnstile-status", texto);
}

function reiniciarTurnstile() {
    tokenTurnstile = "";

    if (window.turnstile && widgetTurnstile !== null) {
        try {
            window.turnstile.reset(widgetTurnstile);
        } catch (error) {
            console.warn("No se pudo reiniciar Turnstile:", error);
        }
    }
}

function inicializarTurnstile() {
    const contenedor = $("turnstile-widget");

    if (!formulario || !contenedor) return;

    if (TURNSTILE_SITE_KEY === "PEGA_AQUI_TU_SITE_KEY") {
        actualizarEstadoTurnstile(
            "Falta configurar la Site Key pública de Cloudflare."
        );
        return;
    }

    if (!window.turnstile) {
        actualizarEstadoTurnstile(
            "No se ha podido cargar la verificación de seguridad. Recarga la página."
        );
        return;
    }

    try {
        widgetTurnstile = window.turnstile.render("#turnstile-widget", {
            sitekey: TURNSTILE_SITE_KEY,
            action: "reserva",
            callback: token => {
                tokenTurnstile = token;
                actualizarEstadoTurnstile("Verificación completada.");
            },
            "expired-callback": () => {
                tokenTurnstile = "";
                actualizarEstadoTurnstile(
                    "La verificación ha caducado. Vuelve a completarla."
                );
            },
            "error-callback": () => {
                tokenTurnstile = "";
                actualizarEstadoTurnstile(
                    "No se ha podido verificar. Comprueba tu conexión e inténtalo de nuevo."
                );
            },
            theme: "dark",
            size: "flexible",
            language: "es"
        });

        actualizarEstadoTurnstile(
            "Completa la verificación de seguridad para enviar tu solicitud."
        );
    } catch (error) {
        console.error("Error al iniciar Turnstile:", error);
        actualizarEstadoTurnstile(
            "No se ha podido iniciar la verificación de seguridad."
        );
    }
}

if (formulario) {
    formulario.elements.fecha.min = fechaLocal();

    // Espera a que el navegador haya cargado los scripts externos.
    if (document.readyState === "complete") {
        inicializarTurnstile();
    } else {
        window.addEventListener("load", inicializarTurnstile, { once: true });
    }

    formulario.addEventListener("submit", async event => {
        event.preventDefault();

        if (procesandoReserva) return;

        const datos = new FormData(formulario);

        const reserva = {
            nombre: String(datos.get("nombre") || "").trim(),
            telefono: String(datos.get("telefono") || "").trim(),
            email: String(datos.get("email") || "").trim().toLowerCase(),
            fecha: String(datos.get("fecha") || ""),
            hora: String(datos.get("hora") || ""),
            personas: Number(datos.get("personas"))
        };

        formulario.elements.fecha.min = fechaLocal();

        if (
            reserva.nombre.length < 2 ||
            reserva.nombre.length > 80 ||
            !/^[+0-9 ()-]{6,20}$/.test(reserva.telefono) ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reserva.email) ||
            reserva.email.length > 254 ||
            !reserva.fecha ||
            !reserva.hora ||
            reserva.fecha < fechaLocal() ||
            !Number.isInteger(reserva.personas) ||
            reserva.personas < 1 ||
            reserva.personas > 12
        ) {
            mensaje("result", "Comprueba los datos de la reserva.");
            return;
        }

        if (!tokenTurnstile) {
            mensaje(
                "result",
                "Completa primero la verificación antispam."
            );
            actualizarEstadoTurnstile(
                "Necesitamos verificar que eres una persona antes de enviar la solicitud."
            );
            return;
        }

        if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
            mensaje(
                "result",
                "No se ha podido conectar con el servicio de reservas."
            );
            return;
        }

        procesandoReserva = true;

        const boton = formulario.querySelector('button[type="submit"]');
        if (boton) boton.disabled = true;

        mensaje("result", "Verificando y enviando solicitud...");

        try {
            const endpoint =
                `${window.SUPABASE_URL}/functions/v1/crear-reserva-segura`;

            const respuesta = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": window.SUPABASE_KEY
                },
                body: JSON.stringify({
                    ...reserva,
                    token: tokenTurnstile
                })
            });

            let resultado = {};
            try {
                resultado = await respuesta.json();
            } catch {
                throw new Error("El servidor devolvió una respuesta no válida.");
            }

            if (!respuesta.ok || resultado.success !== true) {
                const error = new Error(
                    resultado.error || "No se pudo registrar la solicitud."
                );
                error.status = respuesta.status;
                throw error;
            }

            mensaje(
                "result",
                "✓ Solicitud registrada correctamente. Pendiente de confirmación."
            );

            formulario.reset();
            formulario.elements.fecha.min = fechaLocal();
            reiniciarTurnstile();

            if (admin?.open && sesionAutorizada) {
                await cargarReservas();
            }

        } catch (error) {
            console.error("Error al enviar la reserva:", error);

            if (error.status === 409) {
                mensaje(
                    "result",
                    "Ya existe una solicitud para esos datos, fecha y hora."
                );
            } else if (error.status === 403) {
                mensaje(
                    "result",
                    "La verificación de seguridad ha caducado o no es válida. Vuelve a intentarlo."
                );
            } else if (error.status === 401) {
                mensaje(
                    "result",
                    "La función segura requiere ajustar su configuración de acceso en Supabase."
                );
            } else {
                mensaje(
                    "result",
                    "No se pudo registrar la solicitud. Inténtalo de nuevo en unos instantes."
                );
            }

            reiniciarTurnstile();

        } finally {
            procesandoReserva = false;
            if (boton) boton.disabled = false;
        }
    });
}

/* =========================================
   CARGAR RESERVAS DESDE SUPABASE
========================================= */

async function cargarReservas() {

    if (
        !admin?.open ||
        !sesionAutorizada ||
        cargandoReservas ||
        modificandoReserva
    ) return;

    cargandoReservas = true;

    const version = versionPanel;

    try {

        let registros = [];
        let inicio = 0;
        const limite = 500;

        while (true) {

            const { data, error } = await cliente
                .from("reservas")
                .select(
                    "id,nombre,telefono,email,fecha,hora,personas,estado,creada"
                )
                .order("fecha", { ascending: true })
                .order("hora", { ascending: true })
                .order("id", { ascending: true })
                .range(inicio, inicio + limite - 1);

            if (error) throw error;

            if (
                version !== versionPanel ||
                !admin.open ||
                !sesionAutorizada
            ) return;

            registros.push(...(data || []));

            if (!data || data.length < limite) break;

            inicio += limite;

        }

        if (modificandoReserva) return;

        reservas = registros;

        mostrarReservas();
        actualizarEstadisticas();

        mensaje(
            "sessionStatus",
            "✓ Sesión iniciada · Reservas sincronizadas"
        );

    } catch (error) {

        console.error(error);

        if (version === versionPanel && admin?.open) {

            mensaje(
                "sessionStatus",
                "No se pudieron actualizar las reservas."
            );

        }

    } finally {

        cargandoReservas = false;

    }

}

/* =========================================
   ESTADÍSTICAS DEL ADMINISTRADOR
========================================= */

function actualizarEstadisticas() {

    if (!admin?.open || !sesionAutorizada) return;

    const contenedor = $("adminStats");

    if (!contenedor) return;

    contenedor.replaceChildren();

    const pendientes = reservas.filter(
        r => r.estado === "Pendiente"
    );

    const confirmadas = reservas.filter(
        r => r.estado === "Confirmada"
    );

    const rechazadas = reservas.filter(
        r => r.estado === "Rechazada"
    );

    const canceladas = reservas.filter(
        r => r.estado === "Cancelada"
    );

    const reservasHoy = confirmadas.filter(
        r => r.fecha === fechaLocal()
    );

    const personasHoy = reservasHoy.reduce(
        (total, r) => total + Number(r.personas),
        0
    );

    const estadisticas = [

        ["Reservas totales", reservas.length],
        ["Pendientes", pendientes.length],
        ["Confirmadas", confirmadas.length],
        ["Rechazadas", rechazadas.length],
        ["Canceladas", canceladas.length],
        ["Reservas de hoy", reservasHoy.length],
        ["Comensales de hoy", personasHoy],
        ["Platos de la carta", platos.length]

    ];

    estadisticas.forEach(([titulo, cantidad]) => {

        const tarjeta = document.createElement("article");

        tarjeta.className = "dish-card";

        tarjeta.append(

            elemento("p", titulo),
            elemento("h3", cantidad)

        );

        contenedor.appendChild(tarjeta);

    });

}

/* =========================================
   MODIFICAR ESTADO DE RESERVAS
========================================= */

async function cambiarEstado(reserva, estado) {

    if (
        !sesionAutorizada ||
        !admin?.open ||
        modificandoReserva
    ) return;

    const acciones = {

        Confirmada: "aceptar",
        Rechazada: "rechazar",
        Cancelada: "cancelar"

    };

    if (!confirm(
        `¿Quieres ${acciones[estado]} esta reserva?`
    )) return;

    modificandoReserva = true;

    try {

        const { data, error } = await cliente
            .from("reservas")
            .update({ estado })
            .eq("id", reserva.id)
            .eq("estado", reserva.estado)
            .select("id");

        if (error) throw error;

        if (!data?.length) {

            alert(
                "La reserva ha cambiado o ya no está disponible."
            );

        } else {

            alert("Estado actualizado correctamente.");

        }

    } catch (error) {

        console.error(error);

        alert("No se pudo modificar la reserva.");

    } finally {

        modificandoReserva = false;

        await cargarReservas();

    }

}

/* =========================================
   ELIMINAR RESERVAS
========================================= */

async function eliminarReserva(reserva) {

    if (
        !sesionAutorizada ||
        !admin?.open ||
        modificandoReserva
    ) return;

    if (!confirm(
        "¿Eliminar definitivamente esta reserva?"
    )) return;

    modificandoReserva = true;

    try {

        const { data, error } = await cliente
            .from("reservas")
            .delete()
            .eq("id", reserva.id)
            .eq("estado", reserva.estado)
            .select("id");

        if (error) throw error;

        if (!data?.length) {

            alert("La reserva ya no está disponible.");

        }

    } catch (error) {

        console.error(error);

        alert("No se pudo eliminar la reserva.");

    } finally {

        modificandoReserva = false;

        await cargarReservas();

    }

}

/* =========================================
   MOSTRAR RESERVAS
========================================= */

function mostrarReservas() {

    if (!admin?.open || !sesionAutorizada) return;

    const contenedor = $("bookings");

    if (!contenedor) return;

    contenedor.replaceChildren();

    if (!reservas.length) {

        contenedor.appendChild(

            elemento(
                "p",
                "Todavía no hay reservas de prueba."
            )

        );

        return;

    }

    const ordenadas = [...reservas].sort((a, b) => {

        const prioridadA = a.estado === "Pendiente" ? 0 : 1;
        const prioridadB = b.estado === "Pendiente" ? 0 : 1;

        return prioridadA - prioridadB ||
            (a.fecha + a.hora).localeCompare(
                b.fecha + b.hora
            );

    });

    ordenadas.forEach(reserva => {

        const tarjeta = document.createElement("article");

        tarjeta.className = "dish-card";

        tarjeta.append(

            elemento("h3", reserva.nombre),

            elemento("p", "Fecha: " + reserva.fecha),

            elemento(
                "p",
                "Hora: " + reserva.hora.slice(0, 5)
            ),

            elemento(
                "p",
                "Comensales: " + reserva.personas
            ),

            elemento(
                "p",
                "Teléfono: " + reserva.telefono
            ),

            elemento(
                "p",
                "Correo: " + reserva.email
            )

        );

        const estado = elemento(
            "strong",
            reserva.estado
        );

        estado.style.display = "block";
        estado.style.marginBottom = "15px";

        const colores = {

            Pendiente: "#eab308",
            Confirmada: "#22c55e",
            Rechazada: "#ef4444",
            Cancelada: "#9ca3af"

        };

        estado.style.color =
            colores[reserva.estado] || "inherit";

        tarjeta.appendChild(estado);

        if (reserva.estado === "Pendiente") {

            const aceptar = elemento(
                "button",
                "✓ Aceptar reserva"
            );

            aceptar.type = "button";

            aceptar.addEventListener("click", () => {

                cambiarEstado(reserva, "Confirmada");

            });

            const rechazar = elemento(
                "button",
                "✕ Rechazar reserva"
            );

            rechazar.type = "button";

            rechazar.addEventListener("click", () => {

                cambiarEstado(reserva, "Rechazada");

            });

            tarjeta.append(aceptar, rechazar);

        }

        if (reserva.estado === "Confirmada") {

            const cancelar = elemento(
                "button",
                "Cancelar reserva"
            );

            cancelar.type = "button";

            cancelar.addEventListener("click", () => {

                cambiarEstado(reserva, "Cancelada");

            });

            tarjeta.appendChild(cancelar);

        }

        const eliminar = elemento(
            "button",
            "Eliminar"
        );

        eliminar.type = "button";

        eliminar.addEventListener("click", () => {

            eliminarReserva(reserva);

        });

        tarjeta.appendChild(eliminar);

        contenedor.appendChild(tarjeta);

    });

}

/* =========================================
   SINCRONIZACIÓN ENTRE DISPOSITIVOS
========================================= */

setInterval(() => {

    if (admin?.open && sesionAutorizada) {

        cargarReservas();

    }

}, 10000);

window.addEventListener("focus", () => {

    if (admin?.open && sesionAutorizada) {

        cargarReservas();

    }

});

/* =========================================
   AÑADIR PLATOS DE PRUEBA
========================================= */

let guardandoPlato = false;
async function cambiarCarta(operacion) {
    if (!sesionAutorizada || !admin?.open || guardandoPlato) return false;
    guardandoPlato = true;
    try {
        const {data,error} = await operacion.select('id');
        if(error || !data?.length) throw new Error(error?.message || 'Operación no autorizada');
        await cargarPlatos(); return true;
    } catch(e) { mensaje('dishStatus', e.message); return false; }
    finally { guardandoPlato = false; }
}
function camposPlato(form) {
    const d = new FormData(form), valor = String(d.get('precio')).trim();
    const precio = valor === '' ? null : Number(valor);
    const nombre = String(d.get('plato')).trim();
    if (!nombre || (precio !== null && (!Number.isFinite(precio) || precio < 0))) throw new Error('Revisa nombre y precio.');
    return {nombre, categoria:d.get('categoria'), descripcion:d.get('descripcion') || '', precio,
        ocultar_precio:precio===null || d.has('ocultar'), destacado:precio===null || d.has('ocultar') || d.has('destacado'), disponible:d.has('disponible'), unidad_precio:d.get('unidad') || '', etiqueta:d.get('etiqueta') || ''};
}
$('dishForm')?.addEventListener('submit', async event => {
    event.preventDefault(); const form=event.currentTarget;
    try { const datos=camposPlato(form); if(platos.some(p=>normalizar(p.nombre)===normalizar(datos.nombre)&&p.categoria===datos.categoria)) throw new Error('Este plato ya existe.');
        if(await cambiarCarta(cliente.from('platos').insert({...datos,orden:Math.max(0,...platos.map(p=>p.orden))+1}))) form.reset();
    } catch(e) { mensaje('dishStatus',e.message); }
});
function mostrarGestion() {
    if(!admin?.open || !sesionAutorizada) return;
    const contenedor=$('manage'); contenedor.replaceChildren();
    if(!platos.length) contenedor.append(elemento('p','No hay platos cargados.'));
    for(const plato of platos) {
        const tarjeta=elemento('article',''); tarjeta.className='dish-card';
        const details=elemento('details',''); details.append(elemento('summary',plato.nombre+' · '+(plato.ocultar_precio||plato.precio===null?'Precio oculto':formatoPrecio(plato.precio))));
        const form=$('dishForm').cloneNode(true); form.removeAttribute('id');
        for(const [name,value] of Object.entries({plato:plato.nombre,categoria:plato.categoria,descripcion:plato.descripcion,precio:plato.precio,unidad:plato.unidad_precio,etiqueta:plato.etiqueta})) form.elements.namedItem(name).value=value??'';
        for(const [name,value] of Object.entries({ocultar:plato.ocultar_precio,destacado:plato.destacado,disponible:plato.disponible})) form.elements.namedItem(name).checked=value;
        form.querySelector('button').textContent='Guardar cambios';
        form.addEventListener('submit',async e=>{e.preventDefault();try{await cambiarCarta(cliente.from('platos').update(camposPlato(form)).eq('id',plato.id));}catch(err){mensaje('dishStatus',err.message);}});
        const borrar=elemento('button','Eliminar plato'); borrar.type='button'; borrar.addEventListener('click',()=>{if(confirm('¿Eliminar este plato?')) cambiarCarta(cliente.from('platos').delete().eq('id',plato.id));});
        details.append(form,borrar); tarjeta.append(details); contenedor.append(tarjeta);
    }
}

/* =========================================
   ANIMACIONES AL DESPLAZARSE
========================================= */

const secciones = document.querySelectorAll(
    "main section"
);

const movimientoReducido = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
).matches;

if (

    "IntersectionObserver" in window &&

    !movimientoReducido

) {

    const observador = new IntersectionObserver(

        entradas => {

            entradas.forEach(entrada => {

                if (entrada.isIntersecting) {

                    entrada.target.classList.add("visible");

                    observador.unobserve(entrada.target);

                }

            });

        },

        {
            threshold: 0.08
        }

    );

    secciones.forEach(seccion => {

        observador.observe(seccion);

    });

} else {

    secciones.forEach(seccion => {

        seccion.classList.add("visible");

    });

}

/* =========================================
   INICIALIZACIÓN
========================================= */

console.info(
    "Gato Negro · Sistema de reservas manuales iniciado."
);

if (!cliente) {

    console.error(
        "No se ha encontrado la conexión con Supabase."
    );

}