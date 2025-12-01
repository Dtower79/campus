document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. HELPER: TRADUCTOR DE TEXTO
    // ------------------------------------------------------------------------
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (content.type === 'paragraph' || content.type === 'text') {
             return content.children?.map(c => c.text).join('') || '';
        }
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.type === 'paragraph' && block.children) {
                    return `<p>${block.children.map(c => {
                        let text = c.text;
                        if (c.bold) text = `<b>${text}</b>`;
                        if (c.italic) text = `<i>${text}</i>`;
                        if (c.underline) text = `<u>${text}</u>`;
                        return text;
                    }).join('')}</p>`;
                }
                if (block.type === 'list') {
                     const tag = block.format === 'ordered' ? 'ol' : 'ul';
                     const items = block.children.map(li => `<li>${li.children.map(c => c.text).join('')}</li>`).join('');
                     return `<${tag}>${items}</${tag}>`;
                }
                if (block.type === 'heading') {
                    return `<h${block.level}>${block.children[0].text}</h${block.level}>`;
                }
                return '';
            }).join('');
        }
        return JSON.stringify(content);
    }

    // ------------------------------------------------------------------------
    // 2. CONFIGURACIÓN Y ESTADO
    // ------------------------------------------------------------------------
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');
    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    let state = {
        matriculaId: null,
        curso: null,
        progreso: {},
        currentModuleIndex: -1, // -1 = Intro/Programa
        currentView: 'intro',   
        respuestasTemp: {},
        testStartTime: 0,
        testEnCurso: false,
        godMode: false,
        preguntasExamenFinal: [],
        timerInterval: null
    };

    if (!SLUG) return; 

    if (!USER || !TOKEN) {
        window.location.href = 'index.html';
        return;
    }

    // Configuración visual inicial
    const loginOverlay = document.getElementById('login-overlay');
    if(loginOverlay) loginOverlay.style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'flex';

    // Forzar Footer visible
    const footer = document.getElementById('app-footer');
    if(footer) footer.style.display = 'block';

    // Inyectar botón Scroll Top
    if(!document.getElementById('scroll-top-btn')) {
        const btn = document.createElement('button');
        btn.id = 'scroll-top-btn';
        btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        btn.onclick = () => window.scrollTo({top: 0, behavior: 'smooth'});
        document.body.appendChild(btn);
        window.onscroll = () => {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                btn.style.display = "flex";
            } else {
                btn.style.display = "none";
            }
        };
    }

    init();

    async function init() {
        const container = document.getElementById('moduls-container');
        if(container) container.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant curs...</p>';
        try {
            await cargarDatos();
            if (!state.progreso || Object.keys(state.progreso).length === 0) {
                await inicializarProgresoEnStrapi();
            }
            renderSidebar();
            renderMainContent();
        } catch (e) {
            console.error(e);
            if(container) container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
        }
    }

    async function cargarDatos() {
        const query = [
            `filters[users_permissions_user][id][$eq]=${USER.id}`,
            `filters[curs][slug][$eq]=${SLUG}`,
            `populate[curs][populate][moduls][populate][preguntes][populate][opcions]=true`, 
            `populate[curs][populate][moduls][populate][material_pdf]=true`,
            `populate[curs][populate][moduls][populate][targetes_memoria]=true`,
            `populate[curs][populate][examen_final][populate][opcions]=true`, 
            `populate[curs][populate][imatge]=true`
        ].join('&');

        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const json = await res.json();

        if (!json.data || json.data.length === 0) {
            throw new Error("No estàs matriculat en aquest curs.");
        }

        const mat = json.data[0];
        state.matriculaId = mat.documentId || mat.id;
        state.curso = mat.curs;
        state.progreso = mat.progres_detallat || {};
    }

    async function inicializarProgresoEnStrapi() {
        const nuevoProgreso = {
            modulos: state.curso.moduls.map(() => ({ aprobado: false, nota: 0, intentos: 0 })),
            examen_final: { aprobado: false, nota: 0, intentos: 0 }
        };
        await guardarProgreso(nuevoProgreso);
    }

    async function guardarProgreso(progresoObj) {
        let totalModulos = state.curso.modulos ? state.curso.modulos.length : 0;
        let aprobados = 0;
        if (progresoObj.modulos) {
            aprobados = progresoObj.modulos.filter(m => m.aprobado).length;
        }
        let porcentaje = totalModulos > 0 ? Math.round((aprobados / totalModulos) * 100) : 0;
        if (progresoObj.examen_final && progresoObj.examen_final.aprobado) {
            porcentaje = 100;
        }

        const payload = { data: { progres_detallat: progresoObj, progres: porcentaje } };
        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });
        state.progreso = progresoObj;
    }

    // --- Persistencia Local ---
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

    // ------------------------------------------------------------------------
    // 4. LÓGICA DEL UI (SIDEBAR + ACORDEÓN)
    // ------------------------------------------------------------------------
    function estaBloqueado(indexModulo) {
        if (state.godMode) return false;
        if (indexModulo === 0) return false; 
        const moduloAnterior = state.progreso.modulos[indexModulo - 1];
        if (!moduloAnterior) return false; 
        return !moduloAnterior.aprobado;
    }

    function puedeHacerExamenFinal() {
        if (state.godMode) return true; 
        if (!state.progreso.modulos) return false;
        return state.progreso.modulos.every(m => m.aprobado === true);
    }

    // Toggle Acordeón
    window.toggleAccordion = function(headerElement) {
        const group = headerElement.parentElement;
        if (group.classList.contains('group-locked') && !state.godMode) return;
        group.classList.toggle('open');
    };

    // Toggle Modo Dios / Profesor
    window.toggleGodMode = function(checkbox) { 
        state.godMode = checkbox.checked; 
        renderSidebar(); 
        renderMainContent(); // Recargar para ver respuestas en tests/flashcards
    }

    // Navegación Principal
    window.cambiarVista = function(idx, view) {
        state.currentModuleIndex = idx;
        state.currentView = view;
        state.respuestasTemp = {}; 
        state.testEnCurso = false;
        renderSidebar();
        renderMainContent();
        window.scrollTo(0,0);
    }

    // ------------------------------------------------------------------------
    // RENDER SIDEBAR (MENÚ LATERAL)
    // ------------------------------------------------------------------------
    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        const tituloEl = document.getElementById('curs-titol');
        if(tituloEl) tituloEl.innerText = state.curso.titol;

        let html = '';

        if (USER.es_professor === true) {
            html += `<div style="margin-bottom:15px; padding:10px; border-bottom:1px solid #eee; text-align:center; background:#fff3cd; border-radius:6px;">
                    <label style="font-size:0.85rem; cursor:pointer; font-weight:bold; color:#856404;">
                        <input type="checkbox" ${state.godMode ? 'checked' : ''} onchange="toggleGodMode(this)"> 🕵️ Mode Professor
                    </label></div>`;
        }
        
        // 1. PROGRAMA (Intro)
        const isIntroActive = state.currentModuleIndex === -1;
        html += `<div class="sidebar-module-group ${isIntroActive ? 'open' : ''}">
            <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                <span><i class="fa-solid fa-circle-info"></i> Informació General</span>
            </div>
            <div class="sidebar-sub-menu">
                ${renderSubLink(-1, 'intro', '📄 Programa del curs', false, true)}
            </div>
        </div>`;

        // 2. MÓDULOS
        state.curso.moduls.forEach((mod, idx) => {
            const isLocked = estaBloqueado(idx);
            const modProgreso = state.progreso.modulos ? state.progreso.modulos[idx] : null;
            const check = modProgreso && modProgreso.aprobado ? '<i class="fa-solid fa-check" style="color:green"></i>' : '';
            
            // Abierto si es el módulo actual
            const isOpen = (state.currentModuleIndex === idx);
            const lockedClass = (isLocked && !state.godMode) ? 'group-locked' : '';
            const openClass = isOpen ? 'open' : '';

            html += `<div class="sidebar-module-group ${lockedClass} ${openClass}">
                    <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                        <span><i class="fa-regular fa-folder-open"></i> ${mod.titol} ${check}</span>
                    </div>
                    <div class="sidebar-sub-menu">`;
            
            // Sub-items
            html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);

            if ((!isLocked || state.godMode) && mod.material_pdf) {
                const archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
                if (archivos.length > 0) {
                    archivos.forEach(pdf => {
                        const pdfUrl = pdf.url.startsWith('/') ? STRAPI_URL + pdf.url : pdf.url;
                        html += `<a href="${pdfUrl}" target="_blank" class="sidebar-file-item"><i class="fa-solid fa-file-pdf"></i> ${pdf.name}</a>`;
                    });
                }
            }

            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                html += renderSubLink(idx, 'flashcards', '🔄 Targetes de Repàs', isLocked);
            }
            
            const intentos = modProgreso ? modProgreso.intentos : 0;
            html += renderSubLink(idx, 'test', `📝 Test Avaluació (${intentos}/2)`, isLocked);
            html += `</div></div>`;
        });

        // 3. GLOSARIO
        const isGlossaryActive = state.currentModuleIndex === 1000;
        html += `<div class="sidebar-module-group ${isGlossaryActive ? 'open' : ''}" style="border-top:1px solid #eee; margin-top:10px;">
            <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                <span><i class="fa-solid fa-book-bookmark"></i> Recursos</span>
            </div>
            <div class="sidebar-sub-menu">
                ${renderSubLink(1000, 'glossary', '📚 Glossari de Termes', false, true)}
            </div>
        </div>`;

        // 4. EXAMEN FINAL
        const finalIsLocked = !puedeHacerExamenFinal(); 
        const isFinalActive = state.currentModuleIndex === 999;
        const lockedFinalClass = (finalIsLocked && !state.godMode) ? 'group-locked' : '';
        const openFinalClass = isFinalActive ? 'open' : '';

        html += `<div class="sidebar-module-group ${lockedFinalClass} ${openFinalClass}" style="margin-top:20px; border-top:2px solid var(--brand-blue);">
                <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                    <span style="color:var(--brand-blue); font-weight:bold;">🎓 Avaluació Final</span>
                </div>
                <div class="sidebar-sub-menu">
                    ${renderSubLink(999, 'examen_final', '🏆 Examen Final', finalIsLocked)}
                </div>
            </div>`;

        indexContainer.innerHTML = html;
    }

    // Helper para generar enlaces del menú
    function renderSubLink(modIdx, viewName, label, locked, isSpecial = false) {
        const reallyLocked = locked && !state.godMode;
        
        // Comparamos como String para evitar errores de tipo
        let isActive = (String(state.currentModuleIndex) === String(modIdx) && state.currentView === viewName);
        
        const lockedClass = reallyLocked ? 'locked' : '';
        const activeClass = isActive ? 'active' : '';
        const specialClass = isSpecial ? 'special-item' : '';
        
        const clickFn = reallyLocked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;
        
        return `<div class="sidebar-subitem ${lockedClass} ${activeClass} ${specialClass}" onclick="${clickFn}">
                    ${label} ${reallyLocked ? '<i class="fa-solid fa-lock" style="font-size:0.7em;"></i>' : ''}
                </div>`;
    }

    // ------------------------------------------------------------------------
    // RENDER MAIN CONTENT (CONTENIDO CENTRAL)
    // ------------------------------------------------------------------------
    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; 
        gridRight.className = ''; 
        detenerCronometro(); 
        document.body.classList.remove('exam-active');

        // VISTA: PROGRAMA
        if (state.currentView === 'intro') {
            container.innerHTML = `
                <h2><i class="fa-solid fa-book-open"></i> Programa del Curs</h2>
                <div class="module-content-text" style="margin-top:20px;">
                    ${parseStrapiRichText(state.curso.descripcio || "Descripció no disponible.")}
                </div>
            `;
            renderSidebarTools(gridRight, { titol: 'Programa' }); 
            return;
        }

        // VISTA: GLOSARIO
        if (state.currentView === 'glossary') {
            const contenidoGlossari = state.curso.glossari 
                ? parseStrapiRichText(state.curso.glossari) 
                : "<p>No hi ha entrades al glossari.</p>";
            container.innerHTML = `
                <h2><i class="fa-solid fa-spell-check"></i> Glossari de Termes</h2>
                <div class="dashboard-card" style="margin-top:20px;">
                    <div class="module-content-text">${contenidoGlossari}</div>
                </div>
            `;
            renderSidebarTools(gridRight, { titol: 'Glossari' }); 
            return;
        }

        // VISTA: EXAMEN FINAL
        if (state.currentView === 'examen_final') {
            renderExamenFinal(container);
            return;
        }

        // VISTAS DE MÓDULO (Teoría, Flashcards, Test)
        const mod = state.curso.moduls[state.currentModuleIndex];
        
        if (state.currentView === 'teoria') {
            renderTeoria(container, mod);
            renderSidebarTools(gridRight, mod); 
        }
        else if (state.currentView === 'flashcards') {
            renderFlashcards(container, mod.targetes_memoria);
            renderSidebarTools(gridRight, mod); 
        }
        else if (state.currentView === 'test') {
            const savedData = cargarRespuestasLocales(`test_mod_${state.currentModuleIndex}`);
            const hayDatosGuardados = Object.keys(savedData).length > 0;
            const moduloAprobado = state.progreso.modulos[state.currentModuleIndex].aprobado;
            
            if ((state.testEnCurso || hayDatosGuardados) && !moduloAprobado) {
                gridRight.className = 'grid-container';
                state.respuestasTemp = savedData;
                state.testEnCurso = true;
                renderTestQuestions(container, mod, state.currentModuleIndex);
            } else {
                renderTestIntro(container, mod, state.currentModuleIndex);
                renderSidebarTools(gridRight, mod);
            }
        }
    }

    // ------------------------------------------------------------------------
    // RENDER SIDEBAR RIGHT (HERRAMIENTAS + BREADCRUMBS)
    // ------------------------------------------------------------------------
    function renderSidebarTools(container, mod) {
        // Breadcrumbs Interactivos
        let viewLabel = '';
        if (state.currentView === 'intro') viewLabel = 'Programa';
        else if (state.currentView === 'glossary') viewLabel = 'Glossari';
        else if (state.currentView === 'teoria') viewLabel = 'Temari';
        else if (state.currentView === 'test') viewLabel = 'Test';
        else if (state.currentView === 'flashcards') viewLabel = 'Targetes';
        
        let moduleName = mod.titol || '';
        if(moduleName.length > 20) moduleName = moduleName.substring(0, 18) + '...';

        let moduleLink = `<span>${moduleName}</span>`;
        if (state.currentModuleIndex >= 0 && state.currentModuleIndex < 900) {
            moduleLink = `<a href="#" onclick="window.cambiarVista(${state.currentModuleIndex}, 'teoria'); return false;">${moduleName}</a>`;
        }

        const breadcrumbsHtml = `
            <div class="breadcrumbs">
                <a href="#" onclick="window.tornarAlDashboard(); return false;">Inici</a>
                <span class="breadcrumb-separator">></span>
                ${moduleLink}
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-current">${viewLabel}</span>
            </div>
        `;

        const noteKey = `sicap_notes_${USER.id}_${state.curso.slug}`;
        const savedNote = localStorage.getItem(noteKey) || '';
        const modTitleSafe = mod.titol ? mod.titol.replace(/'/g, "\\'") : 'General';

        const toolsHtml = `
            ${breadcrumbsHtml}
            <div class="sidebar-header"><h3>Eines d'Estudi</h3></div>
            <div class="tools-box">
                <div class="tools-title"><i class="fa-regular fa-note-sticky"></i> Les meves notes</div>
                <textarea id="quick-notes" class="notepad-area" placeholder="Escriu apunts aquí...">${savedNote}</textarea>
                <small style="color:var(--text-secondary); font-size:0.75rem;">Es guarda automàticament.</small>
            </div>
            <div class="tools-box" style="border-color: var(--brand-blue);">
                <div class="tools-title"><i class="fa-regular fa-life-ring"></i> Dubtes del Temari</div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">
                    Tens alguna pregunta sobre <strong>"${mod.titol}"</strong>?
                </p>
                <button class="btn-doubt" onclick="obrirFormulariDubte('${modTitleSafe}')">
                    <i class="fa-regular fa-paper-plane"></i> Enviar Dubte
                </button>
            </div>
        `;
        
        container.innerHTML = toolsHtml;

        const noteArea = document.getElementById('quick-notes');
        if(noteArea) {
            noteArea.addEventListener('input', (e) => {
                localStorage.setItem(noteKey, e.target.value);
            });
        }
    }

    // Modal Duda (Ya definido pero necesario)
    window.obrirFormulariDubte = function(moduloTitulo) {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        titleEl.innerText = "Enviar Dubte";
        titleEl.style.color = "var(--brand-blue)";
        msgEl.innerHTML = `
            <p>Escriu la teva pregunta sobre: <strong>${moduloTitulo}</strong></p>
            <textarea id="modal-doubt-text" class="modal-textarea" placeholder="Explica el teu dubte detalladament..."></textarea>
            <small>El professor rebrà una notificació instantània.</small>
        `;
        btnCancel.style.display = 'block';
        btnConfirm.innerText = "Enviar";
        btnConfirm.disabled = false;
        btnConfirm.style.background = "var(--brand-blue)";
        const newConfirm = btnConfirm.cloneNode(true);
        const newCancel = btnCancel.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        newCancel.onclick = () => modal.style.display = 'none';
        newConfirm.onclick = async () => {
            const text = document.getElementById('modal-doubt-text').value.trim();
            if(!text) return alert("Escriu alguna cosa!");
            newConfirm.innerText = "Enviant...";
            newConfirm.disabled = true;
            try {
                const payload = {
                    data: {
                        missatge: text,
                        tema: moduloTitulo,
                        curs: state.curso.titol,
                        alumne_nom: `${USER.nombre || USER.username} ${USER.apellidos || ''}`,
                        users_permissions_user: USER.id,
                        estat: 'pendent',
                        data_envio: new Date().toISOString()
                    }
                };
                const res = await fetch(`${STRAPI_URL}/api/missatges`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    modal.style.display = 'none';
                    window.mostrarModalError("Dubte enviat correctament! Rebràs la resposta a l'apartat de missatges.");
                } else {
                    throw new Error("Error API");
                }
            } catch(e) {
                console.error(e);
                modal.style.display = 'none';
                window.mostrarModalError("Error al connectar amb el servidor.");
            }
        };
        modal.style.display = 'flex';
    };

    function renderTeoria(container, mod) {
        let html = `<h2>${mod.titol}</h2>`;
        if (mod.resum) html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
        if (mod.material_pdf) {
            const archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
            if(archivos.length > 0) {
                html += `<div class="materials-section"><span class="materials-title">Material Descarregable</span>`;
                archivos.forEach(a => {
                    let pdfUrl = a.url.startsWith('/') ? STRAPI_URL + a.url : a.url;
                    html += `<a href="${pdfUrl}" target="_blank" class="btn-pdf"><i class="fa-solid fa-file-pdf"></i> ${a.name}</a>`;
                });
                html += `</div>`;
            }
        }
        container.innerHTML = html;
    }

    // ------------------------------------------------------------------------
    // FLASHCARDS GAMIFICADAS (FIXED)
    // ------------------------------------------------------------------------
    function renderFlashcards(container, cards) {
        if (!cards || cards.length === 0) { container.innerHTML = '<p>No hi ha targetes.</p>'; return; }
        
        let html = `<h3>Targetes de Repàs (Gamificat)</h3><div class="flashcards-grid-view">`;
        
        // Diccionario de distracciones (palabras penitenciarias típicas para rellenar)
        const distractors = ["Règim", "Junta", "DERT", "Aïllament", "Seguretat", "Infermeria", "Ingrés", "Comunicació", "Especialista", "Jurista", "Educador", "Director", "Reglament", "Funcionari"];

        cards.forEach((card, idx) => {
            // 1. Limpieza de texto (Strapi a veces manda objetos Rich Text)
            let rawResp = card.resposta;
            let answerText = "";
            
            if (typeof rawResp === 'string') answerText = rawResp;
            else if (Array.isArray(rawResp)) answerText = rawResp.map(b => b.children?.map(c => c.text).join('') || '').join(' ');
            else answerText = "Text no disponible";

            // Quitar etiquetas HTML si las hay
            answerText = answerText.replace(/<[^>]*>?/gm, '');

            // 2. Lógica del juego
            let words = answerText.split(" ");
            let targetWord = "";
            let hiddenIndex = -1;

            // Buscar palabra candidata (larga)
            for (let i = 0; i < words.length; i++) {
                // Limpiar puntuación para contar letras
                let cleanWord = words[i].replace(/[.,;]/g, '');
                if (cleanWord.length > 4) {
                    targetWord = words[i]; // Guardamos con puntuación original
                    hiddenIndex = i;
                    break;
                }
            }
            // Si no hay larga, cogemos la última
            if(hiddenIndex === -1 && words.length > 0) {
                targetWord = words[words.length-1];
                hiddenIndex = words.length-1;
            }

            // Crear opciones
            let options = [targetWord];
            // Añadir 2 falsas
            while(options.length < 3) {
                let rand = distractors[Math.floor(Math.random() * distractors.length)];
                if(!options.includes(rand)) options.push(rand);
            }
            options.sort(() => Math.random() - 0.5);

            // HTML de la parte trasera
            let backContent = '';
            if (state.godMode) {
                backContent = `<div style="padding:15px; color:white;">${answerText}</div>`;
            } else {
                // Reconstruir frase con hueco
                let questionText = words.map((w, i) => i === hiddenIndex ? "<b style='color:#ffeb3b'>_______</b>" : w).join(" ");
                
                // Escapar comillas para el onclick
                let targetSafe = targetWord.replace(/'/g, "\\'");
                
                let buttonsHtml = options.map(opt => {
                    let optSafe = opt.replace(/'/g, "\\'");
                    return `<button class="btn-flash-option" onclick="checkFlashcard(this, '${optSafe}', '${targetSafe}')">${opt}</button>`;
                }).join('');

                backContent = `
                    <div class="flashcard-game-container">
                        <p class="flashcard-question-text" style="color:white; font-size:0.95rem;">${questionText}</p>
                        <div class="flashcard-options">${buttonsHtml}</div>
                    </div>
                `;
            }

            html += `<div class="flashcard" onclick="this.classList.toggle('flipped')">
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <h4>Pregunta ${idx + 1}</h4>
                            <div style="padding:10px;">${card.pregunta}</div>
                            <small><i class="fa-solid fa-rotate"></i> Girar</small>
                        </div>
                        <div class="flashcard-back" style="display:flex; align-items:center; justify-content:center;">
                            ${backContent}
                        </div>
                    </div></div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    }

    // Función global para verificar respuesta flashcard
    window.checkFlashcard = function(btn, selected, correct) {
        event.stopPropagation(); 
        const parent = btn.parentElement;
        const buttons = parent.querySelectorAll('.btn-flash-option');
        
        buttons.forEach(b => b.disabled = true);

        if (selected === correct) {
            btn.classList.add('correct');
            btn.innerHTML += ' <i class="fa-solid fa-check"></i>';
        } else {
            btn.classList.add('wrong');
            // Marcar la correcta
            buttons.forEach(b => {
                if (b.innerText === correct) b.classList.add('correct');
            });
        }
    };

    function renderTestIntro(container, mod, modIdx) {
        const progreso = state.progreso.modulos[modIdx] || { aprobado: false, intentos: 0, nota: 0 };
        if (progreso.aprobado) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                    <h2 style="color:green">Mòdul Superat! ✅</h2>
                    <div style="font-size:3rem; margin:20px 0;">${progreso.nota}</div>
                    <div class="btn-centered-container">
                        <button class="btn-primary" onclick="revisarTest(${modIdx}, true)">Veure resultats anteriors</button>
                    </div>
                </div>`;
             return;
        }
        if (progreso.intentos >= 2 && !state.godMode) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;">
                    <h2 style="color:red">Bloquejat ⛔</h2><p>Has esgotat els 2 intents.</p>
                </div>`;
             return;
        }
        container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;">
                <h2>📝 Test d'Avaluació: ${mod.titol}</h2>
                <div class="exam-info-box">
                    <p>✅ <strong>Aprovat:</strong> 70% d'encerts.</p>
                    <p>💾 <strong>Autoguardat:</strong> El progrés es guarda si tanques.</p>
                    <p>🔄 <strong>Intent:</strong> ${progreso.intentos + 1} de 2.</p>
                </div>
                <br>
                <div class="btn-centered-container">
                    <button class="btn-primary" onclick="iniciarTest()">COMENÇAR EL TEST</button>
                </div>
            </div>`;
    }

    window.iniciarTest = function() { state.testEnCurso = true; renderMainContent(); }

    // ------------------------------------------------------------------------
    // MODO PROFESOR EN TEST (AUTO-RESPONDER)
    // ------------------------------------------------------------------------
    function renderTestQuestions(container, mod, modIdx) {
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; 
        gridRight.className = 'grid-container'; 
        
        mod.preguntes.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'grid-item'; div.id = `grid-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-q-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`q-${i}`] !== undefined) div.classList.add('answered');
            gridRight.appendChild(div);
        });

        let html = `<h3>Test en Curs...</h3>`;
        
        mod.preguntes.forEach((preg, idx) => {
            const qId = `q-${idx}`; 
            
            // LÓGICA MODO PROFESOR (Auto-seleccionar)
            if (state.godMode && state.respuestasTemp[qId] === undefined) {
                // Busca la opción correcta (soporta varios nombres de campo)
                const correctIdx = preg.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true);
                if (correctIdx !== -1) {
                    state.respuestasTemp[qId] = correctIdx;
                    // Actualizar grid
                    setTimeout(() => {
                        const gridItem = document.getElementById(`grid-q-${idx}`);
                        if(gridItem) gridItem.classList.add('answered');
                    }, 0);
                }
            }

            const savedVal = state.respuestasTemp[qId];

            html += `<div class="question-card" id="card-${qId}">
                    <div class="q-header">Pregunta ${idx + 1}</div>
                    <div class="q-text">${preg.text}</div>
                    <div class="options-list">`;
            
            preg.opcions.forEach((opt, oIdx) => {
                const isSelected = (savedVal == oIdx) ? 'selected' : ''; 
                const checked = (savedVal == oIdx) ? 'checked' : '';
                
                html += `<div class="option-item ${isSelected}" onclick="selectTestOption('${qId}', ${oIdx}, 'test_mod_${modIdx}')">
                        <input type="radio" name="${qId}" value="${oIdx}" ${checked}>
                        <span>${opt.text}</span>
                    </div>`;
            });
            html += `</div></div>`;
        });

        const btnText = state.godMode ? "⚡ PROFESSOR: ENTREGAR ARA" : "FINALITZAR I ENTREGAR";
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarTest(${modIdx})">${btnText}</button></div>`;
        
        container.innerHTML = html;
        window.currentQuestions = mod.preguntes; 
    }

    window.selectTestOption = function(qId, valIdx, storageKeyType) {
        state.respuestasTemp[qId] = valIdx;
        const card = document.getElementById(`card-${qId}`);
        if(card) {
            card.querySelectorAll('.option-item').forEach((el, idx) => {
                if (idx === valIdx) { el.classList.add('selected'); el.querySelector('input').checked = true; } 
                else { el.classList.remove('selected'); el.querySelector('input').checked = false; }
            });
        }
        const gridIdx = qId.split('-')[1]; 
        let gridItemId = storageKeyType === 'examen_final' ? `grid-final-q-${gridIdx}` : `grid-q-${gridIdx}`;
        const gridItem = document.getElementById(gridItemId);
        if(gridItem) gridItem.classList.add('answered');
        guardarRespuestaLocal(storageKeyType, qId, valIdx);
    }

    window.entregarTest = function(modIdx) {
        window.mostrarModalConfirmacion("Entregar Test", "Estàs segur?", async () => {
            document.getElementById('custom-modal').style.display = 'none';
            const preguntas = window.currentQuestions;
            let aciertos = 0;
            preguntas.forEach((preg, idx) => {
                const userRes = state.respuestasTemp[`q-${idx}`];
                // Soporte robusto para nombre del campo
                const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true);
                if (userRes == correctaIdx) aciertos++;
            });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2));
            const aprobado = nota >= 7.0;
            if (!state.progreso.modulos) state.progreso.modulos = [];
            if (!state.progreso.modulos[modIdx]) state.progreso.modulos[modIdx] = { intentos: 0, nota: 0, aprobado: false };
            const p = state.progreso;
            p.modulos[modIdx].intentos += 1;
            p.modulos[modIdx].nota = Math.max(p.modulos[modIdx].nota, nota);
            if (aprobado) p.modulos[modIdx].aprobado = true;
            await guardarProgreso(p);
            limpiarRespuestasLocales(`test_mod_${modIdx}`);
            state.testEnCurso = false;
            document.body.classList.remove('exam-active');
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, modIdx, false);
        });
    }

    function mostrarFeedback(preguntas, respuestasUsuario, nota, aprobado, modIdx, esFinal) {
        const container = document.getElementById('moduls-container');
        const color = aprobado ? 'green' : 'red';
        const titulo = aprobado ? (esFinal ? 'EXAMEN FINAL SUPERAT!' : 'Test Superat!') : 'No Superat';
        let html = `<div class="dashboard-card" style="border-top:5px solid ${color}; text-align:center; margin-bottom:30px;">
                <h2 style="color:${color}">${titulo}</h2>
                <div style="font-size:4rem; font-weight:bold; margin:10px 0;">${nota}</div>
                <div class="btn-centered-container">
                    <button class="btn-primary" onclick="window.cambiarVista(${esFinal ? 999 : modIdx}, '${esFinal ? 'examen_final' : 'test'}')">Continuar</button>
                </div>
            </div><h3>Revisió de Respostes:</h3>`;
        
        preguntas.forEach((preg, idx) => {
            const qId = esFinal ? `final-${idx}` : `q-${idx}`;
            const userRes = respuestasUsuario[qId];
            const cardId = esFinal ? `card-final-${idx}` : `card-q-${idx}`;
            
            html += `<div class="question-card review-mode" id="${cardId}">
                        <div class="q-header">Pregunta ${idx + 1}</div>
                        <div class="q-text">${preg.text}</div>
                        <div class="options-list">`;
            
            preg.opcions.forEach((opt, oIdx) => {
                let classes = 'option-item ';
                const isCorrect = opt.esCorrecta === true || opt.isCorrect === true || opt.correct === true;
                
                if (isCorrect) classes += 'correct-answer ';
                if (userRes == oIdx) { 
                    classes += 'selected '; 
                    if (!isCorrect) classes += 'user-wrong '; 
                }
                
                html += `<div class="${classes}">
                            <input type="radio" ${userRes == oIdx ? 'checked' : ''} disabled>
                            <span>${opt.text}</span>
                         </div>`;
            });
            
            if (preg.explicacio) html += `<div class="explanation-box"><strong><i class="fa-solid fa-circle-info"></i> Explicació:</strong><br>${parseStrapiRichText(preg.explicacio)}</div>`;
            html += `</div></div>`;
        });
        
        container.innerHTML = html;
        window.scrollTo(0,0);
    }

    function renderExamenFinal(container) {
        if (!state.progreso.examen_final) state.progreso.examen_final = { aprobado: false, nota: 0, intentos: 0 };
        const finalData = state.progreso.examen_final;
        if (finalData.aprobado) {
             let puedeDescargar = true; let mensajeFecha = '';
             if (state.curso.data_fi) {
                 const fechaFin = new Date(state.curso.data_fi); const hoy = new Date();
                 if (hoy < fechaFin) { puedeDescargar = false; mensajeFecha = `El certificat estarà disponible a partir del: <strong>${fechaFin.toLocaleDateString('ca-ES')}</strong>.`; }
             }
             let botonHtml = puedeDescargar ? `<button class="btn-primary" onclick="imprimirDiploma('${finalData.nota}')">Descarregar Diploma</button>` : `<div class="alert-info" style="margin-top:15px; color:#856404; background:#fff3cd; padding:10px; border-radius:4px;"><i class="fa-solid fa-clock"></i> ${mensajeFecha}</div>`;
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;"><h1 style="color:green;">🎉 ENHORABONA!</h1><p>Curs Completat.</p><div style="font-size:3.5rem; font-weight:bold; margin:20px 0; color:var(--brand-blue);">${finalData.nota}</div><div class="btn-centered-container">${botonHtml}</div></div>`;
             return;
        }
        if (finalData.intentos >= 2 && !state.godMode) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;"><h2 style="color:red">🚫 Bloquejat</h2><p>Has esgotat els 2 intents.</p><div class="btn-centered-container"><button class="btn-primary" onclick="window.location.href='mailto:sicap@sicap.cat'">Contactar Secretaria</button></div></div>`;
             return;
        }
        const savedData = cargarRespuestasLocales('examen_final');
        const isActive = (Object.keys(savedData).length > 0) || state.testEnCurso;
        if (isActive) { state.testEnCurso = true; renderFinalQuestions(container, savedData); } 
        else { container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;"><h2 style="color:var(--brand-blue);">🏆 Examen Final</h2><div class="exam-info-box"><p>⏱️ <strong>Temps:</strong> 30 minuts (Compte enrere).</p><p>🎯 <strong>Nota tall:</strong> 7.5 (75%).</p><p>⚠️ <strong>Intents:</strong> ${finalData.intentos + 1} de 2.</p></div><br><div class="btn-centered-container"><button class="btn-primary" onclick="iniciarExamenFinal()">COMENÇAR EXAMEN FINAL</button></div></div>`; }
    }

    window.iniciarExamenFinal = function() {
        if (!state.curso.examen_final || state.curso.examen_final.length === 0) { alert("Error: No s'han carregat preguntes."); return; }
        state.preguntasExamenFinal = [...state.curso.examen_final].sort(() => 0.5 - Math.random());
        const orderIds = state.preguntasExamenFinal.map(p => p.id || p.documentId); 
        localStorage.setItem(`sicap_exam_order_${USER.id}_${SLUG}`, JSON.stringify(orderIds));
        state.testEnCurso = true; state.testStartTime = Date.now(); 
        localStorage.setItem(`sicap_timer_start_${USER.id}_${SLUG}`, state.testStartTime);
        state.respuestasTemp = {}; renderExamenFinal(document.getElementById('moduls-container'));
    }

    function renderFinalQuestions(container, savedData) {
        const storedOrder = JSON.parse(localStorage.getItem(`sicap_exam_order_${USER.id}_${SLUG}`));
        if (storedOrder && state.curso.examen_final) {
             state.preguntasExamenFinal = [];
             storedOrder.forEach(id => { const found = state.curso.examen_final.find(p => (p.id || p.documentId) === id); if(found) state.preguntasExamenFinal.push(found); });
             if(state.preguntasExamenFinal.length === 0) state.preguntasExamenFinal = state.curso.examen_final;
        } else if (state.preguntasExamenFinal.length === 0) { state.preguntasExamenFinal = state.curso.examen_final; }
        
        const storedStartTime = localStorage.getItem(`sicap_timer_start_${USER.id}_${SLUG}`);
        if(storedStartTime) state.testStartTime = parseInt(storedStartTime);
        else { state.testStartTime = Date.now(); localStorage.setItem(`sicap_timer_start_${USER.id}_${SLUG}`, state.testStartTime); }
        
        const gridRight = document.getElementById('quiz-grid'); gridRight.className = ''; 
        gridRight.innerHTML = `<div id="exam-timer-container"><div id="exam-timer" class="timer-box">30:00</div></div><div id="grid-inner-numbers"></div>`;
        iniciarCronometro();
        
        const gridInner = document.getElementById('grid-inner-numbers');
        state.preguntasExamenFinal.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-final-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-final-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`final-${i}`] !== undefined || (savedData && savedData[`final-${i}`] !== undefined)) div.classList.add('answered');
            gridInner.appendChild(div);
        });
        
        if(savedData) state.respuestasTemp = savedData;
        
        if (state.godMode) {
            state.preguntasExamenFinal.forEach((p, i) => {
                if (state.respuestasTemp[`final-${i}`] === undefined) {
                    const correctIdx = p.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true);
                    if(correctIdx !== -1) state.respuestasTemp[`final-${i}`] = correctIdx;
                }
            });
        }

        let html = `<h3 style="color:var(--brand-red);">Examen Final en Curs...</h3>`;
        state.preguntasExamenFinal.forEach((preg, idx) => {
            const qId = `final-${idx}`; const userRes = state.respuestasTemp[qId];
            html += `<div class="question-card" id="card-final-${idx}"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text" style="margin-top:10px;">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                const checked = (userRes == oIdx) ? 'checked' : ''; const selected = (userRes == oIdx) ? 'selected' : '';
                html += `<div class="option-item ${selected}" onclick="selectTestOption('${qId}', ${oIdx}, 'examen_final')"><input type="radio" name="${qId}" value="${oIdx}" ${checked}><span>${opt.text}</span></div>`;
            });
            html += `</div></div>`;
        });
        
        const btnText = state.godMode ? "⚡ PROFESSOR: ENTREGAR EXAMEN ARA" : "ENTREGAR EXAMEN FINAL";
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarExamenFinal()">${btnText}</button></div>`;
        container.innerHTML = html;
        window.currentQuestions = state.preguntasExamenFinal;
    }

    function iniciarCronometro() {
        const display = document.getElementById('exam-timer'); if(!display) return;
        const LIMIT_MS = 30 * 60 * 1000;
        clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            const now = Date.now(); const elapsed = now - state.testStartTime; const remaining = LIMIT_MS - elapsed;
            if (remaining <= 0) { detenerCronometro(); display.innerText = "00:00"; alert("S'ha acabat el temps!"); entregarExamenFinal(true); return; }
            const min = Math.floor(remaining / 60000); const sec = Math.floor((remaining % 60000) / 1000);
            display.innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
            if(min < 5) display.classList.add('warning'); if(min < 1) display.classList.add('danger');
        }, 1000);
    }
    function detenerCronometro() { clearInterval(state.timerInterval); }

    window.entregarExamenFinal = function(forzado = false) {
        const doDelivery = async () => {
            detenerCronometro();
            const preguntas = window.currentQuestions;
            let aciertos = 0;
            preguntas.forEach((preg, idx) => {
                const qId = `final-${idx}`; const userRes = state.respuestasTemp[qId];
                const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true);
                if (userRes == correctaIdx) aciertos++;
            });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2));
            const aprobado = nota >= 7.5; 
            state.progreso.examen_final.intentos += 1;
            state.progreso.examen_final.nota = Math.max(state.progreso.examen_final.nota, nota);
            if (aprobado) state.progreso.examen_final.aprobado = true;
            const payload = { data: { progres_detallat: state.progreso } };
            if (aprobado) { payload.data.estat = 'completat'; payload.data.nota_final = nota; }
            await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload)
            });
            limpiarRespuestasLocales('examen_final');
            state.testEnCurso = false; document.body.classList.remove('exam-active');
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, 999, true);
        };
        if(forzado) { doDelivery(); } 
        else { window.mostrarModalConfirmacion("Entregar Examen", "Segur que vols entregar?", () => { document.getElementById('custom-modal').style.display = 'none'; doDelivery(); }); }
    }

    window.imprimirDiploma = function(nota) {
        const nombreCurso = state.curso.titol; const fechaHoy = new Date().toLocaleDateString('ca-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const alumno = USER; const nombreAlumno = `${alumno.nombre} ${alumno.apellidos || ''}`.toUpperCase();
        const ventana = window.open('', '_blank');
        ventana.document.write(`<!DOCTYPE html><html><head><title>Diploma Oficial</title><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Roboto:wght@400;500&display=swap" rel="stylesheet"><style>@page { size: A4 landscape; margin: 0; } body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; background: white; font-family: 'Roboto', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { width: 95%; height: 95%; position: relative; border: 1px solid #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; } .border-deco { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 3px solid #004B87; outline: 5px double #E30613; outline-offset: -10px; z-index: 0; } .content-layer { z-index: 10; position: relative; width: 80%; } .logo { width: 180px; margin-bottom: 20px; } h1 { font-family: 'Playfair Display', serif; font-size: 36pt; color: #004B87; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; } .subtitle { font-size: 14pt; color: #666; margin: 0; } .student { font-size: 24pt; font-weight: bold; margin: 20px auto; border-bottom: 2px solid #333; display: inline-block; padding: 0 40px; min-width: 400px; } .dni { font-size: 11pt; color: #555; margin-bottom: 20px; } .course-intro { font-size: 14pt; color: #333; } .course-name { font-size: 20pt; font-weight: bold; color: #E30613; margin: 10px 0 30px 0; } .meta { font-size: 11pt; color: #444; margin-bottom: 40px; } .signatures { display: flex; justify-content: space-between; margin-top: 20px; padding: 0 50px; } .sig-box { text-align: center; width: 220px; } .sig-line { border-top: 1px solid #333; margin-bottom: 5px; } .sig-role { font-size: 9pt; font-weight: bold; color: #004B87; text-transform: uppercase; } </style></head><body><div class="page"><div class="border-deco"></div><div class="content-layer"><img src="img/logo-sicap.png" class="logo" alt="SICAP"><h1>Certificat d'Aprofitament</h1><p class="subtitle">El Sindicat Català de Presons (SICAP) certifica que</p><div class="student">${nombreAlumno}</div><div class="dni">amb DNI/NIF: <strong>${alumno.username}</strong></div><p class="course-intro">Ha superat satisfactòriament l'acció formativa:</p><div class="course-name">${nombreCurso}</div><p class="meta">Nota Final: <strong>${nota}</strong> &nbsp;|&nbsp; Data d'expedició: <strong>${fechaHoy}</strong></p><div class="signatures"><div class="sig-box"><div style="height:40px;"></div><div class="sig-line"></div><div class="sig-role">Secretari General</div></div><div class="sig-box"><div style="height:40px;"></div><div class="sig-line"></div><div class="sig-role">Secretari de Formació</div></div></div></div></div><script>window.onload = function() { setTimeout(() => window.print(), 500); }</script></body></html>`);
        ventana.document.close();
    };
});