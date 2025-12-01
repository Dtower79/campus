document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. HELPER: TRADUCTOR DE TEXTO
    // ------------------------------------------------------------------------
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        
        const extractText = (nodes) => {
            if (!nodes) return "";
            if (typeof nodes === "string") return nodes;
            if (Array.isArray(nodes)) return nodes.map(extractText).join("");
            
            if (nodes.type === "text") {
                let text = nodes.text || "";
                if (nodes.bold) text = `<strong>${text}</strong>`;
                if (nodes.italic) text = `<em>${text}</em>`;
                if (nodes.underline) text = `<u>${text}</u>`;
                if (nodes.strikethrough) text = `<strike>${text}</strike>`;
                return text;
            }
            if (nodes.type === "link") return `<a href="${nodes.url}" target="_blank">${extractText(nodes.children)}</a>`;
            if (nodes.children) return extractText(nodes.children);
            return "";
        };

        if (Array.isArray(content)) {
            return content.map(block => {
                const text = extractText(block.children);
                if (block.type === 'heading') return `<h${block.level || 3}>${text}</h${block.level || 3}>`;
                if (block.type === 'list') {
                    const tag = block.format === 'ordered' ? 'ol' : 'ul';
                    const items = block.children.map(li => `<li>${extractText(li)}</li>`).join('');
                    return `<${tag}>${items}</${tag}>`;
                }
                if (block.type === 'quote') return `<blockquote>${text}</blockquote>`;
                return `<p>${text}</p>`;
            }).join('');
        }
        return JSON.stringify(content);
    }

    // ------------------------------------------------------------------------
    // 2. CONFIGURACIÓN Y ESTADO
    // ------------------------------------------------------------------------
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');

    if (!SLUG) return; 

    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    if (!USER || !TOKEN) {
        window.location.href = 'index.html';
        return;
    }

    let state = {
        matriculaId: null,
        curso: null,
        progreso: {},
        currentModuleIndex: -1,
        currentView: 'intro',   
        respuestasTemp: {},
        testStartTime: 0,
        testEnCurso: false,
        godMode: false,
        preguntasExamenFinal: [],
        timerInterval: null
    };

    // UI Inicial
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'flex';
    document.getElementById('app-footer').style.display = 'block';

    if(!document.getElementById('scroll-top-btn')) {
        const btn = document.createElement('button');
        btn.id = 'scroll-top-btn';
        btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        btn.onclick = () => window.scrollTo({top: 0, behavior: 'smooth'});
        document.body.appendChild(btn);
        window.onscroll = () => { btn.style.display = (document.body.scrollTop > 300) ? "flex" : "none"; };
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
            if(container) container.innerHTML = `<div class="alert alert-danger" style="color:red; padding:20px;">Error: ${e.message}</div>`;
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

        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const json = await res.json();
        if (!json.data || json.data.length === 0) throw new Error("No s'ha trobat la matrícula o el curs.");
        
        const mat = json.data[0];
        state.matriculaId = mat.documentId || mat.id;
        state.curso = mat.curs;
        if (!state.curso.moduls) state.curso.moduls = [];
        state.progreso = mat.progres_detallat || {};
    }

    async function inicializarProgresoEnStrapi() {
        const modulos = state.curso.moduls || [];
        const nuevoProgreso = {
            modulos: modulos.map(() => ({ aprobado: false, nota: 0, intentos: 0, flashcards_done: false })),
            examen_final: { aprobado: false, nota: 0, intentos: 0 }
        };
        await guardarProgreso(nuevoProgreso);
    }

    async function guardarProgreso(progresoObj) {
        let totalModulos = state.curso.moduls ? state.curso.modulos.length : 0;
        let aprobados = 0;
        if (progresoObj.modulos) aprobados = progresoObj.modulos.filter(m => m.aprobado).length;
        let porcentaje = totalModulos > 0 ? Math.round((aprobados / totalModulos) * 100) : 0;
        if (progresoObj.examen_final && progresoObj.examen_final.aprobado) porcentaje = 100;

        const payload = { data: { progres_detallat: progresoObj, progres: porcentaje } };
        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });
        state.progreso = progresoObj;
        renderSidebar(); 
    }

    // --- Helpers LocalStorage ---
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

    // --- Persistencia Flashcards (Local) ---
    function getFlippedCards(modIdx) {
        const key = `sicap_flipped_${USER.id}_${state.curso.slug}_mod_${modIdx}`;
        return JSON.parse(localStorage.getItem(key)) || [];
    }
    function addFlippedCard(modIdx, cardIdx) {
        const key = `sicap_flipped_${USER.id}_${state.curso.slug}_mod_${modIdx}`;
        let current = getFlippedCards(modIdx);
        // Guardamos que esta tarjeta se ha intentado
        if (!current.includes(cardIdx)) {
            current.push(cardIdx);
            localStorage.setItem(key, JSON.stringify(current));
        }
        return current.length;
    }

    // ------------------------------------------------------------------------
    // 3. LÓGICA DE BLOQUEO (REVISADA)
    // ------------------------------------------------------------------------
    function estaBloqueado(indexModulo) {
        if (state.godMode) return false;
        if (indexModulo === 0) return false; 
        
        // Revisar el módulo ANTERIOR
        const prevIdx = indexModulo - 1;
        const prevProgreso = state.progreso.modulos ? state.progreso.modulos[prevIdx] : null;
        const prevModuloData = state.curso.moduls[prevIdx];

        if (!prevProgreso) return true; // Si no hay datos, bloqueado

        // Requisitos: Test Aprobado
        const testOk = prevProgreso.aprobado === true;
        
        // Requisitos: Flashcards (solo si el módulo tiene)
        const tieneFlashcards = prevModuloData && prevModuloData.targetes_memoria && prevModuloData.targetes_memoria.length > 0;
        const flashcardsOk = tieneFlashcards ? (prevProgreso.flashcards_done === true) : true;

        // Si alguno falla, está bloqueado
        return !(testOk && flashcardsOk);
    }

    function puedeHacerExamenFinal() {
        if (state.godMode) return true; 
        if (!state.progreso.modulos) return false;
        // Revisar TODOS los módulos
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
        renderSidebar();
        renderMainContent();
        window.scrollTo(0,0);
        
        setTimeout(() => {
            const activeItem = document.querySelector('.sidebar-subitem.active');
            if(activeItem) {
                const parentGroup = activeItem.closest('.sidebar-module-group');
                if(parentGroup) parentGroup.classList.add('open');
            }
        }, 100);
    }

    // ------------------------------------------------------------------------
    // RENDER SIDEBAR
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
        
        // Intro
        const isIntroActive = state.currentModuleIndex === -1;
        html += `<div class="sidebar-module-group ${isIntroActive ? 'open' : ''}">
            <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                <span><i class="fa-solid fa-circle-info"></i> Informació General</span>
            </div>
            <div class="sidebar-sub-menu">
                ${renderSubLink(-1, 'intro', '📄 Programa del curs', false, true)}
            </div>
        </div>`;

        // Módulos
        const modulosSeguros = state.curso.moduls || [];
        if (modulosSeguros.length === 0) {
            html += `<div style="padding:15px; color:#666; font-style:italic;">No hi ha mòduls definits.</div>`;
        } else {
            modulosSeguros.forEach((mod, idx) => {
                const isLocked = estaBloqueado(idx);
                const modProgreso = state.progreso.modulos ? state.progreso.modulos[idx] : null;
                
                // Lógica checks
                const tieneFlash = mod.targetes_memoria && mod.targetes_memoria.length > 0;
                const flashDone = modProgreso ? modProgreso.flashcards_done : false;
                const testDone = modProgreso ? modProgreso.aprobado : false;
                
                const moduloCompleto = tieneFlash ? (testDone && flashDone) : testDone;
                const check = moduloCompleto ? '<i class="fa-solid fa-check" style="color:green"></i>' : '';
                
                const isOpen = (state.currentModuleIndex === idx);
                
                // CLASE DE BLOQUEO EN EL GRUPO PRINCIPAL
                const lockedClass = (isLocked && !state.godMode) ? 'locked-module' : '';
                const openClass = isOpen ? 'open' : '';

                html += `<div class="sidebar-module-group ${lockedClass} ${openClass}">
                        <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                            <span><i class="fa-regular fa-folder-open"></i> ${mod.titol} ${check}</span>
                        </div>
                        <div class="sidebar-sub-menu">`;
                
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

                if (tieneFlash) {
                    const fCheck = flashDone ? '✓' : '';
                    html += renderSubLink(idx, 'flashcards', `🔄 Targetes de Repàs ${fCheck}`, isLocked);
                }
                
                const intentos = modProgreso ? modProgreso.intentos : 0;
                const tCheck = testDone ? '✓' : '';
                html += renderSubLink(idx, 'test', `📝 Test Avaluació ${tCheck} (${intentos}/2)`, isLocked);
                html += `</div></div>`;
            });
        }

        // Extras
        const isGlossaryActive = state.currentModuleIndex === 1000;
        html += `<div class="sidebar-module-group ${isGlossaryActive ? 'open' : ''}" style="border-top:1px solid #eee; margin-top:10px;">
            <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                <span><i class="fa-solid fa-book-bookmark"></i> Recursos</span>
            </div>
            <div class="sidebar-sub-menu">
                ${renderSubLink(1000, 'glossary', '📚 Glossari de Termes', false, true)}
            </div>
        </div>`;

        // Examen Final
        const finalIsLocked = !puedeHacerExamenFinal(); 
        const isFinalActive = state.currentModuleIndex === 999;
        const lockedFinalClass = (finalIsLocked && !state.godMode) ? 'locked-module' : '';
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

    function renderSubLink(modIdx, viewName, label, locked, isSpecial = false) {
        const reallyLocked = locked && !state.godMode;
        let isActive = (String(state.currentModuleIndex) === String(modIdx) && state.currentView === viewName);
        const activeClass = isActive ? 'active' : '';
        const specialClass = isSpecial ? 'special-item' : '';
        const clickFn = reallyLocked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;
        return `<div class="sidebar-subitem ${activeClass} ${specialClass}" onclick="${clickFn}">${label}</div>`;
    }

    // ------------------------------------------------------------------------
    // RENDER MAIN CONTENT
    // ------------------------------------------------------------------------
    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; gridRight.className = ''; 
        detenerCronometro(); 
        document.body.classList.remove('exam-active');

        if (state.currentView === 'intro') {
            container.innerHTML = `<h2><i class="fa-solid fa-book-open"></i> Programa del Curs</h2><div class="module-content-text" style="margin-top:20px;">${parseStrapiRichText(state.curso.descripcio || "Descripció no disponible.")}</div>`;
            renderSidebarTools(gridRight, { titol: 'Programa' }); return;
        }
        if (state.currentView === 'glossary') {
            const contenidoGlossari = state.curso.glossari ? parseStrapiRichText(state.curso.glossari) : "<p>No hi ha entrades al glossari.</p>";
            container.innerHTML = `<h2><i class="fa-solid fa-spell-check"></i> Glossari de Termes</h2><div class="dashboard-card" style="margin-top:20px;"><div class="module-content-text">${contenidoGlossari}</div></div>`;
            renderSidebarTools(gridRight, { titol: 'Glossari' }); return;
        }
        if (state.currentView === 'examen_final') {
            renderExamenFinal(container); return;
        }

        const modulos = state.curso.moduls || [];
        const mod = modulos[state.currentModuleIndex];
        if (!mod) { container.innerHTML = `<div class="alert alert-warning">Mòdul no trobat.</div>`; return; }
        
        if (state.currentView === 'teoria') {
            renderTeoria(container, mod);
            renderSidebarTools(gridRight, mod); 
        }
        else if (state.currentView === 'flashcards') {
            renderFlashcards(container, mod.targetes_memoria, state.currentModuleIndex);
            renderSidebarTools(gridRight, mod); 
        }
        else if (state.currentView === 'test') {
            const savedData = cargarRespuestasLocales(`test_mod_${state.currentModuleIndex}`);
            const hayDatosGuardados = Object.keys(savedData).length > 0;
            const moduloAprobado = state.progreso.modulos[state.currentModuleIndex] ? state.progreso.modulos[state.currentModuleIndex].aprobado : false;
            
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

    // Sidebar Derecha (Breadcrumbs + Notas)
    function renderSidebarTools(container, mod) {
        let breadcrumbs = [];
        breadcrumbs.push(`<a href="#" onclick="window.tornarAlDashboard(); return false;">Inici</a>`);
        if (state.currentView === 'intro') breadcrumbs.push(`<span class="breadcrumb-current">Programa del Curs</span>`);
        else if (state.currentView === 'glossary') breadcrumbs.push(`<span class="breadcrumb-current">Glossari</span>`);
        else if (state.currentView === 'examen_final') breadcrumbs.push(`<span class="breadcrumb-current">Examen Final</span>`);
        else {
            let moduleName = mod.titol || 'Mòdul';
            if(moduleName.length > 25) moduleName = moduleName.substring(0, 22) + '...';
            breadcrumbs.push(`<a href="#" onclick="window.cambiarVista(${state.currentModuleIndex}, 'teoria'); return false;">${moduleName}</a>`);
            let subSection = '';
            if (state.currentView === 'teoria') subSection = 'Temari';
            if (state.currentView === 'test') subSection = 'Test Avaluació';
            if (state.currentView === 'flashcards') subSection = 'Targetes';
            breadcrumbs.push(`<span class="breadcrumb-current">${subSection}</span>`);
        }
        const breadcrumbsHtml = `<div class="breadcrumbs">${breadcrumbs.join('<span class="breadcrumb-separator"><i class="fa-solid fa-angle-right"></i></span>')}</div>`;
        const noteKey = `sicap_notes_${USER.id}_${state.curso.slug}`;
        const savedNote = localStorage.getItem(noteKey) || '';
        const modTitleSafe = mod && mod.titol ? mod.titol.replace(/'/g, "\\'") : 'General';
        container.innerHTML = `${breadcrumbsHtml}<div class="sidebar-header"><h3>Eines d'Estudi</h3></div><div class="tools-box"><div class="tools-title"><i class="fa-regular fa-note-sticky"></i> Les meves notes</div><textarea id="quick-notes" class="notepad-area" placeholder="Escriu apunts aquí...">${savedNote}</textarea><small style="color:var(--text-secondary); font-size:0.75rem;">Es guarda automàticament.</small></div><div class="tools-box" style="border-color: var(--brand-blue);"><div class="tools-title"><i class="fa-regular fa-life-ring"></i> Dubtes del Temari</div><p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">Tens alguna pregunta sobre <strong>"${mod ? mod.titol : 'aquí'}"</strong>?</p><button class="btn-doubt" onclick="obrirFormulariDubte('${modTitleSafe}')"><i class="fa-regular fa-paper-plane"></i> Enviar Dubte</button></div>`;
        const noteArea = document.getElementById('quick-notes');
        if(noteArea) noteArea.addEventListener('input', (e) => localStorage.setItem(noteKey, e.target.value));
    }

    // ------------------------------------------------------------------------
    // FLASHCARDS (SOLUCIÓN DEFINITIVA)
    // ------------------------------------------------------------------------
    function renderFlashcards(container, cards, modIdx) {
        if (!cards || cards.length === 0) { container.innerHTML = '<p>No hi ha targetes.</p>'; return; }
        
        // 1. Verificar base de datos (VERDAD ABSOLUTA)
        const isCompletedDB = state.progreso.modulos[modIdx].flashcards_done === true;
        
        // 2. Verificar progreso local actual
        const flippedIndices = getFlippedCards(modIdx);
        
        // Si la DB dice que está completado, lo forzamos visualmente
        const isReallyCompleted = isCompletedDB || (flippedIndices.length >= cards.length);

        // Header Mensaje
        let headerHtml = `<h3>Targetes de Repàs (Gamificat)</h3>`;
        if(isReallyCompleted) {
            headerHtml += `<div class="alert-info" style="margin-bottom:15px; color:green; background:#d4edda; border:1px solid #c3e6cb; padding:15px; border-radius:4px;">
                <i class="fa-solid fa-check-circle"></i> <strong>Activitat Completada!</strong>
                <br><small>Ja pots accedir al següent mòdul (si has aprovat el test).</small>
            </div>`;
        } else {
            const count = flippedIndices.length;
            const total = cards.length;
            headerHtml += `<div class="alert-info" style="margin-bottom:15px; color:#856404; background:#fff3cd; border:1px solid #ffeeba; padding:10px; border-radius:4px;">
                <i class="fa-solid fa-circle-exclamation"></i> Progrés: <strong>${count}/${total}</strong> targetes contestades. Has de fer-les totes per avançar.
            </div>`;
        }

        let html = `${headerHtml}<div class="flashcards-grid-view">`;
        const distractors = ["Règim", "Junta", "DERT", "Aïllament", "Seguretat", "Infermeria", "Ingrés", "Comunicació", "Especialista", "Jurista", "Educador", "Director", "Reglament", "Funcionari"];

        cards.forEach((card, idx) => {
            // Verificar si esta tarjeta ya fue hecha
            const isDone = isReallyCompleted || flippedIndices.includes(idx) || state.godMode;
            const flipClass = isDone ? 'flipped' : '';

            // Texto
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

            // Back Content
            let backContent = '';
            
            if (isDone) {
                // Si ya está hecha, mostramos la solución directamente
                backContent = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
                        <i class="fa-solid fa-check-circle" style="font-size:2.5rem; color:#fff; margin-bottom:10px;"></i>
                        <p style="font-size:1rem; color:white; font-weight:bold;">${answerText}</p>
                    </div>`;
            } else {
                // Juego activo
                let questionText = words.map((w, i) => i === hiddenIndex ? `<span class="cloze-blank">_______</span>` : w).join(" ");
                let buttonsHtml = options.map(opt => {
                    let optSafe = opt.replace(/'/g, "\\'");
                    let targetSafe = targetClean.replace(/'/g, "\\'");
                    return `<button class="btn-flash-option" onclick="checkFlashcard(this, '${optSafe}', '${targetSafe}', ${idx}, ${modIdx})">${opt}</button>`;
                }).join('');
                backContent = `<div class="flashcard-game-container"><div class="flashcard-question-text">${questionText}</div><div class="flashcard-options">${buttonsHtml}</div></div>`;
            }

            // Click solo gira si NO está completada ya (para evitar re-jugar lo ganado)
            const clickAttr = isDone ? '' : `onclick="handleFlip(this)"`; 

            html += `<div class="flashcard ${flipClass}" ${clickAttr}>
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <h4>Targeta ${idx + 1}</h4>
                            <div class="flashcard-front-text">${card.pregunta}</div>
                            <small>${isDone ? '✅ Completada' : '<i class="fa-solid fa-rotate"></i> Clic per jugar'}</small>
                        </div>
                        <div class="flashcard-back">${backContent}</div>
                    </div></div>`;
        });
        html += `</div>`;
        
        // BOTÓN FORZAR (Si acaso falla algo automático)
        if(isReallyCompleted && !isCompletedDB) {
             // Si localmente está acabado pero DB dice que no, forzamos actualización
             console.log("Detectado completado local, sincronizando...");
             actualizarProgresoFlashcards(modIdx);
        }

        container.innerHTML = html;
    }

    // Solo efecto visual
    window.handleFlip = function(cardElement) {
        if (!cardElement.classList.contains('flipped')) {
            cardElement.classList.add('flipped');
        }
    }

    // Comprobar respuesta
    window.checkFlashcard = function(btn, selected, correct, cardIdx, modIdx) {
        event.stopPropagation();
        
        // 1. Guardar que se ha intentado esta carta (Localmente)
        const totalCards = state.curso.modulos[modIdx].targetes_memoria.length;
        const count = addFlippedCard(modIdx, cardIdx);
        
        const container = btn.closest('.flashcard-game-container');
        const blankSpan = container.querySelector('.cloze-blank');
        const buttons = container.querySelectorAll('.btn-flash-option');
        
        buttons.forEach(b => b.disabled = true);

        // Feedback Visual
        if (selected === correct) {
            btn.classList.add('correct');
            blankSpan.innerText = selected;
            blankSpan.classList.remove('cloze-blank');
            blankSpan.classList.add('cloze-blank', 'filled-correct');
            btn.innerHTML = `✅ ${btn.innerText}`;
        } else {
            btn.classList.add('wrong');
            blankSpan.innerText = selected;
            blankSpan.classList.add('filled-wrong');
            btn.innerHTML = `❌ ${btn.innerText}`;
        }

        // 2. Comprobar si hemos terminado TODAS
        if (count >= totalCards) {
            actualizarProgresoFlashcards(modIdx);
        }
    };

    function actualizarProgresoFlashcards(modIdx) {
        const p = state.progreso;
        if (!p.modulos[modIdx].flashcards_done) {
            p.modulos[modIdx].flashcards_done = true;
            
            guardarProgreso(p).then(() => {
                // Notificación
                window.mostrarModalError("🎉 Has completat totes les targetes! Mòdul següent desbloquejat.");
                
                // Recargar interfaz COMPLETA para quitar candados
                setTimeout(() => {
                    renderSidebar(); 
                    // Recargar la vista actual para ver el mensaje verde
                    renderFlashcards(document.getElementById('moduls-container'), state.curso.modulos[modIdx].targetes_memoria, modIdx);
                }, 500);
            });
        }
    }

    // --- RESTO DE FUNCIONES (Test, Revisión, Examen Final) IGUAL QUE ANTES ---
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
    
    function renderTestIntro(container, mod, modIdx) { 
        const progreso = state.progreso.modulos[modIdx] || { aprobado: false, intentos: 0, nota: 0 };
        if (progreso.aprobado) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;"><h2 style="color:green">Mòdul Superat! ✅</h2><div style="font-size:3rem; margin:20px 0;">${progreso.nota}</div><div class="btn-centered-container"><button class="btn-primary" onclick="revisarTest(${modIdx})">Veure resultats anteriors</button></div></div>`;
             return;
        }
        if (progreso.intentos >= 2 && !state.godMode) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;"><h2 style="color:red">Bloquejat ⛔</h2><p>Has esgotat els 2 intents.</p></div>`;
             return;
        }
        container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;"><h2>📝 Test d'Avaluació</h2><div class="exam-info-box"><p>✅ <strong>Aprovat:</strong> 70% d'encerts.</p><p>🔄 <strong>Intent:</strong> ${progreso.intentos + 1} de 2.</p></div><br><div class="btn-centered-container"><button class="btn-primary" onclick="iniciarTest()">COMENÇAR EL TEST</button></div></div>`;
    }
    window.iniciarTest = function() { state.testEnCurso = true; renderMainContent(); }

    function renderTestQuestions(container, mod, modIdx) {
        const gridRight = document.getElementById('quiz-grid'); gridRight.innerHTML = ''; gridRight.className = 'grid-container';
        mod.preguntes.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-q-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`q-${i}`] !== undefined) div.classList.add('answered');
            gridRight.appendChild(div);
        });
        let html = `<h3>Test en Curs...</h3>`;
        mod.preguntes.forEach((preg, idx) => {
            const qId = `q-${idx}`; 
            if (state.godMode && state.respuestasTemp[qId] === undefined) {
                const correctIdx = preg.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true);
                if (correctIdx !== -1) { state.respuestasTemp[qId] = correctIdx; setTimeout(() => { const gridItem = document.getElementById(`grid-q-${idx}`); if(gridItem) gridItem.classList.add('answered'); }, 0); }
            }
            const savedVal = state.respuestasTemp[qId];
            html += `<div class="question-card" id="card-${qId}"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                const isSelected = (savedVal == oIdx) ? 'selected' : ''; const checked = (savedVal == oIdx) ? 'checked' : '';
                html += `<div class="option-item ${isSelected}" onclick="selectTestOption('${qId}', ${oIdx}, 'test_mod_${modIdx}')"><input type="radio" name="${qId}" value="${oIdx}" ${checked}><span>${opt.text}</span></div>`;
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
        if(card) { card.querySelectorAll('.option-item').forEach((el, idx) => { if (idx === valIdx) { el.classList.add('selected'); el.querySelector('input').checked = true; } else { el.classList.remove('selected'); el.querySelector('input').checked = false; } }); }
        const gridIdx = qId.split('-')[1]; let gridItemId = storageKeyType === 'examen_final' ? `grid-final-q-${gridIdx}` : `grid-q-${gridIdx}`;
        const gridItem = document.getElementById(gridItemId); if(gridItem) gridItem.classList.add('answered');
        guardarRespuestaLocal(storageKeyType, qId, valIdx);
    }
    window.entregarTest = function(modIdx) {
        window.mostrarModalConfirmacion("Entregar Test", "Estàs segur?", async () => {
            document.getElementById('custom-modal').style.display = 'none';
            const preguntas = window.currentQuestions; let aciertos = 0;
            preguntas.forEach((preg, idx) => { const userRes = state.respuestasTemp[`q-${idx}`]; const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta === true || o.isCorrect === true || o.correct === true); if (userRes == correctaIdx) aciertos++; });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2)); const aprobado = nota >= 7.0;
            const p = state.progreso;
            if (!p.modulos[modIdx]) p.modulos[modIdx] = { intentos: 0, nota: 0, aprobado: false, flashcards_done: false };
            p.modulos[modIdx].intentos += 1; p.modulos[modIdx].nota = Math.max(p.modulos[modIdx].nota, nota); if (aprobado) p.modulos[modIdx].aprobado = true;
            await guardarProgreso(p); limpiarRespuestasLocales(`test_mod_${modIdx}`); state.testEnCurso = false; document.body.classList.remove('exam-active');
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
        if (!mod || !mod.preguntes) return;
        const container = document.getElementById('moduls-container');
        let html = `<h3>Revisió (Mode Estudi)</h3><div class="alert-info" style="margin-bottom:20px; background:#e8f0fe; padding:15px; border-radius:6px; color:#0d47a1;">Aquí pots veure les respostes correctes per repassar.</div>`;
        mod.preguntes.forEach((preg, idx) => {
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
    function renderExamenFinal(container) {
        if (!state.progreso.examen_final) state.progreso.examen_final = { aprobado: false, nota: 0, intentos: 0 };
        const finalData = state.progreso.examen_final;
        if (finalData.aprobado) {
             let puedeDescargar = true; let mensajeFecha = '';
             if (state.curso.data_fi) { const fechaFin = new Date(state.curso.data_fi); const hoy = new Date(); if (hoy < fechaFin) { puedeDescargar = false; mensajeFecha = `Certificat disponible: <strong>${fechaFin.toLocaleDateString('ca-ES')}</strong>.`; } }
             let botonHtml = puedeDescargar ? `<button class="btn-primary" onclick="imprimirDiploma('${finalData.nota}')">Descarregar Diploma</button>` : `<div class="alert-info" style="margin-top:15px; color:#856404; background:#fff3cd; padding:10px; border-radius:4px;"><i class="fa-solid fa-clock"></i> ${mensajeFecha}</div>`;
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;"><h1 style="color:green;">🎉 ENHORABONA!</h1><p>Curs Completat.</p><div style="font-size:3.5rem; font-weight:bold; margin:20px 0; color:var(--brand-blue);">${finalData.nota}</div><div class="btn-centered-container">${botonHtml}</div></div>`;
             return;
        }
        if (finalData.intentos >= 2 && !state.godMode) { container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;"><h2 style="color:red">🚫 Bloquejat</h2><p>Intents esgotats.</p></div>`; return; }
        const savedData = cargarRespuestasLocales('examen_final'); const isActive = (Object.keys(savedData).length > 0) || state.testEnCurso;
        if (isActive) { state.testEnCurso = true; renderFinalQuestions(container, savedData); } else { container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;"><h2 style="color:var(--brand-blue);">🏆 Examen Final</h2><div class="exam-info-box"><p>⏱️ 30 minuts.</p><p>🎯 Nota tall: 7.5</p></div><br><div class="btn-centered-container"><button class="btn-primary" onclick="iniciarExamenFinal()">COMENÇAR EXAMEN FINAL</button></div></div>`; }
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
            const payload = { data: { progres_detallat: state.progreso } }; if (aprobado) { payload.data.estat = 'completat'; payload.data.nota_final = nota; }
            await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload) });
            limpiarRespuestasLocales('examen_final'); state.testEnCurso = false; document.body.classList.remove('exam-active');
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, 999, true);
        };
        if(forzado) { doDelivery(); } else { window.mostrarModalConfirmacion("Entregar Examen", "Segur que vols entregar?", () => { document.getElementById('custom-modal').style.display = 'none'; doDelivery(); }); }
    }
    window.imprimirDiploma = function(nota) { const nombreCurso = state.curso.titol; const fechaHoy = new Date().toLocaleDateString('ca-ES', { year: 'numeric', month: 'long', day: 'numeric' }); const alumno = USER; const nombreAlumno = `${alumno.nombre} ${alumno.apellidos || ''}`.toUpperCase(); const ventana = window.open('', '_blank'); ventana.document.write(`<!DOCTYPE html><html><head><title>Diploma</title><style>@page { size: A4 landscape; margin: 0; } body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; background: white; font-family: sans-serif; } .page { width: 95%; height: 95%; border: 1px solid #fff; text-align: center; } .student { font-size: 24pt; font-weight: bold; margin: 20px auto; border-bottom: 2px solid #333; display: inline-block; padding: 0 40px; } </style></head><body><div class="page"><h1>Certificat</h1><p>SICAP certifica que</p><div class="student">${nombreAlumno}</div><p>Ha superat:</p><h2>${nombreCurso}</h2><p>Nota: ${nota} - Data: ${fechaHoy}</p></div><script>window.onload = function() { setTimeout(() => window.print(), 500); }</script></body></html>`); ventana.document.close(); };
    window.obrirFormulariDubte = function(moduloTitulo) {
        const modal = document.getElementById('custom-modal'); const titleEl = document.getElementById('modal-title'); const msgEl = document.getElementById('modal-msg'); const btnConfirm = document.getElementById('modal-btn-confirm'); const btnCancel = document.getElementById('modal-btn-cancel');
        titleEl.innerText = "Enviar Dubte"; titleEl.style.color = "var(--brand-blue)";
        msgEl.innerHTML = `<p>Escriu la teva pregunta sobre: <strong>${moduloTitulo}</strong></p><textarea id="modal-doubt-text" class="modal-textarea" placeholder="Explica el teu dubte detalladament..."></textarea><small>El professor rebrà una notificació instantània.</small>`;
        btnCancel.style.display = 'block'; btnConfirm.innerText = "Enviar"; btnConfirm.disabled = false; btnConfirm.style.background = "var(--brand-blue)";
        const newConfirm = btnConfirm.cloneNode(true); const newCancel = btnCancel.cloneNode(true); btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm); btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        newCancel.onclick = () => modal.style.display = 'none';
        newConfirm.onclick = async () => {
            const text = document.getElementById('modal-doubt-text').value.trim(); if(!text) return alert("Escriu alguna cosa!"); newConfirm.innerText = "Enviant..."; newConfirm.disabled = true;
            try {
                const payload = { data: { missatge: text, tema: moduloTitulo, curs: state.curso.titol, alumne_nom: `${USER.nombre || USER.username} ${USER.apellidos || ''}`, users_permissions_user: USER.id, estat: 'pendent', data_envio: new Date().toISOString() } };
                const res = await fetch(`${STRAPI_URL}/api/missatges`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload) });
                if(res.ok) { modal.style.display = 'none'; window.mostrarModalError("Dubte enviat correctament!"); } else { throw new Error("Error API"); }
            } catch(e) { console.error(e); modal.style.display = 'none'; window.mostrarModalError("Error al connectar amb el servidor."); }
        };
        modal.style.display = 'flex';
    };
});