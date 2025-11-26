document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. HELPER: TRADUCTOR DE TEXTO (RICH TEXT)
    // ------------------------------------------------------------------------
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
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
        return '';
    }

    // ------------------------------------------------------------------------
    // 2. CONFIGURACIÓN Y SEGURIDAD
    // ------------------------------------------------------------------------
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');
    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    // Estado global de la aplicación
    let state = {
        matriculaId: null,
        curso: null,
        progreso: {},
        currentModuleIndex: 0,
        currentView: 'teoria', 
        respuestasTemp: {},
        testStartTime: 0,
        testEnCurso: false,
        godMode: false,
        preguntasExamenFinal: [] 
    };

    if (!SLUG) return; 

    if (!USER || !TOKEN) {
        alert("Sessió caducada. Torna a identificar-te.");
        window.location.href = 'index.html';
        return;
    }

    // --- FIX VISUAL: OCULTAR LOGIN Y MOSTRAR CURSO INMEDIATAMENTE ---
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');
    const dashboardView = document.getElementById('dashboard-view');
    const examView = document.getElementById('exam-view');

    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';
    if (dashboardView) dashboardView.style.display = 'none';
    if (examView) examView.style.display = 'flex';
    // -----------------------------------------------------------------

    // INICIAR
    init();

    async function init() {
        const container = document.getElementById('moduls-container');
        if(container) container.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant curs i progrés...</p>';
        
        try {
            await cargarDatos();
            // Si es la primera vez, inicializamos el JSON de progreso
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

    // ------------------------------------------------------------------------
    // 3. CARGA DE DATOS
    // ------------------------------------------------------------------------
    async function cargarDatos() {
        const query = [
            `filters[users_permissions_user][id][$eq]=${USER.id}`,
            `filters[curs][slug][$eq]=${SLUG}`,
            `populate[curs][populate][moduls][populate][preguntes][populate][opcions]=true`, 
            `populate[curs][populate][moduls][populate][material_pdf]=true`,
            `populate[curs][populate][moduls][populate][targetes_memoria]=true`,
            `populate[curs][populate][examen_final][populate][opcions]=true`, // <--- ESTA LÍNEA ES CRÍTICA
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
            modulos: state.curso.moduls.map(() => ({
                aprobado: false,
                nota: 0,
                intentos: 0
            })),
            examen_final: {
                aprobado: false,
                nota: 0,
                intentos: 0
            }
        };
        await guardarProgreso(nuevoProgreso);
    }

    async function guardarProgreso(progresoObj) {
        const payload = { data: { progres_detallat: progresoObj } };
        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });
        state.progreso = progresoObj;
    }

    // ------------------------------------------------------------------------
    // 4. LÓGICA DE BLOQUEOS (CORE)
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

    // ------------------------------------------------------------------------
    // 5. RENDERIZADO SIDEBAR (MENÚ)
    // ------------------------------------------------------------------------
    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        const tituloEl = document.getElementById('curs-titol');
        if(tituloEl) tituloEl.innerText = state.curso.titol;

        let html = '';

        // --- BOTÓN MODO PROFESOR (SOLO SI TIENE PERMISO) ---
        if (USER.es_professor === true) {
            html += `
                <div style="margin-bottom:15px; padding:10px; border-bottom:1px solid #eee; text-align:center; background:#fff3cd; border-radius:6px;">
                    <label style="font-size:0.85rem; cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:center; gap:10px; color:#856404; font-weight:bold;">
                        <input type="checkbox" ${state.godMode ? 'checked' : ''} onchange="toggleGodMode(this)">
                        <span>🕵️ Mode Professor</span>
                    </label>
                </div>
            `;
        }
        
        // 1. MÓDULOS
        state.curso.moduls.forEach((mod, idx) => {
            const isLocked = estaBloqueado(idx);
            const lockIcon = isLocked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-regular fa-folder-open"></i>';
            
            const modProgreso = state.progreso.modulos ? state.progreso.modulos[idx] : null;
            const statusColor = modProgreso && modProgreso.aprobado ? 'color:green;' : '';
            const check = modProgreso && modProgreso.aprobado ? '<i class="fa-solid fa-check"></i>' : '';
            
            const forcedIcon = (state.godMode && isLocked) ? '<span style="font-size:0.7em; color:orange; margin-left:5px;">(Vist)</span>' : '';

            html += `
                <div class="sidebar-module-group">
                    <span class="sidebar-module-title" style="${statusColor}">
                        ${lockIcon} ${mod.titol} ${check} ${forcedIcon}
                    </span>
                    <div class="sidebar-sub-menu">
            `;

            html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);
            
            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                html += renderSubLink(idx, 'flashcards', '🔄 Targetes de Repàs', isLocked);
            }

            const intentos = modProgreso ? modProgreso.intentos : 0;
            html += renderSubLink(idx, 'test', `📝 Test Avaluació (${intentos}/2)`, isLocked);

            html += `</div></div>`;
        });

        // 2. BLOQUE FINAL
        const finalIsLocked = !puedeHacerExamenFinal(); 
        
        html += `
            <div class="sidebar-module-group" style="margin-top:20px; border-top:2px solid var(--brand-blue);">
                <span class="sidebar-module-title">🎓 Avaluació Final</span>
                ${renderSubLink(999, 'examen_final', '🏆 Examen Final i Diploma', finalIsLocked)}
            </div>
        `;

        indexContainer.innerHTML = html;
    }

    function renderSubLink(modIdx, viewName, label, locked) {
        const reallyLocked = locked && !state.godMode;

        let isActive = false;
        if (modIdx === state.currentModuleIndex && state.currentView === viewName) isActive = true;
        if (modIdx === 999 && state.currentView === 'examen_final') isActive = true;

        const lockedClass = reallyLocked ? 'locked' : '';
        const activeClass = isActive ? 'active' : '';
        const clickFn = reallyLocked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;

        return `<div class="sidebar-subitem ${lockedClass} ${activeClass}" onclick="${clickFn}">
                    ${label} ${reallyLocked ? '<i class="fa-solid fa-lock" style="font-size:0.7em; margin-left:5px;"></i>' : ''}
                </div>`;
    }

    window.toggleGodMode = function(checkbox) {
        state.godMode = checkbox.checked;
        renderSidebar();
    }

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
    // 6. RENDERIZADO CONTENIDO PRINCIPAL
    // ------------------------------------------------------------------------
    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; 

        if (state.currentView === 'examen_final') {
            renderExamenFinal(container);
            return;
        }

        const mod = state.curso.moduls[state.currentModuleIndex];
        
        if (state.currentView === 'teoria') {
            renderTeoria(container, mod);
        } else if (state.currentView === 'flashcards') {
            renderFlashcards(container, mod.targetes_memoria);
        } else if (state.currentView === 'test') {
            if (state.testEnCurso) {
                renderTestQuestions(container, mod, state.currentModuleIndex);
            } else {
                renderTestIntro(container, mod, state.currentModuleIndex);
            }
        }
    }

    function renderTeoria(container, mod) {
        let html = `<h2>${mod.titol}</h2>`;
        
        if (mod.resum) {
            html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
        }

        if (mod.material_pdf) {
            const archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
            if(archivos.length > 0) {
                html += `<div class="materials-section"><span class="materials-title">Material Descarregable</span>`;
                archivos.forEach(a => {
                    let pdfUrl = a.url;
                    // Lógica para Cloudinary vs Local
                    if (!pdfUrl.startsWith('http')) {
                        try {
                            const dominioBase = new URL(STRAPI_URL).origin;
                            pdfUrl = `${dominioBase}${pdfUrl}`;
                        } catch (e) { pdfUrl = a.url; }
                    }
                    html += `<a href="${pdfUrl}" target="_blank" class="btn-pdf"><i class="fa-solid fa-file-pdf"></i> ${a.name}</a>`;
                });
                html += `</div>`;
            }
        }
        container.innerHTML = html;
    }

    function renderFlashcards(container, cards) {
        if (!cards || cards.length === 0) {
            container.innerHTML = '<p>No hi ha targetes disponibles per aquest mòdul.</p>'; return;
        }

        let html = `<h3>Targetes de Repàs</h3><div class="flashcards-wrapper">`;
        
        cards.forEach((card, idx) => {
            const active = idx === 0 ? 'active' : '';
            html += `
                <div class="flashcard-slide ${active}" id="fc-${idx}">
                    <div class="flashcard" onclick="this.classList.toggle('flipped')">
                        <div class="flashcard-inner">
                            <div class="flashcard-front">
                                <h4>${card.pregunta}</h4>
                                <small><i class="fa-solid fa-rotate"></i> Clica per girar</small>
                            </div>
                            <div class="flashcard-back">
                                <p>${card.resposta}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
            <button class="carousel-btn carousel-prev" onclick="moveCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="carousel-btn carousel-next" onclick="moveCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>
            <div class="carousel-counter"><span id="fc-current">1</span> / ${cards.length}</div>
        </div>`;

        container.innerHTML = html;
        window.currentFcIndex = 0;
        window.totalFc = cards.length;
    }

    window.moveCarousel = function(dir) {
        const newIndex = window.currentFcIndex + dir;
        if (newIndex < 0 || newIndex >= window.totalFc) return;

        document.getElementById(`fc-${window.currentFcIndex}`).classList.remove('active');
        document.getElementById(`fc-${newIndex}`).classList.add('active');
        window.currentFcIndex = newIndex;
        document.getElementById('fc-current').innerText = newIndex + 1;
    }

    // ------------------------------------------------------------------------
    // TESTS MODULO
    // ------------------------------------------------------------------------
    function renderTestIntro(container, mod, modIdx) {
        const progreso = state.progreso.modulos[modIdx] || { aprobado: false, intentos: 0, nota: 0 };
        
        if (progreso.aprobado) {
             container.innerHTML = `
                <div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                    <h2 style="color:green">Mòdul Superat! ✅</h2>
                    <div style="font-size:3rem; margin:20px 0;">${progreso.nota}</div>
                    <p>Ja has aprovat aquest test. Pots continuar.</p>
                </div>`;
             return;
        }

        if (progreso.intentos >= 2 && !state.godMode) {
             container.innerHTML = `
                <div class="dashboard-card" style="border-top:5px solid red; text-align:center;">
                    <h2 style="color:red">Bloquejat ⛔</h2>
                    <p>Has esgotat els 2 intents permesos.</p>
                    <button class="btn-primary" onclick="window.location.href='mailto:sicap@sicap.cat'">Contactar Secretaria</button>
                </div>`;
             return;
        }

        container.innerHTML = `
            <div class="dashboard-card" style="text-align:center; padding: 40px;">
                <h2>📝 Test d'Avaluació: ${mod.titol}</h2>
                <p style="font-size:1.1rem; margin-top:10px;">Estàs a punt de començar l'avaluació d'aquest mòdul.</p>
                
                <div style="display:inline-block; text-align:left; background:#f8f9fa; padding:20px; border-radius:8px; margin:20px 0;">
                    <p><i class="fa-solid fa-circle-check" style="color:green"></i> <strong>Aprovat:</strong> 70% d'encerts o més.</p>
                    <p><i class="fa-solid fa-clock"></i> <strong>Temps:</strong> El temps quedarà registrat.</p>
                    <p><i class="fa-solid fa-rotate-right"></i> <strong>Intent:</strong> ${progreso.intentos + 1} de 2.</p>
                </div>

                <br>
                <button class="btn-primary" style="max-width:300px; font-size:1.2rem;" onclick="iniciarTest()">
                    COMENÇAR EL TEST
                </button>
            </div>
        `;
    }

    window.iniciarTest = function() {
        state.testEnCurso = true;
        state.testStartTime = Date.now();
        renderMainContent(); 
    }

    function renderTestQuestions(container, mod, modIdx) {
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; 

        if (!mod.preguntes || mod.preguntes.length === 0) {
            container.innerHTML = '<p>No hi ha preguntes.</p>'; return;
        }

        // Grid Derecho
        mod.preguntes.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.id = `grid-q-${i}`;
            div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-q-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            gridRight.appendChild(div);
        });

        let html = `<h3>Test en Curs...</h3>`;
        mod.preguntes.forEach((preg, idx) => {
            const qId = `q-${idx}`;
            html += `
                <div class="question-card" id="card-${qId}">
                    <div class="q-header">Pregunta ${idx + 1}</div>
                    <div class="q-text">${preg.text}</div>
                    <div class="options-list">
            `;
            preg.opcions.forEach((opt, oIdx) => {
                html += `
                    <div class="option-item" onclick="selectTestOption('${qId}', ${oIdx})">
                        <input type="radio" name="${qId}" value="${oIdx}">
                        <span>${opt.text}</span>
                    </div>
                `;
            });
            html += `</div></div>`;
        });

        html += `
            <div style="text-align:center; margin-top:30px; padding-bottom:50px;">
                <button class="btn-primary" onclick="entregarTest(${modIdx})">FINALITZAR I ENTREGAR</button>
            </div>`;
        
        container.innerHTML = html;
        window.currentQuestions = mod.preguntes;
    }

    window.selectTestOption = function(qId, valIdx) {
        state.respuestasTemp[qId] = valIdx;
        // Visual card
        const card = document.getElementById(`card-${qId}`);
        card.querySelectorAll('.option-item').forEach((el, idx) => {
            if (idx === valIdx) { el.classList.add('selected'); el.querySelector('input').checked = true; } 
            else { el.classList.remove('selected'); el.querySelector('input').checked = false; }
        });
        // Visual grid
        const gridIdx = qId.split('-')[1];
        const gridItem = document.getElementById(`grid-q-${gridIdx}`);
        if(gridItem) gridItem.classList.add('answered');
    }

    window.entregarTest = async function(modIdx) {
        if (!confirm("Estàs segur? Aquest intent comptarà.")) return;
        
        // Tiempo
        const endTime = Date.now();
        const durationMs = endTime - state.testStartTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(0);
        const tiempoTexto = `${minutes} min ${seconds} s`;

        // Corrección
        const preguntas = window.currentQuestions;
        let aciertos = 0;
        preguntas.forEach((preg, idx) => {
            const qId = `q-${idx}`;
            const userRes = state.respuestasTemp[qId];
            const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta);
            if (userRes === correctaIdx) aciertos++;
        });

        const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2));
        const aprobado = nota >= 7.0;

        // Actualizar Estado
        if (!state.progreso.modulos) state.progreso.modulos = [];
        // Aseguramos que existe el objeto
        if (!state.progreso.modulos[modIdx]) state.progreso.modulos[modIdx] = { intentos: 0, nota: 0, aprobado: false };

        const p = state.progreso;
        p.modulos[modIdx].intentos += 1;
        p.modulos[modIdx].nota = Math.max(p.modulos[modIdx].nota, nota);
        if (aprobado) p.modulos[modIdx].aprobado = true;

        await guardarProgreso(p);

        state.testEnCurso = false; 
        state.respuestasTemp = {}; 

        // Pantalla Resultado
        const container = document.getElementById('moduls-container');
        const color = aprobado ? 'green' : 'red';
        const titulo = aprobado ? 'Test Superat!' : 'No Superat';
        
        container.innerHTML = `
            <div class="dashboard-card" style="border-top:5px solid ${color}; text-align:center;">
                <h2 style="color:${color}">${titulo}</h2>
                <div style="font-size:4rem; font-weight:bold; margin:20px 0;">${nota}</div>
                <p>Temps emprat: <strong>${tiempoTexto}</strong></p>
                <p>${aprobado ? 'Enhorabona! Pots passar al següent mòdul.' : 'Hauràs de tornar-ho a intentar.'}</p>
                <button class="btn-primary" onclick="location.reload()">Continuar</button>
            </div>
        `;
        document.getElementById('quiz-grid').innerHTML = '';
        renderSidebar(); 
    }

    // ------------------------------------------------------------------------
    // 7. EXAMEN FINAL (NUEVA LÓGICA)
    // ------------------------------------------------------------------------
    function renderExamenFinal(container) {
        if (!state.progreso.examen_final) state.progreso.examen_final = { aprobado: false, nota: 0, intentos: 0 };
        const finalData = state.progreso.examen_final;

        if (finalData.aprobado) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;"><h1 style="color:green;">🎉 ENHORABONA!</h1><p>Curs Completat.</p><div style="font-size:3.5rem; font-weight:bold; margin:20px 0; color:var(--brand-blue);">${finalData.nota}</div><button class="btn-primary" onclick="imprimirDiploma('${finalData.nota}')">Descarregar Diploma</button></div>`;
             return;
        }
        if (finalData.intentos >= 2 && !state.godMode) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;"><h2 style="color:red">🚫 Bloquejat</h2><p>Has esgotat els 2 intents.</p><button class="btn-primary" onclick="window.location.href='mailto:sicap@sicap.cat'">Contactar Secretaria</button></div>`;
             return;
        }
        if (state.testEnCurso) {
            renderFinalQuestions(container);
        } else {
            container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;"><h2 style="color:var(--brand-blue);">🏆 Examen Final</h2><p>Preguntes específiques més difícils.</p><div style="background:#f8f9fa; padding:20px; margin:20px 0;"><p>70% per aprovar. Intent ${finalData.intentos + 1} de 2.</p></div><button class="btn-primary" style="max-width:350px; font-size:1.3rem;" onclick="iniciarExamenFinal()">COMENÇAR EXAMEN FINAL</button></div>`;
        }
    }

    window.iniciarExamenFinal = function() {
        // USAMOS LAS PREGUNTAS DEL CAMPO 'EXAMEN_FINAL'
        if (!state.curso.examen_final || state.curso.examen_final.length === 0) {
            alert("Error: No s'han carregat preguntes per l'examen final. Revisa Strapi.");
            return;
        }
        // BARAJAR (SHUFFLE)
        state.preguntasExamenFinal = [...state.curso.examen_final].sort(() => 0.5 - Math.random());
        
        state.testEnCurso = true;
        state.testStartTime = Date.now();
        state.respuestasTemp = {};
        renderMainContent();
    }

    function renderFinalQuestions(container) {
        const gridRight = document.getElementById('quiz-grid'); gridRight.innerHTML = '';
        state.preguntasExamenFinal.forEach((p, i) => { const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-final-q-${i}`; div.innerText = i + 1; div.onclick = () => document.getElementById(`card-final-${i}`).scrollIntoView({behavior:'smooth', block:'center'}); gridRight.appendChild(div); });

        let html = `<h3 style="color:var(--brand-red);">Examen Final en Curs...</h3>`;
        state.preguntasExamenFinal.forEach((preg, idx) => {
            const qId = `final-${idx}`;
            html += `<div class="question-card" id="card-final-${idx}"><div class="q-header" style="background:#333; color:white;">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => { html += `<div class="option-item" onclick="selectFinalOption('${qId}', ${oIdx})"><input type="radio" name="${qId}" value="${oIdx}"><span>${opt.text}</span></div>`; });
            html += `</div></div>`;
        });
        html += `<div style="text-align:center; margin-top:40px; padding-bottom:60px;"><button class="btn-primary" onclick="entregarExamenFinal()">ENTREGAR EXAMEN</button></div>`;
        container.innerHTML = html;
    }

    window.selectFinalOption = function(qId, valIdx) {
        state.respuestasTemp[qId] = valIdx;
        const idx = qId.split('-')[1]; const card = document.getElementById(`card-final-${idx}`);
        card.querySelectorAll('.option-item').forEach((el, i) => { if (i === valIdx) { el.classList.add('selected'); el.querySelector('input').checked = true; } else { el.classList.remove('selected'); el.querySelector('input').checked = false; } });
        document.getElementById(`grid-final-q-${idx}`).classList.add('answered');
    }

    window.entregarExamenFinal = async function() {
        if (!confirm("Segur que vols entregar?")) return;
        const preguntas = state.preguntasExamenFinal; let aciertos = 0;
        preguntas.forEach((preg, idx) => { const qId = `final-${idx}`; const userRes = state.respuestasTemp[qId]; const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta); if (userRes === correctaIdx) aciertos++; });
        
        const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2));
        const aprobado = nota >= 7.0;

        state.progreso.examen_final.intentos += 1;
        state.progreso.examen_final.nota = Math.max(state.progreso.examen_final.nota, nota);
        if (aprobado) state.progreso.examen_final.aprobado = true;

        const payload = { data: { progres_detallat: state.progreso } };
        if (aprobado) { payload.data.estat = 'completat'; payload.data.nota_final = nota; }

        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload)
        });

        state.testEnCurso = false;
        renderExamenFinal(document.getElementById('moduls-container'));
        document.getElementById('quiz-grid').innerHTML = '';
    }

    window.imprimirDiploma = function(nota) {
        const nombreCurso = state.curso.titol; const fechaHoy = new Date().toLocaleDateString('ca-ES'); const alumno = USER;
        const ventana = window.open('', '_blank');
        ventana.document.write(`<html><head><title>Diploma</title><style>body{font-family:'Georgia',serif;text-align:center;padding:40px;}.marco{border:10px double #004B87;padding:50px;height:85vh;display:flex;flex-direction:column;justify-content:center;align-items:center;}h1{color:#004B87;font-size:3rem;}h2{font-size:2.2rem;}p{font-size:1.2rem;}.firmas{margin-top:60px;display:flex;justify-content:space-around;width:100%;}.firma{border-top:1px solid #000;width:250px;padding-top:10px;}</style></head><body><div class="marco"><img src="img/logo-sicap.png" style="max-width:180px;"><h1>CERTIFICAT D'APROFITAMENT</h1><p>SICAP certifica que</p><h3>${alumno.nombre} ${alumno.apellidos || ''}</h3><p>ha superat el curs:</p><h2>${nombreCurso}</h2><p>Nota: ${nota} | Data: ${fechaHoy}</p><div class="firmas"><div class="firma">Secretari General</div><div class="firma">Secretari de Formació</div></div></div><script>window.onload=function(){window.print();}</script></body></html>`);
        ventana.document.close();
    };
});