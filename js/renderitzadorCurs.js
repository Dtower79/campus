/* --- SUSTITUIR TODO EL CONTENIDO DE js/renderitzadorCurs.js POR ESTE --- */

document.addEventListener('DOMContentLoaded', () => {

    // ========================================================================
    // 1. HELPERS: PROCESAMIENTO DE TEXTO (Strapi v5)
    // ========================================================================
    
    // Convierte Rich Text de Strapi a HTML para mostrar (Teoría/Programa)
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;

        const extractText = (nodes) => {
            if (!nodes) return "";
            if (typeof nodes === "string") return nodes;
            if (Array.isArray(nodes)) return nodes.map(extractText).join(" ");
            if (nodes.type === "text" && nodes.text) {
                let t = nodes.text;
                if(nodes.bold) t = `<strong>${t}</strong>`;
                if(nodes.italic) t = `<em>${t}</em>`;
                if(nodes.underline) t = `<u>${t}</u>`;
                return t;
            }
            if (nodes.children) return extractText(nodes.children);
            return "";
        };

        if (Array.isArray(content)) {
            return content.map(block => {
                const text = extractText(block.children);
                if (!text.trim()) return ''; // Saltar bloques vacíos
                
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
        return JSON.stringify(content); // Fallback
    }

    // NUEVO: Extractor estricto de texto plano para Flashcards
    function extraerTextoPlano(content) {
        if (!content) return "Text no disponible";
        if (typeof content === 'string') return content; // Ya es texto

        // Si es array de bloques de Strapi
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.children) {
                    return block.children
                        .map(child => child.text || '')
                        .join('');
                }
                return '';
            }).join(' ').replace(/\s+/g, ' ').trim();
        }
        
        // Si es objeto
        if (typeof content === 'object') {
            return JSON.stringify(content);
        }
        return String(content);
    }

    // ========================================================================
    // 2. ESTADO Y CONFIGURACIÓN
    // ========================================================================
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');
    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    let state = {
        matriculaId: null,
        curso: null,
        progreso: {},
        currentModuleIndex: -1, // -1: Intro, 1000: Glossari, 999: Examen Final
        currentView: 'intro',
        respuestasTemp: {},
        testEnCurso: false,
        godMode: false,
        preguntasExamenFinal: [],
        timerInterval: null
    };

    if (!SLUG || !USER || !TOKEN) {
        if(!SLUG) console.log("Esperando selección de curso...");
        else window.location.href = 'index.html';
        return;
    }

    // Inicialización UI
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) loginOverlay.style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('exam-view').style.display = 'flex';
    document.getElementById('app-footer').style.display = 'block'; // Footer visible

    init();

    async function init() {
        const container = document.getElementById('moduls-container');
        if (container) container.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant curs...</p>';
        try {
            await cargarDatos();
            if (!state.progreso || Object.keys(state.progreso).length === 0) {
                await inicializarProgresoEnStrapi();
            }
            renderSidebar();
            renderMainContent();
        } catch (e) {
            console.error(e);
            if (container) container.innerHTML = `<div class="dashboard-card" style="border-top:4px solid red; text-align:center;"><h3>Error</h3><p>${e.message}</p><button class="btn-secondary" onclick="window.location.href='index.html'">Tornar</button></div>`;
        }
    }

    async function cargarDatos() {
        // Query optimizada para Strapi v5
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

        if (!json.data || json.data.length === 0) throw new Error("No estàs matriculat en aquest curs.");

        const mat = json.data[0];
        state.matriculaId = mat.documentId || mat.id;
        state.curso = mat.curs;
        state.progreso = mat.progres_detallat || {};
    }

    async function inicializarProgresoEnStrapi() {
        const nuevoProgreso = {
            modulos: state.curso.modulos.map(() => ({ aprobado: false, nota: 0, intentos: 0 })),
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
        // Cálculo de %: 90% módulos + 10% examen final (simplificado)
        let porcentaje = totalModulos > 0 ? Math.round((aprobados / totalModulos) * 100) : 0;
        if (progresoObj.examen_final && progresoObj.examen_final.aprobado) porcentaje = 100;

        const payload = { data: { progres_detallat: progresoObj, progres: porcentaje } };
        
        // Si llega al 100%, marcamos como completado
        if(porcentaje === 100) payload.data.estat = 'completat';

        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });
        state.progreso = progresoObj;
    }

    // ========================================================================
    // 3. PERSISTENCIA LOCAL
    // ========================================================================
    function getStorageKey(tipo) { return `sicap_progress_${USER.id}_${state.curso.slug}_${tipo}`; }

    function guardarRespuestaLocal(tipo, preguntaId, opcionIdx) {
        const key = getStorageKey(tipo);
        let data = JSON.parse(localStorage.getItem(key)) || {};
        data[preguntaId] = opcionIdx;
        localStorage.setItem(key, JSON.stringify(data));
    }

    function cargarRespuestasLocales(tipo) {
        const key = getStorageKey(tipo);
        return JSON.parse(localStorage.getItem(key)) || {};
    }

    function limpiarRespuestasLocales(tipo) {
        localStorage.removeItem(getStorageKey(tipo));
        if (tipo === 'examen_final') {
            localStorage.removeItem(`sicap_timer_start_${USER.id}_${SLUG}`);
            localStorage.removeItem(`sicap_exam_order_${USER.id}_${SLUG}`);
        }
    }

    // ========================================================================
    // 4. LÓGICA UI & SIDEBAR
    // ========================================================================
    
    // Toggle para el acordeón del menú lateral
    window.toggleAccordion = function(headerElement) {
        const group = headerElement.parentElement;
        // Si está bloqueado y no es profesor, no hace nada
        if (group.classList.contains('group-locked') && !state.godMode) return;
        
        // Cerrar otros (opcional, estilo acordeón estricto)
        /* document.querySelectorAll('.sidebar-module-group').forEach(g => {
            if(g !== group) g.classList.remove('open');
        }); */
        
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
        window.scrollTo(0, 0);
    }

    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        const tituloEl = document.getElementById('curs-titol');
        if (tituloEl) tituloEl.innerText = state.curso.titol;

        let html = '';

        if (USER.es_professor) {
            html += `<div style="margin-bottom:15px; padding:10px; border-bottom:1px solid #eee; text-align:center; background:#fff3cd; border-radius:6px;">
                    <label style="font-size:0.85rem; cursor:pointer; font-weight:bold; color:#856404;">
                        <input type="checkbox" ${state.godMode ? 'checked' : ''} onchange="toggleGodMode(this)"> 🕵️ Mode Professor
                    </label></div>`;
        }

        // 1. PROGRAMA
        const isIntroActive = state.currentModuleIndex === -1;
        html += `<div class="sidebar-module-group ${isIntroActive ? 'open' : ''}">
            <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                <span><i class="fa-solid fa-circle-info"></i> Informació General</span>
            </div>
            <div class="sidebar-sub-menu">
                ${renderSubLink(-1, 'intro', '📄 Programa del curs', false)}
            </div>
        </div>`;

        // 2. MÓDULOS
        state.curso.modulos.forEach((mod, idx) => {
            // Lógica de bloqueo: Bloqueado si el anterior no está aprobado (excepto el 1º)
            let isLocked = false;
            if (idx > 0) {
                const prevMod = state.progreso.modulos[idx - 1];
                if (!prevMod || !prevMod.aprobado) isLocked = true;
            }
            if (state.godMode) isLocked = false;

            const modProgreso = state.progreso.modulos[idx];
            const check = (modProgreso && modProgreso.aprobado) ? '<i class="fa-solid fa-check" style="color:green; margin-left:5px;"></i>' : '';
            const isOpen = (state.currentModuleIndex === idx);
            const groupClass = isLocked ? 'group-locked' : '';

            html += `<div class="sidebar-module-group ${groupClass} ${isOpen ? 'open' : ''}">
                    <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                        <span><i class="fa-regular fa-folder-open"></i> ${mod.titol} ${check}</span>
                    </div>
                    <div class="sidebar-sub-menu">`;

            html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);
            
            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                html += renderSubLink(idx, 'flashcards', '🔄 Targetes de Repàs', isLocked);
            }

            const intentos = modProgreso ? modProgreso.intentos : 0;
            html += renderSubLink(idx, 'test', `📝 Test Avaluació (${intentos}/2)`, isLocked);
            
            html += `</div></div>`;
        });

        // 3. GLOSARI
        html += `<div class="sidebar-module-group ${state.currentModuleIndex === 1000 ? 'open' : ''}" style="border-top:1px solid #eee; margin-top:10px;">
            <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                <span><i class="fa-solid fa-book-bookmark"></i> Recursos</span>
            </div>
            <div class="sidebar-sub-menu">
                ${renderSubLink(1000, 'glossary', '📚 Glossari de Termes', false)}
            </div>
        </div>`;

        // 4. EXAMEN FINAL
        // Se desbloquea si todos los módulos están aprobados
        const allModulesPassed = state.progreso.modulos.every(m => m.aprobado);
        const finalLocked = !state.godMode && !allModulesPassed;

        html += `<div class="sidebar-module-group ${finalLocked ? 'group-locked' : ''} ${state.currentModuleIndex === 999 ? 'open' : ''}" style="margin-top:20px; border-top:2px solid var(--brand-blue);">
                <div class="sidebar-module-title" onclick="toggleAccordion(this)">
                    <span style="color:var(--brand-blue); font-weight:bold;">🎓 Avaluació Final</span>
                </div>
                <div class="sidebar-sub-menu">
                    ${renderSubLink(999, 'examen_final', '🏆 Examen Final', finalLocked)}
                </div>
            </div>`;

        indexContainer.innerHTML = html;
    }

    function renderSubLink(modIdx, viewName, label, locked) {
        // Corrección de comparación de tipos (String vs Number)
        const isActive = (String(state.currentModuleIndex) === String(modIdx) && state.currentView === viewName);
        
        let classes = 'sidebar-subitem ';
        if (locked) classes += 'locked ';
        if (isActive) classes += 'active ';

        const clickAttr = locked ? '' : `onclick="window.cambiarVista(${modIdx}, '${viewName}')"`;
        const lockIcon = locked ? '<i class="fa-solid fa-lock" style="font-size:0.7em; margin-left:auto;"></i>' : '';

        return `<div class="${classes}" ${clickAttr}>
                    ${label} ${lockIcon}
                </div>`;
    }

    // ========================================================================
    // 5. RENDER MAIN CONTENT
    // ========================================================================
    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        
        // Reset
        gridRight.innerHTML = '';
        gridRight.className = '';
        document.body.classList.remove('exam-active');
        detenerCronometro();

        // --- VISTAS ESPECIALES ---
        
        // 1. PROGRAMA
        if (state.currentView === 'intro') {
            container.innerHTML = `
                <h2><i class="fa-solid fa-book-open"></i> Programa del Curs</h2>
                <div class="module-content-text" style="margin-top:20px;">
                    ${parseStrapiRichText(state.curso.descripcio || "Descripció no disponible.")}
                </div>`;
            renderTools(gridRight, { titol: 'Inici' }, false);
            return;
        }

        // 2. GLOSARIO
        if (state.currentView === 'glossary') {
            const glossariTxt = state.curso.glossari ? parseStrapiRichText(state.curso.glossari) : "<p>No hi ha termes definits.</p>";
            container.innerHTML = `
                <h2><i class="fa-solid fa-spell-check"></i> Glossari</h2>
                <div class="dashboard-card" style="margin-top:20px;">
                    <div class="module-content-text">${glossariTxt}</div>
                </div>`;
            renderTools(gridRight, { titol: 'Glossari' }, false);
            return;
        }

        // 3. EXAMEN FINAL
        if (state.currentView === 'examen_final') {
            renderExamenFinal(container);
            renderTools(gridRight, { titol: 'Examen Final' }, true); // True para mostrar solo breadcrumbs mínimos
            return;
        }

        // --- VISTAS DE MÓDULO (TEORIA, FLASHCARDS, TEST) ---
        
        const mod = state.curso.modulos[state.currentModuleIndex];
        if(!mod) { container.innerHTML = "<p>Error al carregar mòdul.</p>"; return; }

        if (state.currentView === 'teoria') {
            renderTeoria(container, mod);
            renderTools(gridRight, mod, false);

        } else if (state.currentView === 'flashcards') {
            renderFlashcards(container, mod.targetes_memoria);
            renderTools(gridRight, mod, false);

        } else if (state.currentView === 'test') {
            const savedData = cargarRespuestasLocales(`test_mod_${state.currentModuleIndex}`);
            const hayDatos = Object.keys(savedData).length > 0;
            const aprobado = state.progreso.modulos[state.currentModuleIndex].aprobado;

            if ((state.testEnCurso || hayDatos) && !aprobado) {
                state.testEnCurso = true;
                state.respuestasTemp = savedData;
                renderTestQuestions(container, mod);
            } else {
                renderTestIntro(container, mod, state.currentModuleIndex);
                renderTools(gridRight, mod, false);
            }
        }
    }

    // ========================================================================
    // 6. RENDERIZADORES DE CONTENIDO
    // ========================================================================

    function renderTools(container, mod, hideTools) {
        // Breadcrumbs
        let breadHtml = `<div class="breadcrumbs">
            <a href="#" onclick="window.tornarAlDashboard(); return false;">Inici</a>
            <span class="breadcrumb-separator"><i class="fa-solid fa-angle-right"></i></span>
            <span class="breadcrumb-current">${mod.titol}</span>
        </div>`;

        let toolsHtml = '';
        if (!hideTools) {
            const noteKey = `sicap_notes_${USER.id}_${state.curso.slug}`;
            const savedNote = localStorage.getItem(noteKey) || '';
            
            toolsHtml = `
            <div class="sidebar-header"><h3>Eines</h3></div>
            <div class="tools-box">
                <div class="tools-title"><i class="fa-regular fa-note-sticky"></i> Notes Ràpides</div>
                <textarea id="quick-notes" class="notepad-area" placeholder="Apunts...">${savedNote}</textarea>
            </div>
            <div class="tools-box" style="border-color:var(--brand-blue);">
                <div class="tools-title"><i class="fa-regular fa-life-ring"></i> Dubtes?</div>
                <button class="btn-doubt" onclick="obrirFormulariDubte('${mod.titol.replace(/'/g, "\\'")}')">
                    Enviar Dubte
                </button>
            </div>`;
        }

        container.innerHTML = breadHtml + toolsHtml;

        if(!hideTools) {
            document.getElementById('quick-notes').addEventListener('input', (e) => {
                localStorage.setItem(`sicap_notes_${USER.id}_${state.curso.slug}`, e.target.value);
            });
        }
    }

    function renderTeoria(container, mod) {
        let html = `<h2>${mod.titol}</h2>`;
        if (mod.resum) html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
        
        if (mod.material_pdf && mod.material_pdf.length > 0) {
            html += `<div class="materials-section"><span class="materials-title">Documents</span>`;
            mod.material_pdf.forEach(pdf => {
                const url = pdf.url.startsWith('/') ? STRAPI_URL + pdf.url : pdf.url;
                html += `<a href="${url}" target="_blank" class="btn-pdf"><i class="fa-solid fa-file-pdf"></i> ${pdf.name}</a>`;
            });
            html += `</div>`;
        }
        container.innerHTML = html;
    }

    /* --- FLASHCARDS GAMIFICADAS CORREGIDAS --- */
    function renderFlashcards(container, cards) {
        if (!cards || cards.length === 0) {
            container.innerHTML = '<p>No hi ha targetes de repàs en aquest mòdul.</p>';
            return;
        }

        let html = `<h3><i class="fa-solid fa-layer-group"></i> Targetes de Repàs</h3><div class="flashcards-grid-view">`;
        
        // Palabras para rellenar (distractores)
        const commonDistractors = ["Protocol", "Seguretat", "Règim", "Junta", "Director", "Informe", "Article", "Llei", "Decret", "Centre", "DERT", "Aïllament"];

        cards.forEach((card, idx) => {
            // 1. Limpiar texto de respuesta (Quitar HTML, saltos de línea)
            let rawText = extraerTextoPlano(card.resposta);
            let cleanText = rawText.replace(/\s+/g, ' ').trim(); // Unificar espacios
            
            // 2. Lógica de hueco (Cloze)
            let words = cleanText.split(' ');
            let targetWord = "";
            let targetIndex = -1;

            // Buscar palabra candidata (>4 letras, evitar artículos cortos)
            for(let i=0; i<words.length; i++) {
                let w = words[i].replace(/[.,;:"'()]/g, ''); // Limpiar puntuación
                if(w.length > 4) {
                    targetWord = words[i]; // Guardar con puntuación original si la tiene
                    targetIndex = i;
                    break; 
                }
            }
            // Fallback si no hay palabras largas
            if(targetIndex === -1 && words.length > 0) {
                targetWord = words[words.length-1];
                targetIndex = words.length-1;
            }

            let wordClean = targetWord.replace(/[.,;:"'()]/g, ''); // La palabra limpia para comparar
            
            // 3. Crear frase con hueco
            // Construimos el HTML de la pregunta poniendo el span en el lugar de la palabra
            let questionHtml = words.map((w, i) => {
                if(i === targetIndex) return `<span class="cloze-blank">_______</span>`;
                return w;
            }).join(' ');

            // 4. Generar Opciones
            let options = [wordClean];
            // Añadir 2 distractores
            while(options.length < 3) {
                let rand = commonDistractors[Math.floor(Math.random() * commonDistractors.length)];
                if(!options.includes(rand)) options.push(rand);
            }
            options.sort(() => Math.random() - 0.5); // Barajar

            // 5. Generar HTML Botones
            // Usamos escape para evitar problemas con comillas
            let btnsHtml = options.map(opt => {
                return `<button class="btn-flash-option" onclick="checkFlashcard(this, '${opt.replace(/'/g, "\\'")}', '${wordClean.replace(/'/g, "\\'")}')">${opt}</button>`;
            }).join('');

            // 6. Contenido de la cara trasera
            let backContent = '';
            if(state.godMode) {
                backContent = `<div style="padding:20px; color:white;">${cleanText}</div>`;
            } else {
                backContent = `
                    <div class="flashcard-game-container">
                        <div class="flashcard-question-text">${questionHtml}</div>
                        <div class="flashcard-options">${btnsHtml}</div>
                    </div>
                `;
            }

            html += `<div class="flashcard" onclick="this.classList.toggle('flipped')">
                    <div class="flashcard-inner">
                        <div class="flashcard-front">
                            <h4>Pregunta ${idx + 1}</h4>
                            <div style="padding:10px; font-size:1.1rem; font-weight:500;">${card.pregunta}</div>
                            <small style="margin-top:auto; opacity:0.8;"><i class="fa-solid fa-rotate"></i> Clica per girar</small>
                        </div>
                        <div class="flashcard-back">
                            ${backContent}
                        </div>
                    </div>
                </div>`;
        });

        html += `</div>`;
        container.innerHTML = html;
    }

    // Función global para verificar respuesta (necesita estar en window)
    window.checkFlashcard = function(btn, selected, correct) {
        event.stopPropagation(); // Evitar que la carta gire
        
        const container = btn.closest('.flashcard-game-container');
        const blank = container.querySelector('.cloze-blank');
        const allBtns = container.querySelectorAll('.btn-flash-option');

        // Desactivar botones
        allBtns.forEach(b => b.disabled = true);

        if(selected === correct) {
            btn.classList.add('correct');
            blank.innerText = selected;
            blank.classList.remove('cloze-blank');
            blank.classList.add('cloze-blank', 'filled-correct');
        } else {
            btn.classList.add('wrong');
            // Marcar la correcta
            allBtns.forEach(b => { if(b.innerText === correct) b.classList.add('correct'); });
            
            blank.innerText = selected;
            blank.classList.add('filled-wrong');
            // Después de un momento, mostrar la real
            setTimeout(() => {
                blank.innerText = correct;
                blank.style.color = '#fff';
                blank.style.textDecoration = 'none';
            }, 1500);
        }
    }

    // --- TEST NORMAL ---
    function renderTestIntro(container, mod, modIdx) {
        const prog = state.progreso.modulos[modIdx];
        if(prog.aprobado) {
            container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                <h2 style="color:green">Aprovat! ✅</h2>
                <div style="font-size:3rem;">${prog.nota}</div>
                <button class="btn-primary" onclick="revisarTest(${modIdx})">Veure Revisió</button>
            </div>`;
        } else if(prog.intentos >= 2 && !state.godMode) {
            container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;">
                <h2 style="color:red">Bloquejat</h2><p>Intents esgotats.</p>
            </div>`;
        } else {
            container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding:40px;">
                <h2>Test: ${mod.titol}</h2>
                <p>Tens <strong>${2 - prog.intentos}</strong> intents restants.</p>
                <button class="btn-primary" onclick="iniciarTest()">Començar</button>
            </div>`;
        }
    }

    window.iniciarTest = function() {
        state.testEnCurso = true;
        renderMainContent();
    }

    function renderTestQuestions(container, mod) {
        let html = `<h3>Test en Curs</h3>`;
        const qGrid = document.getElementById('quiz-grid');
        qGrid.className = 'grid-container';
        let gridHtml = '';

        mod.preguntes.forEach((preg, i) => {
            const qId = `q-${i}`;
            const savedVal = state.respuestasTemp[qId];
            
            // Grid lateral
            gridHtml += `<div class="grid-item ${savedVal !== undefined ? 'answered' : ''}" onclick="document.getElementById('card-${qId}').scrollIntoView({behavior:'smooth'})">${i+1}</div>`;

            // Card Pregunta
            html += `<div class="question-card" id="card-${qId}">
                <div class="q-header">Pregunta ${i+1}</div>
                <div class="q-text">${preg.text}</div>
                <div class="options-list">`;
            
            preg.opcions.forEach((opt, oIdx) => {
                const isSel = (savedVal == oIdx);
                html += `<div class="option-item ${isSel ? 'selected' : ''}" onclick="selectOption('${qId}', ${oIdx}, 'test_mod_${state.currentModuleIndex}')">
                    <input type="radio" ${isSel ? 'checked' : ''}> ${opt.text}
                </div>`;
            });
            html += `</div></div>`;
        });

        const btnTxt = state.godMode ? "⚡ PROF: Entregar" : "Finalitzar i Entregar";
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarTest()">${btnTxt}</button></div>`;
        
        container.innerHTML = html;
        qGrid.innerHTML = gridHtml;
        window.currentQuestions = mod.preguntes;
    }

    window.selectOption = function(qId, valIdx, storageKey) {
        state.respuestasTemp[qId] = valIdx;
        guardarRespuestaLocal(storageKey, qId, valIdx);
        // Actualizar visual
        const card = document.getElementById(`card-${qId}`);
        card.querySelectorAll('.option-item').forEach((el, idx) => {
            if(idx === valIdx) { el.classList.add('selected'); el.querySelector('input').checked = true; }
            else { el.classList.remove('selected'); el.querySelector('input').checked = false; }
        });
        // Actualizar grid
        const qNum = parseInt(qId.split('-')[1]);
        const gridItems = document.querySelectorAll('.grid-item');
        if(gridItems[qNum]) gridItems[qNum].classList.add('answered');
    }

    window.entregarTest = function() {
        window.mostrarModalConfirmacion("Entregar", "Segur que vols finalitzar?", async () => {
            document.getElementById('custom-modal').style.display = 'none';
            
            const pregs = window.currentQuestions;
            let hits = 0;
            pregs.forEach((p, i) => {
                const userAns = state.respuestasTemp[`q-${i}`];
                const correctIdx = p.opcions.findIndex(o => o.esCorrecta || o.correct || o.isCorrect);
                if(userAns == correctIdx) hits++;
            });

            const nota = parseFloat(((hits / pregs.length) * 10).toFixed(2));
            const aprobado = nota >= 7.0;

            // Guardar
            const modIdx = state.currentModuleIndex;
            state.progreso.modulos[modIdx].intentos++;
            state.progreso.modulos[modIdx].nota = Math.max(state.progreso.modulos[modIdx].nota, nota);
            if(aprobado) state.progreso.modulos[modIdx].aprobado = true;

            await guardarProgreso(state.progreso);
            limpiarRespuestasLocales(`test_mod_${modIdx}`);
            state.testEnCurso = false;

            // Feedback
            mostrarFeedback(pregs, state.respuestasTemp, nota, aprobado);
        });
    }

    function mostrarFeedback(pregs, resps, nota, aprobado) {
        const container = document.getElementById('moduls-container');
        const color = aprobado ? 'green' : 'red';
        let html = `<div class="dashboard-card" style="border-top:5px solid ${color}; text-align:center;">
            <h2 style="color:${color}">${aprobado ? 'Superat!' : 'No Superat'}</h2>
            <div style="font-size:3rem;">${nota}</div>
            <button class="btn-primary" onclick="renderMainContent()">Continuar</button>
        </div><h3>Revisió:</h3>`;

        pregs.forEach((p, i) => {
            const userAns = resps[`q-${i}`];
            const correctIdx = p.opcions.findIndex(o => o.esCorrecta || o.correct);
            
            html += `<div class="question-card review-mode">
                <div class="q-header">P${i+1}</div>
                <div class="q-text">${p.text}</div>
                <div class="options-list">`;
            
            p.opcions.forEach((o, idx) => {
                let cls = 'option-item';
                if(idx === correctIdx) cls += ' correct-answer';
                if(idx == userAns && idx !== correctIdx) cls += ' user-wrong selected';
                html += `<div class="${cls}"><span>${o.text}</span></div>`;
            });

            if(p.explicacio) html += `<div class="explanation-box">${parseStrapiRichText(p.explicacio)}</div>`;
            html += `</div></div>`;
        });
        container.innerHTML = html;
        window.scrollTo(0,0);
    }

    // --- EXAMEN FINAL (Simplificado para brevedad, misma lógica que Test) ---
    function renderExamenFinal(container) {
        const finalData = state.progreso.examen_final;
        if(finalData.aprobado) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                <h1 style="color:green">ENHORABONA! 🎉</h1>
                <p>Has completat el curs.</p>
                <div style="font-size:4rem; margin:20px 0;">${finalData.nota}</div>
                <button class="btn-primary" onclick="window.print()">Imprimir Resultats</button>
            </div>`;
            return;
        }
        if(finalData.intentos >= 2 && !state.godMode) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red;"><h2 style="color:red">Suspens</h2></div>`;
             return;
        }

        // Si no está aprobado ni bloqueado:
        if(state.testEnCurso) {
            renderFinalQuestions(container);
        } else {
             container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding:40px;">
                <h2>Examen Final</h2>
                <p>30 preguntes - 30 minuts</p>
                <button class="btn-primary" onclick="iniciarExamenFinal()">Començar</button>
             </div>`;
        }
    }

    window.iniciarExamenFinal = function() {
        if(!state.curso.examen_final || state.curso.examen_final.length === 0) return alert("Error dades");
        state.preguntasExamenFinal = state.curso.examen_final; // Aquí se podría barajar
        state.testEnCurso = true;
        state.testStartTime = Date.now();
        renderMainContent();
    }

    function renderFinalQuestions(container) {
        // Renderizado similar a renderTestQuestions pero usando state.preguntasExamenFinal
        // Y activando el cronómetro en el sidebar
        let html = `<h3>Examen Final</h3>`;
        const qGrid = document.getElementById('quiz-grid');
        qGrid.innerHTML = `<div id="exam-timer" class="timer-box">30:00</div><div id="grid-inner"></div>`;
        
        iniciarCronometro();

        state.preguntasExamenFinal.forEach((p, i) => {
            html += `<div class="question-card" id="card-final-${i}">
                <div class="q-header">P${i+1}</div>
                <div class="q-text">${p.text}</div>
                <div class="options-list">`;
            p.opcions.forEach((o, oIdx) => {
                const checked = (state.respuestasTemp[`final-${i}`] == oIdx) ? 'checked' : '';
                html += `<div class="option-item" onclick="selectOption('final-${i}', ${oIdx}, 'examen_final')">
                    <input type="radio" ${checked}> ${o.text}
                </div>`;
            });
            html += `</div></div>`;
        });
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarExamenFinal()">Finalitzar</button></div>`;
        container.innerHTML = html;
        
        // Grid numbers
        const gridInner = document.getElementById('grid-inner');
        state.preguntasExamenFinal.forEach((_, i) => {
             const d = document.createElement('div');
             d.className = 'grid-item'; d.innerText = i+1;
             gridInner.appendChild(d);
        });
    }

    function iniciarCronometro() {
        clearInterval(state.timerInterval);
        const display = document.getElementById('exam-timer');
        state.timerInterval = setInterval(() => {
            const now = Date.now();
            const diff = 30 * 60 * 1000 - (now - state.testStartTime);
            if(diff <= 0) {
                entregarExamenFinal(true);
                return;
            }
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            if(display) display.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        }, 1000);
    }
    
    function detenerCronometro() { clearInterval(state.timerInterval); }

    window.entregarExamenFinal = async function(forced) {
        detenerCronometro();
        const pregs = state.preguntasExamenFinal;
        let hits = 0;
        pregs.forEach((p, i) => {
            const u = state.respuestasTemp[`final-${i}`];
            const ok = p.opcions.findIndex(o => o.esCorrecta);
            if(u == ok) hits++;
        });
        const nota = parseFloat(((hits/pregs.length)*10).toFixed(2));
        const ok = nota >= 7.5;
        
        state.progreso.examen_final.intentos++;
        state.progreso.examen_final.nota = nota;
        if(ok) state.progreso.examen_final.aprobado = true;
        
        await guardarProgreso(state.progreso);
        state.testEnCurso = false;
        limpiarRespuestasLocales('examen_final');
        renderMainContent(); // Mostrará pantalla de éxito o fallo
    }

    // Modal de dudas
    window.obrirFormulariDubte = function(tema) {
        window.mostrarModalConfirmacion("Dubte", `Enviar dubte sobre: ${tema}?`, () => {
             // Lógica de envío simulada
             document.getElementById('custom-modal').style.display = 'none';
             alert("Dubte enviat al professor.");
        });
    }

    window.tornarAlDashboard = function() {
        window.location.href = 'index.html';
    }
});