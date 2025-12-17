/* ==========================================================================
   RENDERITZADORCURS.JS (v54.0 - FIX SPECIALCLASS & FINAL STABLE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // 1. HELPER: TRADUCTOR DE TEXTO
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        
        const extractText = (children) => {
            if (!children) return "";
            return children.map(node => {
                if (node.type === "text") {
                    let text = node.text || "";
                    if (node.bold) text = `<strong>${text}</strong>`;
                    if (node.italic) text = `<em>${text}</em>`;
                    if (node.underline) text = `<u>${text}</u>`;
                    if (node.strikethrough) text = `<strike>${text}</strike>`;
                    if (node.code) text = `<code>${text}</code>`;
                    return text;
                }
                if (node.type === "link") return `<a href="${node.url}" target="_blank">${extractText(node.children)}</a>`;
                return "";
            }).join("");
        };

        if (Array.isArray(content)) {
            return content.map(block => {
                switch (block.type) {
                    case 'heading': return `<h${block.level || 3}>${extractText(block.children)}</h${block.level || 3}>`;
                    case 'paragraph': return `<p>${extractText(block.children)}</p>`;
                    case 'list': 
                        const tag = block.format === 'ordered' ? 'ol' : 'ul';
                        const items = block.children.map(listItem => `<li>${extractText(listItem.children)}</li>`).join('');
                        return `<${tag}>${items}</${tag}>`;
                    case 'quote': return `<blockquote style="border-left:4px solid #ccc; padding-left:10px; margin:10px 0; color:#555;">${extractText(block.children)}</blockquote>`;
                    case 'image': return `<img src="${block.image.url}" alt="${block.image.alternativeText || ''}" style="max-width:100%; height:auto; margin:10px 0;">`;
                    default: return extractText(block.children);
                }
            }).join('');
        }
        return JSON.stringify(content);
    }

    // 2. CONFIGURACIÓN
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');

    if (!SLUG) { console.warn("No hay slug"); return; }

    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    if (!USER || !TOKEN) { window.location.href = 'index.html'; return; }

    let state = {
        matriculaId: null, curso: null, progreso: {},
        currentModuleIndex: -1, currentView: 'intro',   
        respuestasTemp: {}, testStartTime: 0, testEnCurso: false, godMode: false,
        preguntasExamenFinal: [], preguntasSesionActual: [], timerInterval: null
    };

    const elems = {
        loginOverlay: document.getElementById('login-overlay'),
        appContainer: document.getElementById('app-container'),
        dashboardView: document.getElementById('dashboard-view'),
        examView: document.getElementById('exam-view'),
        appFooter: document.getElementById('app-footer')
    };
    
    if(elems.loginOverlay) elems.loginOverlay.style.display = 'none';
    if(elems.appContainer) elems.appContainer.style.display = 'block';
    if(elems.dashboardView) elems.dashboardView.style.display = 'none';
    if(elems.examView) elems.examView.style.display = 'flex';
    if(elems.appFooter) elems.appFooter.style.display = 'block';

    // HELPERS IA
    function shuffleArray(array) {
        if (!array) return [];
        return array
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
    }

    function prepararExamen(mod) {
        const pool = mod.banc_preguntes || [];
        const limite = 10; 
        let seleccionadas = shuffleArray(pool).slice(0, limite);
        return seleccionadas.map(p => {
            const pClon = JSON.parse(JSON.stringify(p));
            if(pClon.opcions) pClon.opcions = shuffleArray(pClon.opcions);
            return pClon;
        });
    }

    init();

    setTimeout(() => {
        const left = document.querySelector('.sidebar-left');
        const right = document.querySelector('.sidebar-right');
        const toggleSidebar = (el) => { if(window.innerWidth <= 1000) el.classList.toggle('sidebar-mobile-open'); };
        if(left) left.onclick = (e) => { if(!e.target.closest('a') && !e.target.closest('.sidebar-subitem')) toggleSidebar(left); };
        if(right) right.onclick = (e) => { if(e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') toggleSidebar(right); };
    }, 500);

    // 3. CARGA DE DATOS
    async function init() {
        const container = document.getElementById('moduls-container');
        if(container) container.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant curs...</p>';
        try {
            await cargarDatos();
            if (!state.progreso || Object.keys(state.progreso).length === 0) {
                await inicializarProgresoEnStrapi();
            }
            if (state.progreso.examen_final && state.progreso.examen_final.aprobado && state.curso.progres < 100) {
                await guardarProgreso(state.progreso);
            } else {
                await sincronizarAvanceLocal(); 
            }
            renderSidebar();
            renderMainContent();
        } catch (e) {
            console.error(e);
            if(container) container.innerHTML = `<div class="alert alert-danger" style="color:red; padding:20px;">Error: ${e.message}</div>`;
        }
    }

    async function sincronizarAvanceLocal() {
        let huboCambios = false;
        const modulos = state.curso.moduls || [];
        modulos.forEach((mod, idx) => {
            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                const flippedIndices = getFlippedCards(idx);
                const localmenteCompletado = flippedIndices.length >= mod.targetes_memoria.length;
                const estadoRemoto = (state.progreso.modulos && state.progreso.modulos[idx]) ? state.progreso.modulos[idx].flashcards_done : false;
                if (localmenteCompletado && !estadoRemoto) {
                    if (!state.progreso.modulos[idx]) state.progreso.modulos[idx] = { aprobado:false, nota:0, intentos:0, flashcards_done: false };
                    state.progreso.modulos[idx].flashcards_done = true;
                    huboCambios = true;
                }
            }
        });
        if (huboCambios) {
            try { await guardarProgreso(state.progreso); } catch(e) { console.error("Error guardando sync auto:", e); }
        }
    }

    async function cargarDatos() {
        const query = [
            `filters[users_permissions_user][id][$eq]=${USER.id}`,
            `filters[curs][slug][$eq]=${SLUG}`,
            // FIX: Removed 'preguntes'
            `populate[curs][populate][moduls][populate][banc_preguntes][populate][opcions]=true`,
            `populate[curs][populate][moduls][populate][material_pdf]=true`,
            `populate[curs][populate][moduls][populate][targetes_memoria]=true`,
            `populate[curs][populate][moduls][populate][video_fitxer]=true`,
            `populate[curs][populate][examen_final][populate][opcions]=true`, 
            `populate[curs][populate][imatge]=true`
        ].join('&');

        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        
        if (!res.ok) throw new Error("Error de connexió amb Strapi");

        const json = await res.json();
        
        if (!json.data || json.data.length === 0) throw new Error("No s'ha trobat la matrícula.");
        
        const mat = json.data[0];
        state.matriculaId = mat.documentId || mat.id;
        state.curso = mat.curs;
        if (!state.curso.moduls) state.curso.moduls = [];
        state.progreso = mat.progres_detallat || {};

        const cacheKey = `sicap_last_matricula_${SLUG}`;
        const lastMatricula = localStorage.getItem(cacheKey);
        
        if ((lastMatricula && lastMatricula !== String(state.matriculaId)) || mat.progres === 0) {
            Object.keys(localStorage).forEach(key => {
                if (key.includes(SLUG) && (key.includes('flipped') || key.includes('progress'))) {
                    localStorage.removeItem(key);
                }
            });
            if (mat.progres === 0 && state.progreso.modulos) {
                state.progreso.modulos.forEach(m => {
                    m.flashcards_done = false; m.aprobado = false; m.nota = 0; m.intentos = 0;
                });
                guardarProgreso(state.progreso); 
            }
        }
        localStorage.setItem(cacheKey, String(state.matriculaId));
    }

    async function inicializarProgresoEnStrapi() {
        const modulos = state.curso.moduls || [];
        const nuevo = {
            modulos: modulos.map(() => ({ aprobado: false, nota: 0, intentos: 0, flashcards_done: false })),
            examen_final: { aprobado: false, nota: 0, intentos: 0 }
        };
        state.progreso = nuevo;
        await guardarProgreso(nuevo);
    }

    async function guardarProgreso(progresoObj) {
        state.progreso = progresoObj;
        let total = 0, done = 0;
        state.curso.moduls.forEach((mod, i) => {
             total++; if(progresoObj.modulos[i]?.aprobado) done++;
             if(mod.targetes_memoria?.length > 0) { total++; if(progresoObj.modulos[i]?.flashcards_done) done++; }
        });
        if(state.curso.examen_final?.length > 0) { total++; if(progresoObj.examen_final?.aprobado) done++; }
        
        let pct = total > 0 ? Math.round((done/total)*100) : 0;
        if(progresoObj.examen_final?.aprobado) pct = 100;

        const payload = { data: { progres_detallat: progresoObj, progres: pct, estat: pct >= 100 ? 'completat' : 'actiu' } };
        if(progresoObj.examen_final?.aprobado) payload.data.nota_final = progresoObj.examen_final.nota;

        try {
            await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload)
            });
            if (document.getElementById('course-index').innerHTML !== '') renderSidebar();
        } catch(e) {}
    }

    // --- NOTIFICACIONES ---
    async function crearNotificacion(titulo, mensaje) {
        try {
            await fetch(API_ROUTES.notifications, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                body: JSON.stringify({ data: { titol: titulo, missatge: mensaje, llegida: false, users_permissions_user: USER.id } })
            });
            if(window.checkRealNotifications) window.checkRealNotifications();
        } catch(e) { console.error("Error creating notification:", e); }
    }

    function verificarFinModulo(modIdx) {
        const mod = state.curso.moduls[modIdx];
        const modProg = state.progreso.modulos[modIdx];
        if (!mod || !modProg) return;
        const testOk = modProg.aprobado;
        const flashOk = (mod.targetes_memoria && mod.targetes_memoria.length > 0) ? modProg.flashcards_done : true;
        if (testOk && flashOk) {
            crearNotificacion(`Mòdul ${modIdx + 1} Completat`, `Enhorabona! Has completat totes les activitats del mòdul: "${mod.titol}".`);
        }
    }

    async function notificarAprobado(cursoTitulo) {
        crearNotificacion("Curs Completat! 🎓", `Enhorabona! Has aprovat el curs "${cursoTitulo}". El teu diploma ja està disponible.`);
    }

    // --- UTILS LOCAL STORAGE ---
    function getStorageKey(tipo) { return `sicap_progress_${USER.id}_${state.curso.slug}_${tipo}`; }
    function guardarRespuestaLocal(tipo, preguntaId, opcionIdx) {
        const key = getStorageKey(tipo);
        let data = JSON.parse(localStorage.getItem(key)) || {};
        data[preguntaId] = opcionIdx; data.timestamp = Date.now();
        localStorage.setItem(key, JSON.stringify(data));
    }
    function cargarRespuestasLocales(tipo) {
        const key = getStorageKey(tipo);
        const data = JSON.parse(localStorage.getItem(key));
        if (data) { delete data.timestamp; return data; }
        return {};
    }
    function limpiarRespuestasLocales(tipo) {
        localStorage.removeItem(getStorageKey(tipo));
        if(tipo === 'examen_final') {
            localStorage.removeItem(`sicap_timer_start_${USER.id}_${SLUG}`);
            localStorage.removeItem(`sicap_exam_order_${USER.id}_${SLUG}`); 
        }
    }
    function getFlippedCards(modIdx) { return JSON.parse(localStorage.getItem(`sicap_flipped_${USER.id}_${state.curso.slug}_mod_${modIdx}`)) || []; }
    function addFlippedCard(modIdx, cardIdx) {
        const key = `sicap_flipped_${USER.id}_${state.curso.slug}_mod_${modIdx}`;
        let current = getFlippedCards(modIdx);
        if (!current.includes(cardIdx)) { current.push(cardIdx); localStorage.setItem(key, JSON.stringify(current)); }
        return current.length;
    }

    // --- BLOQUEO ---
    function estaBloqueado(indexModulo) {
        if (state.godMode) return false;
        if (indexModulo === 0) return false; 
        const prevIdx = indexModulo - 1;
        const prevProgreso = state.progreso.modulos ? state.progreso.modulos[prevIdx] : null;
        if (!prevProgreso) return true; 
        const testOk = prevProgreso.aprobado === true;
        const modulos = state.curso.moduls || [];
        const prevModuloData = modulos[prevIdx];
        const tieneFlashcards = prevModuloData && prevModuloData.targetes_memoria && prevModuloData.targetes_memoria.length > 0;
        const flashcardsOk = tieneFlashcards ? (prevProgreso.flashcards_done === true) : true;
        return !(testOk && flashcardsOk);
    }

    function puedeHacerExamenFinal() {
        if (state.godMode) return true; 
        if (!state.progreso.modulos) return false;
        return state.progreso.modulos.every((m, idx) => {
            const modObj = state.curso.moduls[idx];
            const tieneFlash = modObj && modObj.targetes_memoria && modObj.targetes_memoria.length > 0;
            const flashOk = tieneFlash ? m.flashcards_done : true;
            return m.aprobado && flashOk;
        });
    }

    window.toggleAccordion = function(headerElement) {
        const group = headerElement.parentElement;
        if (group.classList.contains('locked-module') && !state.godMode) return;
        group.classList.toggle('open');
    };

    window.toggleGodMode = function(checkbox) { 
        state.godMode = checkbox.checked; 
        renderSidebar(); 
        renderMainContent();
    }

    window.cambiarVista = function(idx, view) {
        state.currentModuleIndex = parseInt(idx);
        state.currentView = view;
        state.respuestasTemp = {}; 
        state.testEnCurso = false;
        if(view === 'test') state.preguntasSesionActual = [];
        renderSidebar(); renderMainContent(); window.scrollTo(0,0);
        if(window.innerWidth <= 1000) document.querySelector('.sidebar-left').classList.remove('sidebar-mobile-open');
        setTimeout(() => {
            const activeItem = document.querySelector('.sidebar-subitem.active');
            if(activeItem) activeItem.closest('.sidebar-module-group')?.classList.add('open');
        }, 100);
    }

    window.downloadNotes = function() {
        const noteKey = `sicap_notes_${USER.id}_${state.curso.slug}`;
        const content = localStorage.getItem(noteKey) || '';
        if(!content) return alert("No tens apunts guardats per descarregar.");
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Notes_${state.curso.slug}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    };

    // --- RENDERIZADORES ---
    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        document.getElementById('curs-titol').innerText = state.curso.titol;

        let html = '';
        if (USER.es_professor === true) {
            html += `<div style="margin-bottom:15px; padding:10px; border-bottom:1px solid #eee; text-align:center; background:#fff3cd; border-radius:6px;">
                    <label style="font-size:0.85rem; cursor:pointer; font-weight:bold; color:#856404;">
                        <input type="checkbox" ${state.godMode ? 'checked' : ''} onchange="toggleGodMode(this)"> 🕵️ Mode Professor
                    </label></div>`;
        }
        html += `<div class="sidebar-module-group open"><div class="sidebar-module-title" onclick="window.cambiarVista(-1, 'intro')"><span><i class="fa-solid fa-circle-info"></i> Informació General</span></div><div class="sidebar-sub-menu">${renderSubLink(-1, 'intro', '📄 Programa del curs', false, true)}</div></div>`;

        if(state.curso.moduls) {
            state.curso.moduls.forEach((mod, idx) => {
                const isLocked = estaBloqueado(idx);
                const modProg = state.progreso.modulos ? state.progreso.modulos[idx] : null;
                const check = (modProg?.aprobado && (mod.targetes_memoria?.length === 0 || modProg?.flashcards_done)) ? '<i class="fa-solid fa-check" style="color:green"></i>' : '';
                const lockedClass = (isLocked && !state.godMode) ? 'locked-module' : '';
                const openClass = (state.currentModuleIndex === idx) ? 'open' : '';

                html += `<div class="sidebar-module-group ${lockedClass} ${openClass}"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span><i class="fa-regular fa-folder-open"></i> ${mod.titol} ${check}</span></div><div class="sidebar-sub-menu">`;
                html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);
                
                if ((!isLocked || state.godMode) && mod.material_pdf) {
                    const archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
                    archivos.forEach(pdf => {
                        const url = pdf.url.startsWith('/') ? STRAPI_URL + pdf.url : pdf.url;
                        html += `<a href="${url}" target="_blank" class="sidebar-file-item"><i class="fa-solid fa-file-pdf"></i> ${pdf.name}</a>`;
                    });
                }
                if (mod.targetes_memoria?.length > 0) {
                    const fCheck = modProg?.flashcards_done ? '✓' : '';
                    html += renderSubLink(idx, 'flashcards', `🔄 Targetes de Repàs ${fCheck}`, isLocked);
                }
                const tCheck = modProg?.aprobado ? '✓' : '';
                html += renderSubLink(idx, 'test', `📝 Test Avaluació ${tCheck}`, isLocked);
                html += `</div></div>`;
            });
        }

        const isGlossaryActive = state.currentModuleIndex === 1000;
        html += `<div class="sidebar-module-group ${isGlossaryActive ? 'open' : ''}" style="border-top:1px solid #eee; margin-top:10px;"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span><i class="fa-solid fa-book-bookmark"></i> Recursos</span></div><div class="sidebar-sub-menu">${renderSubLink(1000, 'glossary', '📚 Glossari de Termes', false, true)}</div></div>`;

        const finalIsLocked = !puedeHacerExamenFinal(); 
        const isFinalActive = state.currentModuleIndex === 999;
        const lockedFinalClass = (finalIsLocked && !state.godMode) ? 'locked-module' : '';
        const openFinalClass = isFinalActive ? 'open' : '';

        html += `<div class="sidebar-module-group ${lockedFinalClass} ${openFinalClass}" style="margin-top:20px; border-top:2px solid var(--brand-blue);"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span style="color:var(--brand-blue); font-weight:bold;">🎓 Avaluació Final</span></div><div class="sidebar-sub-menu">${renderSubLink(999, 'examen_final', '🏆 Examen Final', finalIsLocked)}</div></div>`;
        indexContainer.innerHTML = html;
    }

    // --- FIX AQUI: Declarar variable specialClass ---
    function renderSubLink(modIdx, viewName, label, locked, isSpecial = false) {
        const reallyLocked = locked && !state.godMode;
        const active = (state.currentModuleIndex === modIdx && state.currentView === viewName) ? 'active' : '';
        const specialClass = isSpecial ? 'special-item' : ''; // <--- LINEA RECUPERADA
        const click = reallyLocked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;
        const lockIcon = reallyLocked ? '<i class="fa-solid fa-lock"></i> ' : '';
        return `<div class="sidebar-subitem ${active} ${specialClass} ${reallyLocked ? 'locked' : ''}" onclick="${click}">${lockIcon}${label}</div>`;
    }

    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; gridRight.className = ''; 
        detenerCronometro(); 
        document.body.classList.remove('exam-active');
        
        container.classList.remove('fade-in-active'); void container.offsetWidth; container.classList.add('fade-in-active');

        if (state.currentView === 'intro') { container.innerHTML = `<h2><i class="fa-solid fa-book-open"></i> Programa del Curs</h2><div class="module-content-text">${parseStrapiRichText(state.curso.descripcio || "")}</div>`; renderSidebarTools(gridRight, { titol: 'Programa' }); return; }
        if (state.currentView === 'glossary') { const contenidoGlossari = state.curso.glossari ? parseStrapiRichText(state.curso.glossari) : "<p>No hi ha entrades al glossari.</p>"; container.innerHTML = `<h2><i class="fa-solid fa-spell-check"></i> Glossari de Termes</h2><div class="dashboard-card" style="margin-top:20px;"><div class="module-content-text">${contenidoGlossari}</div></div>`; renderSidebarTools(gridRight, { titol: 'Glossari' }); return; }
        if (state.currentView === 'examen_final') { renderExamenFinal(container); return; }

        const mod = state.curso.moduls[state.currentModuleIndex];
        if (!mod) { container.innerHTML = `<div class="alert alert-warning">Mòdul no trobat.</div>`; return; }
        
        if (state.currentView === 'teoria') { renderTeoria(container, mod); renderSidebarTools(gridRight, mod); }
        else if (state.currentView === 'flashcards') { renderFlashcards(container, mod.targetes_memoria, state.currentModuleIndex); renderSidebarTools(gridRight, mod); }
        else if (state.currentView === 'test') { renderTestQuestions(container, mod, state.currentModuleIndex); }
    }

    function renderVideoPlayer(mod) {
        if (mod.video_fitxer && mod.video_fitxer.url) {
            const url = mod.video_fitxer.url.startsWith('/') ? STRAPI_URL + mod.video_fitxer.url : mod.video_fitxer.url;
            return `<div class="video-responsive-container"><video controls src="${url}"></video></div>`;
        }
        return '';
    }

    function renderTeoria(container, mod) {
        let html = `<h2>${mod.titol}</h2>` + renderVideoPlayer(mod);
        if (mod.resum) html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
        if (mod.material_pdf && mod.material_pdf.length > 0) {
            html += `<div class="materials-section"><span class="materials-title">Material Descarregable</span>`;
            const arr = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
            arr.forEach(a => {
                let pdfUrl = a.url.startsWith('/') ? STRAPI_URL + a.url : a.url;
                html += `<a href="${pdfUrl}" target="_blank" class="btn-pdf"><i class="fa-solid fa-file-pdf"></i> ${a.name}</a>`;
            });
            html += `</div>`;
        }
        const check = state.progreso.modulos[state.currentModuleIndex]?.flashcards_done ? '✓' : '';
        if(mod.targetes_memoria && mod.targetes_memoria.length > 0) {
             html += `<div style="margin-top:30px;"><button class="btn-primary" onclick="window.cambiarVista(${state.currentModuleIndex}, 'flashcards')">Anar a Targetes ${check}</button></div>`;
        } else {
             html += `<div style="margin-top:30px;"><button class="btn-primary" onclick="window.cambiarVista(${state.currentModuleIndex}, 'test')">Anar al Test</button></div>`;
        }
        container.innerHTML = html;
    }

    function renderSidebarTools(container, mod) {
        const savedNote = localStorage.getItem(`sicap_notes_${USER.id}_${state.curso.slug}`) || '';
        const modTitleSafe = mod && mod.titol ? mod.titol.replace(/'/g, "\\'") : 'General';
        container.innerHTML = `
            <div class="sidebar-header"><h3>Eines d'Estudi</h3></div>
            <div class="tools-box">
                <div class="tools-title" style="display:flex; justify-content:space-between;"><span>Notes</span><button class="btn-small" onclick="window.downloadNotes()"><i class="fa-solid fa-download"></i></button></div>
                <textarea id="quick-notes" class="notepad-area" placeholder="Escriu apunts aquí...">${savedNote}</textarea>
            </div>
            <div class="tools-box" style="border-color: var(--brand-blue);">
                <div class="tools-title">Dubtes</div>
                <button class="btn-doubt" onclick="obrirFormulariDubte('${modTitleSafe}')"><i class="fa-regular fa-paper-plane"></i> Enviar Dubte</button>
            </div>`;
        document.getElementById('quick-notes').addEventListener('input', (e) => localStorage.setItem(`sicap_notes_${USER.id}_${state.curso.slug}`, e.target.value));
    }

    // --- FLASHCARDS LOGIC ---
    function renderFlashcards(container, cards, modIdx) {
        let html = `<div class="flashcards-grid-view">`;
        if(!cards || cards.length === 0) html = '<p>No hi ha targetes.</p>';
        else {
            const flippedIndices = getFlippedCards(modIdx);
            const isCompletedDB = (state.progreso.modulos && state.progreso.modulos[modIdx]) ? state.progreso.modulos[modIdx].flashcards_done === true : false;
            const isReallyCompleted = isCompletedDB || (flippedIndices.length >= cards.length);

            let headerHtml = `<div id="fc-header-container">`;
            if(isReallyCompleted) {
                headerHtml += `<div class="alert-info" style="margin-bottom:15px; color:green; background:#d4edda; border:1px solid #c3e6cb; padding:15px; border-radius:4px;">
                    <i class="fa-solid fa-check-circle"></i> <strong>Activitat Completada!</strong>
                    <br><small>Ja pots accedir al següent mòdul (si has aprovat el test).</small>
                </div>`;
            } else {
                const count = flippedIndices.length;
                const total = cards.length;
                headerHtml += `<div class="alert-info" style="margin-bottom:15px; color:#856404; background:#fff3cd; border:1px solid #ffeeba; padding:10px; border-radius:4px;">
                    <i class="fa-solid fa-circle-exclamation"></i> Progrés: <strong id="fc-counter-text">${count}/${total}</strong> targetes contestades. Has de fer-les totes per avançar.
                </div>`;
            }
            headerHtml += `</div>`; 

            html = `<h3>Targetes de Repàs</h3>${headerHtml}` + html;
            const distractors = ["Règim", "Junta", "DERT", "Aïllament", "Seguretat", "Infermeria", "Ingrés", "Comunicació", "Especialista", "Jurista", "Educador", "Director", "Reglament", "Funcionari"];

            cards.forEach((card, idx) => {
                const isDone = isReallyCompleted || flippedIndices.includes(idx) || state.godMode;
                const flipClass = isDone ? 'flipped' : '';
                let tempDiv = document.createElement("div");
                try {
                    if (typeof card.resposta === 'object') tempDiv.innerHTML = parseStrapiRichText(card.resposta);
                    else tempDiv.innerHTML = card.resposta;
                } catch (e) { tempDiv.innerText = String(card.resposta); }
                let answerText = (tempDiv.innerText || tempDiv.textContent || "").trim().replace(/\s\s+/g, ' ');
                let words = answerText.split(" ");
                let targetWord = "", hiddenIndex = -1;
                for (let i = 0; i < words.length; i++) {
                    let clean = words[i].replace(/[.,;:"'()]/g, '');
                    if (clean.length > 4) { targetWord = words[i]; hiddenIndex = i; break; }
                }
                if(hiddenIndex === -1 && words.length > 0) { targetWord = words[words.length-1]; hiddenIndex = words.length-1; }
                let targetClean = targetWord.replace(/[.,;:"'()]/g, '');
                let options = [targetClean];
                while(options.length < 3) {
                    let rand = distractors[Math.floor(Math.random() * distractors.length)];
                    if(!options.includes(rand) && rand.toLowerCase() !== targetClean.toLowerCase()) options.push(rand);
                }
                options.sort(() => Math.random() - 0.5);
                let backContent = '';
                if (isDone) {
                    backContent = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;"><i class="fa-solid fa-check-circle" style="font-size:2.5rem; color:#fff; margin-bottom:10px;"></i><p style="font-size:1rem; color:white; font-weight:bold;">${answerText}</p></div>`;
                } else {
                    let questionText = words.map((w, i) => i === hiddenIndex ? `<span class="cloze-blank">_______</span>` : w).join(" ");
                    let buttonsHtml = options.map(opt => `<button class="btn-flash-option" 
                            data-selected="${encodeURIComponent(opt)}" 
                            data-correct="${encodeURIComponent(targetClean)}" 
                            data-idx="${idx}" data-mod="${modIdx}" data-total="${cards.length}" 
                            onclick="checkFlashcardFromDOM(event, this)">${opt}</button>`).join('');
                    backContent = `<div class="flashcard-game-container"><div class="flashcard-question-text">${questionText}</div><div class="flashcard-options">${buttonsHtml}</div></div>`;
                }
                const clickAttr = `onclick="handleFlip(this)"`; 
                html += `<div class="flashcard ${flipClass}" ${clickAttr}><div class="flashcard-inner"><div class="flashcard-front"><h4>Targeta ${idx + 1}</h4><div class="flashcard-front-text">${card.pregunta}</div><small>${isDone ? '✅ Completada' : '<i class="fa-solid fa-rotate"></i> Clic per jugar'}</small></div><div class="flashcard-back">${backContent}</div></div></div>`;
            });
        }
        const check = state.progreso.modulos[modIdx].aprobado ? '✓' : '';
        html += `</div><div class="btn-centered-container"><button class="btn-primary" onclick="window.cambiarVista(${modIdx}, 'test')">Anar al Test ${check}</button></div>`;
        container.innerHTML = html;
    }

    window.handleFlip = function(cardElement) { cardElement.classList.toggle('flipped'); }

    window.checkFlashcardFromDOM = function(e, btn) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const selected = decodeURIComponent(btn.getAttribute('data-selected'));
        const correct = decodeURIComponent(btn.getAttribute('data-correct'));
        const cardIdx = parseInt(btn.getAttribute('data-idx'));
        const modIdx = parseInt(btn.getAttribute('data-mod'));
        const totalCards = parseInt(btn.getAttribute('data-total'));
        const count = addFlippedCard(modIdx, cardIdx);
        const counterEl = document.getElementById('fc-counter-text');
        if (counterEl) counterEl.innerText = `${count}/${totalCards}`;
        const container = btn.closest('.flashcard-game-container');
        const blankSpan = container.querySelector('.cloze-blank');
        const buttons = container.querySelectorAll('.btn-flash-option');
        buttons.forEach(b => b.disabled = true);
        if (selected.toLowerCase() === correct.toLowerCase()) {
            btn.classList.add('correct');
            if(blankSpan) { blankSpan.innerText = selected; blankSpan.classList.remove('cloze-blank'); blankSpan.classList.add('cloze-blank', 'filled-correct'); }
            btn.innerHTML = `✅ ${btn.innerText}`;
        } else {
            btn.classList.add('wrong');
            if(blankSpan) { blankSpan.innerText = selected; blankSpan.classList.add('filled-wrong'); }
            btn.innerHTML = `❌ ${btn.innerText}`;
        }
        if (count >= totalCards) {
            const headerContainer = document.getElementById('fc-header-container');
            if (headerContainer) headerContainer.innerHTML = `<div class="alert-info" style="margin-bottom:15px; color:green; background:#d4edda; border:1px solid #c3e6cb; padding:15px; border-radius:4px;"><i class="fa-solid fa-check-circle"></i> <strong>Activitat Completada!</strong><br><small>Ja pots accedir al següent mòdul (si has aprovat el test).</small></div>`;
            actualizarProgresoFlashcards(modIdx);
        }
    };

    function actualizarProgresoFlashcards(modIdx) {
        if (!state.progreso.modulos) state.progreso.modulos = [];
        if (!state.progreso.modulos[modIdx]) state.progreso.modulos[modIdx] = { aprobado:false, nota:0, intentos:0, flashcards_done: false };
        if (!state.progreso.modulos[modIdx].flashcards_done) {
            state.progreso.modulos[modIdx].flashcards_done = true;
            guardarProgreso(state.progreso).then(() => { verificarFinModulo(modIdx); renderSidebar(); });
        }
    }

    // --- TEST LOGIC (FIXED) ---
    function renderTestQuestions(container, mod, modIdx) {
        if (!state.preguntasSesionActual || state.preguntasSesionActual.length === 0 || state.currentModuleIndex !== modIdx) {
            state.preguntasSesionActual = prepararExamen(mod);
        }
        const preguntasActivas = state.preguntasSesionActual;
        window.currentQuestions = preguntasActivas; 

        const gridRight = document.getElementById('quiz-grid'); 
        gridRight.innerHTML = ''; gridRight.className = 'grid-container';
        preguntasActivas.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-q-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`q-${i}`] !== undefined) div.classList.add('answered');
            gridRight.appendChild(div);
        });

        // GOD MODE AUTO FILL (MÓDULOS)
        if (state.godMode) {
            preguntasActivas.forEach((p, i) => {
                 const correctIdx = p.opcions.findIndex(o => o.esCorrecta || o.isCorrect);
                 if (correctIdx !== -1) state.respuestasTemp[`q-${i}`] = correctIdx;
            });
        }

        let html = `<h3>Test en Curs...</h3>`;
        preguntasActivas.forEach((preg, idx) => {
            const qId = `q-${idx}`;
            const val = state.respuestasTemp[qId];
            html += `<div class="question-card" id="card-${qId}"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                const checked = (val == oIdx) ? 'checked' : '';
                html += `<div class="option-item ${checked ? 'selected' : ''}" onclick="selectTestOption('${qId}', ${oIdx}, 'test_mod_${modIdx}')"><input type="radio" name="${qId}" value="${oIdx}" ${checked}><span>${opt.text}</span></div>`;
            });
            html += `</div></div>`;
        });
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarTest(${modIdx})">${state.godMode ? 'Entregar (Mode Profe)' : 'Finalitzar'}</button></div>`;
        container.innerHTML = html;
    }

    window.selectTestOption = function(qId, valId, storageKeyType) {
        state.respuestasTemp[qId] = valId;
        const gridIdx = qId.split('-')[1]; 
        const gridItemId = storageKeyType.includes('examen') ? `grid-final-q-${gridIdx}` : `grid-q-${gridIdx}`;
        const gridItem = document.getElementById(gridItemId); 
        if(gridItem) gridItem.classList.add('answered');
        
        // Visual update inputs
        const inputs = document.getElementsByName(qId);
        inputs.forEach(i => {
            if(i.value == valId) {
                i.checked = true;
                i.parentElement.classList.add('selected');
            } else {
                i.parentElement.classList.remove('selected');
            }
        });
        guardarRespuestaLocal(storageKeyType, qId, valId);
    };

    window.entregarTest = function(modIdx) {
        window.mostrarModalConfirmacion("Entregar Test", "Estàs segur?", async () => {
            document.getElementById('custom-modal').style.display = 'none';
            const preguntas = window.currentQuestions; let aciertos = 0;
            preguntas.forEach((preg, idx) => { 
                const qId = `q-${idx}`;
                const userRes = state.respuestasTemp[qId];
                const selectedOpt = preg.opcions.find((o, i) => (o.id || i) == userRes);
                if (selectedOpt && (selectedOpt.esCorrecta || selectedOpt.correct || selectedOpt.isCorrect)) aciertos++;
            });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2)); 
            const aprobado = nota >= 7.0;
            const p = state.progreso;
            if (!p.modulos[modIdx]) p.modulos[modIdx] = { intentos: 0, nota: 0, aprobado: false, flashcards_done: false };
            p.modulos[modIdx].intentos += 1; 
            p.modulos[modIdx].nota = Math.max(p.modulos[modIdx].nota, nota); 
            if (aprobado) p.modulos[modIdx].aprobado = true;
            
            await guardarProgreso(p); 
            limpiarRespuestasLocales(`test_mod_${modIdx}`); 
            state.testEnCurso = false; 
            document.body.classList.remove('exam-active');
            
            if (aprobado) verificarFinModulo(modIdx);
            
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, modIdx, false);
        });
    }

    function mostrarFeedback(preguntas, respuestasUsuario, nota, aprobado, modIdx, esFinal) {
        const container = document.getElementById('moduls-container'); const color = aprobado ? 'green' : 'red';
        let html = `<div class="dashboard-card" style="border-top:5px solid ${color}; text-align:center; margin-bottom:30px;"><h2 style="color:${color}">${aprobado ? 'Superat!' : 'No Superat'}</h2><div style="font-size:4rem; font-weight:bold; margin:10px 0;">${nota}</div><div class="btn-centered-container"><button class="btn-primary" onclick="window.cambiarVista(${esFinal ? 999 : modIdx}, '${esFinal ? 'examen_final' : 'test'}')">Continuar</button></div></div><h3>Revisió:</h3>`;
        preguntas.forEach((preg, idx) => {
            const qId = esFinal ? `final-${idx}` : `q-${idx}`; const userRes = respuestasUsuario[qId];
            html += `<div class="question-card review-mode"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                let classes = 'option-item '; const isCorrect = opt.esCorrecta === true || opt.isCorrect === true || opt.correct === true;
                if (isCorrect) classes += 'correct-answer '; if (userRes == oIdx) { classes += 'selected '; if (!isCorrect) classes += 'user-wrong '; }
                html += `<div class="${classes}"><input type="radio" ${userRes == oIdx ? 'checked' : ''} disabled><span>${opt.text}</span></div>`;
            });
            if (preg.explicacio) html += `<div class="explanation-box"><strong>Info:</strong><br>${parseStrapiRichText(preg.explicacio)}</div>`;
            html += `</div></div>`;
        });
        container.innerHTML = html; window.scrollTo(0,0);
    }

    window.revisarTest = function(modIdx) {
        const mod = state.curso.moduls[modIdx];
        if (!mod) return;
        const container = document.getElementById('moduls-container');
        
        // Usar banco para mostrar todo
        const pool = mod.banc_preguntes || [];
        
        let html = `<h3>Revisió (Mode Estudi)</h3><div class="alert-info" style="margin-bottom:20px; background:#e8f0fe; padding:15px; border-radius:6px; color:#0d47a1;">Aquí pots veure les respostes correctes per repassar.</div>`;
        pool.forEach((preg, idx) => {
            html += `<div class="question-card review-mode"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                let classes = 'option-item '; const isCorrect = opt.esCorrecta === true || opt.isCorrect === true || opt.correct === true;
                if (isCorrect) classes += 'correct-answer ';
                html += `<div class="${classes}"><input type="radio" disabled><span>${opt.text}</span></div>`;
            });
            if (preg.explicacio) html += `<div class="explanation-box"><strong>Info:</strong><br>${parseStrapiRichText(preg.explicacio)}</div>`;
            html += `</div></div>`;
        });
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="window.cambiarVista(${modIdx}, 'test')">Tornar</button></div>`;
        container.innerHTML = html; window.scrollTo(0,0);
    }

    // --- FINAL EXAM LOGIC ---
    function renderExamenFinal(container) {
        if(state.progreso.examen_final.aprobado) {
            container.innerHTML = `<div class="dashboard-card" style="text-align:center;"><h1 style="color:green">ENHORABONA! 🎓</h1><p>Has completat el curs.</p><button class="btn-primary" onclick="window.imprimirDiploma('${state.progreso.examen_final.nota}')">Descarregar Diploma</button></div>`;
            return;
        }

        // AUTO-FILL GOD MODE PARA EXAMEN FINAL
        if (state.godMode) {
            state.curso.examen_final.forEach((p, i) => {
                const correctIdx = p.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true);
                if (correctIdx !== -1) {
                    state.respuestasTemp[`ef${i}`] = correctIdx;
                }
            });
        }

        let html = '<div id="exam-timer-container"><div id="exam-timer" class="timer-box">30:00</div></div><h3>Examen Final</h3>';
        state.curso.examen_final.forEach((p, i) => {
            const val = state.respuestasTemp[`ef${i}`];
            html += `<div class="question-card"><div class="q-header">Pregunta ${i+1}</div><p>${p.text}</p>
            <div class="options-list">${p.opcions.map((o, oi) => {
                const checked = (val == oi) ? 'checked' : '';
                const selected = (val == oi) ? 'selected' : '';
                return `<div class="option-item ${selected}" onclick="selectTestOption('ef${i}', ${oi}, 'examen_final')"><input type="radio" name="ef${i}" value="${oi}" ${checked}> ${o.text}</div>`;
            }).join('')}</div></div>`;
        });
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="corregirExamenFinal()">Entregar Examen</button></div>`;
        container.innerHTML = html;
        iniciarCronometro();
    }

    window.iniciarExamenFinal = function() {
        if (!state.curso.examen_final || state.curso.examen_final.length === 0) { alert("Error: No s'han carregat preguntes."); return; }
        state.preguntasExamenFinal = [...state.curso.examen_final].sort(() => 0.5 - Math.random());
        const orderIds = state.preguntasExamenFinal.map(p => p.id || p.documentId); 
        localStorage.setItem(`sicap_exam_order_${USER.id}_${SLUG}`, JSON.stringify(orderIds));
        state.testEnCurso = true; state.testStartTime = Date.now(); localStorage.setItem(`sicap_timer_start_${USER.id}_${SLUG}`, state.testStartTime);
        state.respuestasTemp = {}; renderExamenFinal(document.getElementById('moduls-container'));
    }

    function renderFinalQuestions(container, savedData) {
        const storedOrder = JSON.parse(localStorage.getItem(`sicap_exam_order_${USER.id}_${SLUG}`));
        if (storedOrder && state.curso.examen_final) { state.preguntasExamenFinal = []; storedOrder.forEach(id => { const found = state.curso.examen_final.find(p => (p.id || p.documentId) === id); if(found) state.preguntasExamenFinal.push(found); }); if(state.preguntasExamenFinal.length === 0) state.preguntasExamenFinal = state.curso.examen_final; } else if (state.preguntasExamenFinal.length === 0) { state.preguntasExamenFinal = state.curso.examen_final; }
        const storedStartTime = localStorage.getItem(`sicap_timer_start_${USER.id}_${SLUG}`); if(storedStartTime) state.testStartTime = parseInt(storedStartTime); else { state.testStartTime = Date.now(); localStorage.setItem(`sicap_timer_start_${USER.id}_${SLUG}`, state.testStartTime); }
        const gridRight = document.getElementById('quiz-grid'); gridRight.className = ''; gridRight.innerHTML = `<div id="exam-timer-container"><div id="exam-timer" class="timer-box">30:00</div></div><div id="grid-inner-numbers"></div>`; iniciarCronometro();
        const gridInner = document.getElementById('grid-inner-numbers');
        state.preguntasExamenFinal.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-final-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-final-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`final-${i}`] !== undefined || (savedData && savedData[`final-${i}`] !== undefined)) div.classList.add('answered');
            gridInner.appendChild(div);
        });
        if(savedData) state.respuestasTemp = savedData;
        let html = `<h3 style="color:var(--brand-red);">Examen Final en Curs...</h3>`;
        state.preguntasExamenFinal.forEach((preg, idx) => {
            const qId = `final-${idx}`; const userRes = state.respuestasTemp[qId];
            html += `<div class="question-card" id="card-final-${idx}"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text" style="margin-top:10px;">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => { const checked = (userRes == oIdx) ? 'checked' : ''; const selected = (userRes == oIdx) ? 'selected' : ''; html += `<div class="option-item ${selected}" onclick="selectTestOption('${qId}', ${oIdx}, 'examen_final')"><input type="radio" name="${qId}" value="${oIdx}" ${checked}><span>${opt.text}</span></div>`; });
            html += `</div></div>`;
        });
        const btnText = state.godMode ? "⚡ PROFESSOR: ENTREGAR ARA" : "ENTREGAR EXAMEN FINAL";
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarExamenFinal()">${btnText}</button></div>`;
        container.innerHTML = html; window.currentQuestions = state.preguntasExamenFinal;
    }

    function iniciarCronometro() { const display = document.getElementById('exam-timer'); if(!display) return; const LIMIT_MS = 30 * 60 * 1000; clearInterval(state.timerInterval); state.timerInterval = setInterval(() => { const now = Date.now(); const elapsed = now - state.testStartTime; const remaining = LIMIT_MS - elapsed; if (remaining <= 0) { detenerCronometro(); display.innerText = "00:00"; alert("Temps esgotat!"); entregarExamenFinal(true); return; } const min = Math.floor(remaining / 60000); const sec = Math.floor((remaining % 60000) / 1000); display.innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }, 1000); }
    function detenerCronometro() { clearInterval(state.timerInterval); }
    
    window.entregarExamenFinal = function(forzado = false) {
        const doDelivery = async () => {
            detenerCronometro(); const preguntas = window.currentQuestions; let aciertos = 0;
            preguntas.forEach((preg, idx) => { const qId = `final-${idx}`; const userRes = state.respuestasTemp[qId]; const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true); if (userRes == correctaIdx) aciertos++; });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2)); const aprobado = nota >= 7.5; 
            state.progreso.examen_final.intentos += 1; state.progreso.examen_final.nota = Math.max(state.progreso.examen_final.nota, nota); if (aprobado) state.progreso.examen_final.aprobado = true;
            
            let porcentaje = state.progreso.progres || 0;
            if (aprobado) porcentaje = 100;

            const payload = { data: { progres_detallat: state.progreso, progres: porcentaje } }; 
            if (aprobado) { 
                payload.data.estat = 'completat'; 
                payload.data.nota_final = nota; 
                notificarAprobado(state.curso.titol);
            }
            
            await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload) });
            limpiarRespuestasLocales('examen_final'); state.testEnCurso = false; document.body.classList.remove('exam-active');
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, 999, true);
        };
        if(forzado) { doDelivery(); } else { window.mostrarModalConfirmacion("Entregar Examen", "Segur que vols entregar?", () => { document.getElementById('custom-modal').style.display = 'none'; doDelivery(); }); }
    }

    // --- ENLACE A FUNCIÓN DE IMPRESIÓN (DASHBOARD) ---
    window.imprimirDiploma = function(nota) { 
        if (window.imprimirDiplomaCompleto) {
            const matData = { id: state.matriculaId, documentId: state.matriculaId, nota_final: nota, progres_detallat: state.progreso };
            window.imprimirDiplomaCompleto(matData, state.curso);
        } else {
            alert("Error: Mòdul de certificació no carregat.");
        }
    };

    // --- MODAL DE DUDAS (FIX BUTTON) ---
    window.obrirFormulariDubte = function(moduloTitulo) {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        titleEl.innerText = "Enviar Dubte";
        titleEl.style.color = "var(--brand-blue)";
        
        msgEl.innerHTML = `
            <div style="padding: 5px 0;">
                <p style="margin-bottom:10px; color:var(--text-main);">Escriu la teva pregunta sobre: <strong>${moduloTitulo}</strong></p>
                <textarea id="modal-doubt-text" class="modal-textarea" placeholder="Explica el teu dubte detalladament..."></textarea>
                <small style="color:#666; display:flex; align-items:center; gap:5px;"><i class="fa-regular fa-bell"></i> El professor rebrà una notificació instantània.</small>
            </div>
        `;

        btnCancel.style.display = 'block';
        btnConfirm.innerText = "Enviar";
        btnConfirm.disabled = false; // FIX IMPORTANTE: Desbloquea el botón
        btnConfirm.style.background = "var(--brand-blue)";

        const newConfirm = btnConfirm.cloneNode(true);
        const newCancel = btnCancel.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        newCancel.onclick = () => modal.style.display = 'none';
        
        newConfirm.onclick = async () => {
            const text = document.getElementById('modal-doubt-text').value.trim();
            if(!text) {
                document.getElementById('modal-doubt-text').style.borderColor = "red";
                return;
            }
            newConfirm.innerText = "Enviant...";
            newConfirm.disabled = true;
            try {
                const payload = { 
                    data: { 
                        missatge: text, tema: moduloTitulo, curs: state.curso.titol, 
                        alumne_nom: `${USER.nombre || USER.username} ${USER.apellidos || ''}`, 
                        users_permissions_user: USER.id, estat: 'pendent', data_envio: new Date().toISOString() 
                    } 
                };
                const res = await fetch(`${STRAPI_URL}/api/missatges`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, 
                    body: JSON.stringify(payload) 
                });
                
                if(res.ok) {
                    modal.style.display = 'none';
                    window.mostrarModalError("✅ Dubte enviat correctament!");
                } else { throw new Error("API Error"); }
            } catch(e) { 
                console.error(e); 
                modal.style.display = 'none'; 
                window.mostrarModalError("Error al connectar amb el servidor."); 
            }
        };
        modal.style.display = 'flex';
    };

    window.tornarAlDashboard = function() { window.location.href = 'index.html'; };
});