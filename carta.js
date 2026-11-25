
/* =========================================
   GATO NEGRO GASTROBAR
   CARTA DIGITAL INTERACTIVA
========================================= */

"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const searchInput =
        document.getElementById("searchInput");

    const categoryButtons =
        document.querySelectorAll(".category-button");

    const estado = document.createElement('p'); estado.setAttribute('role','status');
    document.getElementById('menuGrid').before(estado);
    estado.textContent='Cargando carta actualizada…';
    const crear=(tag,text,cls)=>{const n=document.createElement(tag); n.textContent=text; if(cls)n.className=cls; return n;};
    try {
        const {data,error}=await window.supabaseClient.from('platos').select('nombre,descripcion,categoria,precio,ocultar_precio,destacado,orden,unidad_precio,etiqueta').eq('disponible',true).order('orden').order('nombre');
        if(error) throw error;
        const fragmentos={tapeo:document.createDocumentFragment(),menus:document.createDocumentFragment()};
        for(const p of data){
            const menu=p.categoria==='menus', oculto=p.ocultar_precio||p.precio===null;
            const item=crear('article','',`menu-item${menu?' menu-card':''}${p.destacado||oculto?' featured':''}`); item.dataset.category=p.categoria;
            const info=crear('div','',menu?'menu-card-header':'dish-info');
            if(menu&&p.etiqueta)info.append(crear('span',p.etiqueta,'menu-tag'));
            const h=crear('h3',''); h.append(crear(p.destacado||oculto?'strong':'span',p.nombre)); info.append(h); item.append(info);
            if(!oculto){const precio=crear('span',new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(p.precio)+(p.unidad_precio?' '+p.unidad_precio:''),menu?'menu-price':'price'); (menu?info:item).append(precio);}
            if(p.descripcion){if(menu){const d=crear('details','','menu-details'); d.append(crear('summary','Ver menú completo'),crear('p',p.descripcion,'descripcion-menu')); item.append(d);}else info.append(crear('p',p.descripcion));}
            fragmentos[menu?'menus':'tapeo'].append(item);
        }
        document.querySelectorAll('.menu-item').forEach(n=>n.remove());
        for(const [id,frag] of Object.entries(fragmentos))document.getElementById(id).append(frag);
        estado.textContent='Carta actualizada';
    }catch(e){document.querySelectorAll('.menu-item').forEach(n=>n.remove()); estado.textContent='No se ha podido cargar la carta actual. Recarga la página para intentarlo de nuevo.';}

    const menuItems =
        document.querySelectorAll(".menu-item");

    const menuCategories =
        document.querySelectorAll(".menu-category");

    const resultsCount =
        document.getElementById("resultsCount");

    const emptyResults =
        document.getElementById("emptyResults");

    const allergenButton =
        document.getElementById("allergenButton");

    const allergenModal =
        document.getElementById("allergenModal");

    const scrollTopButton =
        document.getElementById("scrollTop");

    const menuDetails =
        document.querySelectorAll(".menu-details");

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    let activeCategory = "todos";

    /* =====================================
       NORMALIZAR TEXTO
    ===================================== */

    function normalizeText(text) {

        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

    }

    /* Guardar texto de búsqueda */

    const searchableItems = Array.from(menuItems)
        .map(item => ({

            element: item,

            category: item.dataset.category,

            text: normalizeText(item.textContent)

        }));

    /* =====================================
       BUSCADOR Y FILTROS
    ===================================== */

    function filterMenu() {

        const query = normalizeText(
            searchInput?.value || ""
        );

        const words = query.split(/\s+/).filter(Boolean);

        let visibleItems = 0;

        searchableItems.forEach(item => {

            const matchesCategory =
                activeCategory === "todos" ||
                item.category === activeCategory;

            const matchesSearch = words.every(
                word => item.text.includes(word)
            );

            const isVisible =
                matchesCategory && matchesSearch;

            item.element.hidden = !isVisible;

            if (isVisible) {

                visibleItems++;

                const details =
                    item.element.querySelector("details");

                if (details && query.length > 1) {
                    details.open = true;
                }

            }

        });

        /* Ocultar secciones vacías */

        menuCategories.forEach(category => {

            const items = Array.from(
                category.querySelectorAll(".menu-item")
            );

            category.hidden = !items.some(
                item => !item.hidden
            );

        });

        /* Actualizar contador */

        if (resultsCount) {

            resultsCount.textContent =
                visibleItems === 1
                    ? "1 resultado"
                    : `${visibleItems} resultados`;

        }

        /* Mostrar mensaje si no hay resultados */

        if (emptyResults) {

            emptyResults.hidden = visibleItems !== 0;

        }

    }

    /* =====================================
       CAMBIAR CATEGORÍA
    ===================================== */

    categoryButtons.forEach(button => {

        button.addEventListener("click", () => {

            activeCategory =
                button.dataset.category || "todos";

            categoryButtons.forEach(item => {

                const isActive = item === button;

                item.classList.toggle(
                    "active",
                    isActive
                );

                item.setAttribute(
                    "aria-pressed",
                    String(isActive)
                );

            });

            filterMenu();

        });

    });

    /* =====================================
       BÚSQUEDA INSTANTÁNEA
    ===================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            filterMenu
        );

        searchInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    searchInput.value = "";

                    filterMenu();

                }

            }
        );

    }

    /* =====================================
       MENÚS DESPLEGABLES
    ===================================== */

    menuDetails.forEach(details => {

        const summary =
            details.querySelector("summary");

        if (!summary) return;

        function updateSummary() {

            summary.textContent = details.open
                ? "Ocultar menú completo"
                : "Ver menú completo";

        }

        details.addEventListener(
            "toggle",
            updateSummary
        );

        updateSummary();

    });

    /* =====================================
       INFORMACIÓN SOBRE ALÉRGENOS
    ===================================== */

    if (allergenButton && allergenModal) {

        allergenButton.addEventListener(
            "click",
            () => {

                if (
                    typeof allergenModal.showModal
                    === "function"
                ) {

                    if (!allergenModal.open) {

                        allergenModal.showModal();

                    }

                } else {

                    alert(
                        "Consulta al restaurante sobre " +
                        "alérgenos e intolerancias. " +
                        "La información está pendiente " +
                        "de confirmación."
                    );

                }

            }
        );

        /* Cerrar al pulsar fuera */

        allergenModal.addEventListener(
            "click",
            event => {

                if (event.target !== allergenModal) {
                    return;
                }

                const rect =
                    allergenModal.getBoundingClientRect();

                const outside =
                    event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom;

                if (outside && allergenModal.open) {

                    allergenModal.close();

                }

            }
        );

        allergenModal.addEventListener(
            "close",
            () => allergenButton.focus()
        );

    }

    /* =====================================
       BOTÓN VOLVER ARRIBA
    ===================================== */

    function updateScrollButton() {

        if (!scrollTopButton) return;

        scrollTopButton.hidden =
            window.scrollY < 450;

    }

    window.addEventListener(
        "scroll",
        updateScrollButton,
        { passive: true }
    );

    if (scrollTopButton) {

        scrollTopButton.addEventListener(
            "click",
            () => {

                window.scrollTo({

                    top: 0,

                    behavior: reducedMotion.matches
                        ? "auto"
                        : "smooth"

                });

                const brand =
                    document.querySelector(".header .brand");

                brand?.focus({ preventScroll: true });

            }
        );

    }

    /* =====================================
       ANIMACIONES AL DESPLAZARSE
    ===================================== */

    if (
        "IntersectionObserver" in window &&
        !reducedMotion.matches
    ) {

        const animatedElements =
            document.querySelectorAll(
                ".menu-intro, " +
                ".section-heading, " +
                ".menu-category, " +
                ".menu-item, " +
                ".reservation-content"
            );

        const observer = new IntersectionObserver(

            entries => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        entry.target.classList.add(
                            "reveal-visible"
                        );

                        observer.unobserve(
                            entry.target
                        );

                    }

                });

            },

            {
                threshold: 0.08
            }

        );

        animatedElements.forEach(element => {

            observer.observe(element);

        });

    }

    /* =====================================
       INICIALIZACIÓN
    ===================================== */

    filterMenu();

    updateScrollButton();

    console.info(
        "Gato Negro: carta digital inicializada."
    );

});
