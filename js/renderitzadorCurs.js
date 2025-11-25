document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // CONFIGURACIÓN Y ESTADO
    // ------------------------------------------------------------------------
    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');
    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');

    // Estado de la aplicación
    let state = {
        matriculaId: null,
        curso: null,
        progreso: {}, // Aquí guardamos el JSON de Strapi
        currentModuleIndex: 0,
        currentView: 'teoria', // teoria | flashcards | test | examen_final
        respuestasTemp: {} // Respuestas del test actual
    };

    // ------------------------------------------------------------------------
    // INICIALIZACIÓN
    // ------------------------------------------------------------------------
    if (!SLUG) return;
    if (!USER || !TOKEN) {
        alert("Sessió caducada.");
        window.location.href = 'index.html';
        return;
    }

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
    // LÓGICA DE DATOS (STRAPI)
    // ------------------------------------------------------------------------
    async function cargarDatos() {
        // Query completa
        const query = [
            `filters[users_permissions_user][id][$eq]=${USER.id}`,
            `filters[curs][slug][$eq]=${SLUG}`,
            `populate[curs][populate][moduls][populate][preguntes][populate][opcions]=true`, 
            `populate[curs][populate][moduls][populate][material_pdf]=true`,
            `populate[curs][populate][moduls][populate][targetes_memoria]=true`,
            `populate[curs][populate][imatge]=true`
        ].join('&');

        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const json = await res.json();

        if (!json.data || json.data.length === 0) throw new Error("No estàs matriculat.");

        const mat = json.data[0];
        state.matriculaId = mat.documentId || mat.id;
        state.curso = mat.curs;
        
        // Cargamos el progreso (JSON) o un objeto vacío si es null
        state.progreso = mat.progres_detallat || {};
    }

    async function inicializarProgresoEnStrapi() {
        // Estructura base del JSON
        const nuevoProgreso = {
            modulos: state.curso.moduls.map(() => ({
                aprobado: false,
                nota: 0,
                intentos: 0,
                bloqueado: false // El primero estará desbloqueado por lógica, el resto dependerá
            })),
            examen_final: {
                aprobado: false,
                nota: 0,
                intentos: 0
            }
        };
        
        // Guardar en Strapi
        await guardarProgreso(nuevoProgreso);
        state.progreso = nuevoProgreso;
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
    // LÓGICA DE BLOQUEOS (CORE)
    // ------------------------------------------------------------------------
    function estaBloqueado(indexModulo) {
        if (indexModulo === 0) return false; // El primero siempre abierto
        // El módulo N está bloqueado si el N-1 no está aprobado
        const moduloAnterior = state.progreso.modulos[indexModulo - 1];
        return !moduloAnterior.aprobado;
    }

    function puedeHacerExamenFinal() {
        // Todos los módulos deben estar aprobados
        return state.progreso.modulos.every(m => m.aprobado === true);
    }

    // ------------------------------------------------------------------------
    // RENDERIZADO SIDEBAR (MENÚ)
    // ------------------------------------------------------------------------
    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        const tituloEl = document.getElementById('curs-titol');
        if(tituloEl) tituloEl.innerText = state.curso.titol;

        let html = '';
        
        // 1. MÓDULOS
        state.curso.moduls.forEach((mod, idx) => {
            const isLocked = estaBloqueado(idx);
            const lockIcon = isLocked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-regular fa-folder-open"></i>';
            const statusColor = state.progreso.modulos && state.progreso.modulos[idx].aprobado ? 'color:green;' : '';
            const check = state.progreso.modulos && state.progreso.modulos[idx].aprobado ? '<i class="fa-solid fa-check"></i>' : '';

            html += `
                <div class="sidebar-module-group">
                    <span class="sidebar-module-title" style="${statusColor}">
                        ${lockIcon} ${mod.titol} ${check}
                    </span>
                    <div class="sidebar-sub-menu">
            `;

            // Sub-item: Teoría
            html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);
            
            // Sub-item: Flashcards (Solo si tiene)
            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                html += renderSubLink(idx, 'flashcards', '🔄 Targetes de Repàs', isLocked);
            }

            // Sub-item: Test
            const intentos = state.progreso.modulos[idx].intentos || 0;
            html += renderSubLink(idx, 'test', `📝 Test Avaluació (${intentos}/2)`, isLocked);

            html += `</div></div>`;
        });

        // 2. BLOQUE FINAL
        const finalLocked = !puedeHacerExamenFinal();
        html += `
            <div class="sidebar-module-group" style="margin-top:20px; border-top:2px solid var(--brand-blue);">
                <span class="sidebar-module-title">🎓 Avaluació Final</span>
                ${renderSubLink(999, 'examen_final', '🏆 Examen Final i Diploma', finalLocked)}
            </div>
        `;

        indexContainer.innerHTML = html;
    }

    function renderSubLink(modIdx, viewName, label, locked) {
        // Clase active
        let isActive = false;
        if (modIdx === state.currentModuleIndex && state.currentView === viewName) isActive = true;
        if (modIdx === 999 && state.currentView === 'examen_final') isActive = true;

        const lockedClass = locked ? 'locked' : '';
        const activeClass = isActive ? 'active' : '';
        const clickFn = locked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;

        return `<div class="sidebar-subitem ${lockedClass} ${activeClass}" onclick="${clickFn}">
                    ${label} ${locked ? '<i class="fa-solid fa-lock" style="font-size:0.7em; margin-left:5px;"></i>' : ''}
                </div>`;
    }

    // Función global para cambiar vista desde el HTML
    window.cambiarVista = function(idx, view) {
        state.currentModuleIndex = idx;
        state.currentView = view;
        state.respuestasTemp = {}; // Limpiar respuestas temp
        renderSidebar(); // Para actualizar active
        renderMainContent();
        window.scrollTo(0,0);
    }

    // ------------------------------------------------------------------------
    // RENDERIZADO CONTENIDO PRINCIPAL
    // ------------------------------------------------------------------------
    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        gridRight.innerHTML = ''; // Limpiar grid lateral por defecto

        // CASO 1: EXAMEN FINAL
        if (state.currentView === 'examen_final') {
            renderExamenFinal(container);
            return;
        }

        // CASOS MÓDULOS
        const mod = state.curso.moduls[state.currentModuleIndex];
        
        if (state.currentView === 'teoria') {
            let html = `<h2>${mod.titol}</h2>`;
            
            // Texto enriquecido corregido
            if (mod.resum) {
                html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
            }

            // Material PDF
            if (mod.material_pdf) {
                const archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
                if(archivos.length > 0) {
                    html += `<div class="materials-section"><span class="materials-title">Material Descarregable</span>`;
                    archivos.forEach(a => {
                        let url = a.url.startsWith('http') ? a.url : `${STRAPI_URL}${a.url}`;
                        html += `<a href="${url}" target="_blank" class="btn-pdf"><i class="fa-solid fa-file-pdf"></i> ${a.name}</a>`;
                    });
                    html += `</div>`;
                }
            }
            container.innerHTML = html;

        } else if (state.currentView === 'flashcards') {
            renderFlashcards(container, mod.targetes_memoria);

        } else if (state.currentView === 'test') {
            renderTest(container, mod, state.currentModuleIndex);
        }
    }

    // ------------------------------------------------------------------------
    // FLASHCARDS (CARRUSEL)
    // ------------------------------------------------------------------------
    function renderFlashcards(container, cards) {
        if (!cards || cards.length === 0) {
            container.innerHTML = '<p>No hi ha targetes.</p>'; return;
        }

        let html = `<h3>Targetes de Repàs</h3><div class="flashcards-wrapper">`;
        
        cards.forEach((card, idx) => {
            // La primera activa, el resto ocultas
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

        // Botones
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

        // Ocultar actual
        document.getElementById(`fc-${window.currentFcIndex}`).classList.remove('active');
        // Mostrar nueva
        document.getElementById(`fc-${newIndex}`).classList.add('active');
        // Actualizar contador
        window.currentFcIndex = newIndex;
        document.getElementById('fc-current').innerText = newIndex + 1;
    }

    // ------------------------------------------------------------------------
    // LÓGICA DE TEST Y EXAMEN
    // ------------------------------------------------------------------------
    function renderTest(container, mod, modIdx) {
        const progresoMod = state.progreso.modulos[modIdx];
        
        // REGLAS DE NEGOCIO
        if (progresoMod.aprobado) {
            container.innerHTML = `
                <div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                    <h2 style="color:green">Mòdul Superat!</h2>
                    <p>Nota obtinguda: <strong>${progresoMod.nota}</strong></p>
                    <p>Ja pots continuar amb el següent mòdul.</p>
                </div>`;
            return;
        }

        if (progresoMod.intentos >= 2) {
            container.innerHTML = `
                <div class="dashboard-card" style="border-top:5px solid red; text-align:center;">
                    <h2 style="color:red">Intents Esgotats</h2>
                    <p>Has superat el màxim de 2 intents sense arribar al 70%.</p>
                    <p><strong>Contacta amb secretaria per desbloquejar el mòdul.</strong></p>
                    <button class="btn-primary" onclick="window.location.href='mailto:sicap@sicap.cat'">Contactar Secretaria</button>
                </div>`;
            return;
        }

        // Renderizar Preguntas
        let html = `
            <h3>Test d'Avaluació (Intent ${progresoMod.intentos + 1} de 2)</h3>
            <p>Necessites un <strong>70%</strong> d'encerts per aprovar.</p>
            <div class="quiz-container">
        `;

        if (!mod.preguntes || mod.preguntes.length === 0) {
            container.innerHTML = '<p>No hi ha preguntes definides.</p>'; return;
        }

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
            <div style="text-align:center; margin-top:30px;">
                <button class="btn-primary" onclick="entregarTest(${modIdx})">Finalitzar Intent</button>
            </div></div>
        `;

        container.innerHTML = html;
        window.currentQuestions = mod.preguntes; // Guardar referencia para corregir
    }

    window.selectTestOption = function(qId, valIdx) {
        state.respuestasTemp[qId] = valIdx;
        const card = document.getElementById(`card-${qId}`);
        card.querySelectorAll('.option-item').forEach((el, idx) => {
            if (idx === valIdx) {
                el.classList.add('selected'); el.querySelector('input').checked = true;
            } else {
                el.classList.remove('selected'); el.querySelector('input').checked = false;
            }
        });
    }

    window.entregarTest = async function(modIdx) {
        if (!confirm("Estàs segur? Aquest intent comptarà.")) return;

        const preguntas = window.currentQuestions;
        let aciertos = 0;

        preguntas.forEach((preg, idx) => {
            const qId = `q-${idx}`;
            const userRes = state.respuestasTemp[qId];
            const correctaIdx = preg.opcions.findIndex(o => o.esCorrecta);
            
            if (userRes === correctaIdx) aciertos++;
        });

        // CALCULAR NOTA (0 a 10)
        const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2));
        const aprobado = nota >= 7.0; // REGLA: 70%

        // ACTUALIZAR PROGRESO
        const progresoActual = state.progreso;
        progresoActual.modulos[modIdx].intentos += 1;
        progresoActual.modulos[modIdx].nota = Math.max(progresoActual.modulos[modIdx].nota, nota); // Guardamos la mejor nota
        if (aprobado) progresoActual.modulos[modIdx].aprobado = true;

        // GUARDAR EN STRAPI
        await guardarProgreso(progresoActual);

        // FEEDBACK
        alert(`Has tret un ${nota}. ${aprobado ? 'Aprovat!' : 'Suspès.'}`);
        renderSidebar(); // Actualizar candados
        renderMainContent(); // Actualizar vista (mostrar aprobado o bloqueo)
    }

    // ------------------------------------------------------------------------
    // EXAMEN FINAL (Simulado para que se entienda la lógica)
    // ------------------------------------------------------------------------
    function renderExamenFinal(container) {
        const finalData = state.progreso.examen_final || { aprobado: false, nota: 0 };

        if (finalData.aprobado) {
             container.innerHTML = `
                <div class="dashboard-card" style="text-align:center;">
                    <h1>🎉 ENHORABONA!</h1>
                    <p>Has completat el curs amb èxit.</p>
                    <button class="btn-primary" onclick="imprimirDiploma('${finalData.nota}')">Descarregar Diploma</button>
                </div>`;
             return;
        }

        // Aquí iría la lógica del examen final (igual que renderTest pero afectando a examen_final)
        // Por simplicidad en este paso, ponemos un botón de "Simular Aprobar" para que pruebes el diploma
        container.innerHTML = `
            <div class="dashboard-card">
                <h2>Examen Final</h2>
                <p>Aquest examen recull preguntes de tots els mòduls.</p>
                <p>Necessites un 70% per aprovar i obtenir el certificat.</p>
                <hr>
                <p><em>(Aquí es renderitzarà el test final quan tinguem preguntes globals)</em></p>
                <button class="btn-primary" onclick="simularAprobarFinal()">Simular Aprobar (Demo)</button>
            </div>
        `;
    }

    window.simularAprobarFinal = async function() {
        const p = state.progreso;
        p.examen_final = { aprobado: true, nota: 9.5, intentos: 1 };
        
        // Actualizamos estado general de matrícula a 'completat'
        const payload = { 
            data: { 
                progres_detallat: p,
                estat: 'completat',
                nota_final: 9.5
            } 
        };

        await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify(payload)
        });

        state.progreso = p;
        renderMainContent();
    }

    // ------------------------------------------------------------------------
    // UTILIDADES
    // ------------------------------------------------------------------------
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.type === 'paragraph' && block.children) {
                    // Soporte básico negritas
                    return `<p>${block.children.map(c => c.bold ? `<b>${c.text}</b>` : c.text).join('')}</p>`;
                }
                if (block.type === 'list') {
                     const tag = block.format === 'ordered' ? 'ol' : 'ul';
                     const items = block.children.map(li => `<li>${li.children[0].text}</li>`).join('');
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

    window.imprimirDiploma = function(nota) {
        const nombreCurso = state.curso.titol;
        const fechaHoy = new Date().toLocaleDateString('ca-ES');
        const alumno = USER;
        const ventana = window.open('', '_blank');
        ventana.document.write(`<html><head><title>Diploma</title><style>body{font-family:'Georgia',serif;text-align:center;padding:40px;}.marco{border:10px double #004B87;padding:50px;height:85vh;display:flex;flex-direction:column;justify-content:center;align-items:center;}h1{color:#004B87;font-size:3rem;}h2{font-size:2.2rem;}p{font-size:1.2rem;}.firmas{margin-top:60px;display:flex;justify-content:space-around;width:100%;}.firma{border-top:1px solid #000;width:250px;padding-top:10px;}</style></head><body><div class="marco"><img src="img/logo-sicap.png" style="max-width:180px;"><h1>CERTIFICAT D'APROFITAMENT</h1><p>SICAP certifica que</p><h3>${alumno.nombre} ${alumno.apellidos || ''}</h3><p>ha superat el curs:</p><h2>${nombreCurso}</h2><p>Nota: ${nota} | Data: ${fechaHoy}</p><div class="firmas"><div class="firma">Secretari General</div><div class="firma">Secretari de Formació</div></div></div><script>window.onload=function(){window.print();}</script></body></html>`);
        ventana.document.close();
    };
});