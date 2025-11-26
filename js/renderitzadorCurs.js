document.addEventListener('DOMContentLoaded', () => {
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');
    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    let state = {
        matriculaId: null, curso: null, progreso: {},
        currentModuleIndex: 0, currentView: 'teoria', 
        respuestasTemp: {}, testStartTime: 0, testEnCurso: false
    };

    if (!SLUG) return;
    if (!USER || !TOKEN) { alert("Sessió caducada."); window.location.href = 'index.html'; return; }

    init();

    async function init() {
        const container = document.getElementById('moduls-container');
        if(container) container.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant curs...</p>';
        try {
            await cargarDatos();
            if (!state.progreso || Object.keys(state.progreso).length === 0) await inicializarProgresoEnStrapi();
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
            `populate[curs][populate][imatge]=true`
        ].join('&');

        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const json = await res.json();
        if (!json.data || json.data.length === 0) throw new Error("No estàs matriculat.");
        
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
        const payload = { data: { progres_detallat: progresoObj } };
        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });
        state.progreso = progresoObj;
    }

    function estaBloqueado(indexModulo) {
        if (indexModulo === 0) return false;
        const moduloAnterior = state.progreso.modulos[indexModulo - 1];
        if (!moduloAnterior) return false; 
        return !moduloAnterior.aprobado;
    }

    function puedeHacerExamenFinal() {
        if (!state.progreso.modulos) return false;
        return state.progreso.modulos.every(m => m.aprobado === true);
    }

    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        const tituloEl = document.getElementById('curs-titol');
        if(tituloEl) tituloEl.innerText = state.curso.titol;

        let html = '';
        state.curso.moduls.forEach((mod, idx) => {
            const isLocked = estaBloqueado(idx);
            const lockIcon = isLocked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-regular fa-folder-open"></i>';
            
            const modProgreso = state.progreso.modulos ? state.progreso.modulos[idx] : null;
            const statusColor = modProgreso && modProgreso.aprobado ? 'color:green;' : '';
            const check = modProgreso && modProgreso.aprobado ? '<i class="fa-solid fa-check"></i>' : '';

            html += `<div class="sidebar-module-group">
                    <span class="sidebar-module-title" style="${statusColor}">${lockIcon} ${mod.titol} ${check}</span>
                    <div class="sidebar-sub-menu">`;
            
            html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);
            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                html += renderSubLink(idx, 'flashcards', '🔄 Targetes de Repàs', isLocked);
            }
            const intentos = modProgreso ? modProgreso.intentos : 0;
            html += renderSubLink(idx, 'test', `📝 Test Avaluació (${intentos}/2)`, isLocked);
            html += `</div></div>`;
        });

        const finalLocked = !puedeHacerExamenFinal();
        html += `<div class="sidebar-module-group" style="margin-top:20px; border-top:2px solid var(--brand-blue);">
                <span class="sidebar-module-title">🎓 Avaluació Final</span>
                ${renderSubLink(999, 'examen_final', '🏆 Examen Final i Diploma', finalLocked)}
            </div>`;
        indexContainer.innerHTML = html;
    }

    function renderSubLink(modIdx, viewName, label, locked) {
        let isActive = (modIdx === state.currentModuleIndex && state.currentView === viewName) || (modIdx === 999 && state.currentView === 'examen_final');
        const clickFn = locked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;
        return `<div class="sidebar-subitem ${locked ? 'locked' : ''} ${isActive ? 'active' : ''}" onclick="${clickFn}">
                    ${label} ${locked ? '🔒' : ''}
                </div>`;
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

    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; 

        if (state.currentView === 'examen_final') { renderExamenFinal(container); return; }

        const mod = state.curso.moduls[state.currentModuleIndex];
        if (state.currentView === 'teoria') renderTeoria(container, mod);
        else if (state.currentView === 'flashcards') renderFlashcards(container, mod.targetes_memoria);
        else if (state.currentView === 'test') {
            if (state.testEnCurso) renderTestQuestions(container, mod, state.currentModuleIndex);
            else renderTestIntro(container, mod, state.currentModuleIndex);
        }
    }

    function renderTeoria(container, mod) {
        let html = `<h2>${mod.titol}</h2>`;
        if (mod.resum) html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
        
        if (mod.material_pdf) {
            const archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
            if(archivos.length > 0) {
                html += `<div class="materials-section"><span class="materials-title">Material Descarregable</span>`;
                archivos.forEach(a => {
                    // --- LÓGICA ROBUSTA PARA URL PDF ---
                    let pdfUrl = a.url;
                    // Si NO es Cloudinary (no empieza por http), es ruta relativa de Koyeb
                    if (!pdfUrl.startsWith('http')) {
                        try {
                            const dominioBase = new URL(STRAPI_URL).origin; // Saca https://...koyeb.app (sin /api)
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
        if (!cards || cards.length === 0) { container.innerHTML = '<p>No hi ha targetes.</p>'; return; }
        let html = `<h3>Targetes de Repàs</h3><div class="flashcards-wrapper">`;
        cards.forEach((card, idx) => {
            html += `<div class="flashcard-slide ${idx===0?'active':''}" id="fc-${idx}">
                    <div class="flashcard" onclick="this.classList.toggle('flipped')">
                        <div class="flashcard-inner">
                            <div class="flashcard-front"><h4>${card.pregunta}</h4><small>Clica per girar</small></div>
                            <div class="flashcard-back"><p>${card.resposta}</p></div>
                        </div></div></div>`;
        });
        html += `<button class="carousel-btn carousel-prev" onclick="moveCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button>
                 <button class="carousel-btn carousel-next" onclick="moveCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>
                 <div class="carousel-counter"><span id="fc-current">1</span> / ${cards.length}</div></div>`;
        container.innerHTML = html;
        window.currentFcIndex = 0; window.totalFc = cards.length;
    }

    window.moveCarousel = function(dir) {
        const newIndex = window.currentFcIndex + dir;
        if (newIndex < 0 || newIndex >= window.totalFc) return;
        document.getElementById(`fc-${window.currentFcIndex}`).classList.remove('active');
        document.getElementById(`fc-${newIndex}`).classList.add('active');
        window.currentFcIndex = newIndex;
        document.getElementById('fc-current').innerText = newIndex + 1;
    }

    function renderTestIntro(container, mod, modIdx) {
        const progreso = state.progreso.modulos[modIdx] || { aprobado: false, intentos: 0, nota: 0 };
        
        if (progreso.aprobado) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                <h2 style="color:green">Mòdul Superat! ✅</h2>
                <div style="font-size:3rem; margin:20px 0;">${progreso.nota}</div>
                <p>Ja has aprovat aquest test. Pots continuar.</p>
             </div>`;
             return;
        }
        if (progreso.intentos >= 2) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;">
                <h2 style="color:red">Bloquejat ⛔</h2>
                <p>Has esgotat els 2 intents permesos.</p>
                <button class="btn-primary" onclick="window.location.href='mailto:sicap@sicap.cat'">Contactar Secretaria</button>
             </div>`;
             return;
        }
        container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;">
                <h2>📝 Test d'Avaluació: ${mod.titol}</h2>
                <div style="display:inline-block; text-align:left; background:#f8f9fa; padding:20px; border-radius:8px; margin:20px 0;">
                    <p><i class="fa-solid fa-circle-check" style="color:green"></i> <strong>Aprovat:</strong> 70% d'encerts.</p>
                    <p><i class="fa-solid fa-rotate-right"></i> <strong>Intent:</strong> ${progreso.intentos + 1} de 2.</p>
                </div><br>
                <button class="btn-primary" style="max-width:300px; font-size:1.2rem;" onclick="iniciarTest()">COMENÇAR EL TEST</button>
            </div>`;
    }

    window.iniciarTest = function() { state.testEnCurso = true; state.testStartTime = Date.now(); renderMainContent(); }

    function renderTestQuestions(container, mod, modIdx) {
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = '';
        if (!mod.preguntes || mod.preguntes.length === 0) { container.innerHTML = '<p>No hi ha preguntes.</p>'; return; }

        mod.preguntes.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'grid-item'; div.id = `grid-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-q-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            gridRight.appendChild(div);
        });

        let html = `<h3>Test en Curs...</h3>`;
        mod.preguntes.forEach((preg, idx) => {
            const qId = `q-${idx}`;
            html += `<div class="question-card" id="card-${qId}"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                html += `<div class="option-item" onclick="selectTestOption('${qId}', ${oIdx})"><input type="radio" name="${qId}" value="${oIdx}"><span>${opt.text}</span></div>`;
            });
            html += `</div></div>`;
        });
        html += `<div style="text-align:center; margin-top:30px; padding-bottom:50px;"><button class="btn-primary" onclick="entregarTest(${modIdx})">FINALITZAR I ENTREGAR</button></div>`;
        container.innerHTML = html;
        window.currentQuestions = mod.preguntes;
    }

    window.selectTestOption = function(qId, valIdx) {
        state.respuestasTemp[qId] = valIdx;
        const card = document.getElementById(`card-${qId}`);
        card.querySelectorAll('.option-item').forEach((el, idx) => {
            if (idx === valIdx) { el.classList.add('selected'); el.querySelector('input').checked = true; } 
            else { el.classList.remove('selected'); el.querySelector('input').checked = false; }
        });
        const gridIdx = qId.split('-')[1];
        const gridItem = document.getElementById(`grid-q-${gridIdx}`);
        if(gridItem) gridItem.classList.add('answered');
    }

    window.entregarTest = async function(modIdx) {
        if (!confirm("Estàs segur? Aquest intent comptarà.")) return;
        const durationMs = Date.now() - state.testStartTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(0);
        const tiempoTexto = `${minutes} min ${seconds} s`;

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

        if (!state.progreso.modulos) state.progreso.modulos = [];
        if (!state.progreso.modulos[modIdx]) state.progreso.modulos[modIdx] = { intentos: 0, nota: 0, aprobado: false };

        const p = state.progreso;
        p.modulos[modIdx].intentos += 1;
        p.modulos[modIdx].nota = Math.max(p.modulos[modIdx].nota, nota);
        if (aprobado) p.modulos[modIdx].aprobado = true;

        await guardarProgreso(p);
        state.testEnCurso = false; state.respuestasTemp = {}; 

        const container = document.getElementById('moduls-container');
        const color = aprobado ? 'green' : 'red';
        container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid ${color}; text-align:center;">
            <h2 style="color:${color}">${aprobado ? 'Test Superat!' : 'No Superat'}</h2>
            <div style="font-size:4rem; font-weight:bold; margin:20px 0;">${nota}</div>
            <p>Temps emprat: <strong>${tiempoTexto}</strong></p>
            <button class="btn-primary" onclick="location.reload()">Continuar</button>
        </div>`;
        document.getElementById('quiz-grid').innerHTML = '';
        renderSidebar(); 
    }

    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.type === 'paragraph' && block.children) return `<p>${block.children.map(c => c.bold ? `<b>${c.text}</b>` : c.text).join('')}</p>`;
                if (block.type === 'list') {
                     const tag = block.format === 'ordered' ? 'ol' : 'ul';
                     const items = block.children.map(li => `<li>${li.children[0].text}</li>`).join('');
                     return `<${tag}>${items}</${tag}>`;
                }
                if (block.type === 'heading') return `<h${block.level}>${block.children[0].text}</h${block.level}>`;
                return '';
            }).join('');
        }
        return '';
    }

    function renderExamenFinal(container) {
        container.innerHTML = '<div class="dashboard-card"><h3>Examen Final en construcción...</h3></div>';
    }
});